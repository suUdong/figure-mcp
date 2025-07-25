"""
Pydantic data models and schemas
"""
from typing import Optional, List, Dict, Any, Generic, TypeVar
from datetime import datetime
from enum import Enum
from pydantic import BaseModel, Field, ConfigDict

# Generic type variable for APIResponse
T = TypeVar('T')


class DocumentType(str, Enum):
    """문서 타입"""
    WEBSITE = "website"
    PDF = "pdf"
    TEXT = "text"
    DOC = "doc"
    CONFLUENCE = "confluence"
    JIRA = "jira"
    

class Site(BaseModel):
    """사이트 정보 모델"""
    model_config = ConfigDict(
        str_strip_whitespace=True,
        validate_assignment=True
    )
    
    id: Optional[str] = Field(None, description="사이트 ID")
    name: str = Field(..., min_length=1, description="사이트 이름")
    url: str = Field(..., description="사이트 URL")
    description: Optional[str] = Field(None, description="사이트 설명")
    created_at: Optional[datetime] = Field(default_factory=datetime.now)
    is_active: bool = Field(default=True, description="활성 상태")
    

class Document(BaseModel):
    """문서 정보 모델"""
    model_config = ConfigDict(
        str_strip_whitespace=True,
        validate_assignment=True
    )
    
    id: Optional[str] = Field(None, description="문서 ID")
    title: str = Field(..., min_length=1, description="문서 제목")
    content: str = Field(..., min_length=1, description="문서 내용")
    doc_type: DocumentType = Field(..., description="문서 타입")
    source_url: Optional[str] = Field(None, description="소스 URL")
    site_id: Optional[str] = Field(None, description="관련 사이트 ID")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="메타데이터")
    created_at: Optional[datetime] = Field(default_factory=datetime.now)
    

class QueryRequest(BaseModel):
    """RAG 질의 요청 모델"""
    model_config = ConfigDict(
        str_strip_whitespace=True,
        str_min_length=1
    )
    
    query: str = Field(..., min_length=1, max_length=1000, description="질의 문장")
    site_ids: List[str] = Field(default_factory=list, description="검색할 사이트 ID 목록")
    max_results: int = Field(default=5, ge=1, le=20, description="최대 결과 수")
    similarity_threshold: float = Field(default=0.200, ge=0.0, le=1.0, description="유사도 임계값")
    use_reranking: bool = Field(default=True, description="재순위화 사용 여부")
    


    

class UploadDocumentRequest(BaseModel):
    """문서 업로드 요청 모델"""
    model_config = ConfigDict(
        str_strip_whitespace=True
    )
    
    title: str = Field(..., min_length=1, description="문서 제목")
    content: str = Field(..., min_length=10, description="문서 내용")
    doc_type: DocumentType = Field(..., description="문서 타입")
    source_url: Optional[str] = Field(None, description="소스 URL")
    site_id: Optional[str] = Field(None, description="관련 사이트 ID")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="추가 메타데이터")
    

class JobStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"

class JobType(str, Enum):
    DOCUMENT_UPLOAD = "document_upload"
    VECTORIZATION = "vectorization"
    RAG_QUERY = "rag_query"
    DESIGN_GENERATION = "design_generation"

class Job(BaseModel):
    id: str
    type: JobType
    status: JobStatus
    site_id: Optional[str] = None
    document_id: Optional[str] = None
    progress: float = 0.0  # 0.0 to 100.0
    message: Optional[str] = None
    error: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)

class JobCreate(BaseModel):
    type: JobType
    site_id: Optional[str] = None
    document_id: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)

class JobUpdate(BaseModel):
    status: Optional[JobStatus] = None
    progress: Optional[float] = None
    message: Optional[str] = None
    error: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None

class SystemMetrics(BaseModel):
    timestamp: datetime
    cpu_usage: float
    memory_usage: float
    disk_usage: float
    active_jobs: int
    pending_jobs: int
    completed_jobs_today: int
    failed_jobs_today: int
    total_documents: int
    total_sites: int
    vector_db_size: Optional[int] = None
    uptime_seconds: float

class AdminStats(BaseModel):
    system_metrics: SystemMetrics
    recent_jobs: List[Job]
    error_summary: Dict[str, int]
    performance_summary: Dict[str, float]


