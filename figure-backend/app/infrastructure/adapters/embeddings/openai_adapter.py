"""
OpenAI Embedding Adapter (Infrastructure)
헥사고날 아키텍처의 OpenAI 어댑터 구현체
"""
import logging
import ssl
import httpx
from typing import List
from langchain_openai import OpenAIEmbeddings

from app.domain.repositories.embedding_repository import EmbeddingRepository

logger = logging.getLogger(__name__)


class OpenAIEmbeddingAdapter(EmbeddingRepository):
    """OpenAI 임베딩 어댑터 (Infrastructure)"""
    
    def __init__(self, api_key: str, model: str = "text-embedding-3-large"):
        self.api_key = api_key
        self.model = model
        
        # SSL 검증을 비활성화한 HTTP 클라이언트 생성
        ssl_context = ssl.create_default_context()
        ssl_context.check_hostname = False
        ssl_context.verify_mode = ssl.CERT_NONE
        
        http_client = httpx.Client(
            verify=False,  # SSL 검증 비활성화
            timeout=httpx.Timeout(60.0)  # 타임아웃 설정
        )
        
        self._embeddings = OpenAIEmbeddings(
            model=model,
            openai_api_key=api_key,
            http_client=http_client  # 커스텀 HTTP 클라이언트 사용
        )
        
        logger.info(f"OpenAI 임베딩 어댑터 초기화 완료 (SSL 검증 비활성화): {model}")
    
    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        """문서들을 임베딩합니다."""
        try:
            logger.debug(f"OpenAI 문서 임베딩 - 문서 수: {len(texts)}")
            return self._embeddings.embed_documents(texts)
        except Exception as e:
            logger.error(f"OpenAI 문서 임베딩 실패: {e}")
            raise
    
    def embed_query(self, text: str) -> List[float]:
        """쿼리를 임베딩합니다."""
        try:
            logger.debug(f"OpenAI 쿼리 임베딩 - 쿼리: {text[:100]}...")
            return self._embeddings.embed_query(text)
        except Exception as e:
            logger.error(f"OpenAI 쿼리 임베딩 실패: {e}")
            raise
    
    async def aembed_documents(self, texts: List[str]) -> List[List[float]]:
        """비동기 문서 임베딩"""
        try:
            return await self._embeddings.aembed_documents(texts)
        except Exception as e:
            logger.error(f"OpenAI 비동기 문서 임베딩 실패: {e}")
            raise
    
    async def aembed_query(self, text: str) -> List[float]:
        """비동기 쿼리 임베딩"""
        try:
            return await self._embeddings.aembed_query(text)
        except Exception as e:
            logger.error(f"OpenAI 비동기 쿼리 임베딩 실패: {e}")
            raise
    
    @property
    def provider_name(self) -> str:
        return "openai"
    
    @property
    def model_name(self) -> str:
        return self.model 