"""
Template Matching Rules API Interface
템플릿 매칭 규칙 관리 API 엔드포인트
"""
import logging
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.domain.entities.schemas import APIResponse
from app.domain.entities.template_entities import (
    TemplateMatchingRule,
    TemplateMatchingRuleCreateRequest,
    TemplateMatchingRuleUpdateRequest,
    TemplateMatchingRuleResponse,
    MCPRequestType,
    TemplateType
)
from app.infrastructure.persistence.connection import get_db
from app.infrastructure.persistence.models import TemplateMatchingRuleModel

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/template-matching", tags=["template-matching"])


@router.get(
    "/rules",
    response_model=APIResponse[List[TemplateMatchingRuleResponse]],
    summary="매칭 규칙 목록 조회",
    description="등록된 템플릿 매칭 규칙 목록을 조회합니다."
)
async def get_matching_rules(
    site_id: str = None,
    is_active: bool = None,
    db: Session = Depends(get_db)
) -> APIResponse[List[TemplateMatchingRuleResponse]]:
    """매칭 규칙 목록 조회"""
    try:
        query = db.query(TemplateMatchingRuleModel)
        
        # 필터링
        if site_id is not None:
            query = query.filter(TemplateMatchingRuleModel.site_id == site_id)
        if is_active is not None:
            query = query.filter(TemplateMatchingRuleModel.is_active == is_active)
            
        # 우선순위 및 생성일 기준 정렬
        rules = query.order_by(
            TemplateMatchingRuleModel.priority.desc(),
            TemplateMatchingRuleModel.created_at.desc()
        ).all()
        
        responses = []
        for rule_model in rules:
            rule = TemplateMatchingRule(
                id=rule_model.id,
                mcp_request_type=MCPRequestType(rule_model.mcp_request_type),
                template_type=TemplateType(rule_model.template_type),
                site_id=rule_model.site_id,
                priority=rule_model.priority,
                is_active=rule_model.is_active,
                description=rule_model.description,
                created_at=rule_model.created_at,
                updated_at=rule_model.updated_at,
                created_by=rule_model.created_by
            )
            responses.append(TemplateMatchingRuleResponse(rule=rule))
        
        return APIResponse(
            success=True,
            message=f"매칭 규칙 {len(responses)}개 조회 완료",
            data=responses
        )
        
    except Exception as e:
        logger.error(f"매칭 규칙 목록 조회 오류: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="매칭 규칙 목록 조회 중 오류가 발생했습니다."
        )


@router.post(
    "/rules",
    response_model=APIResponse[TemplateMatchingRuleResponse],
    summary="매칭 규칙 생성",
    description="새로운 템플릿 매칭 규칙을 생성합니다."
)
async def create_matching_rule(
    request: TemplateMatchingRuleCreateRequest,
    db: Session = Depends(get_db)
) -> APIResponse[TemplateMatchingRuleResponse]:
    """매칭 규칙 생성"""
    try:
        # 중복 체크 (같은 MCP 요청 타입과 사이트 ID)
        existing = db.query(TemplateMatchingRuleModel).filter(
            TemplateMatchingRuleModel.mcp_request_type == request.mcp_request_type.value,
            TemplateMatchingRuleModel.site_id == request.site_id,
            TemplateMatchingRuleModel.is_active == True
        ).first()
        
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"동일한 MCP 요청 타입({request.mcp_request_type})과 사이트({request.site_id or '전체'})에 대한 활성 규칙이 이미 존재합니다."
            )
        
        # 새 규칙 생성
        rule_model = TemplateMatchingRuleModel(
            mcp_request_type=request.mcp_request_type.value,
            template_type=request.template_type.value,
            site_id=request.site_id,
            priority=request.priority,
            is_active=request.is_active,
            description=request.description,
            created_by="admin"  # TODO: 실제 사용자 정보로 변경
        )
        
        db.add(rule_model)
        db.commit()
        db.refresh(rule_model)
        
        # 응답 생성
        rule = TemplateMatchingRule(
            id=rule_model.id,
            mcp_request_type=MCPRequestType(rule_model.mcp_request_type),
            template_type=TemplateType(rule_model.template_type),
            site_id=rule_model.site_id,
            priority=rule_model.priority,
            is_active=rule_model.is_active,
            description=rule_model.description,
            created_at=rule_model.created_at,
            updated_at=rule_model.updated_at,
            created_by=rule_model.created_by
        )
        
        response = TemplateMatchingRuleResponse(rule=rule)
        
        return APIResponse(
            success=True,
            message="매칭 규칙이 생성되었습니다.",
            data=response
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"매칭 규칙 생성 오류: {e}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="매칭 규칙 생성 중 오류가 발생했습니다."
        )


