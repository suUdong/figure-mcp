"""
Documents API Endpoints
문서 업로드 및 관리 API
"""
import logging
import uuid
import os
import json
from typing import List, Dict, Any
from datetime import datetime
from fastapi import APIRouter, HTTPException, Depends, status, UploadFile, File, Form
from fastapi.responses import FileResponse
import aiofiles

from app.models.schemas import (
    Document, UploadDocumentRequest, APIResponse, DocumentType,
    JobCreate, JobType, JobUpdate, JobStatus
)
from app.services.vector_store import vector_store_service
from app.services.job_service import job_service
from app.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/documents", tags=["Documents"])

# 업로드 파일 저장 경로 (절대 경로로 설정)
UPLOAD_DIRECTORY = "/app/data/uploads"
os.makedirs(UPLOAD_DIRECTORY, exist_ok=True)

# 지원하는 파일 형식
SUPPORTED_EXTENSIONS = {
    '.txt': 'text',
    '.md': 'text',
    '.pdf': 'pdf',
    '.doc': 'doc',
    '.docx': 'doc',
    '.html': 'website',
    '.htm': 'website'
}

async def get_vector_store_service():
    """벡터 스토어 서비스 의존성 주입"""
    if not vector_store_service._collection:
        await vector_store_service.initialize()
    return vector_store_service


@router.post(
    "/upload-file",
    response_model=APIResponse,
    summary="파일 업로드",
    description="파일을 업로드하고 벡터 데이터베이스에 저장합니다."
)
async def upload_file(
    file: UploadFile = File(...),
    site_id: str = Form(None),
    metadata: str = Form("{}"),
    service: object = Depends(get_vector_store_service)
) -> APIResponse:
    """
    파일 업로드
    
    - **file**: 업로드할 파일
    - **site_id**: 관련 사이트 ID (선택사항)
    - **metadata**: 추가 메타데이터 JSON (선택사항)
    """
    try:
        # 파일 확장자 확인
        file_ext = os.path.splitext(file.filename)[1].lower()
        if file_ext not in SUPPORTED_EXTENSIONS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"지원하지 않는 파일 형식입니다. 지원 형식: {', '.join(SUPPORTED_EXTENSIONS.keys())}"
            )
        
        # 파일 크기 확인 (10MB 제한)
        MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
        content = await file.read()
        if len(content) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail="파일 크기가 10MB를 초과합니다."
            )
        
        # 작업 추적 시작
        job = job_service.create_job(JobCreate(
            type=JobType.DOCUMENT_UPLOAD,
            site_id=site_id,
            metadata={
                "filename": file.filename,
                "file_size": len(content),
                "file_type": file_ext
            }
        ))
        
        try:
            # 진행 상태 업데이트: 파일 저장 중
            job_service.update_job(job.id, JobUpdate(
                status=JobStatus.PROCESSING,
                progress=20.0,
                message="파일 저장 중..."
            ))
            
            # 파일 저장
            file_id = str(uuid.uuid4())
            file_path = os.path.join(UPLOAD_DIRECTORY, f"{file_id}{file_ext}")
            
            async with aiofiles.open(file_path, 'wb') as f:
                await f.write(content)
            
            # 진행 상태 업데이트: 내용 추출 중
            job_service.update_job(job.id, JobUpdate(
                progress=40.0,
                message="내용 추출 중..."
            ))
            
            # 파일 내용 추출
            file_content = await extract_file_content(file_path, file_ext)
            
            # 진행 상태 업데이트: 문서 생성 중
            job_service.update_job(job.id, JobUpdate(
                progress=60.0,
                message="문서 생성 중..."
            ))
            
            # 메타데이터 파싱 및 정제
            parsed_metadata = json.loads(metadata) if metadata != "{}" else {}
            
            # ChromaDB 호환을 위해 배열 타입을 문자열로 변환
            processed_metadata = {}
            for key, value in parsed_metadata.items():
                if isinstance(value, list):
                    # 배열을 쉼표로 구분된 문자열로 변환
                    processed_metadata[key] = ", ".join(str(item) for item in value)
                elif isinstance(value, dict):
                    # 딕셔너리를 JSON 문자열로 변환
                    processed_metadata[key] = json.dumps(value)
                else:
                    # 원시 타입은 그대로 유지
                    processed_metadata[key] = value
            
            # Document 객체 생성
            document = Document(
                id=file_id,
                title=file.filename,
                content=file_content,
                doc_type=DocumentType(SUPPORTED_EXTENSIONS[file_ext]),
                site_id=site_id,
                metadata={
                    "file_path": file_path,
                    "file_size": len(content),
                    "original_filename": file.filename,
                    **processed_metadata
                },
                created_at=datetime.now()
            )
            
            # 진행 상태 업데이트: 벡터화 중
            job_service.update_job(job.id, JobUpdate(
                progress=80.0,
                message="벡터화 처리 중..."
            ))
            
            # 벡터 저장소에 추가
            doc_id = await service.add_document(document)
            
            # 진행 상태 업데이트: 완료
            job_service.update_job(job.id, JobUpdate(
                status=JobStatus.COMPLETED,
                progress=100.0,
                message="파일 업로드 완료",
                metadata={"document_id": doc_id}
            ))
            
            logger.info(f"파일 업로드 성공: {file.filename} -> {doc_id}")
            
            return APIResponse(
                success=True,
                message="파일 업로드 성공",
                data={
                    "document_id": doc_id,
                    "job_id": job.id,
                    "filename": file.filename,
                    "file_size": len(content),
                    "doc_type": SUPPORTED_EXTENSIONS[file_ext],
                    "created_at": document.created_at.isoformat()
                }
            )
            
        except Exception as e:
            # 진행 상태 업데이트: 실패
            job_service.update_job(job.id, JobUpdate(
                status=JobStatus.FAILED,
                error=str(e),
                message="파일 업로드 실패"
            ))
            
            # 실패 시 파일 삭제
            if 'file_path' in locals() and os.path.exists(file_path):
                os.remove(file_path)
            
            raise
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"파일 업로드 실패: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"파일 업로드 실패: {str(e)}"
        )


