"""
Embedding Repository Port
도메인 레이어의 임베딩 리포지토리 인터페이스
"""
from abc import ABC, abstractmethod
from typing import List


class EmbeddingRepository(ABC):
    """임베딩 리포지토리 포트 인터페이스"""
    
    @abstractmethod
    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        """문서들을 임베딩합니다."""
        pass
    
    @abstractmethod
    def embed_query(self, text: str) -> List[float]:
        """쿼리를 임베딩합니다."""
        pass
    
    @abstractmethod
    async def aembed_documents(self, texts: List[str]) -> List[List[float]]:
        """비동기 문서 임베딩"""
        pass
    
    @abstractmethod
    async def aembed_query(self, text: str) -> List[float]:
        """비동기 쿼리 임베딩"""
        pass
    
    @property
    @abstractmethod
    def provider_name(self) -> str:
        """프로바이더 이름"""
        pass
    
    @property
    @abstractmethod
    def model_name(self) -> str:
        """모델 이름"""
        pass 