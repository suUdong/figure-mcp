"""
Google Gemini Embedding Adapter (Infrastructure)
헥사고날 아키텍처의 Gemini 어댑터 구현체
"""
import logging
from typing import List
from langchain_google_genai import GoogleGenerativeAIEmbeddings

from app.domain.repositories.embedding_repository import EmbeddingRepository

logger = logging.getLogger(__name__)


class GeminiEmbeddingAdapter(EmbeddingRepository):
    """Gemini 임베딩 어댑터 (Infrastructure)"""
    
    def __init__(self, api_key: str, model: str = "models/text-embedding-004"):
        self.api_key = api_key
        self.model = model
        self._embeddings = GoogleGenerativeAIEmbeddings(
            model=model,
            google_api_key=api_key
        )
    
    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        """문서들을 임베딩합니다."""
        try:
            logger.debug(f"Gemini 문서 임베딩 - 문서 수: {len(texts)}")
            return self._embeddings.embed_documents(texts)
        except Exception as e:
            logger.error(f"Gemini 문서 임베딩 실패: {e}")
            raise
    
    def embed_query(self, text: str) -> List[float]:
        """쿼리를 임베딩합니다."""
        try:
            logger.debug(f"Gemini 쿼리 임베딩 - 쿼리: {text[:100]}...")
            return self._embeddings.embed_query(text)
        except Exception as e:
            logger.error(f"Gemini 쿼리 임베딩 실패: {e}")
            raise
    
    async def aembed_documents(self, texts: List[str]) -> List[List[float]]:
        """비동기 문서 임베딩"""
        try:
            return await self._embeddings.aembed_documents(texts)
        except Exception as e:
            logger.error(f"Gemini 비동기 문서 임베딩 실패: {e}")
            raise
    
    async def aembed_query(self, text: str) -> List[float]:
        """비동기 쿼리 임베딩"""
        try:
            return await self._embeddings.aembed_query(text)
        except Exception as e:
            logger.error(f"Gemini 비동기 쿼리 임베딩 실패: {e}")
            raise
    
    @property
    def provider_name(self) -> str:
        return "gemini"
    
    @property
    def model_name(self) -> str:
        return self.model 