async def extract_file_content(file_path: str, file_ext: str) -> str:
    """파일 내용 추출"""
    try:
        if file_ext in ['.txt', '.md', '.html', '.htm']:
            # 텍스트 파일
            async with aiofiles.open(file_path, 'r', encoding='utf-8') as f:
                return await f.read()
        elif file_ext == '.pdf':
            # PDF 파일 - 추후 PyPDF2 등으로 구현
            return f"PDF 파일 내용 추출 준비 중: {os.path.basename(file_path)}"
        elif file_ext in ['.doc', '.docx']:
            # Word 파일 - 추후 python-docx 등으로 구현
            return f"Word 파일 내용 추출 준비 중: {os.path.basename(file_path)}"
        else:
            return f"지원하지 않는 파일 형식: {file_ext}"
    except Exception as e:
        logger.error(f"파일 내용 추출 실패: {e}")
        return f"파일 내용 추출 실패: {str(e)}"


@router.get(
    "/download/{document_id}",
    summary="파일 다운로드",
    description="업로드된 파일을 다운로드합니다."
)
async def download_file(
    document_id: str,
    service: object = Depends(get_vector_store_service)
):
    """파일 다운로드"""
    try:
        # 문서 정보 조회 (실제 구현에서는 데이터베이스에서 조회)
        file_path = os.path.join(UPLOAD_DIRECTORY, f"{document_id}.txt")  # 임시로 txt 확장자
        
        if not os.path.exists(file_path):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="파일을 찾을 수 없습니다."
            )
        
        return FileResponse(
            file_path,
            media_type='application/octet-stream',
            filename=f"{document_id}.txt"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"파일 다운로드 실패: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"파일 다운로드 실패: {str(e)}"
        )


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
    "",
    response_model=APIResponse,
    summary="문서 목록 조회",
    description="벡터 데이터베이스에 저장된 모든 문서 목록을 조회합니다."
)
async def get_documents(
    service: object = Depends(get_vector_store_service)
) -> APIResponse:
    """문서 목록 조회"""
    try:
        # ChromaDB에서 모든 문서 정보 가져오기
        collection_info = await service.get_collection_info()
        
        # 컬렉션이 비어있다면 빈 목록 반환
        if collection_info.get("total_documents", 0) == 0:
            return APIResponse(
                success=True,
                message="문서 목록 조회 성공",
                data={"documents": [], "total": 0}
            )
        
        # 모든 문서 조회 (ChromaDB의 get() 메서드 사용)
        collection = service._collection
        if collection is None:
            return APIResponse(
                success=True,
                message="문서 목록 조회 성공",
                data={"documents": [], "total": 0}
            )
        
        # 모든 문서 ID와 메타데이터 가져오기
        results = collection.get()
        
        # 문서 정보 구성
        documents = []
        processed_doc_ids = set()
        
        for i, doc_id in enumerate(results.get("ids", [])):
            metadata = results.get("metadatas", [{}])[i] if i < len(results.get("metadatas", [])) else {}
            
            # 원본 문서 ID 추출 (chunk ID에서 _chunk_X 부분 제거)
            original_doc_id = doc_id.split("_chunk_")[0] if "_chunk_" in doc_id else doc_id
            
            # 이미 처리된 문서는 건너뛰기 (중복 제거)
            if original_doc_id in processed_doc_ids:
                continue
                
            processed_doc_ids.add(original_doc_id)
            
            document_info = {
                "id": original_doc_id,
                "title": metadata.get("title", "제목 없음"),
                "doc_type": metadata.get("doc_type", "unknown"),
                "created_at": metadata.get("created_at"),
                "site_id": metadata.get("site_id"),
                "source_url": metadata.get("source_url"),
                "total_chunks": metadata.get("total_chunks", 1)
            }
            
            documents.append(document_info)
        
        # 생성일시 기준 내림차순 정렬
        documents.sort(key=lambda x: x.get("created_at", ""), reverse=True)
        
        return APIResponse(
            success=True,
            message="문서 목록 조회 성공",
            data={
                "documents": documents,
                "total": len(documents)
            }
        )
        
    except Exception as e:
        logger.error(f"문서 목록 조회 실패: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"문서 목록 조회 실패: {str(e)}"
        )


