"""
Authentication Service
인증과 관련된 비즈니스 로직을 담당하는 애플리케이션 서비스
"""
from datetime import datetime, timedelta
from typing import Optional
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.infrastructure.persistence.connection import get_db_session
from app.infrastructure.persistence.models import User, UserRole
from app.infrastructure.auth.jwt_handler import jwt_handler
from app.infrastructure.auth.password_handler import password_handler
from app.domain.entities.auth_schemas import (
    LoginRequest, LoginResponse, UserInfo, UserCreate, 
    TokenPayload, RefreshTokenRequest
)
import logging

logger = logging.getLogger(__name__)

class AuthService:
    """인증 서비스 클래스"""
    
    def __init__(self):
        self.jwt_handler = jwt_handler
        self.password_handler = password_handler
    
    def authenticate_user(self, username: str, password: str) -> Optional[User]:
        """사용자 인증"""
        try:
            with get_db_session() as db:
                user = db.query(User).filter(User.username == username).first()
                
                if not user:
                    logger.warning(f"존재하지 않는 사용자: {username}")
                    return None
                
                if not user.is_active:
                    logger.warning(f"비활성 사용자 로그인 시도: {username}")
                    return None
                
                if not self.password_handler.verify_password(password, user.hashed_password):
                    logger.warning(f"잘못된 패스워드: {username}")
                    return None
                
                # 마지막 로그인 시간 업데이트
                user.last_login = datetime.utcnow()
                db.commit()
                
                logger.info(f"사용자 인증 성공: {username}")
                return user
                
        except Exception as e:
            logger.error(f"사용자 인증 중 오류: {e}")
            return None
    
    def login(self, login_request: LoginRequest) -> LoginResponse:
        """로그인 처리"""
        user = self.authenticate_user(login_request.username, login_request.password)
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="사용자명 또는 비밀번호가 잘못되었습니다",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        # JWT 토큰 생성
        token_data = {
            "sub": str(user.id),
            "username": user.username,
            "role": user.role.value
        }
        
        access_token = self.jwt_handler.create_access_token(token_data)
        refresh_token = self.jwt_handler.create_refresh_token(token_data)
        
        # 사용자 정보 변환
        user_info = UserInfo(
            id=user.id,
            username=user.username,
            email=user.email,
            full_name=user.full_name,
            role=user.role,
            is_active=user.is_active,
            created_at=user.created_at,
            last_login=user.last_login
        )
        
        return LoginResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            token_type="bearer",
            expires_in=self.jwt_handler.access_token_expire_minutes * 60,
            user=user_info
        )
    
    def refresh_token(self, refresh_request: RefreshTokenRequest) -> LoginResponse:
        """토큰 갱신"""
        payload = self.jwt_handler.verify_refresh_token(refresh_request.refresh_token)
        
        if not payload:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="유효하지 않은 refresh token입니다",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        # 사용자 정보 확인
        try:
            with get_db_session() as db:
                user = db.query(User).filter(User.id == int(payload["sub"])).first()
                
                if not user or not user.is_active:
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="사용자를 찾을 수 없거나 비활성 상태입니다",
                        headers={"WWW-Authenticate": "Bearer"},
                    )
                
                # 새 토큰 생성
                token_data = {
                    "sub": str(user.id),
                    "username": user.username,
                    "role": user.role.value
                }
                
                access_token = self.jwt_handler.create_access_token(token_data)
                new_refresh_token = self.jwt_handler.create_refresh_token(token_data)
                
                # 사용자 정보 변환
                user_info = UserInfo(
                    id=user.id,
                    username=user.username,
                    email=user.email,
                    full_name=user.full_name,
                    role=user.role,
                    is_active=user.is_active,
                    created_at=user.created_at,
                    last_login=user.last_login
                )
                
                return LoginResponse(
                    access_token=access_token,
                    refresh_token=new_refresh_token,
                    token_type="bearer",
                    expires_in=self.jwt_handler.access_token_expire_minutes * 60,
                    user=user_info
                )
                
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"토큰 갱신 중 오류: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="토큰 갱신 중 오류가 발생했습니다"
            )
    
    def get_current_user(self, token: str) -> User:
        """현재 사용자 정보 조회"""
        payload = self.jwt_handler.verify_access_token(token)
        
        if not payload:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="유효하지 않은 토큰입니다",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        try:
            with get_db_session() as db:
                user = db.query(User).filter(User.id == int(payload["sub"])).first()
                
                if not user:
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="사용자를 찾을 수 없습니다",
                        headers={"WWW-Authenticate": "Bearer"},
                    )
                
                if not user.is_active:
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="비활성 사용자입니다",
                        headers={"WWW-Authenticate": "Bearer"},
                    )
                
                return user
                
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"현재 사용자 조회 중 오류: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="사용자 정보 조회 중 오류가 발생했습니다"
            )
    
    def create_user(self, user_create: UserCreate) -> UserInfo:
        """사용자 생성 (관리자용)"""
        try:
            with get_db_session() as db:
                # 중복 사용자명 확인
                existing_user = db.query(User).filter(User.username == user_create.username).first()
                if existing_user:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="이미 존재하는 사용자명입니다"
                    )
                
                # 패스워드 해싱
                hashed_password = self.password_handler.hash_password(user_create.password)
                
                # 사용자 생성
                user = User(
                    username=user_create.username,
                    email=user_create.email,
                    full_name=user_create.full_name,
                    hashed_password=hashed_password,
                    role=user_create.role
                )
                
                db.add(user)
                db.commit()
                db.refresh(user)
                
                logger.info(f"새 사용자 생성: {user.username}")
                
                return UserInfo(
                    id=user.id,
                    username=user.username,
                    email=user.email,
                    full_name=user.full_name,
                    role=user.role,
                    is_active=user.is_active,
                    created_at=user.created_at,
                    last_login=user.last_login
                )
                
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"사용자 생성 중 오류: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="사용자 생성 중 오류가 발생했습니다"
            )
    
    def create_default_admin(self):
        """기본 관리자 계정 생성"""
        try:
            with get_db_session() as db:
                # 기존 관리자 확인
                admin_exists = db.query(User).filter(User.role == UserRole.ADMIN).first()
                
                if not admin_exists:
                    # 기본 관리자 생성
                    hashed_password = self.password_handler.hash_password("admin123!")
                    
                    admin_user = User(
                        username="admin",
                        email="admin@figure.com",
                        full_name="System Administrator",
                        hashed_password=hashed_password,
                        role=UserRole.ADMIN
                    )
                    
                    db.add(admin_user)
                    db.commit()
                    
                    logger.info("기본 관리자 계정 생성 완료: admin / admin123!")
                else:
                    logger.info("관리자 계정이 이미 존재합니다")
                    
        except Exception as e:
            logger.error(f"기본 관리자 생성 중 오류: {e}")

# 싱글톤 인스턴스
auth_service = AuthService() 