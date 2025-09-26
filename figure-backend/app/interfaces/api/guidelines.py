"""
Guidelines API 엔드포인트
LLM 지침 관리 API
"""
import uuid
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from app.infrastructure.persistence.connection import get_db
from app.domain.entities.guideline_entities import (
    GuidelineCreateRequest, 
    GuidelineUpdateRequest, 
    GuidelineSearchRequest, 
    GuidelineResponse, 
    GuidelineAggregateResponse,
    Guideline,
    GuidelineType,
    GuidelineScope
)
from app.infrastructure.persistence.models import GuidelineModel, Site
from app.domain.entities.schemas import APIResponse
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/guidelines", tags=["Guidelines"])


@router.post(
    "/",
    response_model=APIResponse[GuidelineResponse],
    summary="지침 생성",
    description="새로운 LLM 지침을 생성합니다."
)
async def create_guideline(
    request: GuidelineCreateRequest,
    db: Session = Depends(get_db)
) -> APIResponse[GuidelineResponse]:
    """지침 생성"""
    try:
        # 사이트 검증 (SITE_SPECIFIC인 경우)
        if request.scope == GuidelineScope.SITE_SPECIFIC and request.site_id:
            site = db.query(Site).filter(Site.id == request.site_id).first()
            if not site:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"사이트를 찾을 수 없습니다: {request.site_id}"
                )
        
        # 지침 생성
        guideline_id = str(uuid.uuid4())
        guideline_model = GuidelineModel(
            id=guideline_id,
            title=request.title,
            description=request.description,
            guideline_type=request.guideline_type.value,
            scope=request.scope.value,
            site_id=request.site_id,
            role_instruction=request.role_instruction,
            objective_instruction=request.objective_instruction,
            additional_context=request.additional_context,
            priority=request.priority,
            constraints=request.constraints,
            examples=request.examples,
            references=request.references,
            tags=request.tags,
            is_active=request.is_active,
            created_by="api_user"  # TODO: 실제 사용자 ID 적용
        )
        
        db.add(guideline_model)
        db.commit()
        db.refresh(guideline_model)
        
        # 응답 생성
        guideline = model_to_entity(guideline_model)
        response = GuidelineResponse(
            guideline=guideline,
            can_edit=True,
            can_delete=True
        )
        
        logger.info(f"지침 생성 완료: {guideline_id} - {request.title}")
        
        return APIResponse(
            success=True,
            message="지침이 성공적으로 생성되었습니다.",
            data=response
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"지침 생성 오류: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="지침 생성 중 오류가 발생했습니다."
        )


@router.get(
    "/aggregate/{guideline_type}",
    response_model=APIResponse[GuidelineAggregateResponse],
    summary="지침 종합 조회 (MCP용)",
    description="특정 타입의 모든 적용 가능한 지침을 종합하여 반환합니다."
)
async def get_aggregate_guidelines(
    guideline_type: GuidelineType,
    site_id: Optional[str] = None,
    db: Session = Depends(get_db)
) -> APIResponse[GuidelineAggregateResponse]:
    """MCP용 지침 종합 조회"""
    try:
        # 적용 가능한 지침 검색
        query = db.query(GuidelineModel).filter(
            GuidelineModel.guideline_type == guideline_type.value,
            GuidelineModel.is_active == True
        )
        
        # 사이트별 지침 + 전역 지침
        if site_id:
            query = query.filter(
                (GuidelineModel.site_id == site_id) | 
                (GuidelineModel.scope == GuidelineScope.GLOBAL.value)
            )
        else:
            query = query.filter(GuidelineModel.scope == GuidelineScope.GLOBAL.value)
        
        # 우선순위 순으로 정렬
        guidelines_models = query.order_by(GuidelineModel.priority.desc()).all()
        
        if not guidelines_models:
            return APIResponse(
                success=True,
                message="적용 가능한 지침이 없습니다.",
                data=GuidelineAggregateResponse()
            )
        
        # 엔티티 변환
        guidelines = [model_to_entity(model) for model in guidelines_models]
        
        # 지침 통합 처리
        combined_role = []
        combined_objective = []
        total_priority = 0
        last_updated = None
        
        for guideline in guidelines:
            if guideline.role_instruction:
                combined_role.append(f"## {guideline.title}\n{guideline.role_instruction}")
            
            if guideline.objective_instruction:
                combined_objective.append(f"## {guideline.title}\n{guideline.objective_instruction}")
                
            total_priority += guideline.priority
            
            if not last_updated or (guideline.updated_at and guideline.updated_at > last_updated):
                last_updated = guideline.updated_at
        
        # 응답 생성
        response = GuidelineAggregateResponse(
            guidelines=guidelines,
            combined_role_instruction="\n\n".join(combined_role),
            combined_objective_instruction="\n\n".join(combined_objective),
            total_priority=total_priority,
            last_updated=last_updated
        )
        
        logger.info(f"지침 종합 조회 완료: {guideline_type.value}, site_id: {site_id}, count: {len(guidelines)}")
        
        return APIResponse(
            success=True,
            message=f"{len(guidelines)}개의 지침을 조회했습니다.",
            data=response
        )
        
    except Exception as e:
        logger.error(f"지침 종합 조회 오류: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="지침 조회 중 오류가 발생했습니다."
        )


@router.get(
    "/",
    response_model=APIResponse[List[GuidelineResponse]],
    summary="지침 목록 조회",
    description="조건에 따라 지침 목록을 조회합니다."
)
async def list_guidelines(
    guideline_type: Optional[GuidelineType] = None,
    scope: Optional[GuidelineScope] = None,
    site_id: Optional[str] = None,
    is_active: Optional[bool] = None,
    search_query: Optional[str] = None,
    limit: int = Query(50, description="조회 개수"),
    offset: int = Query(0, description="시작 위치"),
    db: Session = Depends(get_db)
) -> APIResponse[List[GuidelineResponse]]:
    """지침 목록 조회"""
    try:
        query = db.query(GuidelineModel)
        
        # 필터링
        if guideline_type:
            query = query.filter(GuidelineModel.guideline_type == guideline_type.value)
        if scope:
            query = query.filter(GuidelineModel.scope == scope.value)
        if site_id:
            query = query.filter(GuidelineModel.site_id == site_id)
        if is_active is not None:
            query = query.filter(GuidelineModel.is_active == is_active)
        if search_query:
            query = query.filter(
                (GuidelineModel.title.contains(search_query)) |
                (GuidelineModel.description.contains(search_query)) |
                (GuidelineModel.role_instruction.contains(search_query)) |
                (GuidelineModel.objective_instruction.contains(search_query))
            )
        
        # 페이지네이션 및 정렬
        guidelines_models = query.order_by(
            GuidelineModel.priority.desc(),
            GuidelineModel.created_at.desc()
        ).offset(offset).limit(limit).all()
        
        # 응답 생성
        responses = []
        for model in guidelines_models:
            guideline = model_to_entity(model)
            response = GuidelineResponse(
                guideline=guideline,
                can_edit=True,
                can_delete=True
            )
            responses.append(response)
        
        return APIResponse(
            success=True,
            message=f"{len(responses)}개의 지침을 조회했습니다.",
            data=responses
        )
        
    except Exception as e:
        logger.error(f"지침 목록 조회 오류: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="지침 목록 조회 중 오류가 발생했습니다."
        )


@router.get(
    "/{guideline_id}",
    response_model=APIResponse[GuidelineResponse],
    summary="지침 상세 조회",
    description="ID로 특정 지침의 상세 정보를 조회합니다."
)
async def get_guideline(
    guideline_id: str,
    db: Session = Depends(get_db)
) -> APIResponse[GuidelineResponse]:
    """지침 상세 조회"""
    try:
        guideline_model = db.query(GuidelineModel).filter(
            GuidelineModel.id == guideline_id
        ).first()
        
        if not guideline_model:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="지침을 찾을 수 없습니다."
            )
        
        guideline = model_to_entity(guideline_model)
        response = GuidelineResponse(
            guideline=guideline,
            can_edit=True,
            can_delete=True
        )
        
        return APIResponse(
            success=True,
            message="지침 조회 완료",
            data=response
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"지침 상세 조회 오류: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="지침 조회 중 오류가 발생했습니다."
        )


