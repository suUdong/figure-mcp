"""
Documents API 엔드포인트 테스트
"""
import pytest
from unittest.mock import patch, AsyncMock
from fastapi.testclient import TestClient


pytestmark = pytest.mark.api


class TestDocumentsAPI:
    """Documents API 테스트"""
    
    @pytest.fixture
    def mock_vector_store(self):
        """모킹된 VectorStore"""
        mock_store = AsyncMock()
        mock_store.add_document.return_value = True
        mock_store.delete_document.return_value = True
        mock_store.get_document_count.return_value = 5
        mock_store.search_documents.return_value = [
            {
                "content": "테스트 문서 내용",
                "source": "test.txt",
                "site_id": "test-site",
                "score": 0.9,
                "metadata": {"author": "테스트 작성자"}
            }
        ]
        return mock_store
    
    @pytest.fixture
    def client_with_mocked_vector_store(self, app, mock_vector_store):
        """모킹된 벡터 스토어가 포함된 테스트 클라이언트"""
        with patch('app.api.documents.vector_store', mock_vector_store):
            yield TestClient(app)
    
    def test_upload_document_success(self, client_with_mocked_vector_store, mock_vector_store, sample_document_data):
        """문서 업로드 성공 테스트"""
        response = client_with_mocked_vector_store.post("/api/documents/upload", json=sample_document_data)
        
        assert response.status_code == 200
        data = response.json()
        
        assert "message" in data
        assert "document_id" in data
        assert "success" in data["message"]
        
        mock_vector_store.add_document.assert_called_once()
    
    def test_upload_document_invalid_data(self, client_with_mocked_vector_store):
        """잘못된 문서 데이터 업로드 테스트"""
        invalid_data = {
            "site_id": "test-site",
            "title": "",  # 빈 제목
            "content": "",  # 빈 내용
            "metadata": {}
        }
        
        response = client_with_mocked_vector_store.post("/api/documents/upload", json=invalid_data)
        
        assert response.status_code == 422  # Validation Error
    
    def test_upload_document_service_error(self, client_with_mocked_vector_store, mock_vector_store, sample_document_data):
        """문서 업로드 서비스 에러 테스트"""
        mock_vector_store.add_document.side_effect = Exception("Upload failed")
        
        response = client_with_mocked_vector_store.post("/api/documents/upload", json=sample_document_data)
        
        assert response.status_code == 500
        data = response.json()
        assert "detail" in data
    
    def test_delete_document_success(self, client_with_mocked_vector_store, mock_vector_store):
        """문서 삭제 성공 테스트"""
        document_id = "test-doc-id"
        
        response = client_with_mocked_vector_store.delete(f"/api/documents/{document_id}")
        
        assert response.status_code == 200
        data = response.json()
        
        assert "message" in data
        assert "success" in data["message"]
        
        mock_vector_store.delete_document.assert_called_once_with(document_id)
    
    def test_delete_document_not_found(self, client_with_mocked_vector_store, mock_vector_store):
        """존재하지 않는 문서 삭제 테스트"""
        document_id = "nonexistent-doc"
        mock_vector_store.delete_document.return_value = False
        
        response = client_with_mocked_vector_store.delete(f"/api/documents/{document_id}")
        
        assert response.status_code == 404
        data = response.json()
        assert "detail" in data
    
    def test_search_documents_success(self, client_with_mocked_vector_store, mock_vector_store):
        """문서 검색 성공 테스트"""
        query_params = {
            "query": "테스트 쿼리",
            "site_id": "test-site",
            "limit": 5
        }
        
        response = client_with_mocked_vector_store.get("/api/documents/search", params=query_params)
        
        assert response.status_code == 200
        data = response.json()
        
        assert "results" in data
        assert "total" in data
        assert len(data["results"]) == 1
        assert data["total"] == 1
        
        mock_vector_store.search_documents.assert_called_once()
    
    def test_get_document_stats_success(self, client_with_mocked_vector_store, mock_vector_store):
        """문서 통계 조회 성공 테스트"""
        response = client_with_mocked_vector_store.get("/api/documents/stats")
        
        assert response.status_code == 200
        data = response.json()
        
        assert "total_documents" in data
        assert data["total_documents"] == 5
        
        mock_vector_store.get_document_count.assert_called_once()
    
    def test_get_document_stats_by_site(self, client_with_mocked_vector_store, mock_vector_store):
        """사이트별 문서 통계 조회 테스트"""
        site_id = "test-site"
        
        response = client_with_mocked_vector_store.get(f"/api/documents/stats?site_id={site_id}")
        
        assert response.status_code == 200
        data = response.json()
        
        assert "total_documents" in data
        assert "site_id" in data
        assert data["site_id"] == site_id
        
        mock_vector_store.get_document_count.assert_called_once_with(site_id) 