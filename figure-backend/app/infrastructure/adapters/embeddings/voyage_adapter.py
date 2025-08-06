"""
Voyage AI Embedding Adapter (Infrastructure)
헥사고날 아키텍처의 Voyage AI 어댑터 구현체
"""
import logging
import ssl
import httpx
from typing import List
import voyageai

from app.domain.repositories.embedding_repository import EmbeddingRepository

logger = logging.getLogger(__name__)


class VoyageEmbeddingAdapter(EmbeddingRepository):
    """Voyage AI 임베딩 어댑터 (Infrastructure)"""
    
    def __init__(self, api_key: str, model: str = "voyage-3-large"):
        self.api_key = api_key
        self.model = model
        
        # 최강 SSL 검증 비활성화 - 모든 레벨에서 패치
        import os
        import requests
        import urllib3
        import socket
        from requests.adapters import HTTPAdapter
        from urllib3.util.ssl_ import create_urllib3_context
        
        # 환경 변수 설정
        os.environ["PYTHONHTTPSVERIFY"] = "0"
        os.environ["CURL_CA_BUNDLE"] = ""
        os.environ["REQUESTS_CA_BUNDLE"] = ""
        
        # urllib3 경고 완전 비활성화
        urllib3.disable_warnings()
        urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
        # SubjectAltNameWarning과 SecurityWarning은 버전에 따라 존재하지 않을 수 있음
        try:
            urllib3.disable_warnings(urllib3.exceptions.SubjectAltNameWarning)
        except AttributeError:
            pass
        try:
            urllib3.disable_warnings(urllib3.exceptions.SecurityWarning)
        except AttributeError:
            pass
        
        # SSL 모듈 전역 패치
        ssl._create_default_https_context = ssl._create_unverified_context
        
        # urllib3 연결 풀 매니저 패치
        original_urlopen = urllib3.poolmanager.PoolManager.urlopen
        def patched_urlopen(self, method, url, *args, **kwargs):
            kwargs.pop('assert_hostname', None)
            kwargs.pop('verify', None)
            return original_urlopen(self, method, url, *args, **kwargs)
        urllib3.poolmanager.PoolManager.urlopen = patched_urlopen
        
        # requests 모듈 전역 패치
        original_request = requests.Session.request
        def patched_request(self, method, url, *args, **kwargs):
            kwargs['verify'] = False
            return original_request(self, method, url, *args, **kwargs)
        requests.Session.request = patched_request
        
        # 기본 requests 함수들도 패치
        original_get = requests.get
        original_post = requests.post
        def patched_get(*args, **kwargs):
            kwargs['verify'] = False
            return original_get(*args, **kwargs)
        def patched_post(*args, **kwargs):
            kwargs['verify'] = False
            return original_post(*args, **kwargs)
        requests.get = patched_get
        requests.post = patched_post
        
        # Voyage 클라이언트 초기화
        self.client = voyageai.Client(api_key=api_key)
        
        logger.info(f"Voyage 임베딩 어댑터 초기화 완료 (강력한 SSL 검증 비활성화): {model}")
    
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