@router.get(
    "/list",
    response_model=APIResponse,
    summary="문서 목록 조회",
    description="벡터 데이터베이스에 저장된 모든 문서 목록을 조회합니다."
)
async def list_documents(
    service: object = Depends(get_vector_store_service)
) -> APIResponse:
    """문서 목록 조회"""
    try:
        # ChromaDB에서 모든 문서 정보 가져오기
        collection_info = await service.get_collection_info()
        
        # 컬렉션이 비어있다면 빈 목록 반환
        if collection_info.get("total_documents", 0) == 0:
            return APIResponse(
                success=True,
                message="문서 목록 조회 성공",
                data={"documents": [], "total": 0}
            )
        
        # 모든 문서 조회 (ChromaDB의 get() 메서드 사용)
        collection = service._collection
        if collection is None:
            return APIResponse(
                success=True,
                message="문서 목록 조회 성공",
                data={"documents": [], "total": 0}
            )
        
        # 모든 문서 ID와 메타데이터 가져오기
        results = collection.get()
        
        # 문서 정보 구성
        documents = []
        processed_doc_ids = set()
        
        for i, doc_id in enumerate(results.get("ids", [])):
            metadata = results.get("metadatas", [{}])[i] if i < len(results.get("metadatas", [])) else {}
            
            # 원본 문서 ID 추출 (chunk ID에서 _chunk_X 부분 제거)
            original_doc_id = doc_id.split("_chunk_")[0] if "_chunk_" in doc_id else doc_id
            
            # 이미 처리된 문서는 건너뛰기 (중복 제거)
            if original_doc_id in processed_doc_ids:
                continue
                
            processed_doc_ids.add(original_doc_id)
            
            document_info = {
                "id": original_doc_id,
                "title": metadata.get("title", "제목 없음"),
                "doc_type": metadata.get("doc_type", "unknown"),
                "created_at": metadata.get("created_at"),
                "site_id": metadata.get("site_id"),
                "source_url": metadata.get("source_url"),
                "total_chunks": metadata.get("total_chunks", 1)
            }
            
            documents.append(document_info)
        
        # 생성일시 기준 내림차순 정렬
        documents.sort(key=lambda x: x.get("created_at", ""), reverse=True)
        
        return APIResponse(
            success=True,
            message="문서 목록 조회 성공",
            data={
                "documents": documents,
                "total": len(documents)
            }
        )
        
    except Exception as e:
        logger.error(f"문서 목록 조회 실패: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"문서 목록 조회 실패: {str(e)}"
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