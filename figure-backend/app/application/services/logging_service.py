"""
로깅 애플리케이션 서비스
헥사고날 아키텍처 - Application Layer
"""
import logging
import uuid
from typing import Any, Dict, Optional
from datetime import datetime

from app.domain.repositories.logging_repository import (
    LoggingRepository, 
    LogLevel, 
    LogContext, 
    LogEntry
)

logger = logging.getLogger(__name__)

class LoggingService:
    """로깅 애플리케이션 서비스"""
    
    def __init__(self, logging_repository: LoggingRepository):
        self.logging_repo = logging_repository
    
    async def create_context(
        self,
        request_id: Optional[str] = None,
        user_id: Optional[str] = None,
        session_id: Optional[str] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        endpoint: Optional[str] = None,
        method: Optional[str] = None,
        **additional_context: Any
    ) -> LogContext:
        """로그 컨텍스트 생성"""
        if not request_id:
            request_id = str(uuid.uuid4())
        
        return LogContext(
            request_id=request_id,
            user_id=user_id,
            session_id=session_id,
            ip_address=ip_address,
            user_agent=user_agent,
            endpoint=endpoint,
            method=method,
            **additional_context
        )
    
    async def log_api_call_start(
        self,
        context: LogContext,
        request_body: Optional[Dict[str, Any]] = None
    ) -> None:
        """API 호출 시작 로깅"""
        try:
            await self.logging_repo.log_api_request(context, request_body)
            logger.info(f"API 요청 시작: {context.method} {context.endpoint} [ID: {context.request_id}]")
        except Exception as e:
            logger.error(f"API 요청 로깅 실패: {e}")
    
    async def log_api_call_end(
        self,
        context: LogContext,
        response_body: Optional[Dict[str, Any]] = None,
        status_code: int = 200,
        duration_ms: float = 0.0
    ) -> None:
        """API 호출 종료 로깅"""
        try:
            await self.logging_repo.log_api_response(
                context, response_body, status_code, duration_ms
            )
            logger.info(
                f"API 응답 완료: {context.method} {context.endpoint} "
                f"[ID: {context.request_id}] [{status_code}] [{duration_ms:.2f}ms]"
            )
        except Exception as e:
            logger.error(f"API 응답 로깅 실패: {e}")
    
    async def log_error(
        self,
        context: LogContext,
        exception: Exception,
        additional_info: Optional[Dict[str, Any]] = None
    ) -> None:
        """에러 로깅"""
        try:
            await self.logging_repo.log_error(context, exception, additional_info)
            logger.error(
                f"API 에러 발생: {context.method} {context.endpoint} "
                f"[ID: {context.request_id}] - {str(exception)}"
            )
        except Exception as e:
            logger.error(f"에러 로깅 실패: {e}")
    
    async def log_business_event(
        self,
        context: LogContext,
        event_name: str,
        event_data: Optional[Dict[str, Any]] = None,
        level: LogLevel = LogLevel.INFO
    ) -> None:
        """비즈니스 이벤트 로깅"""
        try:
            entry = LogEntry(
                level=level,
                message=f"비즈니스 이벤트: {event_name}",
                context=context,
                request_body=event_data
            )
            await self.logging_repo.log(entry)
            logger.info(f"비즈니스 이벤트: {event_name} [ID: {context.request_id}]")
        except Exception as e:
            logger.error(f"비즈니스 이벤트 로깅 실패: {e}")
    
    async def get_request_logs(
        self,
        request_id: str
    ) -> list[LogEntry]:
        """특정 요청의 모든 로그 조회"""
        try:
            return await self.logging_repo.get_logs(request_id=request_id)
        except Exception as e:
            logger.error(f"로그 조회 실패: {e}")
            return []
