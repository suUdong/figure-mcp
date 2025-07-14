"""
pytest 설정 및 공통 fixtures
"""
import os
import sys
import pytest
import asyncio
from typing import AsyncGenerator, Generator
from unittest.mock import Mock, patch

# 프로젝트 루트를 Python path에 추가
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from fastapi import FastAPI
from fastapi.testclient import TestClient
from fastapi.middleware.cors import CORSMiddleware
from app.config import Settings
from app.api import rag, documents, sites


@pytest.fixture(scope="session", autouse=True)
def mock_environment_variables():
    """테스트용 환경 변수 모킹"""
    env_vars = {
        "OPENAI_API_KEY": "test-openai-key",
        "CHROMA_PERSIST_DIRECTORY": "./test_chroma_db",
        "ENVIRONMENT": "test",
        "LOG_LEVEL": "DEBUG",
        "DEBUG": "true"
    }
    
    with patch.dict(os.environ, env_vars, clear=False):
        yield


@pytest.fixture(scope="session")
def event_loop() -> Generator[asyncio.AbstractEventLoop, None, None]:
    """세션 스코프 이벤트 루프 생성"""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture
def test_settings() -> Settings:
    """테스트용 설정"""
    return Settings(
        openai_api_key="test-key",
        chroma_persist_directory="./test_chroma_db",
        debug=True
    )


@pytest.fixture
def app(test_settings):
    """테스트용 FastAPI 앱"""
    # 테스트용 FastAPI 앱 생성 (lifespan 없이)
    test_app = FastAPI(
        title="Figure Backend API - Test",
        description="테스트용 Figure 백엔드 API",
        version="test",
        docs_url="/docs",
        redoc_url="/redoc"
    )
    
    # CORS 미들웨어 설정
    test_app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    
    # 라우터 포함
    test_app.include_router(rag.router, prefix="/api")
    test_app.include_router(documents.router, prefix="/api")
    test_app.include_router(sites.router, prefix="/api")
    
    return test_app


@pytest.fixture
def client(app) -> TestClient:
    """테스트 클라이언트"""
    return TestClient(app)


@pytest.fixture
def mock_openai_client():
    """모킹된 OpenAI 클라이언트"""
    mock_client = Mock()
    mock_embeddings = Mock()
    mock_embeddings.create.return_value.data = [
        Mock(embedding=[0.1, 0.2, 0.3] * 512)  # 1536 dimensions
    ]
    mock_client.embeddings = mock_embeddings
    
    mock_chat = Mock()
    mock_chat.completions.create.return_value.choices = [
        Mock(message=Mock(content="테스트 응답입니다."))
    ]
    mock_client.chat = mock_chat
    
    return mock_client


@pytest.fixture
def mock_chroma_client():
    """모킹된 ChromaDB 클라이언트"""
    mock_client = Mock()
    mock_collection = Mock()
    
    # 컬렉션 메서드들 모킹
    mock_collection.add.return_value = None
    mock_collection.query.return_value = {
        "documents": [["테스트 문서 내용"]],
        "metadatas": [[{"source": "test.txt"}]],
        "distances": [[0.5]]
    }
    mock_collection.delete.return_value = None
    mock_collection.count.return_value = 1
    
    mock_client.get_or_create_collection.return_value = mock_collection
    mock_client.delete_collection.return_value = None
    
    return mock_client


@pytest.fixture
def sample_document_data():
    """테스트용 문서 데이터"""
    return {
        "site_id": "test-site",
        "title": "테스트 문서",
        "content": "이것은 테스트용 문서 내용입니다. RAG 시스템을 테스트하기 위한 내용이 포함되어 있습니다.",
        "metadata": {
            "author": "테스트 작성자",
            "category": "테스트"
        }
    }


@pytest.fixture
def sample_site_data():
    """테스트용 사이트 데이터"""
    return {
        "name": "테스트 사이트",
        "description": "테스트용 사이트입니다",
        "url": "https://test.example.com",
        "is_active": True
    }


@pytest.fixture
def sample_query_data():
    """테스트용 쿼리 데이터"""
    return {
        "query": "RAG 시스템에 대해 설명해주세요",
        "site_ids": ["test-site"],
        "max_results": 5
    }


