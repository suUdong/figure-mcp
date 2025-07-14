"""
RAG (Retrieval-Augmented Generation) Service
헥사고날 아키텍처 기반 멀티 프로바이더 LLM을 지원하는 질의응답 서비스
"""
import time
import logging
from typing import List, Dict, Any, Optional

from langchain.chains import RetrievalQA
from langchain.prompts import PromptTemplate
from langchain_core.documents import Document
from langchain_core.retrievers import BaseRetriever

from app.config import settings
from app.models.schemas import QueryRequest, QueryResponse
from app.services.vector_store import vector_store_service

logger = logging.getLogger(__name__)


class CustomRetriever(BaseRetriever):
    """VectorStoreService를 위한 커스텀 리트리버"""
    
    vector_store_service: Any = None
    
    def __init__(self, vector_store_service, **kwargs):
        super().__init__(**kwargs)
        self.vector_store_service = vector_store_service
    
    async def _aget_relevant_documents(self, query: str, *, run_manager=None) -> List[Document]:
        """비동기 문서 검색"""
        results = await self.vector_store_service.search_similar(
            query=query,
            max_results=5,
            similarity_threshold=0.7
        )
        
        documents = []
        for result in results:
            doc = Document(
                page_content=result["content"],
                metadata=result["metadata"]
            )
            documents.append(doc)
        
        return documents
    
    def _get_relevant_documents(self, query: str, *, run_manager=None) -> List[Document]:
        """동기 문서 검색 (비동기 버전을 호출)"""
        import asyncio
        try:
            # 현재 실행 중인 이벤트 루프가 있는지 확인
            loop = asyncio.get_running_loop()
            # 새 태스크로 비동기 함수 실행
            task = loop.create_task(self._aget_relevant_documents(query, run_manager=run_manager))
            return asyncio.create_task(task).result() if hasattr(asyncio, 'create_task') else []
        except RuntimeError:
            # 이벤트 루프가 없는 경우 새로 생성
            return asyncio.run(self._aget_relevant_documents(query, run_manager=run_manager))


