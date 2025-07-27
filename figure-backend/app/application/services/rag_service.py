"""
RAG Service
헥사고날 아키텍처 기반 멀티 프로바이더 LLM을 지원하는 질의응답 서비스
"""
import logging
from typing import List, Optional, Dict, Any

from app.config import settings
from app.application.services.vector_store import vector_store_service
from app.application.services.usage.tracker import usage_tracker
from app.infrastructure.adapters.llm.factory import llm_factory
from app.domain.repositories.llm_repository import LLMRepository
from app.utils.logger import rag_logger as logger


class RAGService:
    """RAG (Retrieval-Augmented Generation) 서비스"""
    
    def __init__(self):
        """RAG 서비스 초기화"""
        self._llm: Optional[LLMRepository] = None
        self._initialized = False
    
    async def initialize(self) -> None:
        """비동기 초기화"""
        if self._initialized:
            return
            
        try:
            # LLM 어댑터 팩토리를 통해 초기화
            self._llm = llm_factory.create_adapter(settings)
            logger.info(f"LLM 어댑터 초기화 완료: {self._llm.provider_name} - {self._llm.model_name}")
            
            # 벡터 스토어 서비스 초기화
            await vector_store_service.initialize()
            
            self._initialized = True
            logger.info("RAG 서비스 초기화 완료")
            
        except Exception as e:
            logger.error(f"RAG 서비스 초기화 실패: {e}")
            raise
    
    async def query(self, question: str, include_sources: bool = True) -> Dict[str, Any]:
        """질의응답 수행"""
        if not self._initialized:
            await self.initialize()
        
        try:
            logger.info(f"RAG 질의 시작: {question}")
            
            # 관련 문서 검색
            search_results = await vector_store_service.search_similar(
                query=question,
                max_results=5,
                similarity_threshold=0.2
            )
            
            if not search_results:
                # 검색 결과가 없는 경우
                response = {
                    "answer": "제공된 정보로는 답변할 수 없습니다. 관련 문서를 찾을 수 없습니다.",
                    "question": question
                }
                if include_sources:
                    response["sources"] = []
                return response
            
            # 컨텍스트 구성
            context = "\n\n".join([result["content"] for result in search_results])
            
            # LLM을 통한 답변 생성
            answer = await self._llm.generate_response(question, context)
            
            # 응답 구성
            response = {
                "answer": answer,
                "question": question
            }
            
            # 소스 문서 포함 (옵션)
            if include_sources:
            sources = []
                for result in search_results:
                source_info = {
                        "content": result["content"],
                        "metadata": result["metadata"]
                }
                sources.append(source_info)
                response["sources"] = sources
            
            # 사용량 추적
            answer_length = len(answer)
            estimated_tokens = (len(question) + len(context) + answer_length) // 4  # 대략적인 토큰 추정
            
            usage_tracker.record_usage(
                provider=self._llm.provider_name,
                service="llm",
                model=self._llm.model_name,
                tokens_used=estimated_tokens,
                request_type="rag_query",
                success=True
            )
            
            logger.info(f"RAG 질의 완료: {len(answer)} 문자 응답")
            return response
            
        except Exception as e:
            logger.error(f"RAG 질의 실패: {e}")
            raise
    
    async def query_without_context(self, question: str) -> str:
        """컨텍스트 없이 직접 LLM에 질의"""
        if not self._initialized:
            await self.initialize()
        
        try:
            logger.info(f"직접 LLM 질의: {question}")
            
            # LLM 직접 호출
            answer = await self._llm.generate_response(question)
            
            # 사용량 추적
            estimated_tokens = (len(question) + len(answer)) // 4
            usage_tracker.record_usage(
                provider=self._llm.provider_name,
                service="llm",
                model=self._llm.model_name,
                tokens_used=estimated_tokens,
                request_type="direct_query",
                success=True
            )
            
            logger.info(f"직접 LLM 질의 완료: {len(answer)} 문자")
            return answer
            
        except Exception as e:
            logger.error(f"직접 LLM 질의 실패: {e}")
            raise
    
    async def summarize_document(self, content: str, max_length: int = 200) -> str:
        """문서 요약"""
        if not self._initialized:
            await self.initialize()
        
        try:
            logger.info(f"문서 요약 시작: {len(content)} 문자")
            
            summary = await self._llm.summarize(content, max_length)
            
            # 사용량 추적
            estimated_tokens = (len(content) + len(summary)) // 4
            usage_tracker.record_usage(
                provider=self._llm.provider_name,
                service="llm",
                model=self._llm.model_name,
                tokens_used=estimated_tokens,
                request_type="summarization",
                success=True
            )
            
            logger.info(f"문서 요약 완료: {len(summary)} 문자")
            return summary
            
        except Exception as e:
            logger.error(f"문서 요약 실패: {e}")
            raise
    
    async def analyze_sentiment(self, text: str) -> Dict[str, Any]:
        """감정 분석"""
        if not self._initialized:
            await self.initialize()
        
        try:
            logger.info(f"감정 분석 시작: {len(text)} 문자")
            
            sentiment_result = await self._llm.analyze_sentiment(text)
            
            # 사용량 추적
            estimated_tokens = len(text) // 4
            usage_tracker.record_usage(
                provider=self._llm.provider_name,
                service="llm",
                model=self._llm.model_name,
                tokens_used=estimated_tokens,
                request_type="sentiment_analysis",
                success=True
            )
            
            logger.info("감정 분석 완료")
            return sentiment_result
            
        except Exception as e:
            logger.error(f"감정 분석 실패: {e}")
            raise
    
    async def extract_keywords(self, text: str, count: int = 10) -> List[str]:
        """키워드 추출"""
        if not self._initialized:
            await self.initialize()
        
        try:
            logger.info(f"키워드 추출 시작: {len(text)} 문자")
            
            keywords = await self._llm.extract_keywords(text, count)
            
            # 사용량 추적
            estimated_tokens = len(text) // 4
            usage_tracker.record_usage(
                provider=self._llm.provider_name,
                service="llm",
                model=self._llm.model_name,
                tokens_used=estimated_tokens,
                request_type="keyword_extraction",
                success=True
            )
            
            logger.info(f"키워드 추출 완료: {len(keywords)}개")
            return keywords
            
        except Exception as e:
            logger.error(f"키워드 추출 실패: {e}")
            raise
    
    async def get_service_status(self) -> Dict[str, Any]:
        """서비스 상태 반환"""
        llm_info = {}
        if self._llm:
            llm_info = {
                "llm_provider": self._llm.provider_name,
                "llm_model": self._llm.model_name,
                "max_tokens": self._llm.max_tokens,
                "temperature": self._llm.temperature,
                "usage_stats": self._llm.get_usage_stats()
            }
        else:
            llm_info = {
                "llm_provider": settings.llm_provider,
                "llm_model": "Not initialized",
                "max_tokens": 0,
                "temperature": 0.0,
                "usage_stats": {}
            }
        
        return {
            "rag_service_initialized": self._initialized,
            "embedding_provider": settings.embedding_provider,
            "embedding_model": settings.gemini_embedding_model if settings.embedding_provider == "gemini" else settings.openai_embedding_model,
            "vector_store_initialized": vector_store_service._initialized if hasattr(vector_store_service, '_initialized') else False,
            **llm_info
        }
    
    def get_available_providers(self) -> List[str]:
        """사용 가능한 LLM 프로바이더 목록"""
        return llm_factory.get_available_providers()


# 싱글톤 인스턴스
rag_service = RAGService() 