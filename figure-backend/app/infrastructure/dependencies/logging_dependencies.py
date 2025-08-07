"""
로깅 의존성 주입
헥사고날 아키텍처 - Infrastructure Layer
"""
from functools import lru_cache
from fastapi import Depends

from app.application.services.logging_service import LoggingService
from app.infrastructure.adapters.logging_adapter import FileLoggingAdapter
from app.infrastructure.middleware.logging_middleware import BusinessEventLogger

# 싱글톤 인스턴스들
_logging_service: LoggingService = None
_business_event_logger: BusinessEventLogger = None

@lru_cache()
def get_logging_adapter() -> FileLoggingAdapter:
    """로깅 어댑터 인스턴스 반환"""
    return FileLoggingAdapter(log_directory="logs")

def get_logging_service() -> LoggingService:
    """로깅 서비스 인스턴스 반환"""
    global _logging_service
    if _logging_service is None:
        logging_adapter = get_logging_adapter()
        _logging_service = LoggingService(logging_adapter)
    return _logging_service

def get_business_event_logger() -> BusinessEventLogger:
    """비즈니스 이벤트 로거 인스턴스 반환"""
    global _business_event_logger
    if _business_event_logger is None:
        logging_service = get_logging_service()
        _business_event_logger = BusinessEventLogger(logging_service)
    return _business_event_logger

# FastAPI 의존성 주입용 함수들
def logging_service_dependency() -> LoggingService:
    """FastAPI 의존성 주입용 로깅 서비스"""
    return get_logging_service()

def business_logger_dependency() -> BusinessEventLogger:
    """FastAPI 의존성 주입용 비즈니스 로거"""
    return get_business_event_logger()
