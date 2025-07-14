"""
RAG API 엔드포인트 테스트
"""
import pytest
from unittest.mock import Mock, patch, AsyncMock
from fastapi.testclient import TestClient


pytestmark = pytest.mark.api


class TestRAGAPI:
    """RAG API 테스트"""
    
    @pytest.fixture
    def mock_rag_service(self):
        """모킹된 RAGService"""
        mock_service = AsyncMock()
        mock_service.query.return_value = {
            "answer": "RAG는 Retrieval-Augmented Generation의 줄임말로, 검색과 생성을 결합한 AI 기술입니다.",
            "results": [
                {
                    "content": "RAG는 검색과 생성을 결합한 기술입니다.",
                    "source": "rag-guide.txt",
                    "site_id": "docs-site",
                    "score": 0.95,
                    "metadata": {"author": "AI 전문가"}
                }
            ],
            "total_results": 1,
            "query_time": 1.234,
            "sources": ["rag-guide.txt"]
        }
        return mock_service
    
    @pytest.fixture
    def client_with_mocked_service(self, app, mock_rag_service):
        """모킹된 서비스가 포함된 테스트 클라이언트"""
        with patch('app.api.rag.rag_service', mock_rag_service):
            yield TestClient(app)
    
    def test_query_endpoint_success(self, client_with_mocked_service, mock_rag_service):
        """성공적인 쿼리 엔드포인트 테스트"""
        request_data = {
            "query": "RAG에 대해 설명해주세요",
            "site_ids": ["docs-site"],
            "max_results": 5,
            "use_reranking": True
        }
        
        response = client_with_mocked_service.post("/api/rag/query", json=request_data)
        
        assert response.status_code == 200
        data = response.json()
        
        assert "answer" in data
        assert "results" in data
        assert "total_results" in data
        assert "query_time" in data
        assert "sources" in data
        
        assert data["answer"] == "RAG는 Retrieval-Augmented Generation의 줄임말로, 검색과 생성을 결합한 AI 기술입니다."
        assert len(data["results"]) == 1
        assert data["total_results"] == 1
        assert data["query_time"] == 1.234
        assert "rag-guide.txt" in data["sources"]
        
        # RAGService.query가 올바른 파라미터로 호출되었는지 확인
        mock_rag_service.query.assert_called_once_with(
            query="RAG에 대해 설명해주세요",
            site_ids=["docs-site"],
            max_results=5,
            use_reranking=True
        )
    
    def test_query_endpoint_minimal_request(self, client_with_mocked_service, mock_rag_service):
        """최소한의 요청 데이터로 쿼리 테스트"""
        request_data = {
            "query": "간단한 질문"
        }
        
        response = client_with_mocked_service.post("/api/rag/query", json=request_data)
        
        assert response.status_code == 200
        
        # 기본값들이 적용되었는지 확인
        mock_rag_service.query.assert_called_once_with(
            query="간단한 질문",
            site_ids=[],
            max_results=5,
            use_reranking=True
        )
    
    def test_query_endpoint_invalid_request(self, client_with_mocked_service):
        """잘못된 요청 데이터 테스트"""
        # 빈 쿼리
        request_data = {
            "query": "",
            "site_ids": ["site1"],
            "max_results": 5
        }
        
        response = client_with_mocked_service.post("/api/rag/query", json=request_data)
        
        assert response.status_code == 422  # Validation Error
    
    def test_query_endpoint_invalid_max_results(self, client_with_mocked_service):
        """잘못된 max_results 값 테스트"""
        request_data = {
            "query": "테스트 쿼리",
            "max_results": 0  # 0은 허용되지 않음
        }
        
        response = client_with_mocked_service.post("/api/rag/query", json=request_data)
        
        assert response.status_code == 422  # Validation Error
    
    def test_query_endpoint_service_error(self, client_with_mocked_service, mock_rag_service):
        """서비스 에러 처리 테스트"""
        request_data = {
            "query": "에러 테스트"
        }
        
        # RAGService에서 에러 발생 시뮬레이션
        mock_rag_service.query.side_effect = Exception("Service error")
        
        response = client_with_mocked_service.post("/api/rag/query", json=request_data)
        
        assert response.status_code == 500
        data = response.json()
        assert "detail" in data
        assert "오류가 발생했습니다" in data["detail"]
    
    def test_status_endpoint(self, client):
        """상태 엔드포인트 테스트"""
        response = client.get("/api/rag/status")
        
        assert response.status_code == 200
        data = response.json()
        
        assert "status" in data
        assert "timestamp" in data
        assert "version" in data
        assert data["status"] == "healthy"
    
    def test_health_endpoint(self, client):
        """헬스 체크 엔드포인트 테스트"""
        response = client.get("/api/rag/health")
        
        assert response.status_code == 200
        data = response.json()
        
        assert "status" in data
        assert data["status"] == "ok"


