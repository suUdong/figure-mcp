"""
LangChain Embedding Wrapper (Infrastructure)
헥사고날 아키텍처의 어댑터를 LangChain 인터페이스로 변환하는 래퍼
"""
import logging
from typing import List
from langchain_core.embeddings import Embeddings

from app.domain.repositories.embedding_repository import EmbeddingRepository

logger = logging.getLogger(__name__)


class LangChainEmbeddingWrapper(Embeddings):
    """LangChain 호환성을 위한 임베딩 래퍼 (Infrastructure)"""
    
    def __init__(self, adapter: EmbeddingRepository):
        self.adapter = adapter
    
    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        """문서들을 임베딩합니다."""
        return self.adapter.embed_documents(texts)
    
    def embed_query(self, text: str) -> List[float]:
        """쿼리를 임베딩합니다."""
        return self.adapter.embed_query(text)
    
    async def aembed_documents(self, texts: List[str]) -> List[List[float]]:
        """비동기 문서 임베딩"""
        return await self.adapter.aembed_documents(texts)
    
    async def aembed_query(self, text: str) -> List[float]:
        """비동기 쿼리 임베딩"""
        return await self.adapter.aembed_query(text) 