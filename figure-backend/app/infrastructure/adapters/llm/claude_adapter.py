"""
Claude LLM Adapter (Infrastructure)
Anthropic Claude API를 사용하는 LLM 어댑터
"""
import logging
import json
from typing import Dict, Any, Optional, List, AsyncGenerator
from datetime import datetime

from app.domain.repositories.llm_repository import LLMRepository

logger = logging.getLogger(__name__)


class ClaudeLLMAdapter(LLMRepository):
    """Claude LLM 어댑터"""
    
    def __init__(
        self, 
        api_key: str, 
        model: str = "claude-3-5-sonnet-20241022",
        max_tokens: int = 4096,
        temperature: float = 0.1
    ):
        self.api_key = api_key
        self.model = model
        self._max_tokens = max_tokens
        self._temperature = temperature
        self.usage_stats = {
            "total_requests": 0,
            "total_tokens": 0,
            "total_cost": 0.0,
            "last_request": None
        }
        
        # Anthropic 클라이언트 초기화
        try:
            import anthropic
            import httpx
            import ssl
            import os
            
            # SSL 검증 비활성화 설정 (Voyage AI와 동일한 방식)
            os.environ["PYTHONHTTPSVERIFY"] = "0"
            ssl._create_default_https_context = ssl._create_unverified_context
            
            # 타임아웃과 SSL 설정이 포함된 HTTP 클라이언트 생성
            http_client = httpx.AsyncClient(
                timeout=httpx.Timeout(
                    connect=30.0,  # 연결 타임아웃: 30초
                    read=60.0,     # 읽기 타임아웃: 60초
                    write=30.0,    # 쓰기 타임아웃: 30초
                    pool=120.0     # 전체 타임아웃: 2분
                ),
                verify=False,  # SSL 검증 비활성화
                limits=httpx.Limits(
                    max_keepalive_connections=10,
                    max_connections=20
                )
            )
            
            self.client = anthropic.AsyncAnthropic(
                api_key=api_key,
                http_client=http_client
            )
            logger.info(f"Claude LLM 초기화 완료 (타임아웃: 60s, SSL 비활성화): {model}")
        except ImportError:
            raise ImportError(
                "anthropic 패키지가 설치되지 않았습니다. "
                "`pip install anthropic` 명령으로 설치하세요."
            )
    
    async def generate_response(self, prompt: str, context: Optional[str] = None) -> str:
        """텍스트 생성 응답"""
        try:
            # 컨텍스트와 프롬프트 결합
            if context:
                full_prompt = f"다음 컨텍스트를 참고하여 질문에 답하세요:\n\n컨텍스트:\n{context}\n\n질문: {prompt}"
            else:
                full_prompt = prompt
            
            # Claude API 호출
            response = await self.client.messages.create(
                model=self.model,
                max_tokens=self._max_tokens,
                temperature=self._temperature,
                messages=[
                    {
                        "role": "user",
                        "content": full_prompt
                    }
                ]
            )
            
            # 사용량 통계 업데이트
            self._update_usage_stats(response.usage)
            
            # 응답 텍스트 추출
            content = response.content[0].text if response.content else ""
            
            logger.info(f"Claude 응답 생성 완료: {len(content)} 문자")
            return content
            
        except Exception as e:
            logger.error(f"Claude 응답 생성 실패: {e}")
            raise
    
    async def generate_streaming_response(self, prompt: str, context: Optional[str] = None) -> AsyncGenerator[str, None]:
        """스트리밍 텍스트 생성 응답"""
        try:
            # 컨텍스트와 프롬프트 결합
            if context:
                full_prompt = f"다음 컨텍스트를 참고하여 질문에 답하세요:\n\n컨텍스트:\n{context}\n\n질문: {prompt}"
            else:
                full_prompt = prompt
            
            # Claude 스트리밍 API 호출
            async with self.client.messages.stream(
                model=self.model,
                max_tokens=self._max_tokens,
                temperature=self._temperature,
                messages=[
                    {
                        "role": "user", 
                        "content": full_prompt
                    }
                ]
            ) as stream:
                async for text in stream.text_stream:
                    yield text
                    
                # 최종 사용량 통계 업데이트
                final_message = await stream.get_final_message()
                if hasattr(final_message, 'usage'):
                    self._update_usage_stats(final_message.usage)
                    
        except Exception as e:
            logger.error(f"Claude 스트리밍 응답 실패: {e}")
            raise
    
    async def summarize(self, text: str, max_length: Optional[int] = None) -> str:
        """텍스트 요약"""
        max_len = max_length or 200
        prompt = f"""
다음 텍스트를 {max_len}자 이내로 요약해주세요. 핵심 내용만 간결하게 정리하세요.

텍스트:
{text}

요약:
"""
        return await self.generate_response(prompt)
    
    async def analyze_sentiment(self, text: str) -> Dict[str, Any]:
        """감정 분석"""
        prompt = f"""
다음 텍스트의 감정을 분석하고 JSON 형식으로 답변해주세요:

텍스트: {text}

다음과 같은 형식으로 답변하세요:
{{
  "sentiment": "positive|negative|neutral",
  "confidence": 0.95,
  "emotions": ["joy", "excitement"],
  "summary": "감정 분석 요약"
}}
"""
        
        response = await self.generate_response(prompt)
        try:
            # JSON 파싱 시도
            return json.loads(response)
        except json.JSONDecodeError:
            # 파싱 실패 시 기본값 반환
            return {
                "sentiment": "neutral",
                "confidence": 0.5,
                "emotions": [],
                "summary": "감정 분석 처리 중 오류 발생",
                "raw_response": response
            }
    
    async def extract_keywords(self, text: str, count: int = 10) -> List[str]:
        """키워드 추출"""
        prompt = f"""
다음 텍스트에서 가장 중요한 키워드 {count}개를 추출해주세요. 
키워드만 쉼표로 구분하여 나열하세요.

텍스트: {text}

키워드:
"""
        
        response = await self.generate_response(prompt)
        
        # 키워드 파싱
        keywords = [kw.strip() for kw in response.split(',')]
        return keywords[:count]
    
    def get_usage_stats(self) -> Dict[str, Any]:
        """사용량 통계"""
        return self.usage_stats.copy()
    
    def _update_usage_stats(self, usage) -> None:
        """사용량 통계 업데이트"""
        if hasattr(usage, 'input_tokens') and hasattr(usage, 'output_tokens'):
            input_tokens = usage.input_tokens
            output_tokens = usage.output_tokens
            total_tokens = input_tokens + output_tokens
            
            self.usage_stats["total_requests"] += 1
            self.usage_stats["total_tokens"] += total_tokens
            self.usage_stats["last_request"] = datetime.now().isoformat()
            
            # Claude 가격 계산 (예시: Claude-3 Sonnet 기준)
            # Input: $3 per 1M tokens, Output: $15 per 1M tokens
            input_cost = (input_tokens / 1_000_000) * 3.0
            output_cost = (output_tokens / 1_000_000) * 15.0
            self.usage_stats["total_cost"] += input_cost + output_cost
    
    @property
    def provider_name(self) -> str:
        """프로바이더 이름"""
        return "claude"
    
    @property
    def model_name(self) -> str:
        """모델 이름"""
        return self.model
    
    @property
    def max_tokens(self) -> int:
        """최대 토큰 수"""
        return self._max_tokens
    
    @property
    def temperature(self) -> float:
        """온도 설정"""
        return self._temperature 