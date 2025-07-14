"""
Documents API Endpoints
문서 업로드 및 관리 API
"""
import logging
import uuid
from typing import List, Dict, Any
from datetime import datetime
from fastapi import APIRouter, HTTPException, Depends, status

from app.models.schemas import (
    Document, UploadDocumentRequest, APIResponse, DocumentType,
    JobCreate, JobType, JobUpdate, JobStatus
)
from app.services.vector_store import vector_store_service
from app.services.job_service import job_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/documents", tags=["Documents"])


async def get_vector_store_service():
    """벡터 스토어 서비스 의존성 주입"""
    if not vector_store_service._collection:
        await vector_store_service.initialize()
    return vector_store_service


@router.post(
    "/upload",
    response_model=APIResponse,
    summary="문서 업로드",
    description="새 문서를 벡터 데이터베이스에 업로드합니다."
)
async def upload_document(
    request: UploadDocumentRequest,
    service: object = Depends(get_vector_store_service)
) -> APIResponse:
    """
    문서 업로드
    
    - **title**: 문서 제목
    - **content**: 문서 내용 (최소 10자)
    - **doc_type**: 문서 타입 (website, pdf, text, confluence, jira)
    - **source_url**: 소스 URL (선택사항)
    - **site_id**: 관련 사이트 ID (선택사항)
    - **metadata**: 추가 메타데이터 (선택사항)
    """
    try:
        # 작업 추적 시작
        job = job_service.create_job(JobCreate(
            type=JobType.DOCUMENT_UPLOAD,
            site_id=request.site_id,
            metadata={
                "title": request.title,
                "doc_type": request.doc_type.value,
                "content_length": len(request.content)
            }
        ))
        
        try:
            # 진행 상태 업데이트: 시작
            job_service.update_job(job.id, JobUpdate(
                status=JobStatus.PROCESSING,
                progress=10.0,
                message="문서 검증 중..."
            ))
            
            # Document 객체 생성
            document = Document(
                id=str(uuid.uuid4()),
                title=request.title,
                content=request.content,
                doc_type=request.doc_type,
                source_url=request.source_url,
                site_id=request.site_id,
                metadata=request.metadata,
                created_at=datetime.now()
            )
            
            # 진행 상태 업데이트: 벡터화 중
            job_service.update_job(job.id, JobUpdate(
                progress=50.0,
                message="벡터화 처리 중..."
            ))
            
            # 벡터 저장소에 추가
            doc_id = await service.add_document(document)
            
            # 진행 상태 업데이트: 완료
            job_service.update_job(job.id, JobUpdate(
                status=JobStatus.COMPLETED,
                progress=100.0,
                message="문서 업로드 완료",
                metadata={"document_id": doc_id}
            ))
            
            logger.info(f"문서 업로드 성공: {doc_id}")
            
            return APIResponse(
                success=True,
                message="문서 업로드 성공",
                data={
                    "document_id": doc_id,
                    "job_id": job.id,
                    "title": document.title,
                    "doc_type": document.doc_type.value,
                    "created_at": document.created_at.isoformat()
                }
            )
            
        except Exception as e:
            # 진행 상태 업데이트: 실패
            job_service.update_job(job.id, JobUpdate(
                status=JobStatus.FAILED,
                error=str(e),
                message="문서 업로드 실패"
            ))
            raise
        
    except ValueError as e:
        logger.error(f"문서 업로드 검증 실패: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"문서 업로드 실패: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"문서 업로드 실패: {str(e)}"
        )


@router.delete(
    "/{document_id}",
    response_model=APIResponse,
    summary="문서 삭제",
    description="지정된 문서를 벡터 데이터베이스에서 삭제합니다."
)
async def delete_document(
    document_id: str,
    service: object = Depends(get_vector_store_service)
) -> APIResponse:
    """문서 삭제"""
    try:
        success = await service.delete_document(document_id)
        
        if success:
            logger.info(f"문서 삭제 성공: {document_id}")
            return APIResponse(
                success=True,
                message="문서 삭제 성공",
                data={"document_id": document_id}
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"문서를 찾을 수 없습니다: {document_id}"
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"문서 삭제 실패: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"문서 삭제 실패: {str(e)}"
        )


@router.get(
    "/search",
    response_model=APIResponse,
    summary="문서 검색",
    description="유사도 기반으로 관련 문서를 검색합니다."
)
async def search_documents(
    query: str,
    max_results: int = 5,
    similarity_threshold: float = 0.7,
    site_ids: str = None,  # 쿼리 파라미터로 쉼표 구분 문자열
    service: object = Depends(get_vector_store_service)
) -> APIResponse:
    """
    문서 검색
    
    - **query**: 검색어
    - **max_results**: 최대 결과 수 (기본값: 5)
    - **similarity_threshold**: 유사도 임계값 (기본값: 0.7)
    - **site_ids**: 사이트 ID 목록 (쉼표로 구분, 선택사항)
    """
    try:
        # site_ids 파싱
        site_id_list = None
        if site_ids:
            site_id_list = [s.strip() for s in site_ids.split(",") if s.strip()]
        
        # 검색 실행
        results = await service.search_similar(
            query=query,
            max_results=max_results,
            site_ids=site_id_list,
            similarity_threshold=similarity_threshold
        )
        
        return APIResponse(
            success=True,
            message="문서 검색 성공",
            data={
                "query": query,
                "results": results,
                "total_found": len(results)
            }
        )
        
    except Exception as e:
        logger.error(f"문서 검색 실패: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"문서 검색 실패: {str(e)}"
        )


@router.get(
    "/stats",
    response_model=APIResponse,
    summary="문서 통계",
    description="벡터 데이터베이스의 문서 통계를 조회합니다."
)
async def get_document_stats(
    service: object = Depends(get_vector_store_service)
) -> APIResponse:
    """문서 통계 조회"""
    try:
        stats = await service.get_collection_info()
        
        return APIResponse(
            success=True,
            message="문서 통계 조회 성공",
            data=stats
        )
        
    except Exception as e:
        logger.error(f"문서 통계 조회 실패: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"문서 통계 조회 실패: {str(e)}"
        ) 