@pytest.fixture
def multiple_documents_data():
    """여러 문서 테스트 데이터"""
    return [
        {
            "site_id": "site-1",
            "title": "RAG 시스템 개요",
            "content": "RAG(Retrieval-Augmented Generation)는 검색과 생성을 결합한 AI 기술입니다. 외부 지식 베이스에서 관련 정보를 검색하고, 이를 바탕으로 더 정확하고 유용한 답변을 생성합니다.",
            "metadata": {"category": "AI", "author": "Tech Writer", "difficulty": "beginner"}
        },
        {
            "site_id": "site-1", 
            "title": "벡터 데이터베이스 활용",
            "content": "벡터 데이터베이스는 텍스트를 수치형 벡터로 변환하여 저장하고 유사성 검색을 수행하는 데이터베이스입니다. ChromaDB, Pinecone, Weaviate 등이 있습니다.",
            "metadata": {"category": "Database", "author": "DB Expert", "difficulty": "intermediate"}
        },
        {
            "site_id": "site-2",
            "title": "LangChain 프레임워크",
            "content": "LangChain은 언어 모델을 활용한 애플리케이션 개발을 위한 프레임워크입니다. 체인, 에이전트, 메모리 등의 컴포넌트를 제공합니다.",
            "metadata": {"category": "Framework", "author": "Dev Team", "difficulty": "advanced"}
        }
    ]


@pytest.fixture
def multiple_sites_data():
    """여러 사이트 테스트 데이터"""
    return [
        {
            "name": "AI 기술 블로그",
            "description": "최신 AI 기술 동향과 튜토리얼을 제공하는 블로그",
            "url": "https://ai-tech-blog.com",
            "is_active": True
        },
        {
            "name": "개발자 문서",
            "description": "개발자를 위한 기술 문서 사이트",
            "url": "https://dev-docs.com",
            "is_active": True
        },
        {
            "name": "아카이브 사이트",
            "description": "이전 버전 문서 보관 사이트",
            "url": "https://archive.example.com",
            "is_active": False
        }
    ]


@pytest.fixture
def performance_test_data():
    """성능 테스트용 대용량 데이터"""
    base_content = "이것은 성능 테스트를 위한 문서입니다. " * 100
    
    return [
        {
            "site_id": f"perf-site-{i}",
            "title": f"성능 테스트 문서 {i}",
            "content": f"{base_content} 문서 번호: {i}",
            "metadata": {"type": "performance", "index": i}
        }
        for i in range(10)  # 10개의 문서
    ]


@pytest.fixture
def invalid_data_samples():
    """잘못된 데이터 샘플들"""
    return {
        "invalid_site": {
            "name": "",  # 빈 이름
            "description": "테스트",
            "url": "invalid-url",  # 잘못된 URL
            "is_active": "yes"  # 잘못된 타입
        },
        "invalid_document": {
            "site_id": "",  # 빈 사이트 ID
            "title": "a" * 501,  # 너무 긴 제목
            "content": "",  # 빈 내용
            "metadata": "not-a-dict"  # 잘못된 타입
        },
        "invalid_query": {
            "query": "",  # 빈 쿼리
            "site_ids": "not-a-list",  # 잘못된 타입
            "max_results": -1,  # 음수
            "use_reranking": "not-boolean"  # 잘못된 타입
        }
    }


@pytest.fixture
def mock_error_responses():
    """에러 응답 모킹용 데이터"""
    return {
        "openai_error": Exception("OpenAI API 한도 초과"),
        "chroma_error": Exception("ChromaDB 연결 실패"),
        "validation_error": ValueError("잘못된 입력 데이터"),
        "timeout_error": TimeoutError("요청 시간 초과")
    }


@pytest.fixture(autouse=True)
def cleanup_test_files():
    """테스트 후 임시 파일 정리"""
    yield
    # 테스트 ChromaDB 디렉토리 정리
    import shutil
    test_db_path = "./test_chroma_db"
    if os.path.exists(test_db_path):
        try:
            shutil.rmtree(test_db_path)
        except (OSError, PermissionError):
            # Windows에서 파일이 사용 중인 경우 무시
            pass 