@router.put(
    "/{guideline_id}",
    response_model=APIResponse[GuidelineResponse],
    summary="지침 수정",
    description="기존 지침을 수정합니다."
)
async def update_guideline(
    guideline_id: str,
    request: GuidelineUpdateRequest,
    db: Session = Depends(get_db)
) -> APIResponse[GuidelineResponse]:
    """지침 수정"""
    try:
        guideline_model = db.query(GuidelineModel).filter(
            GuidelineModel.id == guideline_id
        ).first()
        
        if not guideline_model:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="지침을 찾을 수 없습니다."
            )
        
        # 수정 가능한 필드 업데이트
        if request.title is not None:
            guideline_model.title = request.title
        if request.description is not None:
            guideline_model.description = request.description
        if request.guideline_type is not None:
            guideline_model.guideline_type = request.guideline_type.value
        if request.scope is not None:
            guideline_model.scope = request.scope.value
        if request.site_id is not None:
            guideline_model.site_id = request.site_id
        if request.role_instruction is not None:
            guideline_model.role_instruction = request.role_instruction
        if request.objective_instruction is not None:
            guideline_model.objective_instruction = request.objective_instruction
        if request.additional_context is not None:
            guideline_model.additional_context = request.additional_context
        if request.priority is not None:
            guideline_model.priority = request.priority
        if request.constraints is not None:
            guideline_model.constraints = request.constraints
        if request.examples is not None:
            guideline_model.examples = request.examples
        if request.references is not None:
            guideline_model.references = request.references
        if request.tags is not None:
            guideline_model.tags = request.tags
        if request.is_active is not None:
            guideline_model.is_active = request.is_active
        
        guideline_model.updated_by = "api_user"  # TODO: 실제 사용자 ID
        guideline_model.updated_at = datetime.utcnow()
        
        db.commit()
        db.refresh(guideline_model)
        
        # 응답 생성
        guideline = model_to_entity(guideline_model)
        response = GuidelineResponse(
            guideline=guideline,
            can_edit=True,
            can_delete=True
        )
        
        logger.info(f"지침 수정 완료: {guideline_id}")
        
        return APIResponse(
            success=True,
            message="지침이 성공적으로 수정되었습니다.",
            data=response
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"지침 수정 오류: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="지침 수정 중 오류가 발생했습니다."
        )


@router.delete(
    "/{guideline_id}",
    response_model=APIResponse[str],
    summary="지침 삭제",
    description="지침을 삭제합니다."
)
async def delete_guideline(
    guideline_id: str,
    db: Session = Depends(get_db)
) -> APIResponse[str]:
    """지침 삭제"""
    try:
        guideline_model = db.query(GuidelineModel).filter(
            GuidelineModel.id == guideline_id
        ).first()
        
        if not guideline_model:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="지침을 찾을 수 없습니다."
            )
        
        db.delete(guideline_model)
        db.commit()
        
        logger.info(f"지침 삭제 완료: {guideline_id}")
        
        return APIResponse(
            success=True,
            message="지침이 성공적으로 삭제되었습니다.",
            data=guideline_id
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"지침 삭제 오류: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="지침 삭제 중 오류가 발생했습니다."
        )


def model_to_entity(model: GuidelineModel) -> Guideline:
    """GuidelineModel을 Guideline 엔티티로 변환"""
    return Guideline(
        id=model.id,
        title=model.title,
        description=model.description,
        guideline_type=GuidelineType(model.guideline_type),
        scope=GuidelineScope(model.scope),
        site_id=model.site_id,
        role_instruction=model.role_instruction,
        objective_instruction=model.objective_instruction,
        additional_context=model.additional_context,
        priority=model.priority,
        constraints=model.constraints,
        examples=model.examples,
        references=model.references,
        tags=model.tags or [],
        extra_metadata=model.extra_metadata or {},
        is_active=model.is_active,
        version=model.version,
        created_by=model.created_by,
        created_at=model.created_at,
        updated_by=model.updated_by,
        updated_at=model.updated_at
    )
