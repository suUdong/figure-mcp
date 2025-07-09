"""
Pydantic 모델 스키마 테스트
"""
import pytest
from datetime import datetime
from pydantic import ValidationError

from app.models.schemas import (
    SiteCreate, SiteResponse, SiteUpdate,
    DocumentCreate, DocumentResponse, DocumentUpdate,
    QueryRequest, QueryResponse, QueryResult
)


pytestmark = pytest.mark.model


class TestSiteSchemas:
    """사이트 스키마 테스트"""
    
    def test_site_create_valid(self):
        """유효한 사이트 생성 데이터 테스트"""
        data = {
            "name": "테스트 사이트",
            "description": "테스트용 사이트입니다",
            "url": "https://test.example.com",
            "is_active": True
        }
        site = SiteCreate(**data)
        assert site.name == "테스트 사이트"
        assert site.url == "https://test.example.com"
        assert site.is_active is True
    
    def test_site_create_invalid_url(self):
        """잘못된 URL 형식 테스트"""
        data = {
            "name": "테스트 사이트",
            "description": "테스트용 사이트입니다",
            "url": "invalid-url",
            "is_active": True
        }
        with pytest.raises(ValidationError) as exc_info:
            SiteCreate(**data)
        assert "url" in str(exc_info.value)
    
    def test_site_create_missing_required_fields(self):
        """필수 필드 누락 테스트"""
        data = {
            "description": "테스트용 사이트입니다"
        }
        with pytest.raises(ValidationError) as exc_info:
            SiteCreate(**data)
        assert "name" in str(exc_info.value)
    
    def test_site_update_partial(self):
        """부분 업데이트 테스트"""
        data = {
            "name": "수정된 사이트 이름",
            "is_active": False
        }
        site = SiteUpdate(**data)
        assert site.name == "수정된 사이트 이름"
        assert site.is_active is False
        assert site.description is None
    
    def test_site_response_with_timestamps(self):
        """타임스탬프가 포함된 응답 테스트"""
        now = datetime.now()
        data = {
            "id": "test-site-id",
            "name": "테스트 사이트",
            "description": "테스트용 사이트입니다",
            "url": "https://test.example.com",
            "is_active": True,
            "created_at": now,
            "updated_at": now,
            "document_count": 5
        }
        site = SiteResponse(**data)
        assert site.id == "test-site-id"
        assert site.document_count == 5
        assert isinstance(site.created_at, datetime)


class TestDocumentSchemas:
    """문서 스키마 테스트"""
    
    def test_document_create_valid(self):
        """유효한 문서 생성 데이터 테스트"""
        data = {
            "site_id": "test-site",
            "title": "테스트 문서",
            "content": "이것은 테스트 문서입니다.",
            "metadata": {
                "author": "테스트 작성자",
                "category": "테스트"
            }
        }
        doc = DocumentCreate(**data)
        assert doc.site_id == "test-site"
        assert doc.title == "테스트 문서"
        assert doc.metadata["author"] == "테스트 작성자"
    
    def test_document_create_empty_content(self):
        """빈 내용 테스트"""
        data = {
            "site_id": "test-site",
            "title": "테스트 문서",
            "content": "",
            "metadata": {}
        }
        with pytest.raises(ValidationError) as exc_info:
            DocumentCreate(**data)
        assert "content" in str(exc_info.value)
    
    def test_document_create_long_title(self):
        """긴 제목 테스트"""
        data = {
            "site_id": "test-site",
            "title": "a" * 501,  # 500자 초과
            "content": "테스트 내용",
            "metadata": {}
        }
        with pytest.raises(ValidationError) as exc_info:
            DocumentCreate(**data)
        assert "title" in str(exc_info.value)
    
    def test_document_response_with_vector_id(self):
        """벡터 ID가 포함된 응답 테스트"""
        now = datetime.now()
        data = {
            "id": "test-doc-id",
            "site_id": "test-site",
            "title": "테스트 문서",
            "content": "이것은 테스트 문서입니다.",
            "doc_type": "text",
            "metadata": {"author": "테스트 작성자"},
            "vector_id": "vector-123",
            "created_at": now,
            "updated_at": now
        }
        doc = DocumentResponse(**data)
        assert doc.vector_id == "vector-123"
        assert doc.doc_type == "text"
        assert isinstance(doc.created_at, datetime)


class TestQuerySchemas:
    """쿼리 스키마 테스트"""
    
    def test_query_request_valid(self):
        """유효한 쿼리 요청 테스트"""
        data = {
            "query": "RAG 시스템에 대해 설명해주세요",
            "site_ids": ["site1", "site2"],
            "max_results": 5
        }
        query = QueryRequest(**data)
        assert query.query == "RAG 시스템에 대해 설명해주세요"
        assert len(query.site_ids) == 2
        assert query.max_results == 5
    
    def test_query_request_empty_query(self):
        """빈 쿼리 테스트"""
        data = {
            "query": "",
            "site_ids": ["site1"],
            "max_results": 5
        }
        with pytest.raises(ValidationError) as exc_info:
            QueryRequest(**data)
        assert "query" in str(exc_info.value)
    
    def test_query_request_invalid_max_results(self):
        """잘못된 최대 결과 수 테스트"""
        data = {
            "query": "테스트 쿼리",
            "site_ids": ["site1"],
            "max_results": 0
        }
        with pytest.raises(ValidationError) as exc_info:
            QueryRequest(**data)
        assert "max_results" in str(exc_info.value)
    
    def test_query_request_default_values(self):
        """기본값 테스트"""
        data = {
            "query": "테스트 쿼리"
        }
        query = QueryRequest(**data)
        assert query.site_ids == []
        assert query.max_results == 5
        assert query.use_reranking is True
    
    def test_query_result_valid(self):
        """유효한 쿼리 결과 테스트"""
        data = {
            "content": "찾은 문서 내용",
            "source": "test-document.txt",
            "site_id": "test-site",
            "score": 0.85,
            "metadata": {"author": "테스트 작성자"}
        }
        result = QueryResult(**data)
        assert result.content == "찾은 문서 내용"
        assert result.score == 0.85
        assert 0.0 <= result.score <= 1.0
    
    def test_query_result_invalid_score(self):
        """잘못된 점수 테스트"""
        data = {
            "content": "찾은 문서 내용",
            "source": "test-document.txt",
            "site_id": "test-site",
            "score": 1.5,  # 1.0 초과
            "metadata": {}
        }
        with pytest.raises(ValidationError) as exc_info:
            QueryResult(**data)
        assert "score" in str(exc_info.value)
    
    def test_query_response_complete(self):
        """완전한 쿼리 응답 테스트"""
        result_data = {
            "content": "찾은 문서 내용",
            "source": "test-document.txt",
            "site_id": "test-site",
            "score": 0.85,
            "metadata": {"author": "테스트 작성자"}
        }
        
        data = {
            "answer": "AI가 생성한 답변입니다.",
            "results": [result_data],
            "total_results": 1,
            "query_time": 1.23,
            "sources": ["test-document.txt"]
        }
        
        response = QueryResponse(**data)
        assert response.answer == "AI가 생성한 답변입니다."
        assert len(response.results) == 1
        assert response.total_results == 1
        assert response.query_time == 1.23
        assert "test-document.txt" in response.sources 