"""
SQLAlchemy 데이터베이스 모델 정의
"""

from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, Float, ForeignKey, JSON, Enum
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
import enum

Base = declarative_base()

class UserRole(enum.Enum):
    """사용자 역할 열거형"""
    ADMIN = "admin"
    USER = "user"


class Site(Base):
    """사이트 정보 모델 - IT 운영업무를 하는 회사 정보"""
    __tablename__ = "sites"
    
    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False, index=True)  # 회사/조직 이름
    company = Column(String, nullable=False, index=True)  # 회사명
    department = Column(String, nullable=True)  # 부서명
    business_type = Column(String, nullable=True)  # 업종/사업 분야
    contact_person = Column(String, nullable=True)  # 담당자
    contact_email = Column(String, nullable=True)  # 담당자 이메일
    contact_phone = Column(String, nullable=True)  # 연락처
    
    # URL을 선택사항으로 변경 (회사 웹사이트 주소)
    url = Column(String, nullable=True, index=True)  # 회사 웹사이트 (선택사항)
    description = Column(Text, nullable=True)  # 회사/업무 설명
    is_active = Column(Boolean, default=True)
    
    # 크롤링 설정 필드 (웹사이트가 있는 경우)
    crawl_frequency = Column(Integer, default=24)  # 시간 단위
    max_depth = Column(Integer, default=3)
    include_patterns = Column(JSON, nullable=True)  # 포함 패턴 리스트
    exclude_patterns = Column(JSON, nullable=True)  # 제외 패턴 리스트
    
    # 크롤링 상태 필드
    last_crawled = Column(DateTime, nullable=True)
    status = Column(String, default="active")  # active, inactive, error
    document_count = Column(Integer, default=0)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # 관계 설정
    documents = relationship("Document", back_populates="site", cascade="all, delete-orphan")
    guidelines = relationship("GuidelineModel", back_populates="site", cascade="all, delete-orphan")


class Document(Base):
    """문서 정보 모델 (메타데이터만 저장)"""
    __tablename__ = "documents"
    
    id = Column(String, primary_key=True, index=True)
    site_id = Column(String, ForeignKey("sites.id"), nullable=True, index=True)
    title = Column(String, nullable=False, index=True)
    doc_type = Column(String, nullable=False, index=True)
    source_url = Column(String, nullable=True)
    file_path = Column(String, nullable=True)  # 파일 저장 경로
    file_size = Column(Integer, nullable=True)  # 파일 크기 (bytes)
    content_hash = Column(String, nullable=True)  # 콘텐츠 해시
    processing_status = Column(String, default="pending")  # pending, processing, completed, failed
    extra_data = Column(JSON, nullable=True)  # 추가 메타데이터
    
    # 템플릿 관련 필드 (통합)
    is_template = Column(Boolean, default=False, index=True)  # 템플릿 여부
    template_type = Column(String, nullable=True, index=True)  # 템플릿 타입 (IMPACT_ANALYSIS 등)
    template_name = Column(String, nullable=True, index=True)  # 템플릿 이름
    template_description = Column(String, nullable=True)  # 템플릿 설명
    template_version = Column(String, default="1.0.0")  # 템플릿 버전
    template_format = Column(String, default="markdown")  # 템플릿 포맷
    template_variables = Column(JSON, nullable=True)  # 템플릿 변수 정의
    template_tags = Column(String, nullable=True)  # 템플릿 태그 (쉼표 구분)
    usage_count = Column(Integer, default=0)  # 사용 횟수
    is_active = Column(Boolean, default=True)  # 활성 상태
    is_default = Column(Boolean, default=False)  # 기본 템플릿 여부
    created_by = Column(String, nullable=True)  # 생성자
    updated_by = Column(String, nullable=True)  # 수정자
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # 관계 설정
    site = relationship("Site", back_populates="documents")


class UsageLog(Base):
    """API 사용량 로그 모델"""
    __tablename__ = "usage_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    provider = Column(String, nullable=False, index=True)  # gemini, groq, openai
    service = Column(String, nullable=False, index=True)  # llm, embedding
    model = Column(String, nullable=False)
    tokens_used = Column(Integer, nullable=False)
    cost = Column(Float, nullable=False)
    request_type = Column(String, nullable=False)  # query, embed, etc.
    success = Column(Boolean, default=True)
    error_message = Column(Text, nullable=True)
    extra_data = Column(JSON, nullable=True)  # 추가 메타데이터
    created_at = Column(DateTime, default=datetime.utcnow)


class User(Base):
    """사용자 모델"""
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    email = Column(String(255), nullable=True, index=True)
    full_name = Column(String(255), nullable=True)
    hashed_password = Column(String, nullable=False)
    role = Column(Enum(UserRole), nullable=False, default=UserRole.USER)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_login = Column(DateTime, nullable=True)


class TemplateMatchingRuleModel(Base):
    """템플릿 매칭 규칙 모델"""
    __tablename__ = "template_matching_rules"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    mcp_request_type = Column(String(50), nullable=False, index=True)  # MCP 요청 타입
    template_type = Column(String(50), nullable=False, index=True)     # 템플릿 타입
    site_id = Column(String, nullable=True, index=True)               # 사이트별 매칭 (NULL이면 전체)
    priority = Column(Integer, default=0, nullable=False, index=True)  # 우선순위
    is_active = Column(Boolean, default=True, nullable=False)         # 활성화 여부
    description = Column(Text, nullable=True)                         # 규칙 설명
    
    # 메타데이터
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    created_by = Column(String(100), nullable=True)


class GuidelineModel(Base):
    """LLM 지침 모델"""
    __tablename__ = "guidelines"
    
    id = Column(String, primary_key=True, index=True)  # UUID
    title = Column(String(255), nullable=False, index=True)
    description = Column(Text, nullable=True)
    
    # 지침 메타데이터
    guideline_type = Column(String(50), nullable=False, index=True)  # BUSINESS_FLOW, REQUIREMENTS 등
    scope = Column(String(20), default="GLOBAL", nullable=False, index=True)  # GLOBAL, SITE_SPECIFIC
    site_id = Column(String, ForeignKey("sites.id"), nullable=True, index=True)  # 사이트별 지침
    
    # 지침 내용
    role_instruction = Column(Text, nullable=False)      # LLM 역할 지침
    objective_instruction = Column(Text, nullable=False)  # LLM 목표 지침
    additional_context = Column(Text, nullable=True)     # 추가 컨텍스트
    
    # 우선순위 및 제약사항
    priority = Column(Integer, default=0, nullable=False, index=True)  # 우선순위
    constraints = Column(Text, nullable=True)            # 제약사항
    
    # 예시 및 참고사항
    examples = Column(Text, nullable=True)               # 작성 예시
    references = Column(Text, nullable=True)             # 참고 자료
    
    # 메타데이터
    tags = Column(JSON, nullable=True)                   # 태그 배열
    extra_metadata = Column(JSON, nullable=True)         # 추가 메타데이터
    
    # 상태
    is_active = Column(Boolean, default=True, nullable=False, index=True)
    version = Column(String(20), default="1.0.0", nullable=False)
    
    # 감사 필드
    created_by = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_by = Column(String(100), nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # 관계 설정
    site = relationship("Site", back_populates="guidelines")
 