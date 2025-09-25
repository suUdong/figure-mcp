"""
Template API Interface
템플릿 관리 API 엔드포인트 (헥사고날 아키텍처)
"""
import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from fastapi.responses import StreamingResponse
import io

from app.domain.entities.template_entities import (
    Template,
    TemplateType,
    MCPRequestType,
    TemplateCreateRequest,
    TemplateUpdateRequest,
    TemplateSearchRequest,
    TemplateResponse
)
from app.domain.entities.schemas import APIResponse
from app.application.services.template_service import get_template_service, TemplateService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/templates", tags=["templates"])


@router.post(
    "/",
    response_model=APIResponse[TemplateResponse],
    summary="템플릿 생성",
    description="새로운 템플릿을 생성합니다."
)
async def create_template(
    request: TemplateCreateRequest,
    service: TemplateService = Depends(get_template_service)
) -> APIResponse[TemplateResponse]:
    """템플릿 생성"""
    try:
        template = await service.create_template(request)
        response = TemplateResponse(template=template, can_edit=True, can_delete=True)
        
        return APIResponse(
            success=True,
            message="템플릿이 생성되었습니다.",
            data=response
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"템플릿 생성 실패: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="템플릿 생성 중 오류가 발생했습니다."
        )


@router.post(
    "/upload",
    response_model=APIResponse[TemplateResponse],
    summary="템플릿 파일 업로드",
    description="파일을 업로드하여 템플릿을 생성합니다."
)
async def upload_template(
    file: UploadFile = File(...),
    name: str = Form(...),
    description: Optional[str] = Form(None),
    template_type: TemplateType = Form(...),
    site_id: Optional[str] = Form(None),
    tags: Optional[str] = Form(None),  # JSON 문자열
    is_default: bool = Form(False),
    service: TemplateService = Depends(get_template_service)
) -> APIResponse[TemplateResponse]:
    """템플릿 파일 업로드"""
    try:
        # 파일 내용 읽기
        file_content = await file.read()
        content = file_content.decode('utf-8')
        
        # 요청 객체 생성
        tag_list = []
        if tags:
            import json
            tag_list = json.loads(tags)
        
        request = TemplateCreateRequest(
            name=name,
            description=description,
            template_type=template_type,
            site_id=site_id,
            content=content,
            tags=tag_list,
            is_default=is_default
        )
        
        # 템플릿 생성 (파일 정보 포함)
        template = await service.create_template(
            request=request,
            file_content=file_content,
            file_name=file.filename,
            content_type=file.content_type
        )
        
        response = TemplateResponse(template=template, can_edit=True, can_delete=True)
        
        return APIResponse(
            success=True,
            message="템플릿 파일이 업로드되었습니다.",
            data=response
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except UnicodeDecodeError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="텍스트 파일만 업로드 가능합니다."
        )
    except Exception as e:
        logger.error(f"템플릿 파일 업로드 실패: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="템플릿 파일 업로드 중 오류가 발생했습니다."
        )


@router.get(
    "/{template_id}",
    response_model=APIResponse[TemplateResponse],
    summary="템플릿 조회",
    description="ID로 템플릿을 조회합니다."
)
async def get_template(
    template_id: str,
    service: TemplateService = Depends(get_template_service)
) -> APIResponse[TemplateResponse]:
    """템플릿 조회"""
    template = await service.get_template(template_id)
    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="템플릿을 찾을 수 없습니다."
        )
    
    response = TemplateResponse(template=template, can_edit=True, can_delete=True)
    
    return APIResponse(
        success=True,
        message="템플릿 조회 완료",
        data=response
    )


