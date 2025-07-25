"""
Authentication API Endpoints
인증과 관련된 RESTful API 엔드포인트
"""
from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPAuthorizationCredentials

from app.domain.entities.schemas import APIResponse
from app.domain.entities.auth_schemas import (
    LoginRequest, LoginResponse, RefreshTokenRequest, 
    UserInfo, UserCreate
)
from app.application.services.auth_service import auth_service
from app.infrastructure.auth.dependencies import (
    get_current_active_user, get_current_admin_user, security
)
from app.infrastructure.persistence.models import User
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["authentication"])

@router.post("/login", response_model=APIResponse[LoginResponse])
async def login(login_request: LoginRequest):
    """사용자 로그인"""
    try:
        login_response = auth_service.login(login_request)
        
        return APIResponse(
            success=True,
            message="로그인 성공",
            data=login_response
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"로그인 처리 중 오류: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="로그인 처리 중 오류가 발생했습니다"
        )

@router.post("/refresh", response_model=APIResponse[LoginResponse])
async def refresh_token(refresh_request: RefreshTokenRequest):
    """액세스 토큰 갱신"""
    try:
        login_response = auth_service.refresh_token(refresh_request)
        
        return APIResponse(
            success=True,
            message="토큰 갱신 성공",
            data=login_response
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"토큰 갱신 처리 중 오류: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="토큰 갱신 처리 중 오류가 발생했습니다"
        )

@router.post("/logout")
async def logout(current_user: User = Depends(get_current_active_user)):
    """사용자 로그아웃"""
    try:
        # 현재는 클라이언트에서 토큰을 삭제하는 방식
        # 향후 토큰 블랙리스트 기능 추가 가능
        logger.info(f"사용자 로그아웃: {current_user.username}")
        
        return APIResponse(
            success=True,
            message="로그아웃 되었습니다",
            data=None
        )
        
    except Exception as e:
        logger.error(f"로그아웃 처리 중 오류: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="로그아웃 처리 중 오류가 발생했습니다"
        )

@router.get("/me", response_model=APIResponse[UserInfo])
async def get_current_user_info(current_user: User = Depends(get_current_active_user)):
    """현재 사용자 정보 조회"""
    try:
        user_info = UserInfo(
            id=current_user.id,
            username=current_user.username,
            email=current_user.email,
            full_name=current_user.full_name,
            role=current_user.role,
            is_active=current_user.is_active,
            created_at=current_user.created_at,
            last_login=current_user.last_login
        )
        
        return APIResponse(
            success=True,
            message="사용자 정보 조회 성공",
            data=user_info
        )
        
    except Exception as e:
        logger.error(f"사용자 정보 조회 중 오류: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="사용자 정보 조회 중 오류가 발생했습니다"
        )

@router.post("/users", response_model=APIResponse[UserInfo])
async def create_user(
    user_create: UserCreate,
    current_user: User = Depends(get_current_admin_user)
):
    """새 사용자 생성 (관리자 전용)"""
    try:
        user_info = auth_service.create_user(user_create)
        
        logger.info(f"관리자 {current_user.username}가 새 사용자 {user_info.username} 생성")
        
        return APIResponse(
            success=True,
            message="사용자가 성공적으로 생성되었습니다",
            data=user_info
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"사용자 생성 중 오류: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="사용자 생성 중 오류가 발생했습니다"
        )

@router.get("/verify")
async def verify_token(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """토큰 검증"""
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="인증 토큰이 필요합니다",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    try:
        token = credentials.credentials
        user = auth_service.get_current_user(token)
        
        return APIResponse(
            success=True,
            message="유효한 토큰입니다",
            data={
                "user_id": user.id,
                "username": user.username,
                "role": user.role.value,
                "is_active": user.is_active
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"토큰 검증 중 오류: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="유효하지 않은 토큰입니다",
            headers={"WWW-Authenticate": "Bearer"},
        ) 