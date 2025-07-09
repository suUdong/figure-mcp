"""
VectorStore 서비스 테스트
"""
import pytest
from unittest.mock import Mock, patch, AsyncMock
from typing import Dict, Any, List

from app.services.vector_store import VectorStoreService
from app.config import Settings


pytestmark = pytest.mark.service


class TestVectorStore:
    """VectorStore 테스트"""
    
    @pytest.fixture
    def vector_store(self, test_settings, mock_chroma_client, mock_openai_client):
        """VectorStore 인스턴스 생성"""
        with patch('app.services.vector_store.chromadb.PersistentClient') as mock_chroma, \
             patch('app.services.vector_store.OpenAIEmbeddings') as mock_openai:
            
            mock_chroma.return_value = mock_chroma_client
            mock_openai.return_value = mock_openai_client
            
            store = VectorStoreService()
            return store
    
    def test_vector_store_initialization(self, vector_store):
        """VectorStore 초기화 테스트"""
        assert vector_store is not None
        assert hasattr(vector_store, '_client')
        assert hasattr(vector_store, '_collection')
        assert hasattr(vector_store, '_embeddings')
    
    @pytest.mark.asyncio
    async def test_chunk_text_basic(self, vector_store):
        """기본 텍스트 청킹 테스트"""
        await vector_store.initialize()
        text = "이것은 테스트 문서입니다. " * 100  # 긴 텍스트
        chunks = vector_store._text_splitter.split_text(text)
        
        assert len(chunks) > 0
        assert all(len(chunk) <= 1000 for chunk in chunks)  # chunk_size
        assert all(len(chunk) > 0 for chunk in chunks)
    
    @pytest.mark.asyncio
    async def test_chunk_text_short(self, vector_store):
        """짧은 텍스트 청킹 테스트"""
        await vector_store.initialize()
        text = "짧은 텍스트입니다."
        chunks = vector_store._text_splitter.split_text(text)
        
        assert len(chunks) == 1
        assert chunks[0] == text
    
    @pytest.mark.asyncio
    async def test_chunk_text_empty(self, vector_store):
        """빈 텍스트 청킹 테스트"""
        await vector_store.initialize()
        text = ""
        chunks = vector_store._text_splitter.split_text(text)
        
        assert len(chunks) == 0
    
    @pytest.mark.asyncio
    async def test_get_embeddings_success(self, vector_store, mock_openai_client):
        """임베딩 생성 성공 테스트"""
        texts = ["테스트 텍스트 1", "테스트 텍스트 2"]
        
        # OpenAI 응답 모킹
        mock_openai_client.embeddings.create.return_value.data = [
            Mock(embedding=[0.1, 0.2, 0.3] * 512),
            Mock(embedding=[0.4, 0.5, 0.6] * 512)
        ]
        
        embeddings = await vector_store._get_embeddings(texts)
        
        assert len(embeddings) == 2
        assert len(embeddings[0]) == 1536  # embedding dimension
        mock_openai_client.embeddings.create.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_get_embeddings_failure(self, vector_store, mock_openai_client):
        """임베딩 생성 실패 테스트"""
        texts = ["테스트 텍스트"]
        
        # OpenAI 에러 시뮬레이션
        mock_openai_client.embeddings.create.side_effect = Exception("API Error")
        
        with pytest.raises(Exception):
            await vector_store._get_embeddings(texts)
    
    @pytest.mark.asyncio
    async def test_add_document_success(self, vector_store, mock_chroma_client, mock_openai_client):
        """문서 추가 성공 테스트"""
        from app.models.schemas import DocumentCreate
        
        document = DocumentCreate(
            title="테스트 문서",
            content="이것은 테스트 문서입니다.",
            site_id="test-site",
            metadata={"author": "테스트 작성자"}
        )
        
        # OpenAI 임베딩 응답 모킹
        mock_openai_client.embeddings.create.return_value.data = [
            Mock(embedding=[0.1, 0.2, 0.3] * 512)
        ]
        
        result = await vector_store.add_document(document)
        
        assert result is True
        mock_chroma_client.get_or_create_collection.assert_called()
        mock_openai_client.embeddings.create.assert_called()
    
    @pytest.mark.asyncio
    async def test_add_document_long_content(self, vector_store, mock_chroma_client, mock_openai_client):
        """긴 내용의 문서 추가 테스트"""
        long_content = "이것은 긴 테스트 문서입니다. " * 200
        document_data = {
            "id": "test-doc-2",
            "site_id": "test-site",
            "title": "긴 테스트 문서",
            "content": long_content,
            "metadata": {"author": "테스트 작성자"}
        }
        
        # 여러 청크에 대한 임베딩 응답 모킹
        mock_openai_client.embeddings.create.return_value.data = [
            Mock(embedding=[0.1, 0.2, 0.3] * 512),
            Mock(embedding=[0.4, 0.5, 0.6] * 512)
        ]
        
        result = await vector_store.add_document(document_data)
        
        assert result is True
        # 임베딩 호출 확인 (여러 청크)
        mock_openai_client.embeddings.create.assert_called()
    
    @pytest.mark.asyncio
    async def test_search_documents_success(self, vector_store, mock_chroma_client, mock_openai_client):
        """문서 검색 성공 테스트"""
        query = "테스트 쿼리"
        site_ids = ["site1", "site2"]
        
        # OpenAI 임베딩 응답 모킹
        mock_openai_client.embeddings.create.return_value.data = [
            Mock(embedding=[0.1, 0.2, 0.3] * 512)
        ]
        
        # ChromaDB 검색 응답 모킹
        mock_collection = mock_chroma_client.get_or_create_collection.return_value
        mock_collection.query.return_value = {
            "documents": [["테스트 문서 내용 1", "테스트 문서 내용 2"]],
            "metadatas": [[
                {"document_id": "doc1", "site_id": "site1", "source": "test1.txt"},
                {"document_id": "doc2", "site_id": "site2", "source": "test2.txt"}
            ]],
            "distances": [[0.3, 0.5]]
        }
        
        results = await vector_store.search_similar(query, site_ids, max_results=5)
        
        assert len(results) == 2
        assert results[0]["content"] == "테스트 문서 내용 1"
        assert results[0]["site_id"] == "site1"
        assert results[0]["score"] > results[1]["score"]  # 거리 기반 점수
        
        mock_openai_client.embeddings.create.assert_called_once()
        mock_collection.query.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_search_documents_no_results(self, vector_store, mock_chroma_client, mock_openai_client):
        """검색 결과 없음 테스트"""
        query = "존재하지 않는 내용"
        
        # OpenAI 임베딩 응답 모킹
        mock_openai_client.embeddings.create.return_value.data = [
            Mock(embedding=[0.1, 0.2, 0.3] * 512)
        ]
        
        # ChromaDB 빈 결과 모킹
        mock_collection = mock_chroma_client.get_or_create_collection.return_value
        mock_collection.query.return_value = {
            "documents": [[]],
            "metadatas": [[]],
            "distances": [[]]
        }
        
        results = await vector_store.search_similar(query, [], max_results=5)
        
        assert len(results) == 0
    
    @pytest.mark.asyncio
    async def test_delete_document_success(self, vector_store, mock_chroma_client):
        """문서 삭제 성공 테스트"""
        document_id = "test-doc-1"
        
        result = await vector_store.delete_document(document_id)
        
        assert result is True
        mock_collection = mock_chroma_client.get_or_create_collection.return_value
        mock_collection.delete.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_delete_document_failure(self, vector_store, mock_chroma_client):
        """문서 삭제 실패 테스트"""
        document_id = "nonexistent-doc"
        
        # ChromaDB 삭제 에러 시뮬레이션
        mock_collection = mock_chroma_client.get_or_create_collection.return_value
        mock_collection.delete.side_effect = Exception("Delete failed")
        
        result = await vector_store.delete_document(document_id)
        
        assert result is False
    
    @pytest.mark.asyncio
    async def test_get_document_count(self, vector_store, mock_chroma_client):
        """문서 개수 조회 테스트"""
        site_id = "test-site"
        
        # ChromaDB count 응답 모킹
        mock_collection = mock_chroma_client.get_or_create_collection.return_value
        mock_collection.count.return_value = 10
        
        count = await vector_store.get_document_count(site_id)
        
        assert count == 10
        mock_collection.count.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_get_document_count_no_site(self, vector_store, mock_chroma_client):
        """전체 문서 개수 조회 테스트"""
        # ChromaDB count 응답 모킹
        mock_collection = mock_chroma_client.get_or_create_collection.return_value
        mock_collection.count.return_value = 25
        
        count = await vector_store.get_document_count()
        
        assert count == 25
        mock_collection.count.assert_called_once()
    
    def test_calculate_score_from_distance(self, vector_store):
        """거리 기반 점수 계산 테스트"""
        # 거리가 0에 가까울수록 점수가 높아야 함
        score_high = vector_store._calculate_score_from_distance(0.1)
        score_low = vector_store._calculate_score_from_distance(0.9)
        
        assert 0.0 <= score_high <= 1.0
        assert 0.0 <= score_low <= 1.0
        assert score_high > score_low
    
    def test_prepare_metadata(self, vector_store):
        """메타데이터 준비 테스트"""
        document_data = {
            "id": "test-doc",
            "site_id": "test-site",
            "title": "테스트 문서",
            "metadata": {"author": "테스트 작성자", "category": "테스트"}
        }
        chunk_index = 0
        
        metadata = vector_store._prepare_metadata(document_data, chunk_index)
        
        assert metadata["document_id"] == "test-doc"
        assert metadata["site_id"] == "test-site"
        assert metadata["title"] == "테스트 문서"
        assert metadata["chunk_index"] == 0
        assert metadata["author"] == "테스트 작성자"
        assert metadata["category"] == "테스트" 