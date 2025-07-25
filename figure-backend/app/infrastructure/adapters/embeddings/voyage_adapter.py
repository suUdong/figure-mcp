"""
Voyage AI Embedding Adapter (Infrastructure)
헥사고날 아키텍처의 Voyage AI 어댑터 구현체
"""
import logging
from typing import List
import voyageai

from app.domain.repositories.embedding_repository import EmbeddingRepository

logger = logging.getLogger(__name__)


class VoyageEmbeddingAdapter(EmbeddingRepository):
    """Voyage AI 임베딩 어댑터 (Infrastructure)"""
    
    def __init__(self, api_key: str, model: str = "voyage-3-large"):
        self.api_key = api_key
        self.model = model
        self.client = voyageai.Client(api_key=api_key)
    
    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        """문서들을 임베딩합니다."""
        try:
            logger.debug(f"Voyage 문서 임베딩 - 문서 수: {len(texts)}")
            response = self.client.embed(
                texts, 
                model=self.model, 
                input_type="document"
            )
            return response.embeddings
        except Exception as e:
            logger.error(f"Voyage 문서 임베딩 실패: {e}")
            raise
    
    def embed_query(self, text: str) -> List[float]:
        """쿼리를 임베딩합니다."""
        try:
            logger.debug(f"Voyage 쿼리 임베딩 - 쿼리: {text[:100]}...")
            response = self.client.embed(
                [text], 
                model=self.model, 
                input_type="query"
            )
            return response.embeddings[0]
        except Exception as e:
            logger.error(f"Voyage 쿼리 임베딩 실패: {e}")
            raise
    
    async def aembed_documents(self, texts: List[str]) -> List[List[float]]:
        """비동기 문서 임베딩"""
        return self.embed_documents(texts)
    
    async def aembed_query(self, text: str) -> List[float]:
        """비동기 쿼리 임베딩"""
        return self.embed_query(text)
    
    @property
    def provider_name(self) -> str:
        return "voyage"
    
    @property
    def model_name(self) -> str:
        return self.model 