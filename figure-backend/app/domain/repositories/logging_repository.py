"""
로깅 포트 (인터페이스)
헥사고날 아키텍처 - Domain Layer
"""
from abc import ABC, abstractmethod
from typing import Any, Dict, Optional
from datetime import datetime
from enum import Enum

class LogLevel(Enum):
    """로그 레벨"""
    DEBUG = "DEBUG"
    INFO = "INFO"
    WARNING = "WARNING"
    ERROR = "ERROR"
    CRITICAL = "CRITICAL"

class LogContext:
    """로그 컨텍스트 정보"""
    def __init__(
        self,
        request_id: str,
        user_id: Optional[str] = None,
        session_id: Optional[str] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        endpoint: Optional[str] = None,
        method: Optional[str] = None,
        **additional_context: Any
    ):
        self.request_id = request_id
        self.user_id = user_id
        self.session_id = session_id
        self.ip_address = ip_address
        self.user_agent = user_agent
        self.endpoint = endpoint
        self.method = method
        self.additional_context = additional_context
        self.timestamp = datetime.utcnow()

class LogEntry:
    """로그 엔트리"""
    def __init__(
        self,
        level: LogLevel,
        message: str,
        context: LogContext,
        exception: Optional[Exception] = None,
        duration_ms: Optional[float] = None,
        request_body: Optional[Dict[str, Any]] = None,
        response_body: Optional[Dict[str, Any]] = None,
        status_code: Optional[int] = None
    ):
        self.level = level
        self.message = message
        self.context = context
        self.exception = exception
        self.duration_ms = duration_ms
        self.request_body = request_body
        self.response_body = response_body
        self.status_code = status_code
        self.timestamp = datetime.utcnow()

class LoggingRepository(ABC):
    """로깅 포트 인터페이스"""
    
    @abstractmethod
    async def log(self, entry: LogEntry) -> None:
        """로그 기록"""
        pass
    
    @abstractmethod
    async def log_api_request(
        self,
        context: LogContext,
        request_body: Optional[Dict[str, Any]] = None
    ) -> None:
        """API 요청 로깅"""
        pass
    
    @abstractmethod
    async def log_api_response(
        self,
        context: LogContext,
        response_body: Optional[Dict[str, Any]] = None,
        status_code: int = 200,
        duration_ms: float = 0.0
    ) -> None:
        """API 응답 로깅"""
        pass
    
    @abstractmethod
    async def log_error(
        self,
        context: LogContext,
        exception: Exception,
        additional_info: Optional[Dict[str, Any]] = None
    ) -> None:
        """에러 로깅"""
        pass
    
    @abstractmethod
    async def get_logs(
        self,
        request_id: Optional[str] = None,
        user_id: Optional[str] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        level: Optional[LogLevel] = None,
        limit: int = 100
    ) -> list[LogEntry]:
        """로그 조회"""
        pass