class RAGService:
    """RAG 기반 질의응답 서비스"""
    
    def __init__(self):
        """서비스 초기화"""
        self._llm = None
        self._retriever = None
        self._qa_chain = None
        self._initialized = False
    
    async def initialize(self) -> None:
        """비동기 초기화"""
        if self._initialized:
            return
            
        try:
            # LLM 프로바이더에 따라 초기화
            if settings.llm_provider == "gemini":
                from langchain_google_genai import ChatGoogleGenerativeAI
                self._llm = ChatGoogleGenerativeAI(
                    model=settings.gemini_model,
                    google_api_key=settings.gemini_api_key,
                    temperature=0.1,
                    max_output_tokens=1000
                )
            elif settings.llm_provider == "openai":
                from langchain_openai import ChatOpenAI
                self._llm = ChatOpenAI(
                    model=settings.openai_model,
                    openai_api_key=settings.openai_api_key,
                    temperature=0.1,
                    max_tokens=1000
                )
                        else:
                # 기본값으로 Gemini 사용
                from langchain_google_genai import ChatGoogleGenerativeAI
                self._llm = ChatGoogleGenerativeAI(
                    model=settings.gemini_model,
                    google_api_key=settings.gemini_api_key,
                    temperature=0.1,
                    max_output_tokens=1000
                )
            
            # 벡터 스토어 서비스 초기화
            await vector_store_service.initialize()
            
            # 커스텀 리트리버 생성
            self._retriever = CustomRetriever(
                vector_store_service=vector_store_service
            )
            
            # QA 체인 생성
            self._qa_chain = self._create_qa_chain()
            
            self._initialized = True
            logger.info("RAG 서비스 초기화 완료")
            
        except Exception as e:
            logger.error(f"RAG 서비스 초기화 실패: {e}")
            raise
    
    def _create_qa_chain(self) -> RetrievalQA:
        """QA 체인 생성"""
        # 한국어 최적화된 프롬프트 템플릿
        prompt_template = """
당신은 Figure 디자인 도구에 대한 전문 어시스턴트입니다. 
주어진 문맥 정보를 바탕으로 사용자의 질문에 정확하고 도움이 되는 답변을 제공해주세요.

문맥 정보:
{context}

질문: {question}

답변 가이드라인:
1. 주어진 문맥 정보를 우선적으로 활용하세요
2. 정확하고 구체적인 정보를 제공하세요
3. 모르는 내용은 추측하지 말고 솔직히 말씀해주세요
4. 가능하면 단계별 설명이나 예시를 포함해주세요
5. 한국어로 자연스럽게 답변해주세요

답변:"""

        prompt = PromptTemplate(
            template=prompt_template,
            input_variables=["context", "question"]
        )
        
        return RetrievalQA.from_chain_type(
            llm=self._llm,
            chain_type="stuff",
            retriever=self._retriever,
            chain_type_kwargs={"prompt": prompt},
            return_source_documents=True
        )
    
    async def process_query(self, request: QueryRequest) -> QueryResponse:
        """질의 처리"""
        if not self._initialized:
            await self.initialize()
        
        start_time = time.time()
        
        try:
            # 벡터 검색으로 관련 문서 찾기
            search_results = await vector_store_service.search_similar(
                query=request.query,
                max_results=request.max_results,
                site_ids=request.site_ids,
                similarity_threshold=request.similarity_threshold
            )
            
            if not search_results:
                return QueryResponse(
                    query=request.query,
                    answer="죄송합니다. 관련된 정보를 찾을 수 없습니다. 다른 키워드로 시도해보시거나 질문을 더 구체적으로 해주세요.",
                    sources=[],
                    processing_time=time.time() - start_time
                )
            
            # QA 체인 실행
            result = await self._run_qa_chain(request.query)
            
            # 소스 정보 구성
            sources = []
            for search_result in search_results:
                source_info = {
                    "content": search_result["content"][:200] + "..." if len(search_result["content"]) > 200 else search_result["content"],
                    "title": search_result["metadata"].get("title", "제목 없음"),
                    "doc_type": search_result["metadata"].get("doc_type", "unknown"),
                    "similarity": round(search_result["similarity"], 3),
                    "source_url": search_result["metadata"].get("source_url")
                }
                sources.append(source_info)
            
            processing_time = time.time() - start_time
            
            return QueryResponse(
                query=request.query,
                answer=result["result"],
                sources=sources,
                processing_time=round(processing_time, 3)
            )
            
        except Exception as e:
            logger.error(f"질의 처리 실패: {e}")
            return QueryResponse(
                query=request.query,
                answer=f"처리 중 오류가 발생했습니다: {str(e)}",
                sources=[],
                processing_time=time.time() - start_time
            )
    
    async def _run_qa_chain(self, query: str) -> Dict[str, Any]:
        """QA 체인 실행 (비동기 래퍼)"""
        import asyncio
        
        try:
            # 이벤트 루프에서 동기 체인 실행
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(
                None, 
                lambda: self._qa_chain({"query": query})
            )
            return result
        except Exception as e:
            logger.error(f"QA 체인 실행 실패: {e}")
            return {
                "result": "답변 생성 중 오류가 발생했습니다.",
                "source_documents": []
            }
    
    async def get_service_status(self) -> Dict[str, Any]:
        """서비스 상태 조회"""
        vector_info = await vector_store_service.get_collection_info()
        
        return {
            "rag_service_initialized": self._initialized,
            "llm_provider": settings.llm_provider,
            "embedding_provider": settings.embedding_provider,
            "current_llm_model": settings.gemini_model if settings.llm_provider == "gemini" else settings.openai_model,
            "current_embedding_model": settings.gemini_embedding_model if settings.embedding_provider == "gemini" else settings.openai_embedding_model,
            "vector_store": vector_info
        }


# 글로벌 인스턴스
rag_service = RAGService() 