@router.get(
    "/by-type/{template_type}",
    response_model=APIResponse[List[TemplateResponse]],
    summary="타입별 템플릿 조회",
    description="지정된 타입의 템플릿 목록을 조회합니다. MCP 요청 매칭용."
)
async def get_templates_by_type(
    template_type: TemplateType,
    site_id: Optional[str] = None,
    limit: int = 10,
    service: TemplateService = Depends(get_template_service)
) -> APIResponse[List[TemplateResponse]]:
    """타입별 템플릿 조회 (MCP 매칭용)"""
    try:
        logger.info(f"타입별 템플릿 조회: {template_type}, site_id: {site_id}")
        
        # 검색 조건 구성
        search_request = TemplateSearchRequest(
            template_type=template_type,
            site_id=site_id,
            is_active=True,
            limit=limit,
            offset=0
        )
        
        templates = await service.search_templates(search_request)
        
        # 우선순위 정렬 (기본 템플릿 우선, 최신순)
        templates.sort(key=lambda t: (not t.is_default, -t.id))
        
        responses = [
            TemplateResponse(template=template, can_edit=True, can_delete=True)
            for template in templates
        ]
        
        return APIResponse(
            success=True,
            message=f"{template_type} 타입 템플릿 {len(responses)}개 조회 완료",
            data=responses
        )
        
    except Exception as e:
        logger.error(f"타입별 템플릿 조회 오류: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="템플릿 조회 중 오류가 발생했습니다."
        )


@router.post(
    "/search",
    response_model=APIResponse[List[TemplateResponse]],
    summary="템플릿 검색",
    description="조건에 따라 템플릿을 검색합니다."
)
async def search_templates(
    request: TemplateSearchRequest,
    service: TemplateService = Depends(get_template_service)
) -> APIResponse[List[TemplateResponse]]:
    """템플릿 검색"""
    templates = await service.search_templates(request)
    responses = [
        TemplateResponse(template=template, can_edit=True, can_delete=True)
        for template in templates
    ]
    
    return APIResponse(
        success=True,
        message=f"{len(templates)}개의 템플릿을 찾았습니다.",
        data=responses
    )


@router.get(
    "/type/{template_type}",
    response_model=APIResponse[List[TemplateResponse]],
    summary="유형별 템플릿 조회",
    description="특정 유형의 템플릿들을 조회합니다."
)
async def get_templates_by_type(
    template_type: TemplateType,
    site_id: Optional[str] = None,
    is_active: bool = True,
    service: TemplateService = Depends(get_template_service)
) -> APIResponse[List[TemplateResponse]]:
    """유형별 템플릿 조회"""
    templates = await service.get_templates_by_type(template_type, site_id, is_active)
    responses = [
        TemplateResponse(template=template, can_edit=True, can_delete=True)
        for template in templates
    ]
    
    return APIResponse(
        success=True,
        message=f"{template_type.value} 템플릿 {len(templates)}개를 조회했습니다.",
        data=responses
    )


@router.get(
    "/default/{template_type}",
    response_model=APIResponse[TemplateResponse],
    summary="기본 템플릿 조회",
    description="특정 유형의 기본 템플릿을 조회합니다."
)
async def get_default_template(
    template_type: TemplateType,
    site_id: Optional[str] = None,
    service: TemplateService = Depends(get_template_service)
) -> APIResponse[TemplateResponse]:
    """기본 템플릿 조회"""
    template = await service.get_default_template(template_type, site_id)
    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"{template_type.value} 유형의 기본 템플릿을 찾을 수 없습니다."
        )
    
    response = TemplateResponse(template=template, can_edit=True, can_delete=True)
    
    return APIResponse(
        success=True,
        message="기본 템플릿 조회 완료",
        data=response
    )


