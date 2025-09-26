"""
Template Domain Entities
템플릿 도메인 엔티티 정의
"""
from datetime import datetime
from enum import Enum
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field


class TemplateType(str, Enum):
    """템플릿 유형 - 핵심 개발 문서로 간소화"""
    # 🎯 핵심 개발 문서 (9가지)
    BUSINESS_FLOW = "BUSINESS_FLOW"                     # 목표업무흐름도
    SEQUENCE_DIAGRAM = "SEQUENCE_DIAGRAM"               # 시퀀스다이어그램
    REQUIREMENTS = "REQUIREMENTS"                       # 요구사항정의서
    PROGRAM_DESIGN_ONLINE = "PROGRAM_DESIGN_ONLINE"     # 프로그램설계서(온라인)
    PROGRAM_DESIGN_BATCH = "PROGRAM_DESIGN_BATCH"       # 프로그램설계서(배치)
    PROGRAM_DESIGN_COMMON = "PROGRAM_DESIGN_COMMON"     # 프로그램설계서(공통)
    IMPACT_ANALYSIS = "IMPACT_ANALYSIS"                 # 영향도분석서
    TABLE_SPECIFICATION = "TABLE_SPECIFICATION"        # 테이블정의서
    INTERFACE_SPECIFICATION = "INTERFACE_SPECIFICATION" # 인터페이스정의서
    
    CUSTOM = "CUSTOM"                                   # 사용자 정의


class TemplateFormat(str, Enum):
    """템플릿 포맷"""
    MARKDOWN = "markdown"
    HTML = "html"
    JSON = "json"
    YAML = "yaml"
    TEXT = "text"


class Template(BaseModel):
    """템플릿 도메인 엔티티"""
    id: Optional[str] = Field(None, description="템플릿 ID")
    name: str = Field(..., description="템플릿 이름", max_length=255)
    description: Optional[str] = Field(None, description="템플릿 설명", max_length=1000)
    
    # 템플릿 메타데이터
    template_type: TemplateType = Field(..., description="템플릿 유형")
    format: TemplateFormat = Field(default=TemplateFormat.MARKDOWN, description="템플릿 포맷")
    version: str = Field(default="1.0.0", description="템플릿 버전")
    
    # 사이트 연관
    site_id: Optional[str] = Field(None, description="연관된 사이트 ID")
    
    # 템플릿 내용
    content: str = Field(..., description="템플릿 내용")
    variables: Dict[str, Any] = Field(default_factory=dict, description="템플릿 변수 정의")
    
    # 파일 정보
    file_path: Optional[str] = Field(None, description="원본 파일 경로")
    file_size: Optional[int] = Field(None, description="파일 크기 (bytes)")
    
    # 메타데이터
    tags: list[str] = Field(default_factory=list, description="태그")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="추가 메타데이터")
    
    # 사용 통계
    usage_count: int = Field(default=0, description="사용 횟수")
    
    # 상태
    is_active: bool = Field(default=True, description="활성 상태")
    is_default: bool = Field(default=False, description="기본 템플릿 여부")
    
    # 감사 필드
    created_by: Optional[str] = Field(None, description="생성자")
    created_at: Optional[datetime] = Field(None, description="생성 시간")
    updated_by: Optional[str] = Field(None, description="수정자")
    updated_at: Optional[datetime] = Field(None, description="수정 시간")

    class Config:
        """Pydantic 설정"""
        from_attributes = True
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class TemplateUsage(BaseModel):
    """템플릿 사용 이력"""
    id: Optional[str] = Field(None, description="사용 이력 ID")
    template_id: str = Field(..., description="템플릿 ID")
    user_id: Optional[str] = Field(None, description="사용자 ID")
    
    # 사용 컨텍스트
    jira_ticket_id: Optional[str] = Field(None, description="연관된 JIRA 티켓")
    site_id: Optional[str] = Field(None, description="사용된 사이트")
    
    # 사용 결과
    success: bool = Field(default=True, description="성공 여부")
    error_message: Optional[str] = Field(None, description="오류 메시지")
    
    # 생성된 문서 정보
    generated_content_length: Optional[int] = Field(None, description="생성된 문서 길이")
    
    # 타이밍
    used_at: datetime = Field(default_factory=datetime.now, description="사용 시간")
    duration_ms: Optional[int] = Field(None, description="처리 시간 (밀리초)")

    class Config:
        from_attributes = True


# API 요청/응답 스키마들
class TemplateCreateRequest(BaseModel):
    """템플릿 생성 요청"""
    name: str = Field(..., description="템플릿 이름", max_length=255)
    description: Optional[str] = Field(None, description="템플릿 설명", max_length=1000)
    template_type: TemplateType = Field(..., description="템플릿 유형")
    format: TemplateFormat = Field(default=TemplateFormat.MARKDOWN, description="템플릿 포맷")
    site_id: Optional[str] = Field(None, description="연관된 사이트 ID")
    content: str = Field(..., description="템플릿 내용")
    variables: Dict[str, Any] = Field(default_factory=dict, description="템플릿 변수 정의")
    tags: list[str] = Field(default_factory=list, description="태그")
    is_default: bool = Field(default=False, description="기본 템플릿 여부")


