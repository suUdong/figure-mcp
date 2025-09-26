"""
Guideline Domain Entities
LLM 지침 도메인 엔티티 정의
"""
from datetime import datetime
from enum import Enum
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field


class GuidelineType(str, Enum):
    """지침 타입"""
    # 문서 타입별 지침
    BUSINESS_FLOW = "BUSINESS_FLOW"                     # 목표업무흐름도 지침
    SEQUENCE_DIAGRAM = "SEQUENCE_DIAGRAM"               # 시퀀스다이어그램 지침
    REQUIREMENTS = "REQUIREMENTS"                       # 요구사항정의서 지침
    PROGRAM_DESIGN_ONLINE = "PROGRAM_DESIGN_ONLINE"     # 프로그램설계서(온라인) 지침
    PROGRAM_DESIGN_BATCH = "PROGRAM_DESIGN_BATCH"       # 프로그램설계서(배치) 지침
    PROGRAM_DESIGN_COMMON = "PROGRAM_DESIGN_COMMON"     # 프로그램설계서(공통) 지침
    IMPACT_ANALYSIS = "IMPACT_ANALYSIS"                 # 영향도분석서 지침
    TABLE_SPECIFICATION = "TABLE_SPECIFICATION"        # 테이블정의서 지침
    INTERFACE_SPECIFICATION = "INTERFACE_SPECIFICATION" # 인터페이스정의서 지침
    
    # 범용 지침
    GENERAL = "GENERAL"                                 # 일반 지침


class GuidelineScope(str, Enum):
    """지침 적용 범위"""
    GLOBAL = "GLOBAL"        # 전역 지침 (모든 사이트)
    SITE_SPECIFIC = "SITE_SPECIFIC"  # 사이트별 지침
    

class Guideline(BaseModel):
    """지침 도메인 엔티티"""
    id: Optional[str] = Field(None, description="지침 ID")
    title: str = Field(..., description="지침 제목", max_length=255)
    description: Optional[str] = Field(None, description="지침 설명", max_length=1000)
    
    # 지침 메타데이터
    guideline_type: GuidelineType = Field(..., description="지침 타입")
    scope: GuidelineScope = Field(default=GuidelineScope.GLOBAL, description="적용 범위")
    
    # 사이트 연관 (scope가 SITE_SPECIFIC인 경우)
    site_id: Optional[str] = Field(None, description="연관된 사이트 ID")
    
    # 지침 내용
    role_instruction: str = Field(..., description="LLM 역할 지침")
    objective_instruction: str = Field(..., description="LLM 목표 지침")
    additional_context: Optional[str] = Field(None, description="추가 컨텍스트")
    
    # 우선순위 및 제약사항
    priority: int = Field(default=0, description="우선순위 (높을수록 우선)")
    constraints: Optional[str] = Field(None, description="제약사항 및 주의사항")
    
    # 예시 및 참고사항
    examples: Optional[str] = Field(None, description="작성 예시")
    references: Optional[str] = Field(None, description="참고 자료")
    
    # 메타데이터
    tags: list[str] = Field(default_factory=list, description="태그")
    extra_metadata: Dict[str, Any] = Field(default_factory=dict, description="추가 메타데이터")
    
    # 상태
    is_active: bool = Field(default=True, description="활성 상태")
    version: str = Field(default="1.0.0", description="지침 버전")
    
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


class GuidelineCreateRequest(BaseModel):
    """지침 생성 요청"""
    title: str = Field(..., description="지침 제목", max_length=255)
    description: Optional[str] = Field(None, description="지침 설명")
    guideline_type: GuidelineType = Field(..., description="지침 타입")
    scope: GuidelineScope = Field(default=GuidelineScope.GLOBAL, description="적용 범위")
    site_id: Optional[str] = Field(None, description="사이트 ID (SITE_SPECIFIC인 경우)")
    
    role_instruction: str = Field(..., description="LLM 역할 지침")
    objective_instruction: str = Field(..., description="LLM 목표 지침")
    additional_context: Optional[str] = Field(None, description="추가 컨텍스트")
    
    priority: int = Field(default=0, description="우선순위")
    constraints: Optional[str] = Field(None, description="제약사항")
    examples: Optional[str] = Field(None, description="작성 예시")
    references: Optional[str] = Field(None, description="참고 자료")
    
    tags: list[str] = Field(default_factory=list, description="태그")
    is_active: bool = Field(default=True, description="활성 상태")


class GuidelineUpdateRequest(BaseModel):
    """지침 수정 요청"""
    title: Optional[str] = Field(None, description="지침 제목")
    description: Optional[str] = Field(None, description="지침 설명")
    guideline_type: Optional[GuidelineType] = Field(None, description="지침 타입")
    scope: Optional[GuidelineScope] = Field(None, description="적용 범위")
    site_id: Optional[str] = Field(None, description="사이트 ID")
    
    role_instruction: Optional[str] = Field(None, description="LLM 역할 지침")
    objective_instruction: Optional[str] = Field(None, description="LLM 목표 지침")
    additional_context: Optional[str] = Field(None, description="추가 컨텍스트")
    
    priority: Optional[int] = Field(None, description="우선순위")
    constraints: Optional[str] = Field(None, description="제약사항")
    examples: Optional[str] = Field(None, description="작성 예시")
    references: Optional[str] = Field(None, description="참고 자료")
    
    tags: Optional[list[str]] = Field(None, description="태그")
    is_active: Optional[bool] = Field(None, description="활성 상태")


class GuidelineSearchRequest(BaseModel):
    """지침 검색 요청"""
    guideline_type: Optional[GuidelineType] = Field(None, description="지침 타입")
    scope: Optional[GuidelineScope] = Field(None, description="적용 범위")
    site_id: Optional[str] = Field(None, description="사이트 ID")
    is_active: Optional[bool] = Field(None, description="활성 상태")
    
    # 검색 조건
    search_query: Optional[str] = Field(None, description="검색어")
    tags: Optional[list[str]] = Field(None, description="태그 필터")
    
    # 페이지네이션
    limit: int = Field(default=50, description="조회 개수")
    offset: int = Field(default=0, description="시작 위치")
    
    # 정렬
    order_by: str = Field(default="priority", description="정렬 기준")
    order_desc: bool = Field(default=True, description="내림차순 정렬")


class GuidelineResponse(BaseModel):
    """지침 응답"""
    guideline: Guideline = Field(..., description="지침 정보")
    can_edit: bool = Field(default=False, description="편집 권한")
    can_delete: bool = Field(default=False, description="삭제 권한")


class GuidelineAggregateResponse(BaseModel):
    """지침 종합 응답 (MCP용)"""
    guidelines: list[Guideline] = Field(default_factory=list, description="적용 가능한 지침 목록")
    combined_role_instruction: str = Field(default="", description="통합된 역할 지침")
    combined_objective_instruction: str = Field(default="", description="통합된 목표 지침")
    total_priority: int = Field(default=0, description="총 우선순위 점수")
    last_updated: Optional[datetime] = Field(None, description="마지막 업데이트 시간")
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }
