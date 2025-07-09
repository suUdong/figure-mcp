"""
Sites API Endpoints
사이트 관리 API (임시 메모리 기반 구현)
"""
import logging
import uuid
from typing import List, Dict, Any, Optional
from datetime import datetime
from fastapi import APIRouter, HTTPException, Depends, status

from app.models.schemas import Site, APIResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/sites", tags=["Sites"])

# 임시 메모리 저장소 (실제 환경에서는 데이터베이스 사용)
_sites_storage: Dict[str, Site] = {}


def get_sites_storage() -> Dict[str, Site]:
    """사이트 저장소 의존성 주입"""
    return _sites_storage


@router.post(
    "/",
    response_model=APIResponse,
    summary="사이트 생성",
    description="새로운 사이트를 등록합니다."
)
async def create_site(
    site_data: Site,
    storage: Dict[str, Site] = Depends(get_sites_storage)
) -> APIResponse:
    """
    사이트 생성
    
    - **name**: 사이트 이름
    - **url**: 사이트 URL
    - **description**: 사이트 설명 (선택사항)
    - **is_active**: 활성 상태 (기본값: True)
    """
    try:
        # ID 생성 및 생성시간 설정
        site_id = str(uuid.uuid4())
        site_data.id = site_id
        site_data.created_at = datetime.now()
        
        # 저장
        storage[site_id] = site_data
        
        logger.info(f"사이트 생성 성공: {site_id} - {site_data.name}")
        
        return APIResponse(
            success=True,
            message="사이트 생성 성공",
            data=site_data.model_dump()
        )
        
    except Exception as e:
        logger.error(f"사이트 생성 실패: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"사이트 생성 실패: {str(e)}"
        )


@router.get(
    "/",
    response_model=APIResponse,
    summary="사이트 목록 조회",
    description="등록된 모든 사이트 목록을 조회합니다."
)
async def list_sites(
    active_only: bool = True,
    storage: Dict[str, Site] = Depends(get_sites_storage)
) -> APIResponse:
    """
    사이트 목록 조회
    
    - **active_only**: 활성 사이트만 조회 (기본값: True)
    """
    try:
        sites = list(storage.values())
        
        if active_only:
            sites = [site for site in sites if site.is_active]
        
        # 생성일 기준 내림차순 정렬
        sites.sort(key=lambda x: x.created_at or datetime.min, reverse=True)
        
        return APIResponse(
            success=True,
            message="사이트 목록 조회 성공",
            data={
                "sites": [site.model_dump() for site in sites],
                "total_count": len(sites)
            }
        )
        
    except Exception as e:
        logger.error(f"사이트 목록 조회 실패: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"사이트 목록 조회 실패: {str(e)}"
        )


@router.get(
    "/{site_id}",
    response_model=APIResponse,
    summary="사이트 상세 조회",
    description="지정된 사이트의 상세 정보를 조회합니다."
)
async def get_site(
    site_id: str,
    storage: Dict[str, Site] = Depends(get_sites_storage)
) -> APIResponse:
    """사이트 상세 조회"""
    try:
        if site_id not in storage:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"사이트를 찾을 수 없습니다: {site_id}"
            )
        
        site = storage[site_id]
        
        return APIResponse(
            success=True,
            message="사이트 조회 성공",
            data=site.model_dump()
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
    site_update: Site,
    storage: Dict[str, Site] = Depends(get_sites_storage)
) -> APIResponse:
    """사이트 정보 수정"""
    try:
        if site_id not in storage:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"사이트를 찾을 수 없습니다: {site_id}"
            )
        
        # 기존 사이트 정보 유지
        existing_site = storage[site_id]
        site_update.id = site_id
        site_update.created_at = existing_site.created_at
        
        # 업데이트
        storage[site_id] = site_update
        
        logger.info(f"사이트 수정 성공: {site_id} - {site_update.name}")
        
        return APIResponse(
            success=True,
            message="사이트 수정 성공",
            data=site_update.model_dump()
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"사이트 수정 실패: {e}")
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
    storage: Dict[str, Site] = Depends(get_sites_storage)
) -> APIResponse:
    """사이트 삭제"""
    try:
        if site_id not in storage:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"사이트를 찾을 수 없습니다: {site_id}"
            )
        
        deleted_site = storage.pop(site_id)
        
        logger.info(f"사이트 삭제 성공: {site_id} - {deleted_site.name}")
        
        return APIResponse(
            success=True,
            message="사이트 삭제 성공",
            data={"deleted_site_id": site_id}
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"사이트 삭제 실패: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"사이트 삭제 실패: {str(e)}"
        ) 