"""
RAGService 테스트
"""
import pytest
from unittest.mock import Mock, patch, AsyncMock
from typing import Dict, Any, List

from app.services.rag_service import RAGService
from app.config import Settings


pytestmark = pytest.mark.service


class TestRAGService:
    """RAGService 테스트"""
    
    @pytest.fixture
    def mock_vector_store(self):
        """모킹된 VectorStore"""
        mock_store = AsyncMock()
        mock_store.search_documents.return_value = [
            {
                "content": "RAG는 Retrieval-Augmented Generation의 줄임말입니다.",
                "source": "rag-guide.txt",
                "site_id": "docs-site",
                "score": 0.95,
                "metadata": {"author": "AI 전문가"}
            },
            {
                "content": "RAG 시스템은 검색과 생성을 결합한 AI 모델입니다.",
                "source": "ai-basics.txt",
                "site_id": "docs-site",
                "score": 0.87,
                "metadata": {"category": "AI"}
            }
        ]
        return mock_store
    
    @pytest.fixture
    def mock_openai_client(self):
        """모킹된 OpenAI 클라이언트"""
        mock_client = Mock()
        mock_response = Mock()
        mock_response.choices = [
            Mock(message=Mock(content="RAG는 검색 증강 생성 기술로, 외부 지식을 활용하여 더 정확한 답변을 생성합니다."))
        ]
        mock_client.chat.completions.create.return_value = mock_response
        return mock_client
    
    @pytest.fixture
    def rag_service(self, test_settings, mock_vector_store, mock_openai_client):
        """RAGService 인스턴스 생성"""
        with patch('app.services.rag_service.vector_store_service') as mock_vector_store, \
             patch('app.services.rag_service.ChatOpenAI') as mock_openai:
            mock_openai.return_value = mock_openai_client
            mock_vector_store.search_similar.return_value = []
            
            service = RAGService()
            return service
    
    def test_rag_service_initialization(self, rag_service):
        """RAGService 초기화 테스트"""
        assert rag_service is not None
        assert hasattr(rag_service, '_llm')
        assert hasattr(rag_service, '_retriever')
        assert hasattr(rag_service, '_initialized')
    
    def test_create_prompt(self, rag_service):
        """프롬프트 생성 테스트"""
        query = "RAG에 대해 설명해주세요"
        contexts = [
            "RAG는 Retrieval-Augmented Generation의 줄임말입니다.",
            "RAG 시스템은 검색과 생성을 결합한 AI 모델입니다."
        ]
        
        prompt = rag_service._create_prompt(query, contexts)
        
        assert query in prompt
        assert contexts[0] in prompt
        assert contexts[1] in prompt
        assert "한국어로 답변" in prompt  # 한국어 지시사항 확인
    
    def test_create_prompt_empty_contexts(self, rag_service):
        """빈 컨텍스트로 프롬프트 생성 테스트"""
        query = "일반적인 질문입니다"
        contexts = []
        
        prompt = rag_service._create_prompt(query, contexts)
        
        assert query in prompt
        assert "제공된 문서" not in prompt  # 문서가 없을 때는 다른 메시지
    
    @pytest.mark.asyncio
    async def test_query_success(self, rag_service, mock_vector_store, mock_openai_client):
        """성공적인 쿼리 테스트"""
        from app.models.schemas import QueryRequest
        
        request = QueryRequest(
            query="RAG에 대해 설명해주세요",
            site_ids=["docs-site"],
            max_results=5
        )
        
        # 모킹 설정
        mock_vector_store.search_similar.return_value = [
            {
                "content": "RAG는 검색 증강 생성 기술입니다.",
                "metadata": {"title": "RAG 가이드", "doc_type": "guide"},
                "similarity": 0.95
            }
        ]
        
        result = await rag_service.process_query(request)
        
        assert result is not None
        assert hasattr(result, 'query')
        assert hasattr(result, 'answer')
        assert hasattr(result, 'sources')
        assert hasattr(result, 'processing_time')
        
        assert result.query == request.query
        assert len(result.sources) > 0
    
    @pytest.mark.asyncio
    async def test_query_no_results(self, rag_service, mock_vector_store, mock_openai_client):
        """검색 결과가 없는 쿼리 테스트"""
        query = "존재하지 않는 내용"
        site_ids = []
        
        # 빈 검색 결과 설정
        mock_vector_store.search_documents.return_value = []
        
        result = await rag_service.query(query, site_ids, 5)
        
        assert result is not None
        assert len(result["results"]) == 0
        assert result["total_results"] == 0
        assert len(result["sources"]) == 0
        assert "죄송합니다" in result["answer"] or "찾을 수 없습니다" in result["answer"]
        
        # LLM이 호출되지 않았는지 확인 (검색 결과가 없으므로)
        mock_openai_client.chat.completions.create.assert_not_called()
    
    @pytest.mark.asyncio
    async def test_query_with_reranking(self, rag_service, mock_vector_store, mock_openai_client):
        """리랭킹이 포함된 쿼리 테스트"""
        query = "RAG 시스템의 장점"
        site_ids = ["docs-site"]
        
        result = await rag_service.query(query, site_ids, 5, use_reranking=True)
        
        assert result is not None
        assert len(result["results"]) == 2
        
        # 리랭킹 후 점수 순으로 정렬되었는지 확인
        scores = [r["score"] for r in result["results"]]
        assert scores == sorted(scores, reverse=True)
    
    @pytest.mark.asyncio
    async def test_query_llm_error(self, rag_service, mock_vector_store, mock_openai_client):
        """LLM 오류 처리 테스트"""
        query = "테스트 쿼리"
        site_ids = ["docs-site"]
        
        # LLM 오류 시뮬레이션
        mock_openai_client.chat.completions.create.side_effect = Exception("API Error")
        
        result = await rag_service.query(query, site_ids, 5)
        
        assert result is not None
        assert "오류가 발생했습니다" in result["answer"]
        assert len(result["results"]) == 2  # 검색 결과는 여전히 반환
    
    @pytest.mark.asyncio
    async def test_query_vector_store_error(self, rag_service, mock_vector_store, mock_openai_client):
        """벡터 스토어 오류 처리 테스트"""
        query = "테스트 쿼리"
        site_ids = ["docs-site"]
        
        # 벡터 스토어 오류 시뮬레이션
        mock_vector_store.search_documents.side_effect = Exception("Vector store error")
        
        with pytest.raises(Exception):
            await rag_service.query(query, site_ids, 5)
    
    def test_rerank_results(self, rag_service):
        """결과 리랭킹 테스트"""
        query = "RAG 시스템"
        results = [
            {
                "content": "RAG는 검색과 생성을 결합합니다.",
                "source": "doc1.txt",
                "site_id": "site1",
                "score": 0.7,
                "metadata": {}
            },
            {
                "content": "RAG 시스템은 매우 유용한 AI 기술입니다.",
                "source": "doc2.txt",
                "site_id": "site1",
                "score": 0.6,
                "metadata": {}
            },
            {
                "content": "다른 주제에 대한 내용입니다.",
                "source": "doc3.txt",
                "site_id": "site1",
                "score": 0.8,
                "metadata": {}
            }
        ]
        
        reranked = rag_service._rerank_results(query, results)
        
        assert len(reranked) == len(results)
        # 리랭킹 후에는 다른 순서일 수 있음
        assert all(0.0 <= r["score"] <= 1.0 for r in reranked)
    
    def test_rerank_results_empty(self, rag_service):
        """빈 결과 리랭킹 테스트"""
        query = "테스트 쿼리"
        results = []
        
        reranked = rag_service._rerank_results(query, results)
        
        assert len(reranked) == 0
    
    def test_calculate_relevance_score(self, rag_service):
        """관련성 점수 계산 테스트"""
        query = "RAG 시스템"
        content = "RAG는 Retrieval-Augmented Generation의 줄임말로, 검색과 생성을 결합한 AI 기술입니다."
        
        score = rag_service._calculate_relevance_score(query, content)
        
        assert 0.0 <= score <= 1.0
        
        # 관련성이 높은 내용의 점수가 더 높아야 함
        unrelated_content = "날씨가 좋습니다. 오늘은 맑은 하늘입니다."
        unrelated_score = rag_service._calculate_relevance_score(query, unrelated_content)
        
        assert score > unrelated_score
    
    def test_extract_sources(self, rag_service):
        """소스 추출 테스트"""
        results = [
            {"source": "doc1.txt", "content": "내용1", "site_id": "site1", "score": 0.9, "metadata": {}},
            {"source": "doc2.txt", "content": "내용2", "site_id": "site1", "score": 0.8, "metadata": {}},
            {"source": "doc1.txt", "content": "내용3", "site_id": "site1", "score": 0.7, "metadata": {}},  # 중복
        ]
        
        sources = rag_service._extract_sources(results)
        
        assert len(sources) == 2  # 중복 제거
        assert "doc1.txt" in sources
        assert "doc2.txt" in sources
    
    def test_extract_sources_empty(self, rag_service):
        """빈 결과에서 소스 추출 테스트"""
        results = []
        
        sources = rag_service._extract_sources(results)
        
        assert len(sources) == 0
    
    @pytest.mark.asyncio
    async def test_query_performance_measurement(self, rag_service, mock_vector_store, mock_openai_client):
        """쿼리 성능 측정 테스트"""
        query = "성능 테스트"
        site_ids = ["docs-site"]
        
        result = await rag_service.query(query, site_ids, 5)
        
        assert "query_time" in result
        assert isinstance(result["query_time"], (int, float))
        assert result["query_time"] > 0
    
    @pytest.mark.asyncio
    async def test_query_with_different_parameters(self, rag_service, mock_vector_store, mock_openai_client):
        """다양한 파라미터로 쿼리 테스트"""
        query = "파라미터 테스트"
        
        # 다른 max_results 값으로 테스트
        result = await rag_service.query(query, ["site1"], max_results=3)
        
        assert result is not None
        mock_vector_store.search_documents.assert_called_with(
            query=query,
            site_ids=["site1"],
            max_results=3
        ) 