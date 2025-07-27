"""
RAG API Endpoints
FastAPI를 활용한 RAG 기능 API
"""
import logging
import time
from typing import Dict, Any
from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.responses import JSONResponse

from app.domain.entities.schemas import QueryRequest, QueryResponse, APIResponse, JobCreate, JobType, JobUpdate, JobStatus
from app.application.services.job_service import job_service
from app.application.services.rag_service import rag_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/rag", tags=["RAG"])


async def get_rag_service():
    """RAG 서비스 의존성 주입"""
    if not rag_service._initialized:
        await rag_service.initialize()
    return rag_service


@router.post(
    "/query", 
    response_model=APIResponse,
    summary="RAG 질의응답",
    description="문서 검색 기반 질의응답을 수행합니다."
)
async def process_query(
    request: QueryRequest,
    service: object = Depends(get_rag_service)
) -> APIResponse:
    """
    RAG 기반 질의응답 처리
    
    - **query**: 질문 내용 (1-1000자)
    - **site_ids**: 검색할 사이트 ID 목록 (선택사항)
    - **max_results**: 최대 검색 결과 수 (1-20, 기본값 5)
    - **similarity_threshold**: 유사도 임계값 (0.0-1.0, 기본값 0.7)
    """
    try:
        logger.info(f"RAG 질의 요청: {request.query[:50]}...")
        
        # 작업 추적 시작
        job = job_service.create_job(JobCreate(
            type=JobType.RAG_QUERY,
            metadata={
                "query": request.query[:100],
                "site_ids": request.site_ids or [],
                "max_results": request.max_results
            }
        ))
        
        try:
            # 진행 상태 업데이트: 시작
            job_service.update_job(job.id, JobUpdate(
                status=JobStatus.PROCESSING,
                progress=20.0,
                message="문서 검색 중..."
            ))
            
            # 진행 상태 업데이트: RAG 처리 중
            job_service.update_job(job.id, JobUpdate(
                progress=60.0,
                message="AI 응답 생성 중..."
            ))
            
            # RAG 질의 처리 (QueryRequest를 적절한 파라미터로 변환)
            start_time = time.time()
            
            result = await service.query(
                question=request.query,
                include_sources=True
            )
            
            query_time = time.time() - start_time
            
            # QueryResponse 객체 생성
            response = QueryResponse(
                answer=result.get("answer", ""),
                sources=result.get("sources", []),
                query=request.query,
                query_time=query_time,
                max_results=request.max_results,
                similarity_threshold=request.similarity_threshold
            )
            
            if response.answer.startswith("처리 중 오류가 발생했습니다"):
                job_service.update_job(job.id, JobUpdate(
                    status=JobStatus.FAILED,
                    error=response.answer,
                    message="RAG 처리 실패"
                ))
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=response.answer
                )
            
            # 진행 상태 업데이트: 완료
            job_service.update_job(job.id, JobUpdate(
                status=JobStatus.COMPLETED,
                progress=100.0,
                message="RAG 처리 완료",
                metadata={
                    "answer_length": len(response.answer),
                    "sources_count": len(response.sources),
                    "processing_time": response.query_time
                }
            ))
            
            # 응답에 job_id 추가
            response.job_id = job.id
            
            # APIResponse 형태로 감싸서 반환
            return APIResponse(
                success=True,
                message="RAG 질의 처리 완료",
                data={
                    "query": request.query,
                    "answer": response.answer,
                    "sources": [
                        {
                            "title": result.metadata.get("title", "Unknown"),
                            "content": result.content,
                            "doc_type": result.metadata.get("doc_type", "text"),
                            "similarity": result.score,
                            "source_url": result.metadata.get("source_url")
                        }
                        for result in response.results
                    ],
                    "processing_time": response.query_time,
                    "job_id": response.job_id
                },
                errors=None
            )
            
        except Exception as e:
            # 진행 상태 업데이트: 실패
            job_service.update_job(job.id, JobUpdate(
                status=JobStatus.FAILED,
                error=str(e),
                message="RAG 처리 실패"
            ))
            raise
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"RAG 질의 처리 실패: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"내부 서버 오류: {str(e)}"
        )


@router.get(
    "/status",
    response_model=APIResponse,
    summary="RAG 서비스 상태",
    description="RAG 서비스의 현재 상태를 조회합니다."
)
async def get_rag_status(
    service: object = Depends(get_rag_service)
) -> APIResponse:
    """RAG 서비스 상태 조회"""
    try:
        status_info = await service.get_service_status()
        
        return APIResponse(
            success=True,
            message="RAG 서비스 상태 조회 성공",
            data=status_info,
            errors=None
        )
        
    except Exception as e:
        logger.error(f"RAG 상태 조회 실패: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"상태 조회 실패: {str(e)}"
        )


@router.post(
    "/health",
    response_model=APIResponse,
    summary="RAG 서비스 헬스체크",
    description="RAG 서비스가 정상 작동하는지 확인합니다."
)
async def health_check(
    service: object = Depends(get_rag_service)
) -> APIResponse:
    """RAG 서비스 헬스체크"""
    try:
        # 간단한 테스트 질의 수행
        test_request = QueryRequest(
            query="테스트",
            max_results=1,
            similarity_threshold=0.5
        )
        
        # 간단한 테스트 질의
        result = await service.query(
            question=test_request.query,
            include_sources=False
        )
        
        # QueryResponse 형태로 변환
        response = QueryResponse(
            answer=result.get("answer", ""),
            sources=result.get("sources", []),
            query=test_request.query,
            query_time=0.0,
            max_results=test_request.max_results,
            similarity_threshold=test_request.similarity_threshold
        )
        
        return APIResponse(
            success=True,
            message="RAG 서비스 정상 작동",
            data={
                "service_healthy": True,
                "test_query_processing_time": response.query_time
            },
            errors=None
        )
        
    except Exception as e:
        logger.error(f"RAG 헬스체크 실패: {e}")
        return APIResponse(
            success=False,
            message=f"RAG 서비스 오류: {str(e)}",
            data={"service_healthy": False},
            errors=[str(e)]
        ) 