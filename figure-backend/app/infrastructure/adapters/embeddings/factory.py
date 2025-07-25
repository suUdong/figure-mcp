"""
Embedding Adapter Factory (Infrastructure)
헥사고날 아키텍처의 어댑터 팩토리 (Factory Pattern)
"""
import logging
from typing import Dict, Type

from app.domain.repositories.embedding_repository import EmbeddingRepository
from app.config import Settings

logger = logging.getLogger(__name__)


class EmbeddingAdapterFactory:
    """임베딩 어댑터 팩토리 (Infrastructure)"""
    
    def __init__(self):
        self._adapters: Dict[str, Type[EmbeddingRepository]] = {}
        self._register_adapters()
    
    def _register_adapters(self):
        """사용 가능한 어댑터들을 등록합니다."""
        try:
            from .gemini_adapter import GeminiEmbeddingAdapter
            self._adapters["gemini"] = GeminiEmbeddingAdapter
        except ImportError:
            logger.warning("Gemini 어댑터를 가져올 수 없습니다.")
        
        try:
            from .openai_adapter import OpenAIEmbeddingAdapter
            self._adapters["openai"] = OpenAIEmbeddingAdapter
        except ImportError:
            logger.warning("OpenAI 어댑터를 가져올 수 없습니다.")
        
        try:
            from .voyage_adapter import VoyageEmbeddingAdapter
            self._adapters["voyage"] = VoyageEmbeddingAdapter
        except ImportError:
            logger.warning("Voyage 어댑터를 가져올 수 없습니다.")
    
    def create_adapter(self, settings: Settings) -> EmbeddingRepository:
        """설정에 따라 적절한 어댑터를 생성합니다."""
        provider = settings.embedding_provider.lower()
        
        if provider not in self._adapters:
            available_providers = list(self._adapters.keys())
            raise ValueError(
                f"지원하지 않는 임베딩 프로바이더: {provider}. "
                f"사용 가능한 프로바이더: {available_providers}"
            )
        
        adapter_class = self._adapters[provider]
        
        # 프로바이더별 어댑터 생성
        if provider == "gemini":
            return adapter_class(
                api_key=settings.gemini_api_key,
                model=settings.gemini_embedding_model
            )
        elif provider == "openai":
            return adapter_class(
                api_key=settings.openai_api_key,
                model=settings.openai_embedding_model
            )
        elif provider == "voyage":
            return adapter_class(
                api_key=settings.voyage_api_key,
                model=settings.voyage_embedding_model
            )
        else:
            raise ValueError(f"알 수 없는 프로바이더: {provider}")
    
    def get_available_providers(self) -> list[str]:
        """사용 가능한 프로바이더 목록을 반환합니다."""
        return list(self._adapters.keys())


# 싱글톤 인스턴스
embedding_factory = EmbeddingAdapterFactory() 