# Site related schemas
class SiteCreate(BaseModel):
    """사이트 생성 요청 모델"""
    model_config = ConfigDict(str_strip_whitespace=True)
    
    name: str = Field(..., min_length=1, description="사이트 이름")
    url: str = Field(..., pattern=r'^https?://.+', description="사이트 URL (http/https)")
    description: Optional[str] = Field(None, description="사이트 설명")
    is_active: bool = Field(default=True, description="활성 상태")


class SiteUpdate(BaseModel):
    """사이트 업데이트 요청 모델"""
    model_config = ConfigDict(str_strip_whitespace=True)
    
    name: Optional[str] = Field(None, min_length=1, description="사이트 이름")
    url: Optional[str] = Field(None, pattern=r'^https?://.+', description="사이트 URL (http/https)")
    description: Optional[str] = Field(None, description="사이트 설명")
    is_active: Optional[bool] = Field(None, description="활성 상태")


class SiteResponse(BaseModel):
    """사이트 응답 모델"""
    id: str = Field(..., description="사이트 ID")
    name: str = Field(..., description="사이트 이름")
    url: str = Field(..., description="사이트 URL")
    description: Optional[str] = Field(None, description="사이트 설명")
    created_at: datetime = Field(..., description="생성 시간")
    updated_at: datetime = Field(..., description="수정 시간")
    is_active: bool = Field(..., description="활성 상태")
    document_count: int = Field(default=0, description="연결된 문서 수")


# Document related schemas
class DocumentCreate(BaseModel):
    """문서 생성 요청 모델"""
    model_config = ConfigDict(str_strip_whitespace=True)
    
    site_id: str = Field(..., description="소속 사이트 ID")
    title: str = Field(..., min_length=1, max_length=500, description="문서 제목")
    content: str = Field(..., min_length=1, description="문서 내용")
    doc_type: str = Field(default="text", description="문서 타입")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="메타데이터")


class DocumentUpdate(BaseModel):
    """문서 업데이트 요청 모델"""
    model_config = ConfigDict(str_strip_whitespace=True)
    
    title: Optional[str] = Field(None, min_length=1, max_length=500, description="문서 제목")
    content: Optional[str] = Field(None, min_length=1, description="문서 내용")
    doc_type: Optional[str] = Field(None, description="문서 타입")
    metadata: Optional[Dict[str, Any]] = Field(None, description="메타데이터")


class DocumentResponse(BaseModel):
    """문서 응답 모델"""
    id: str = Field(..., description="문서 ID")
    site_id: str = Field(..., description="소속 사이트 ID")
    title: str = Field(..., description="문서 제목")
    content: str = Field(..., description="문서 내용")
    doc_type: str = Field(..., description="문서 타입")
    metadata: Dict[str, Any] = Field(..., description="메타데이터")
    vector_id: Optional[str] = Field(None, description="벡터 ID")
    created_at: datetime = Field(..., description="생성 시간")
    updated_at: datetime = Field(..., description="수정 시간")


# Query result schemas
class QueryResult(BaseModel):
    """검색 결과 항목 모델"""
    content: str = Field(..., description="문서 내용")
    source: str = Field(..., description="문서 소스")
    site_id: str = Field(..., description="사이트 ID")
    score: float = Field(..., ge=0.0, le=1.0, description="유사도 점수")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="메타데이터")


class QueryResponse(BaseModel):
    """쿼리 응답 모델"""
    answer: str = Field(..., description="AI 생성 답변")
    results: List[QueryResult] = Field(default_factory=list, description="검색 결과 목록")
    total_results: int = Field(default=0, description="전체 결과 수")
    query_time: float = Field(..., description="처리 시간 (초)")
    sources: List[str] = Field(default_factory=list, description="참조 소스 목록")
    job_id: Optional[str] = Field(None, description="작업 추적 ID")


class APIResponse(BaseModel, Generic[T]):
    """표준 API 응답 모델"""
    success: bool = Field(..., description="성공 여부")
    message: str = Field(..., description="응답 메시지")
    data: Optional[T] = Field(None, description="응답 데이터")
    errors: Optional[List[str]] = Field(None, description="오류 목록") 