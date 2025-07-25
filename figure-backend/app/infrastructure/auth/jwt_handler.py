"""
JWT 토큰 처리기
JWT 토큰의 생성, 검증, 디코딩을 담당하는 인프라스트럭처 컴포넌트
"""
import jwt
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from app.config import settings
import logging

logger = logging.getLogger(__name__)

class JWTHandler:
    """JWT 토큰 처리 클래스"""
    
    def __init__(self):
        # 기본 설정값 사용 (실제 환경에서는 환경변수로 설정)
        self.secret_key = getattr(settings, 'jwt_secret_key', 'figure-backend-secret-key-change-in-production')
        self.algorithm = getattr(settings, 'jwt_algorithm', 'HS256')
        self.access_token_expire_minutes = getattr(settings, 'jwt_access_token_expire_minutes', 30)
        self.refresh_token_expire_days = getattr(settings, 'jwt_refresh_token_expire_days', 7)
    
    def create_access_token(self, data: Dict[str, Any]) -> str:
        """액세스 토큰 생성"""
        to_encode = data.copy()
        expire = datetime.utcnow() + timedelta(minutes=self.access_token_expire_minutes)
        to_encode.update({
            "exp": expire,
            "iat": datetime.utcnow(),
            "type": "access"
        })
        
        try:
            encoded_jwt = jwt.encode(to_encode, self.secret_key, algorithm=self.algorithm)
            logger.info(f"액세스 토큰 생성 완료: 사용자 {data.get('sub', 'unknown')}")
            return encoded_jwt
        except Exception as e:
            logger.error(f"액세스 토큰 생성 실패: {e}")
            raise
    
    def create_refresh_token(self, data: Dict[str, Any]) -> str:
        """리프레시 토큰 생성"""
        to_encode = data.copy()
        expire = datetime.utcnow() + timedelta(days=self.refresh_token_expire_days)
        to_encode.update({
            "exp": expire,
            "iat": datetime.utcnow(),
            "type": "refresh"
        })
        
        try:
            encoded_jwt = jwt.encode(to_encode, self.secret_key, algorithm=self.algorithm)
            logger.info(f"리프레시 토큰 생성 완료: 사용자 {data.get('sub', 'unknown')}")
            return encoded_jwt
        except Exception as e:
            logger.error(f"리프레시 토큰 생성 실패: {e}")
            raise
    
    def decode_token(self, token: str) -> Optional[Dict[str, Any]]:
        """토큰 디코딩 및 검증"""
        try:
            payload = jwt.decode(
                token, 
                self.secret_key, 
                algorithms=[self.algorithm]
            )
            
            # 토큰 타입 확인
            token_type = payload.get("type")
            if token_type not in ["access", "refresh"]:
                logger.warning(f"잘못된 토큰 타입: {token_type}")
                return None
            
            logger.debug(f"토큰 디코딩 성공: 사용자 {payload.get('sub', 'unknown')}")
            return payload
            
        except jwt.ExpiredSignatureError:
            logger.warning("토큰이 만료됨")
            return None
        except jwt.JWTError as e:
            logger.warning(f"토큰 검증 실패: {e}")
            return None
        except Exception as e:
            logger.error(f"토큰 디코딩 중 예외 발생: {e}")
            return None
    
    def verify_access_token(self, token: str) -> Optional[Dict[str, Any]]:
        """액세스 토큰 검증"""
        payload = self.decode_token(token)
        if payload and payload.get("type") == "access":
            return payload
        return None
    
    def verify_refresh_token(self, token: str) -> Optional[Dict[str, Any]]:
        """리프레시 토큰 검증"""
        payload = self.decode_token(token)
        if payload and payload.get("type") == "refresh":
            return payload
        return None
    
    def get_token_expiry(self, token: str) -> Optional[datetime]:
        """토큰 만료 시간 반환"""
        payload = self.decode_token(token)
        if payload:
            exp_timestamp = payload.get("exp")
            if exp_timestamp:
                return datetime.fromtimestamp(exp_timestamp)
        return None

# 싱글톤 인스턴스
jwt_handler = JWTHandler() 