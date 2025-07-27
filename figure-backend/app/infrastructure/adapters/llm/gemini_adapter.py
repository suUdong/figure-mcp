"""
Gemini LLM Adapter (Infrastructure)
Google Gemini API를 사용하는 LLM 어댑터
"""
import logging
import json
from typing import Dict, Any, Optional, List, AsyncGenerator
from datetime import datetime

from app.domain.repositories.llm_repository import LLMRepository

logger = logging.getLogger(__name__)


class GeminiLLMAdapter(LLMRepository):
    """Gemini LLM 어댑터"""
    
    def __init__(
        self, 
        api_key: str, 
        model: str = "gemini-1.5-flash",
        max_tokens: int = 2048,
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
        
        # Google Generative AI 클라이언트 초기화
        try:
            import google.generativeai as genai
            genai.configure(api_key=api_key)
            
            # 모델 설정
            generation_config = genai.types.GenerationConfig(
                candidate_count=1,
                max_output_tokens=max_tokens,
                temperature=temperature,
            )
            
            self.client = genai.GenerativeModel(
                model_name=model,
                generation_config=generation_config
            )
            
            logger.info(f"Gemini LLM 초기화 완료: {model}")
        except ImportError:
            raise ImportError(
                "google-generativeai 패키지가 설치되지 않았습니다. "
                "`pip install google-generativeai` 명령으로 설치하세요."
            )
    
    async def generate_response(self, prompt: str, context: Optional[str] = None) -> str:
        """텍스트 생성 응답"""
        try:
            # 컨텍스트와 프롬프트 결합
            if context:
                full_prompt = f"다음 컨텍스트를 참고하여 질문에 답하세요:\n\n컨텍스트:\n{context}\n\n질문: {prompt}"
            else:
                full_prompt = prompt
            
            # Gemini API 호출
            response = await self.client.generate_content_async(full_prompt)
            
            # 사용량 통계 업데이트
            self._update_usage_stats(response)
            
            # 응답 텍스트 추출
            content = response.text if hasattr(response, 'text') else ""
            
            logger.info(f"Gemini 응답 생성 완료: {len(content)} 문자")
            return content
            
        except Exception as e:
            logger.error(f"Gemini 응답 생성 실패: {e}")
            raise
    
    async def generate_streaming_response(self, prompt: str, context: Optional[str] = None) -> AsyncGenerator[str, None]:
        """스트리밍 텍스트 생성 응답"""
        try:
            # 컨텍스트와 프롬프트 결합
            if context:
                full_prompt = f"다음 컨텍스트를 참고하여 질문에 답하세요:\n\n컨텍스트:\n{context}\n\n질문: {prompt}"
            else:
                full_prompt = prompt
            
            # Gemini 스트리밍 API 호출
            response = self.client.generate_content(full_prompt, stream=True)
            
            for chunk in response:
                if hasattr(chunk, 'text') and chunk.text:
                    yield chunk.text
                    
            # 최종 사용량 통계 업데이트 (스트리밍에서는 정확한 토큰 수 계산이 어려워 추정)
            self._update_usage_stats_estimate(full_prompt, "")
                    
        except Exception as e:
            logger.error(f"Gemini 스트리밍 응답 실패: {e}")
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
    
    def _update_usage_stats(self, response) -> None:
        """사용량 통계 업데이트"""
        self.usage_stats["total_requests"] += 1
        self.usage_stats["last_request"] = datetime.now().isoformat()
        
        # Gemini는 현재 토큰 사용량 정보를 제공하지 않아 추정
        if hasattr(response, 'text'):
            estimated_tokens = len(response.text.split()) * 1.3  # 대략적인 토큰 추정
            self.usage_stats["total_tokens"] += int(estimated_tokens)
            
            # Gemini 가격 계산 (예시: Flash 모델 기준)
            # $0.075 per 1M input tokens, $0.30 per 1M output tokens
            estimated_cost = (estimated_tokens / 1_000_000) * 0.30
            self.usage_stats["total_cost"] += estimated_cost
    
    def _update_usage_stats_estimate(self, prompt: str, response: str) -> None:
        """스트리밍용 사용량 통계 추정 업데이트"""
        self.usage_stats["total_requests"] += 1
        self.usage_stats["last_request"] = datetime.now().isoformat()
        
        # 토큰 수 추정
        estimated_input_tokens = len(prompt.split()) * 1.3
        estimated_output_tokens = len(response.split()) * 1.3
        total_tokens = int(estimated_input_tokens + estimated_output_tokens)
        
        self.usage_stats["total_tokens"] += total_tokens
        
        # 비용 추정
        input_cost = (estimated_input_tokens / 1_000_000) * 0.075
        output_cost = (estimated_output_tokens / 1_000_000) * 0.30
        self.usage_stats["total_cost"] += input_cost + output_cost
    
    @property
    def provider_name(self) -> str:
        """프로바이더 이름"""
        return "gemini"
    
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