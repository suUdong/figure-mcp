"""
Figure Backend Main Application
FastAPI를 활용한 메인 애플리케이션
"""
import logging
import asyncio
from contextlib import asynccontextmanager
from typing import Dict, Any

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exception_handlers import http_exception_handler
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
import uvicorn

from app.config import settings
from app.models.schemas import APIResponse
from app.api import rag, documents, sites, admin
from app.services.vector_store import vector_store_service
from app.services.rag_service import rag_service

# 로깅 설정
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """애플리케이션 생명주기 관리"""
    # 시작 시 실행
    logger.info("🚀 Figure Backend 시작 중...")
    
    try:
        # 데이터 디렉토리 생성
        logger.info("📁 데이터 디렉토리 생성 중...")
        settings.create_data_directory()
        
        # 서비스 초기화
        logger.info("📊 벡터 스토어 서비스 초기화 중...")
        await vector_store_service.initialize()
        
        logger.info("🤖 RAG 서비스 초기화 중...")
        await rag_service.initialize()
        
        logger.info("✅ 모든 서비스 초기화 완료")
        
    except Exception as e:
        logger.error(f"❌ 서비스 초기화 실패: {e}")
        raise
    
    yield
    
    # 종료 시 실행
    logger.info("🛑 Figure Backend 종료 중...")


# FastAPI 앱 생성
app = FastAPI(
    title="Figure Backend API",
    description="Figure 디자인 도구를 위한 RAG 기반 백엔드 API",
    version=settings.api_version,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS 미들웨어 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 개발 환경용, 프로덕션에서는 제한 필요
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# 글로벌 예외 처리
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """글로벌 예외 처리기"""
    logger.error(f"예상치 못한 오류 발생: {exc}", exc_info=True)
    
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "message": "내부 서버 오류가 발생했습니다.",
            "errors": [str(exc)] if settings.debug else ["서버 오류"]
        }
    )


# HTTP 예외 처리
@app.exception_handler(HTTPException)
async def custom_http_exception_handler(request: Request, exc: HTTPException):
    """HTTP 예외 처리기"""
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "message": exc.detail,
            "errors": [exc.detail]
        }
    )


# 정적 파일 마운트 (관리자 대시보드용)
app.mount("/static", StaticFiles(directory="app/static"), name="static")

# 라우터 포함
app.include_router(rag.router, prefix="/api")
app.include_router(documents.router, prefix="/api")
app.include_router(sites.router, prefix="/api")
app.include_router(admin.router)


# 기본 엔드포인트
@app.get("/", response_model=APIResponse, tags=["Health"])
async def root():
    """루트 엔드포인트"""
    return APIResponse(
        success=True,
        message="Figure Backend API가 정상적으로 실행 중입니다!",
        data={
            "version": settings.api_version,
            "app_name": settings.app_name,
            "docs_url": "/docs"
    }
    )


@app.get("/health", response_model=APIResponse, tags=["Health"])
async def health_check():
    """전체 시스템 헬스체크"""
    try:
        # 각 서비스 상태 확인
        vector_info = await vector_store_service.get_collection_info()
        rag_status = await rag_service.get_service_status()
        
        return APIResponse(
            success=True,
            message="시스템이 정상적으로 작동 중입니다.",
            data={
                "status": "healthy",
            "services": {
                    "vector_store": {
                        "status": "healthy",
                        "documents": vector_info.get("total_chunks", 0)
                    },
                    "rag_service": {
                        "status": "healthy" if rag_status.get("rag_service_initialized") else "initializing",
                        "model": rag_status.get("llm_model")
                    }
            },
                "config": {
                "debug": settings.debug,
                    "llm_provider": settings.llm_provider,
                    "embedding_provider": settings.embedding_provider,
                    "current_llm_model": settings.gemini_model if settings.llm_provider == "gemini" else settings.openai_model,
                    "current_embedding_model": settings.gemini_embedding_model if settings.embedding_provider == "gemini" else settings.openai_embedding_model
            }
        }
        )
        
    except Exception as e:
        logger.error(f"헬스체크 실패: {e}")
        return APIResponse(
            success=False,
            message=f"시스템 상태 확인 실패: {str(e)}",
            data={"status": "unhealthy"}
        )


@app.get("/status", response_model=APIResponse, tags=["Status"])
async def get_system_status():
    """시스템 상세 상태 조회"""
    try:
        # 벡터 스토어 정보
        vector_info = await vector_store_service.get_collection_info()
        
        # RAG 서비스 상태
        rag_status = await rag_service.get_service_status()
        
        return APIResponse(
            success=True,
            message="시스템 상태 조회 성공",
            data={
                "system": {
                    "app_name": settings.app_name,
                    "version": settings.api_version,
                    "debug_mode": settings.debug
            },
                "vector_store": vector_info,
                "rag_service": rag_status,
            "configuration": {
                    "llm_provider": settings.llm_provider,
                    "embedding_provider": settings.embedding_provider,
                    "current_llm_model": settings.gemini_model if settings.llm_provider == "gemini" else settings.openai_model,
                    "current_embedding_model": settings.gemini_embedding_model if settings.embedding_provider == "gemini" else settings.openai_embedding_model,
                    "chroma_collection": settings.chroma_collection_name
            }
        }
        )
        
    except Exception as e:
        logger.error(f"상태 조회 실패: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"시스템 상태 조회 실패: {str(e)}"
        )


if __name__ == "__main__":
    """개발 서버 실행"""
    uvicorn.run(
        "app.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
        log_level="info"
    ) 