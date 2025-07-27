"""
Sites API Endpoints 
사이트 관리 API (SQLAlchemy 데이터베이스 연동)
"""
import logging
import uuid
from typing import List, Dict, Any, Optional
from datetime import datetime
from fastapi import APIRouter, HTTPException, Depends, status
from sqlalchemy.orm import Session

from app.domain.entities.schemas import Site, CreateSiteRequest, UpdateSiteRequest, APIResponse
from app.infrastructure.persistence.models import Site as SiteModel
from app.infrastructure.persistence.connection import get_db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/sites", tags=["Sites"])


@router.post(
    "/",
    response_model=APIResponse,
    summary="회사(사이트) 생성",
    description="새로운 회사(IT 운영업무)를 등록합니다."
)
async def create_site(
    site_data: CreateSiteRequest,
    db: Session = Depends(get_db)
) -> APIResponse:
    """
    회사(사이트) 생성
    
    - **name**: 회사/조직 이름
    - **company**: 회사명
    - **business_type**: 업종/사업 분야
    - **contact_person**: 담당자
    - **url**: 회사 웹사이트 URL (선택사항)
    - **description**: 회사/업무 설명
    """
    try:
        # URL이 제공된 경우에만 중복 체크
        if site_data.url:
            existing_site = db.query(SiteModel).filter(SiteModel.url == site_data.url).first()
            if existing_site:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"이미 등록된 URL입니다: {site_data.url}"
                )
        
        # 같은 회사명 + 부서 조합 중복 체크
        existing_company = db.query(SiteModel).filter(
            SiteModel.company == site_data.company,
            SiteModel.department == site_data.department
        ).first()
        if existing_company:
            dept_info = f" ({site_data.department})" if site_data.department else ""
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"이미 등록된 회사입니다: {site_data.company}{dept_info}"
            )
        
        # 사이트 생성
        db_site = SiteModel(
            id=str(uuid.uuid4()),
            name=site_data.name,
            company=site_data.company,
            department=site_data.department,
            business_type=site_data.business_type,
            contact_person=site_data.contact_person,
            contact_email=site_data.contact_email,
            contact_phone=site_data.contact_phone,
            url=site_data.url,
            description=site_data.description,
            crawl_frequency=site_data.crawl_frequency,
            max_depth=site_data.max_depth,
            include_patterns=site_data.include_patterns,
            exclude_patterns=site_data.exclude_patterns,
            is_active=True,
            status="active",
            document_count=0,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        
        db.add(db_site)
        db.commit()
        db.refresh(db_site)
        
        logger.info(f"회사(사이트) 생성 성공: {db_site.id} - {db_site.company}")
        
        # 프론트엔드 호환 응답 데이터
        site_dict = {
            "id": db_site.id,
            "name": db_site.name,
            "company": db_site.company,
            "department": db_site.department,
            "business_type": db_site.business_type,
            "contact_person": db_site.contact_person,
            "contact_email": db_site.contact_email,
            "contact_phone": db_site.contact_phone,
            "url": db_site.url,
            "description": db_site.description,
            "enabled": db_site.is_active,
            "crawl_frequency": db_site.crawl_frequency,
            "max_depth": db_site.max_depth,
            "include_patterns": db_site.include_patterns,
            "exclude_patterns": db_site.exclude_patterns,
            "last_crawled": db_site.last_crawled.isoformat() if db_site.last_crawled else None,
            "status": db_site.status,
            "document_count": db_site.document_count,
            "created_at": db_site.created_at.isoformat(),
            "updated_at": db_site.updated_at.isoformat()
        }
        
        return APIResponse(
            success=True,
            message="회사(사이트) 생성 성공",
            data=site_dict
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"사이트 생성 실패: {e}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"사이트 생성 실패: {str(e)}"
        )


@router.get(
    "/",
    response_model=APIResponse,
    summary="회사(사이트) 목록 조회",
    description="등록된 회사(IT 운영업무) 목록을 조회합니다."
)
async def get_sites(
    active_only: bool = True,
    db: Session = Depends(get_db)
) -> APIResponse:
    """
    회사(사이트) 목록 조회
    
    - **active_only**: 활성 회사만 조회할지 여부
    """
    try:
        query = db.query(SiteModel)
        
        if active_only:
            query = query.filter(SiteModel.is_active == True)
        
        sites = query.order_by(SiteModel.created_at.desc()).all()
        
        result = []
        for site in sites:
            site_dict = {
                "id": site.id,
                "name": site.name,
                "company": site.company,
                "department": site.department,
                "business_type": site.business_type,
                "contact_person": site.contact_person,
                "contact_email": site.contact_email,
                "contact_phone": site.contact_phone,
                "url": site.url,
                "description": site.description,
                "enabled": site.is_active,
                "crawl_frequency": site.crawl_frequency,
                "max_depth": site.max_depth,
                "include_patterns": site.include_patterns,
                "exclude_patterns": site.exclude_patterns,
                "last_crawled": site.last_crawled.isoformat() if site.last_crawled else None,
                "status": site.status,
                "document_count": site.document_count,
                "created_at": site.created_at.isoformat(),
                "updated_at": site.updated_at.isoformat()
            }
            result.append(site_dict)
        
        logger.info(f"회사(사이트) 목록 조회: {len(result)}개")
        
        return APIResponse(
            success=True,
            message="회사(사이트) 목록 조회 성공",
            data=result
        )
        
    except Exception as e:
        logger.error(f"회사(사이트) 목록 조회 실패: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="회사(사이트) 목록을 조회할 수 없습니다"
        )


@router.get(
    "/{site_id}",
    response_model=APIResponse,
    summary="사이트 상세 조회",
    description="지정된 사이트의 상세 정보를 조회합니다."
)
async def get_site(
    site_id: str,
    db: Session = Depends(get_db)
) -> APIResponse:
    """사이트 상세 조회"""
    try:
        site = db.query(SiteModel).filter(SiteModel.id == site_id).first()
        
        if not site:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"사이트를 찾을 수 없습니다: {site_id}"
            )
        
        site_dict = {
            "id": site.id,
            "name": site.name,
            "company": site.company,
            "department": site.department,
            "url": site.url,
            "description": site.description,
            "enabled": site.is_active,
            "crawl_frequency": site.crawl_frequency,
            "max_depth": site.max_depth,
            "include_patterns": site.include_patterns,
            "exclude_patterns": site.exclude_patterns,
            "last_crawled": site.last_crawled.isoformat() if site.last_crawled else None,
            "status": site.status,
            "document_count": site.document_count,
            "created_at": site.created_at.isoformat(),
            "updated_at": site.updated_at.isoformat()
        }
        
        return APIResponse(
            success=True,
            message="사이트 조회 성공",
            data=site_dict
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"사이트 조회 실패: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"사이트 조회 실패: {str(e)}"
        )


@router.put(
    "/{site_id}",
    response_model=APIResponse,
    summary="사이트 수정",
    description="지정된 사이트의 정보를 수정합니다."
)
async def update_site(
    site_id: str,
    site_update: UpdateSiteRequest,
    db: Session = Depends(get_db)
) -> APIResponse:
    """사이트 정보 수정"""
    try:
        site = db.query(SiteModel).filter(SiteModel.id == site_id).first()
        
        if not site:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"사이트를 찾을 수 없습니다: {site_id}"
            )
        
        # 수정할 필드들 업데이트
        update_data = site_update.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(site, field, value)
        
        site.updated_at = datetime.utcnow()
        
        db.commit()
        db.refresh(site)
        
        logger.info(f"사이트 수정 성공: {site_id} - {site.name}")
        
        site_dict = {
            "id": site.id,
            "name": site.name,
            "company": site.company,
            "department": site.department,
            "url": site.url,
            "description": site.description,
            "enabled": site.is_active,
            "crawl_frequency": site.crawl_frequency,
            "max_depth": site.max_depth,
            "include_patterns": site.include_patterns,
            "exclude_patterns": site.exclude_patterns,
            "last_crawled": site.last_crawled.isoformat() if site.last_crawled else None,
            "status": site.status,
            "document_count": site.document_count,
            "created_at": site.created_at.isoformat(),
            "updated_at": site.updated_at.isoformat()
        }
        
        return APIResponse(
            success=True,
            message="사이트 수정 성공",
            data=site_dict
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"사이트 수정 실패: {e}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"사이트 수정 실패: {str(e)}"
        )


@router.delete(
    "/{site_id}",
    response_model=APIResponse,
    summary="사이트 삭제",
    description="지정된 사이트를 삭제합니다."
)
async def delete_site(
    site_id: str,
    db: Session = Depends(get_db)
) -> APIResponse:
    """사이트 삭제"""
    try:
        site = db.query(SiteModel).filter(SiteModel.id == site_id).first()
        
        if not site:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"사이트를 찾을 수 없습니다: {site_id}"
            )
        
        site_name = site.name
        db.delete(site)
        db.commit()
        
        logger.info(f"사이트 삭제 성공: {site_id} - {site_name}")
        
        return APIResponse(
            success=True,
            message="사이트 삭제 성공",
            data={"deleted_site_id": site_id}
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"사이트 삭제 실패: {e}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"사이트 삭제 실패: {str(e)}"
        )


@router.patch(
    "/{site_id}/status",
    response_model=APIResponse,
    summary="사이트 상태 토글",
    description="사이트의 활성/비활성 상태를 변경합니다."
)
async def toggle_site_status(
    site_id: str,
    status_data: dict,
    db: Session = Depends(get_db)
) -> APIResponse:
    """사이트 상태 토글"""
    try:
        site = db.query(SiteModel).filter(SiteModel.id == site_id).first()
        
        if not site:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"사이트를 찾을 수 없습니다: {site_id}"
            )
        
        enabled = status_data.get("enabled", not site.is_active)
        site.is_active = enabled
        site.updated_at = datetime.utcnow()
        
        db.commit()
        db.refresh(site)
        
        logger.info(f"사이트 상태 변경: {site_id} - {enabled}")
        
        site_dict = {
            "id": site.id,
            "name": site.name,
            "company": site.company,
            "department": site.department,
            "url": site.url,
            "description": site.description,
            "enabled": site.is_active,
            "crawl_frequency": site.crawl_frequency,
            "max_depth": site.max_depth,
            "include_patterns": site.include_patterns,
            "exclude_patterns": site.exclude_patterns,
            "last_crawled": site.last_crawled.isoformat() if site.last_crawled else None,
            "status": site.status,
            "document_count": site.document_count,
            "created_at": site.created_at.isoformat(),
            "updated_at": site.updated_at.isoformat()
        }
        
        return APIResponse(
            success=True,
            message="사이트 상태 변경 성공",
            data=site_dict
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"사이트 상태 변경 실패: {e}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"사이트 상태 변경 실패: {str(e)}"
        ) 