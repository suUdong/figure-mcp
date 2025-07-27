"""
OpenAI LLM Adapter (Infrastructure)
OpenAI API를 사용하는 LLM 어댑터
"""
import logging
import json
from typing import Dict, Any, Optional, List, AsyncGenerator
from datetime import datetime

from app.domain.repositories.llm_repository import LLMRepository

logger = logging.getLogger(__name__)


class OpenAILLMAdapter(LLMRepository):
    """OpenAI LLM 어댑터"""
    
    def __init__(
        self, 
        api_key: str, 
        model: str = "gpt-4o-mini",
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
        
        # OpenAI 클라이언트 초기화
        try:
            from openai import AsyncOpenAI
            self.client = AsyncOpenAI(api_key=api_key)
            logger.info(f"OpenAI LLM 초기화 완료: {model}")
        except ImportError:
            raise ImportError(
                "openai 패키지가 설치되지 않았습니다. "
                "`pip install openai` 명령으로 설치하세요."
            )
    
    async def generate_response(self, prompt: str, context: Optional[str] = None) -> str:
        """텍스트 생성 응답"""
        try:
            # 메시지 구성
            messages = []
            
            if context:
                messages.append({
                    "role": "system",
                    "content": f"다음 컨텍스트를 참고하여 질문에 답하세요:\n\n{context}"
                })
            
            messages.append({
                "role": "user",
                "content": prompt
            })
            
            # OpenAI API 호출
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                max_tokens=self._max_tokens,
                temperature=self._temperature
            )
            
            # 사용량 통계 업데이트
            self._update_usage_stats(response.usage)
            
            # 응답 텍스트 추출
            content = response.choices[0].message.content if response.choices else ""
            
            logger.info(f"OpenAI 응답 생성 완료: {len(content)} 문자")
            return content
            
        except Exception as e:
            logger.error(f"OpenAI 응답 생성 실패: {e}")
            raise
    
    async def generate_streaming_response(self, prompt: str, context: Optional[str] = None) -> AsyncGenerator[str, None]:
        """스트리밍 텍스트 생성 응답"""
        try:
            # 메시지 구성
            messages = []
            
            if context:
                messages.append({
                    "role": "system",
                    "content": f"다음 컨텍스트를 참고하여 질문에 답하세요:\n\n{context}"
                })
            
            messages.append({
                "role": "user",
                "content": prompt
            })
            
            # OpenAI 스트리밍 API 호출
            stream = await self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                max_tokens=self._max_tokens,
                temperature=self._temperature,
                stream=True
            )
            
            async for chunk in stream:
                if chunk.choices and chunk.choices[0].delta.content:
                    yield chunk.choices[0].delta.content
                    
            # 스트리밍 완료 후 사용량 통계 업데이트 (추정)
            self._update_usage_stats_estimate(prompt, context)
                    
        except Exception as e:
            logger.error(f"OpenAI 스트리밍 응답 실패: {e}")
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
        if usage:
            prompt_tokens = getattr(usage, 'prompt_tokens', 0)
            completion_tokens = getattr(usage, 'completion_tokens', 0)
            total_tokens = getattr(usage, 'total_tokens', prompt_tokens + completion_tokens)
            
            self.usage_stats["total_requests"] += 1
            self.usage_stats["total_tokens"] += total_tokens
            self.usage_stats["last_request"] = datetime.now().isoformat()
            
            # OpenAI 가격 계산 (GPT-4o-mini 기준)
            # Input: $0.15 per 1M tokens, Output: $0.60 per 1M tokens
            input_cost = (prompt_tokens / 1_000_000) * 0.15
            output_cost = (completion_tokens / 1_000_000) * 0.60
            self.usage_stats["total_cost"] += input_cost + output_cost
    
    def _update_usage_stats_estimate(self, prompt: str, context: Optional[str] = None) -> None:
        """스트리밍용 사용량 통계 추정 업데이트"""
        self.usage_stats["total_requests"] += 1
        self.usage_stats["last_request"] = datetime.now().isoformat()
        
        # 토큰 수 추정
        full_prompt = f"{context or ''}\n{prompt}"
        estimated_prompt_tokens = len(full_prompt.split()) * 1.3
        estimated_completion_tokens = 150  # 평균 추정
        total_tokens = int(estimated_prompt_tokens + estimated_completion_tokens)
        
        self.usage_stats["total_tokens"] += total_tokens
        
        # 비용 추정
        input_cost = (estimated_prompt_tokens / 1_000_000) * 0.15
        output_cost = (estimated_completion_tokens / 1_000_000) * 0.60
        self.usage_stats["total_cost"] += input_cost + output_cost
    
    @property
    def provider_name(self) -> str:
        """프로바이더 이름"""
        return "openai"
    
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