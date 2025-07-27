"""
LLM Adapter Factory (Infrastructure)
헥사고날 아키텍처의 LLM 어댑터 팩토리 (Factory Pattern)
"""
import logging
from typing import Dict, Type

from app.domain.repositories.llm_repository import LLMRepository
from app.config import Settings

logger = logging.getLogger(__name__)


class LLMAdapterFactory:
    """LLM 어댑터 팩토리 (Infrastructure)"""
    
    def __init__(self):
        self._adapters: Dict[str, Type[LLMRepository]] = {}
        self._register_adapters()
    
    def _register_adapters(self):
        """사용 가능한 어댑터들을 등록합니다."""
        try:
            from .claude_adapter import ClaudeLLMAdapter
            self._adapters["claude"] = ClaudeLLMAdapter
        except ImportError:
            logger.warning("Claude 어댑터를 가져올 수 없습니다.")
        
        try:
            from .gemini_adapter import GeminiLLMAdapter
            self._adapters["gemini"] = GeminiLLMAdapter
        except ImportError:
            logger.warning("Gemini 어댑터를 가져올 수 없습니다.")
        
        try:
            from .openai_adapter import OpenAILLMAdapter
            self._adapters["openai"] = OpenAILLMAdapter
        except ImportError:
            logger.warning("OpenAI 어댑터를 가져올 수 없습니다.")
    
    def create_adapter(self, settings: Settings) -> LLMRepository:
        """설정에 따라 적절한 어댑터를 생성합니다."""
        provider = settings.llm_provider.lower()
        
        if provider not in self._adapters:
            available_providers = list(self._adapters.keys())
            raise ValueError(
                f"지원하지 않는 LLM 프로바이더: {provider}. "
                f"사용 가능한 프로바이더: {available_providers}"
            )
        
        adapter_class = self._adapters[provider]
        
        # 프로바이더별 어댑터 생성
        if provider == "claude":
            return adapter_class(
                api_key=settings.claude_api_key,
                model=settings.claude_model,
                max_tokens=getattr(settings, 'claude_max_tokens', 4096),
                temperature=getattr(settings, 'claude_temperature', 0.1)
            )
        elif provider == "gemini":
            return adapter_class(
                api_key=settings.gemini_api_key,
                model=settings.gemini_model,
                max_tokens=getattr(settings, 'gemini_max_tokens', 2048),
                temperature=getattr(settings, 'gemini_temperature', 0.1)
            )
        elif provider == "openai":
            return adapter_class(
                api_key=settings.openai_api_key,
                model=settings.openai_model,
                max_tokens=getattr(settings, 'openai_max_tokens', 4096),
                temperature=getattr(settings, 'openai_temperature', 0.1)
            )
        else:
            raise ValueError(f"알 수 없는 프로바이더: {provider}")
    
    def get_available_providers(self) -> list[str]:
        """사용 가능한 프로바이더 목록을 반환합니다."""
        return list(self._adapters.keys())


# 싱글톤 인스턴스
llm_factory = LLMAdapterFactory() 