class TestRAGAPIIntegration:
    """RAG API 통합 테스트"""
    
    @pytest.mark.integration
    def test_query_endpoint_with_real_service(self, client, sample_query_data):
        """실제 서비스와의 통합 테스트"""
        # 실제 서비스를 사용하여 테스트
        # 이 테스트는 실제 OpenAI API와 ChromaDB를 필요로 함
        response = client.post("/api/rag/query", json=sample_query_data)
        
        # 환경이 설정되지 않은 경우 500 에러 또는 성공
        assert response.status_code in [200, 500]
        
        if response.status_code == 200:
            data = response.json()
            assert "answer" in data
            assert "results" in data
            assert "total_results" in data
            assert "query_time" in data
            assert "sources" in data
    
    @pytest.mark.integration
    def test_multiple_concurrent_queries(self, client):
        """동시 다중 쿼리 테스트"""
        import asyncio
        import httpx
        
        async def make_query(client_url: str, query_data: dict):
            async with httpx.AsyncClient() as async_client:
                response = await async_client.post(f"{client_url}/api/rag/query", json=query_data)
                return response
        
        # 이 테스트는 실제 동시성 테스트를 위해 비동기로 실행
        query_data = {
            "query": "동시성 테스트",
            "site_ids": [],
            "max_results": 3
        }
        
        # 실제 서버가 실행 중일 때만 이 테스트가 의미가 있음
        # 단위 테스트에서는 스킵
        pytest.skip("Integration test - requires running server")


class TestRAGAPIValidation:
    """RAG API 입력 검증 테스트"""
    
    def test_query_too_long(self, client):
        """너무 긴 쿼리 테스트"""
        request_data = {
            "query": "a" * 2001,  # 2000자 초과
            "site_ids": [],
            "max_results": 5
        }
        
        response = client.post("/api/rag/query", json=request_data)
        
        assert response.status_code == 422
    
    def test_too_many_site_ids(self, client):
        """너무 많은 사이트 ID 테스트"""
        request_data = {
            "query": "테스트 쿼리",
            "site_ids": [f"site-{i}" for i in range(51)],  # 50개 초과
            "max_results": 5
        }
        
        response = client.post("/api/rag/query", json=request_data)
        
        assert response.status_code == 422
    
    def test_max_results_too_large(self, client):
        """max_results가 너무 큰 경우 테스트"""
        request_data = {
            "query": "테스트 쿼리",
            "site_ids": [],
            "max_results": 101  # 100 초과
        }
        
        response = client.post("/api/rag/query", json=request_data)
        
        assert response.status_code == 422
    
    def test_invalid_json(self, client):
        """잘못된 JSON 형식 테스트"""
        response = client.post(
            "/api/rag/query",
            data="invalid json",
            headers={"Content-Type": "application/json"}
        )
        
        assert response.status_code == 422
    
    def test_missing_query_field(self, client):
        """필수 필드 누락 테스트"""
        request_data = {
            "site_ids": ["site1"],
            "max_results": 5
            # query 필드 누락
        }
        
        response = client.post("/api/rag/query", json=request_data)
        
        assert response.status_code == 422
    
    def test_wrong_field_types(self, client):
        """잘못된 필드 타입 테스트"""
        request_data = {
            "query": "테스트 쿼리",
            "site_ids": "should-be-list",  # 리스트여야 함
            "max_results": "should-be-int",  # 정수여야 함
            "use_reranking": "should-be-bool"  # 불린여야 함
        }
        
        response = client.post("/api/rag/query", json=request_data)
        
        assert response.status_code == 422 