class TemplateUpdateRequest(BaseModel):
    """템플릿 수정 요청"""
    name: Optional[str] = Field(None, description="템플릿 이름", max_length=255)
    description: Optional[str] = Field(None, description="템플릿 설명", max_length=1000)
    content: Optional[str] = Field(None, description="템플릿 내용")
    variables: Optional[Dict[str, Any]] = Field(None, description="템플릿 변수 정의")
    tags: Optional[list[str]] = Field(None, description="태그")
    is_active: Optional[bool] = Field(None, description="활성 상태")
    is_default: Optional[bool] = Field(None, description="기본 템플릿 여부")


class TemplateSearchRequest(BaseModel):
    """템플릿 검색 요청"""
    template_type: Optional[TemplateType] = Field(None, description="템플릿 유형")
    site_id: Optional[str] = Field(None, description="사이트 ID")
    tags: Optional[list[str]] = Field(None, description="태그")
    is_active: Optional[bool] = Field(True, description="활성 상태")
    search_query: Optional[str] = Field(None, description="검색어")
    
    # 페이징
    page: int = Field(default=1, ge=1, description="페이지 번호")
    size: int = Field(default=20, ge=1, le=100, description="페이지 크기")


class TemplateResponse(BaseModel):
    """템플릿 응답"""
    template: Template = Field(..., description="템플릿 정보")
    can_edit: bool = Field(default=False, description="편집 권한")
    can_delete: bool = Field(default=False, description="삭제 권한")


class MCPRequestType(str, Enum):
    """MCP 요청 타입 - 핵심 개발 문서만 선별"""
    # 🎯 핵심 개발 문서 (7가지)
    BUSINESS_FLOW = "business_flow"                     # 목표업무흐름도
    SEQUENCE_DIAGRAM = "sequence_diagram"               # 시퀀스다이어그램
    REQUIREMENTS = "requirements"                       # 요구사항정의서
    PROGRAM_DESIGN_ONLINE = "program_design_online"     # 프로그램설계서(온라인)
    PROGRAM_DESIGN_BATCH = "program_design_batch"       # 프로그램설계서(배치)
    PROGRAM_DESIGN_COMMON = "program_design_common"     # 프로그램설계서(공통)
    IMPACT_ANALYSIS = "impact_analysis"                 # 영향도분석서
    TABLE_SPECIFICATION = "table_specification"        # 테이블정의서
    INTERFACE_SPECIFICATION = "interface_specification" # 인터페이스정의서


class TemplateMatchingRule(BaseModel):
    """템플릿 매칭 규칙"""
    id: Optional[int] = Field(None, description="매칭 규칙 ID")
    mcp_request_type: MCPRequestType = Field(..., description="MCP 요청 타입")
    template_type: TemplateType = Field(..., description="매칭될 템플릿 타입")
    site_id: Optional[str] = Field(None, description="사이트별 매칭 (None이면 전체)")
    priority: int = Field(default=0, description="우선순위 (높을수록 우선)")
    is_active: bool = Field(default=True, description="활성화 여부")
    description: Optional[str] = Field(None, description="규칙 설명")
    
    # 메타데이터
    created_at: Optional[datetime] = Field(None, description="생성일시")
    updated_at: Optional[datetime] = Field(None, description="수정일시")
    created_by: Optional[str] = Field(None, description="생성자")
    
    class Config:
        from_attributes = True
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class TemplateMatchingRuleCreateRequest(BaseModel):
    """템플릿 매칭 규칙 생성 요청"""
    mcp_request_type: MCPRequestType = Field(..., description="MCP 요청 타입")
    template_type: TemplateType = Field(..., description="매칭될 템플릿 타입")
    site_id: Optional[str] = Field(None, description="사이트별 매칭 (None이면 전체)")
    priority: int = Field(default=0, description="우선순위")
    is_active: bool = Field(default=True, description="활성화 여부")
    description: Optional[str] = Field(None, description="규칙 설명")


class TemplateMatchingRuleUpdateRequest(BaseModel):
    """템플릿 매칭 규칙 수정 요청"""
    mcp_request_type: Optional[MCPRequestType] = Field(None, description="MCP 요청 타입")
    template_type: Optional[TemplateType] = Field(None, description="매칭될 템플릿 타입")
    site_id: Optional[str] = Field(None, description="사이트별 매칭")
    priority: Optional[int] = Field(None, description="우선순위")
    is_active: Optional[bool] = Field(None, description="활성화 여부")
    description: Optional[str] = Field(None, description="규칙 설명")


class TemplateMatchingRuleResponse(BaseModel):
    """템플릿 매칭 규칙 응답"""
    rule: TemplateMatchingRule
    can_edit: bool = True
    can_delete: bool = True