@router.get(
    "/guide/{mcp_request_type}",
    response_model=APIResponse[dict],
    summary="템플릿 가이드 조회 (MCP용)",
    description="MCP 서버에서 사용할 템플릿 가이드를 조회합니다."
)
async def get_template_guide_for_mcp(
    mcp_request_type: MCPRequestType,
    site_id: Optional[str] = None,
    context: Optional[str] = None,
    service: TemplateService = Depends(get_template_service)
) -> APIResponse[dict]:
    """MCP용 템플릿 가이드 조회"""
    try:
        # MCPRequestType을 TemplateType으로 매핑
        mcp_to_template_mapping = {
            MCPRequestType.REQUIREMENTS_DOC: TemplateType.REQUIREMENTS,
            MCPRequestType.BUSINESS_REQUIREMENTS: TemplateType.BUSINESS_REQUIREMENTS,
            MCPRequestType.FUNCTIONAL_SPECIFICATION: TemplateType.FUNCTIONAL_SPECIFICATION,
            MCPRequestType.TECHNICAL_SPEC: TemplateType.TECHNICAL_SPECIFICATION,
            MCPRequestType.SYSTEM_ARCHITECTURE: TemplateType.SYSTEM_ARCHITECTURE,
            MCPRequestType.DATABASE_DESIGN: TemplateType.DATABASE_DESIGN,
            MCPRequestType.TABLE_SPECIFICATION: TemplateType.TABLE_SPECIFICATION,
            MCPRequestType.API_SPECIFICATION: TemplateType.API_SPECIFICATION,
            MCPRequestType.UI_UX_DESIGN: TemplateType.UI_UX_DESIGN,
            MCPRequestType.IMPACT_ANALYSIS: TemplateType.IMPACT_ANALYSIS,
            MCPRequestType.API_DOCUMENTATION: TemplateType.API_DOCUMENTATION,
            MCPRequestType.CODE_REVIEW_CHECKLIST: TemplateType.CODE_REVIEW_CHECKLIST,
            MCPRequestType.TEST_PLAN: TemplateType.TEST_PLAN,
            MCPRequestType.TEST_SCENARIO: TemplateType.TEST_SCENARIO,
            MCPRequestType.TEST_CASE: TemplateType.TEST_CASE,
            MCPRequestType.QA_CHECKLIST: TemplateType.QA_CHECKLIST,
            MCPRequestType.DEPLOYMENT_GUIDE: TemplateType.DEPLOYMENT_GUIDE,
            MCPRequestType.DEPLOYMENT_CHECKLIST: TemplateType.DEPLOYMENT_CHECKLIST,
            MCPRequestType.ROLLBACK_PLAN: TemplateType.ROLLBACK_PLAN,
            MCPRequestType.MONITORING_PLAN: TemplateType.MONITORING_PLAN,
            MCPRequestType.USER_MANUAL: TemplateType.USER_MANUAL,
            MCPRequestType.RELEASE_NOTES: TemplateType.RELEASE_NOTES,
            MCPRequestType.OPERATION_MANUAL: TemplateType.OPERATION_MANUAL,
            MCPRequestType.TROUBLESHOOTING_GUIDE: TemplateType.TROUBLESHOOTING_GUIDE
        }
        
        template_type = mcp_to_template_mapping.get(mcp_request_type)
        if not template_type:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"지원하지 않는 MCP 요청 타입입니다: {mcp_request_type}"
            )
        
        template = await service.get_default_template(template_type, site_id)
        if not template:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"{mcp_request_type} 유형의 기본 템플릿을 찾을 수 없습니다."
            )
        
        # 컨텍스트 파싱 (JSON 문자열인 경우)
        parsed_context = {}
        if context:
            try:
                import json
                parsed_context = json.loads(context)
            except json.JSONDecodeError:
                logger.warning(f"컨텍스트 파싱 실패: {context}")
        
        # 템플릿 사용 처리 (사용 횟수 증가 + 지침 생성)
        template_obj, context_info = await service.use_template(
            template_id=template.id,
            context=parsed_context,
            user_id="mcp_user",
            site_id=site_id
        )
        
        # MCP에서 기대하는 형식으로 응답 구성
        guide_response = {
            "template": template_obj.content,
            "variables": template_obj.variables,
            "instructions": context_info["instructions"],
            "usage_count": template_obj.usage_count
        }
        
        return APIResponse(
            success=True,
            message="템플릿 가이드 조회 완료",
            data=guide_response
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"템플릿 가이드 조회 실패: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="템플릿 가이드 조회 중 오류가 발생했습니다."
        )