@router.put(
    "/rules/{rule_id}",
    response_model=APIResponse[TemplateMatchingRuleResponse],
    summary="매칭 규칙 수정",
    description="기존 템플릿 매칭 규칙을 수정합니다."
)
async def update_matching_rule(
    rule_id: int,
    request: TemplateMatchingRuleUpdateRequest,
    db: Session = Depends(get_db)
) -> APIResponse[TemplateMatchingRuleResponse]:
    """매칭 규칙 수정"""
    try:
        rule_model = db.query(TemplateMatchingRuleModel).filter(
            TemplateMatchingRuleModel.id == rule_id
        ).first()
        
        if not rule_model:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="매칭 규칙을 찾을 수 없습니다."
            )
        
        # 업데이트할 필드만 수정
        if request.mcp_request_type is not None:
            rule_model.mcp_request_type = request.mcp_request_type.value
        if request.template_type is not None:
            rule_model.template_type = request.template_type.value
        if request.site_id is not None:
            rule_model.site_id = request.site_id
        if request.priority is not None:
            rule_model.priority = request.priority
        if request.is_active is not None:
            rule_model.is_active = request.is_active
        if request.description is not None:
            rule_model.description = request.description
            
        db.commit()
        db.refresh(rule_model)
        
        # 응답 생성
        rule = TemplateMatchingRule(
            id=rule_model.id,
            mcp_request_type=MCPRequestType(rule_model.mcp_request_type),
            template_type=TemplateType(rule_model.template_type),
            site_id=rule_model.site_id,
            priority=rule_model.priority,
            is_active=rule_model.is_active,
            description=rule_model.description,
            created_at=rule_model.created_at,
            updated_at=rule_model.updated_at,
            created_by=rule_model.created_by
        )
        
        response = TemplateMatchingRuleResponse(rule=rule)
        
        return APIResponse(
            success=True,
            message="매칭 규칙이 수정되었습니다.",
            data=response
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"매칭 규칙 수정 오류: {e}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="매칭 규칙 수정 중 오류가 발생했습니다."
        )


@router.delete(
    "/rules/{rule_id}",
    response_model=APIResponse,
    summary="매칭 규칙 삭제",
    description="템플릿 매칭 규칙을 삭제합니다."
)
async def delete_matching_rule(
    rule_id: int,
    db: Session = Depends(get_db)
) -> APIResponse:
    """매칭 규칙 삭제"""
    try:
        rule_model = db.query(TemplateMatchingRuleModel).filter(
            TemplateMatchingRuleModel.id == rule_id
        ).first()
        
        if not rule_model:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="매칭 규칙을 찾을 수 없습니다."
            )
        
        db.delete(rule_model)
        db.commit()
        
        return APIResponse(
            success=True,
            message="매칭 규칙이 삭제되었습니다."
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"매칭 규칙 삭제 오류: {e}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="매칭 규칙 삭제 중 오류가 발생했습니다."
        )


@router.get(
    "/rules/match/{mcp_request_type}",
    response_model=APIResponse[TemplateMatchingRuleResponse],
    summary="매칭 규칙 조회",
    description="MCP 요청 타입에 맞는 매칭 규칙을 조회합니다."
)
async def get_matching_rule(
    mcp_request_type: MCPRequestType,
    site_id: str = None,
    db: Session = Depends(get_db)
) -> APIResponse[TemplateMatchingRuleResponse]:
    """MCP 요청 타입에 맞는 매칭 규칙 조회"""
    try:
        query = db.query(TemplateMatchingRuleModel).filter(
            TemplateMatchingRuleModel.mcp_request_type == mcp_request_type.value,
            TemplateMatchingRuleModel.is_active == True
        )
        
        # 사이트별 우선, 전체 사이트 순으로 조회
        if site_id:
            # 1. 사이트별 규칙 우선 조회
            site_rule = query.filter(
                TemplateMatchingRuleModel.site_id == site_id
            ).order_by(TemplateMatchingRuleModel.priority.desc()).first()
            
            if site_rule:
                rule = TemplateMatchingRule(
                    id=site_rule.id,
                    mcp_request_type=MCPRequestType(site_rule.mcp_request_type),
                    template_type=TemplateType(site_rule.template_type),
                    site_id=site_rule.site_id,
                    priority=site_rule.priority,
                    is_active=site_rule.is_active,
                    description=site_rule.description,
                    created_at=site_rule.created_at,
                    updated_at=site_rule.updated_at,
                    created_by=site_rule.created_by
                )
                
                return APIResponse(
                    success=True,
                    message="사이트별 매칭 규칙 조회 완료",
                    data=TemplateMatchingRuleResponse(rule=rule)
                )
        
        # 2. 전체 사이트 규칙 조회
        global_rule = query.filter(
            TemplateMatchingRuleModel.site_id.is_(None)
        ).order_by(TemplateMatchingRuleModel.priority.desc()).first()
        
        if global_rule:
            rule = TemplateMatchingRule(
                id=global_rule.id,
                mcp_request_type=MCPRequestType(global_rule.mcp_request_type),
                template_type=TemplateType(global_rule.template_type),
                site_id=global_rule.site_id,
                priority=global_rule.priority,
                is_active=global_rule.is_active,
                description=global_rule.description,
                created_at=global_rule.created_at,
                updated_at=global_rule.updated_at,
                created_by=global_rule.created_by
            )
            
            return APIResponse(
                success=True,
                message="전체 매칭 규칙 조회 완료",
                data=TemplateMatchingRuleResponse(rule=rule)
            )
        
        # 매칭되는 규칙이 없음
        return APIResponse(
            success=False,
            message=f"MCP 요청 타입({mcp_request_type})에 맞는 매칭 규칙이 없습니다.",
            data=None
        )
        
    except Exception as e:
        logger.error(f"매칭 규칙 조회 오류: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="매칭 규칙 조회 중 오류가 발생했습니다."
        )
