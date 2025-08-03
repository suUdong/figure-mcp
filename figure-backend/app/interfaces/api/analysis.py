"""
분석 API 엔드포인트
코드 의존성 분석 및 데이터베이스 스키마 분석 기능
"""
import logging
import os
import tempfile
from typing import List, Optional, Dict, Any
from pathlib import Path

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from app.domain.entities.schemas import APIResponse
from app.application.services.code_analysis_service import CodeAnalysisService
from app.application.services.schema_analysis_service import SchemaAnalysisService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/analysis", tags=["Analysis"])

# 요청/응답 모델
class MethodDependencyRequest(BaseModel):
    project_path: str = Field(..., description="분석할 프로젝트 경로")
    language: str = Field(..., description="프로그래밍 언어 (java, python, etc.)")
    target_class: Optional[str] = Field(None, description="분석할 특정 클래스명")

class TableSchemaRequest(BaseModel):
    database_type: str = Field(..., description="데이터베이스 타입")
    connection_string: Optional[str] = Field(None, description="데이터베이스 연결 문자열")
    schema_file: Optional[str] = Field(None, description="DDL 스키마 파일 경로")
    target_tables: Optional[List[str]] = Field(None, description="분석할 테이블 목록")

# 응답 모델
class MethodDependencyResponse(BaseModel):
    totalDependencies: int
    analyzedFiles: int
    complexityLevel: str
    dependencyMatrix: str

class TableSchemaResponse(BaseModel):
    totalTables: int
    foreignKeyCount: int
    indexCount: int
    constraintCount: int
    schemaDefinition: str
    relationshipDiagram: str

@router.post(
    "/method-dependency",
    response_model=APIResponse[MethodDependencyResponse],
    summary="메서드 의존성 분석",
    description="소스 코드를 분석하여 메서드 간 의존성 매트릭스를 생성합니다."
)
async def analyze_method_dependency(
    request: MethodDependencyRequest
) -> APIResponse[MethodDependencyResponse]:
    """메서드 의존성 분석"""
    try:
        logger.info(f"메서드 의존성 분석 시작: {request.project_path} ({request.language})")
        
        # 프로젝트 경로 검증
        if not os.path.exists(request.project_path):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"프로젝트 경로를 찾을 수 없습니다: {request.project_path}"
            )
        
        # 코드 분석 서비스 초기화
        analysis_service = CodeAnalysisService()
        
        # 의존성 분석 수행
        result = await analysis_service.analyze_method_dependencies(
            project_path=request.project_path,
            language=request.language,
            target_class=request.target_class
        )
        
        logger.info(f"메서드 의존성 분석 완료: {result['total_dependencies']}개 의존성 발견")
        
        response_data = MethodDependencyResponse(
            totalDependencies=result['total_dependencies'],
            analyzedFiles=result['analyzed_files'],
            complexityLevel=result['complexity_level'],
            dependencyMatrix=result['dependency_matrix']
        )
        
        return APIResponse(
            success=True,
            message="메서드 의존성 분석 완료",
            data=response_data
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"메서드 의존성 분석 오류: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="메서드 의존성 분석 중 오류가 발생했습니다."
        )

@router.post(
    "/table-schema",
    response_model=APIResponse[TableSchemaResponse],
    summary="테이블 스키마 분석",
    description="데이터베이스 스키마를 분석하여 테이블 구조와 관계를 추출합니다."
)
async def analyze_table_schema(
    request: TableSchemaRequest
) -> APIResponse[TableSchemaResponse]:
    """테이블 스키마 분석"""
    try:
        logger.info(f"테이블 스키마 분석 시작: {request.database_type}")
        
        # 연결 문자열 또는 스키마 파일 중 하나는 필수
        if not request.connection_string and not request.schema_file:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="데이터베이스 연결 문자열 또는 스키마 파일 중 하나를 제공해야 합니다."
            )
        
        # 스키마 파일이 제공된 경우 존재 확인
        if request.schema_file and not os.path.exists(request.schema_file):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"스키마 파일을 찾을 수 없습니다: {request.schema_file}"
            )
        
        # 스키마 분석 서비스 초기화
        schema_service = SchemaAnalysisService()
        
        # 스키마 분석 수행
        result = await schema_service.analyze_database_schema(
            database_type=request.database_type,
            connection_string=request.connection_string,
            schema_file=request.schema_file,
            target_tables=request.target_tables
        )
        
        logger.info(f"테이블 스키마 분석 완료: {result['total_tables']}개 테이블 분석")
        
        response_data = TableSchemaResponse(
            totalTables=result['total_tables'],
            foreignKeyCount=result['foreign_key_count'],
            indexCount=result['index_count'],
            constraintCount=result['constraint_count'],
            schemaDefinition=result['schema_definition'],
            relationshipDiagram=result['relationship_diagram']
        )
        
        return APIResponse(
            success=True,
            message="테이블 스키마 분석 완료",
            data=response_data
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"테이블 스키마 분석 오류: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="테이블 스키마 분석 중 오류가 발생했습니다."
        )

@router.get(
    "/supported-languages",
    response_model=APIResponse[List[str]],
    summary="지원 언어 목록",
    description="메서드 의존성 분석에서 지원하는 프로그래밍 언어 목록을 반환합니다."
)
async def get_supported_languages() -> APIResponse[List[str]]:
    """지원하는 프로그래밍 언어 목록"""
    try:
        supported_languages = [
            "java",
            "python", 
            "javascript",
            "typescript",
            "csharp"
        ]
        
        return APIResponse(
            success=True,
            message="지원 언어 목록 조회 완료",
            data=supported_languages
        )
        
    except Exception as e:
        logger.error(f"지원 언어 목록 조회 오류: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="지원 언어 목록 조회 중 오류가 발생했습니다."
        )

