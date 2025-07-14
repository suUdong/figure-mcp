"""
Logging utilities for Figure Backend
"""
import logging
import sys
from typing import Optional
from pathlib import Path


def setup_logger(
    name: str,
    level: str = "INFO",
    log_file: Optional[str] = None,
    format_string: Optional[str] = None
) -> logging.Logger:
    """
    로거 설정 유틸리티
    
    Args:
        name: 로거 이름
        level: 로그 레벨 (DEBUG, INFO, WARNING, ERROR, CRITICAL)
        log_file: 로그 파일 경로 (선택사항)
        format_string: 커스텀 포맷 문자열 (선택사항)
    
    Returns:
        설정된 로거 인스턴스
    """
    logger = logging.getLogger(name)
    
    # 기존 핸들러 제거
    for handler in logger.handlers[:]:
        logger.removeHandler(handler)
    
    # 로그 레벨 설정
    logger.setLevel(getattr(logging, level.upper()))
    
    # 포맷 설정
    if format_string is None:
        format_string = (
            "%(asctime)s - %(name)s - %(levelname)s - "
            "%(filename)s:%(lineno)d - %(message)s"
        )
    
    formatter = logging.Formatter(format_string)
    
    # 콘솔 핸들러
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)
    
    # 파일 핸들러 (선택사항)
    if log_file:
        log_path = Path(log_file)
        log_path.parent.mkdir(parents=True, exist_ok=True)
        
        file_handler = logging.FileHandler(log_file, encoding='utf-8')
        file_handler.setFormatter(formatter)
        logger.addHandler(file_handler)
    
    # 전파 방지 (중복 로그 방지)
    logger.propagate = False
    
    return logger


def get_figure_logger(component: str = "main") -> logging.Logger:
    """
    Figure 백엔드용 표준 로거 생성
    
    Args:
        component: 컴포넌트 이름 (rag, vector_store, api 등)
    
    Returns:
        설정된 로거 인스턴스
    """
    return setup_logger(
        name=f"figure.{component}",
        level="INFO",
        format_string=(
            "%(asctime)s - [%(levelname)s] - %(name)s - "
            "%(message)s"
        )
    )


def get_logger(name: str) -> logging.Logger:
    """
    간단한 로거 생성 함수 (호환성 목적)
    
    Args:
        name: 로거 이름
    
    Returns:
        설정된 로거 인스턴스
    """
    return setup_logger(name, level="INFO")


# 프리셋 로거들
api_logger = get_figure_logger("api")
service_logger = get_figure_logger("service")
vector_logger = get_figure_logger("vector")
rag_logger = get_figure_logger("rag") 