@router.put(
    "/{template_id}",
    response_model=APIResponse[TemplateResponse],
    summary="템플릿 수정",
    description="템플릿을 수정합니다."
)
async def update_template(
    template_id: str,
    request: TemplateUpdateRequest,
    service: TemplateService = Depends(get_template_service)
) -> APIResponse[TemplateResponse]:
    """템플릿 수정"""
    try:
        template = await service.update_template(template_id, request)
        if not template:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="템플릿을 찾을 수 없습니다."
            )
        
        response = TemplateResponse(template=template, can_edit=True, can_delete=True)
        
        return APIResponse(
            success=True,
            message="템플릿이 수정되었습니다.",
            data=response
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"템플릿 수정 실패: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="템플릿 수정 중 오류가 발생했습니다."
        )


@router.delete(
    "/{template_id}",
    response_model=APIResponse[bool],
    summary="템플릿 삭제",
    description="템플릿을 삭제합니다."
)
async def delete_template(
    template_id: str,
    service: TemplateService = Depends(get_template_service)
) -> APIResponse[bool]:
    """템플릿 삭제"""
    result = await service.delete_template(template_id)
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="템플릿을 찾을 수 없습니다."
        )
    
    return APIResponse(
        success=True,
        message="템플릿이 삭제되었습니다.",
        data=True
    )


@router.post(
    "/{template_id}/use",
    response_model=APIResponse[dict],
    summary="템플릿 사용",
    description="템플릿을 사용하여 LLM이 문서를 생성할 수 있는 컨텍스트를 제공합니다."
)
async def use_template(
    template_id: str,
    context: dict,
    user_id: Optional[str] = None,
    jira_ticket_id: Optional[str] = None,
    site_id: Optional[str] = None,
    service: TemplateService = Depends(get_template_service)
) -> APIResponse[dict]:
    """템플릿 사용"""
    try:
        template, context_info = await service.use_template(
            template_id=template_id,
            context=context,
            user_id=user_id,
            jira_ticket_id=jira_ticket_id,
            site_id=site_id
        )
        
        return APIResponse(
            success=True,
            message=f"템플릿 '{template.name}'을 사용할 준비가 완료되었습니다.",
            data=context_info
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"템플릿 사용 실패: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="템플릿 사용 중 오류가 발생했습니다."
        )


@router.get(
    "/popular/{limit}",
    response_model=APIResponse[List[TemplateResponse]],
    summary="인기 템플릿 조회",
    description="사용 횟수가 많은 인기 템플릿들을 조회합니다."
)
async def get_popular_templates(
    limit: int = 10,
    site_id: Optional[str] = None,
    service: TemplateService = Depends(get_template_service)
) -> APIResponse[List[TemplateResponse]]:
    """인기 템플릿 조회"""
    templates = await service.get_popular_templates(limit, site_id)
    responses = [
        TemplateResponse(template=template, can_edit=True, can_delete=True)
        for template in templates
    ]
    
    return APIResponse(
        success=True,
        message=f"인기 템플릿 {len(templates)}개를 조회했습니다.",
        data=responses
    )


@router.get(
    "/{template_id}/stats",
    response_model=APIResponse[dict],
    summary="템플릿 사용 통계",
    description="템플릿의 사용 통계를 조회합니다."
)
async def get_template_stats(
    template_id: str,
    service: TemplateService = Depends(get_template_service)
) -> APIResponse[dict]:
    """템플릿 사용 통계"""
    stats = await service.get_usage_stats(template_id)
    
    return APIResponse(
        success=True,
        message="템플릿 사용 통계 조회 완료",
        data=stats
    )