@router.get(
    "/supported-databases",
    response_model=APIResponse[List[str]],
    summary="지원 데이터베이스 목록",
    description="테이블 스키마 분석에서 지원하는 데이터베이스 타입 목록을 반환합니다."
)
async def get_supported_databases() -> APIResponse[List[str]]:
    """지원하는 데이터베이스 타입 목록"""
    try:
        supported_databases = [
            "mysql",
            "postgresql",
            "oracle",
            "mssql",
            "sqlite"
        ]
        
        return APIResponse(
            success=True,
            message="지원 데이터베이스 목록 조회 완료",
            data=supported_databases
        )
        
    except Exception as e:
        logger.error(f"지원 데이터베이스 목록 조회 오류: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="지원 데이터베이스 목록 조회 중 오류가 발생했습니다."
        )

# 고급 분석 API 엔드포인트들

class CircularDependencyRequest(BaseModel):
    project_path: str = Field(..., description="분석할 프로젝트 경로")
    language: str = Field(..., description="프로그래밍 언어")
    max_depth: Optional[int] = Field(10, description="최대 탐지 깊이")

class ImpactScoreRequest(BaseModel):
    project_path: str = Field(..., description="분석할 프로젝트 경로")
    target_files: List[str] = Field(..., description="영향도를 계산할 대상 파일들")
    change_type: str = Field("modify", description="변경 유형")
    language: str = Field(..., description="프로그래밍 언어")

class ComprehensiveReportRequest(BaseModel):
    project_path: str = Field(..., description="분석할 프로젝트 경로")
    change_description: str = Field(..., description="변경 사항 설명")
    target_modules: List[str] = Field(..., description="변경 대상 모듈/파일 목록")
    language: str = Field(..., description="프로그래밍 언어")
    include_database: Optional[bool] = Field(False, description="데이터베이스 영향도 포함 여부")
    database_type: Optional[str] = Field(None, description="데이터베이스 타입")

@router.post(
    "/circular-dependency",
    response_model=APIResponse,
    summary="순환 의존성 탐지",
    description="소스 코드에서 순환 의존성을 탐지하고 분석합니다."
)
async def detect_circular_dependency(
    request: CircularDependencyRequest
) -> APIResponse:
    """순환 의존성 탐지"""
    try:
        logger.info(f"순환 의존성 탐지 시작: {request.project_path} ({request.language})")
        
        # 의존성 분석 서비스 초기화
        from app.application.services.dependency_analysis_service import DependencyAnalysisService
        dependency_service = DependencyAnalysisService()
        
        # 순환 의존성 분석 수행
        result = await dependency_service.detect_circular_dependencies(
            project_path=request.project_path,
            language=request.language,
            max_depth=request.max_depth
        )
        
        logger.info(f"순환 의존성 탐지 완료: {len(result.get('circular_dependencies', []))}개 발견")
        
        return APIResponse(
            success=True,
            message="순환 의존성 탐지 완료",
            data=result
        )
        
    except Exception as e:
        logger.error(f"순환 의존성 탐지 오류: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="순환 의존성 탐지 중 오류가 발생했습니다."
        )

@router.post(
    "/impact-score",
    response_model=APIResponse,
    summary="영향도 점수 계산",
    description="변경 대상의 영향도 점수를 자동으로 계산합니다."
)
async def calculate_impact_score(
    request: ImpactScoreRequest
) -> APIResponse:
    """영향도 점수 계산"""
    try:
        logger.info(f"영향도 점수 계산 시작: {len(request.target_files)}개 파일")
        
        # 의존성 분석 서비스 초기화
        from app.application.services.dependency_analysis_service import DependencyAnalysisService
        dependency_service = DependencyAnalysisService()
        
        # 영향도 점수 계산 수행
        result = await dependency_service.calculate_impact_score(
            project_path=request.project_path,
            target_files=request.target_files,
            change_type=request.change_type,
            language=request.language
        )
        
        logger.info(f"영향도 점수 계산 완료: {result.get('overall_score', 0)}/100")
        
        return APIResponse(
            success=True,
            message="영향도 점수 계산 완료",
            data=result
        )
        
    except Exception as e:
        logger.error(f"영향도 점수 계산 오류: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="영향도 점수 계산 중 오류가 발생했습니다."
        )

@router.post(
    "/comprehensive-impact-report",
    response_model=APIResponse,
    summary="종합 영향도 분석 리포트",
    description="종합 영향도 분석 리포트를 생성합니다."
)
async def generate_comprehensive_impact_report(
    request: ComprehensiveReportRequest
) -> APIResponse:
    """종합 영향도 분석 리포트 생성"""
    try:
        logger.info(f"종합 영향도 분석 리포트 생성 시작: {request.project_path}")
        
        # 의존성 분석 서비스 초기화
        from app.application.services.dependency_analysis_service import DependencyAnalysisService
        dependency_service = DependencyAnalysisService()
        
        # 종합 리포트 생성 수행
        result = await dependency_service.generate_comprehensive_report(
            project_path=request.project_path,
            change_description=request.change_description,
            target_modules=request.target_modules,
            language=request.language,
            include_database=request.include_database,
            database_type=request.database_type
        )
        
        logger.info(f"종합 영향도 분석 리포트 생성 완료: {result.get('overall_risk_level', 'Unknown')}")
        
        return APIResponse(
            success=True,
            message="종합 영향도 분석 리포트 생성 완료",
            data=result
        )
        
    except Exception as e:
        logger.error(f"종합 영향도 분석 리포트 생성 오류: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="종합 영향도 분석 리포트 생성 중 오류가 발생했습니다."
        )