"""
로깅 어댑터 구현체
헥사고날 아키텍처 - Infrastructure Layer
"""
import json
import logging
from typing import Any, Dict, Optional, List
from datetime import datetime
import asyncio
from pathlib import Path

from app.domain.repositories.logging_repository import (
    LoggingRepository,
    LogLevel,
    LogContext,
    LogEntry
)

logger = logging.getLogger(__name__)

class FileLoggingAdapter(LoggingRepository):
    """파일 기반 로깅 어댑터"""
    
    def __init__(self, log_directory: str = "logs"):
        self.log_directory = Path(log_directory)
        self.log_directory.mkdir(exist_ok=True)
        self._setup_file_handlers()
    
    def _setup_file_handlers(self):
        """파일 핸들러 설정"""
        # API 로그 파일
        self.api_log_file = self.log_directory / "api.log"
        self.error_log_file = self.log_directory / "error.log"
        self.business_log_file = self.log_directory / "business.log"
    
    def _format_log_entry(self, entry: LogEntry) -> str:
        """로그 엔트리 포맷팅"""
        log_data = {
            "timestamp": entry.timestamp.isoformat(),
            "level": entry.level.value,
            "message": entry.message,
            "request_id": entry.context.request_id,
            "user_id": entry.context.user_id,
            "endpoint": entry.context.endpoint,
            "method": entry.context.method,
            "ip_address": entry.context.ip_address,
            "duration_ms": entry.duration_ms,
            "status_code": entry.status_code
        }
        
        if entry.request_body:
            log_data["request_body"] = self._sanitize_sensitive_data(entry.request_body)
        
        if entry.response_body:
            log_data["response_body"] = self._sanitize_sensitive_data(entry.response_body)
        
        if entry.exception:
            log_data["exception"] = {
                "type": type(entry.exception).__name__,
                "message": str(entry.exception),
                "traceback": str(entry.exception.__traceback__) if entry.exception.__traceback__ else None
            }
        
        return json.dumps(log_data, ensure_ascii=False, default=str)
    
    def _sanitize_sensitive_data(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """민감한 데이터 마스킹"""
        if not isinstance(data, dict):
            return data
        
        sensitive_keys = {"password", "token", "secret", "key", "authorization"}
        sanitized = {}
        
        for key, value in data.items():
            if any(sensitive_key in key.lower() for sensitive_key in sensitive_keys):
                sanitized[key] = "***MASKED***"
            elif isinstance(value, dict):
                sanitized[key] = self._sanitize_sensitive_data(value)
            else:
                sanitized[key] = value
        
        return sanitized
    
    async def _write_to_file(self, file_path: Path, content: str):
        """비동기 파일 쓰기"""
        try:
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(
                None,
                lambda: file_path.open("a", encoding="utf-8").write(content + "\n")
            )
        except Exception as e:
            logger.error(f"파일 쓰기 실패 {file_path}: {e}")
    
    async def log(self, entry: LogEntry) -> None:
        """로그 기록"""
        formatted_log = self._format_log_entry(entry)
        
        # 레벨에 따라 적절한 파일에 기록
        if entry.level in [LogLevel.ERROR, LogLevel.CRITICAL]:
            await self._write_to_file(self.error_log_file, formatted_log)
        
        # 모든 API 관련 로그는 api.log에도 기록
        if entry.context.endpoint:
            await self._write_to_file(self.api_log_file, formatted_log)
        else:
            await self._write_to_file(self.business_log_file, formatted_log)
    
    async def log_api_request(
        self,
        context: LogContext,
        request_body: Optional[Dict[str, Any]] = None
    ) -> None:
        """API 요청 로깅"""
        entry = LogEntry(
            level=LogLevel.INFO,
            message=f"API 요청: {context.method} {context.endpoint}",
            context=context,
            request_body=request_body
        )
        await self.log(entry)
    
    async def log_api_response(
        self,
        context: LogContext,
        response_body: Optional[Dict[str, Any]] = None,
        status_code: int = 200,
        duration_ms: float = 0.0
    ) -> None:
        """API 응답 로깅"""
        level = LogLevel.ERROR if status_code >= 400 else LogLevel.INFO
        entry = LogEntry(
            level=level,
            message=f"API 응답: {context.method} {context.endpoint}",
            context=context,
            response_body=response_body,
            status_code=status_code,
            duration_ms=duration_ms
        )
        await self.log(entry)
    
    async def log_error(
        self,
        context: LogContext,
        exception: Exception,
        additional_info: Optional[Dict[str, Any]] = None
    ) -> None:
        """에러 로깅"""
        entry = LogEntry(
            level=LogLevel.ERROR,
            message=f"에러 발생: {str(exception)}",
            context=context,
            exception=exception,
            request_body=additional_info
        )
        await self.log(entry)
    
    async def get_logs(
        self,
        request_id: Optional[str] = None,
        user_id: Optional[str] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        level: Optional[LogLevel] = None,
        limit: int = 100
    ) -> List[LogEntry]:
        """로그 조회 (파일 기반이므로 제한적 구현)"""
        # 실제 구현에서는 로그 파일을 파싱하거나 DB를 사용
        # 여기서는 기본 구현만 제공
        logger.warning("파일 기반 로그 조회는 제한적으로 구현됨")
        return []

class DatabaseLoggingAdapter(LoggingRepository):
    """데이터베이스 기반 로깅 어댑터 (향후 구현)"""
    
    def __init__(self, db_connection):
        self.db = db_connection
        # TODO: 데이터베이스 테이블 초기화
    
    async def log(self, entry: LogEntry) -> None:
        """데이터베이스에 로그 저장"""
        # TODO: 데이터베이스 구현
        pass
    
    async def log_api_request(self, context: LogContext, request_body: Optional[Dict[str, Any]] = None) -> None:
        pass
    
    async def log_api_response(self, context: LogContext, response_body: Optional[Dict[str, Any]] = None, status_code: int = 200, duration_ms: float = 0.0) -> None:
        pass
    
    async def log_error(self, context: LogContext, exception: Exception, additional_info: Optional[Dict[str, Any]] = None) -> None:
        pass
    
    async def get_logs(self, request_id: Optional[str] = None, user_id: Optional[str] = None, start_time: Optional[datetime] = None, end_time: Optional[datetime] = None, level: Optional[LogLevel] = None, limit: int = 100) -> List[LogEntry]:
        return []
