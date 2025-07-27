"""
LLM Repository Port
도메인 레이어의 LLM 리포지토리 인터페이스
"""
from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional


class LLMRepository(ABC):
    """LLM 리포지토리 포트 인터페이스"""
    
    @abstractmethod
    async def generate_response(self, prompt: str, context: Optional[str] = None) -> str:
        """텍스트 생성 응답"""
        pass
    
    @abstractmethod
    async def generate_streaming_response(self, prompt: str, context: Optional[str] = None):
        """스트리밍 텍스트 생성 응답"""
        pass
    
    @abstractmethod
    async def summarize(self, text: str, max_length: Optional[int] = None) -> str:
        """텍스트 요약"""
        pass
    
    @abstractmethod
    async def analyze_sentiment(self, text: str) -> Dict[str, Any]:
        """감정 분석"""
        pass
    
    @abstractmethod
    async def extract_keywords(self, text: str, count: int = 10) -> List[str]:
        """키워드 추출"""
        pass
    
    @abstractmethod
    def get_usage_stats(self) -> Dict[str, Any]:
        """사용량 통계"""
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
    
    @property
    @abstractmethod
    def max_tokens(self) -> int:
        """최대 토큰 수"""
        pass
    
    @property
    @abstractmethod
    def temperature(self) -> float:
        """온도 설정"""
        pass 