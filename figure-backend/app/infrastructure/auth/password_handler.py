"""
Password Hashing Handler
패스워드 해싱 및 검증을 담당하는 인프라스트럭처 컴포넌트
"""
from passlib.context import CryptContext
import logging

logger = logging.getLogger(__name__)

class PasswordHandler:
    """패스워드 해싱 처리 클래스"""
    
    def __init__(self):
        # bcrypt를 사용한 패스워드 해싱 컨텍스트
        self.pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    
    def hash_password(self, password: str) -> str:
        """패스워드 해싱"""
        try:
            hashed = self.pwd_context.hash(password)
            logger.debug("패스워드 해싱 완료")
            return hashed
        except Exception as e:
            logger.error(f"패스워드 해싱 실패: {e}")
            raise
    
    def verify_password(self, plain_password: str, hashed_password: str) -> bool:
        """패스워드 검증"""
        try:
            result = self.pwd_context.verify(plain_password, hashed_password)
            logger.debug(f"패스워드 검증 결과: {result}")
            return result
        except Exception as e:
            logger.error(f"패스워드 검증 실패: {e}")
            return False
    
    def needs_update(self, hashed_password: str) -> bool:
        """패스워드 해시 업데이트 필요 여부 확인"""
        try:
            return self.pwd_context.needs_update(hashed_password)
        except Exception as e:
            logger.error(f"패스워드 해시 상태 확인 실패: {e}")
            return False

# 싱글톤 인스턴스
password_handler = PasswordHandler() 