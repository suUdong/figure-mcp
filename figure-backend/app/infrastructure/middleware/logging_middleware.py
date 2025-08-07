"""
API 로깅 미들웨어 (AOP 스타일)
헥사고날 아키텍처 - Infrastructure Layer
"""
import time
import json
import uuid
from typing import Callable, Optional
from fastapi import Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp

from app.application.services.logging_service import LoggingService
from app.domain.repositories.logging_repository import LogContext

class APILoggingMiddleware(BaseHTTPMiddleware):
    """API 요청/응답 로깅 미들웨어"""
    
    def __init__(
        self,
        app: ASGIApp,
        logging_service: LoggingService,
        exclude_paths: Optional[set[str]] = None
    ):
        super().__init__(app)
        self.logging_service = logging_service
        self.exclude_paths = exclude_paths or {"/health", "/docs", "/redoc", "/openapi.json"}
    
    def _should_log_request(self, path: str) -> bool:
        """요청을 로깅해야 하는지 판단"""
        return path not in self.exclude_paths
    
    def _extract_client_ip(self, request: Request) -> str:
        """클라이언트 IP 추출"""
        # X-Forwarded-For 헤더 확인 (프록시/로드밸런서 환경)
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            return forwarded_for.split(",")[0].strip()
        
        # X-Real-IP 헤더 확인
        real_ip = request.headers.get("X-Real-IP")
        if real_ip:
            return real_ip
        
        # 직접 연결된 클라이언트 IP
        if request.client:
            return request.client.host
        
        return "unknown"
    
    async def _get_request_body(self, request: Request) -> Optional[dict]:
        """요청 본문 추출"""
        try:
            if request.method in ["POST", "PUT", "PATCH"]:
                content_type = request.headers.get("content-type", "")
                
                if "application/json" in content_type:
                    body = await request.body()
                    if body:
                        return json.loads(body.decode("utf-8"))
                elif "multipart/form-data" in content_type:
                    # 파일 업로드의 경우 메타데이터만 로깅
                    form_data = await request.form()
                    return {
                        "form_fields": list(form_data.keys()),
                        "has_files": any(hasattr(value, "filename") for value in form_data.values()),
                        "metadata": form_data.get("metadata")
                    }
        except Exception:
            # 요청 본문 파싱 실패시 무시
            pass
        
        return None
    
    def _get_response_body(self, response: Response) -> Optional[dict]:
        """응답 본문 추출"""
        try:
            if isinstance(response, JSONResponse):
                # JSONResponse의 경우 content 속성에서 추출
                if hasattr(response, "body"):
                    body_bytes = response.body
                    if body_bytes:
                        return json.loads(body_bytes.decode("utf-8"))
        except Exception:
            # 응답 본문 파싱 실패시 무시
            pass
        
        return None
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """미들웨어 메인 로직"""
        # 로깅 제외 경로 체크
        if not self._should_log_request(request.url.path):
            return await call_next(request)
        
        # 요청 시작 시간
        start_time = time.time()
        
        # 요청 ID 생성
        request_id = str(uuid.uuid4())
        
        # 로그 컨텍스트 생성
        context = await self.logging_service.create_context(
            request_id=request_id,
            ip_address=self._extract_client_ip(request),
            user_agent=request.headers.get("user-agent"),
            endpoint=request.url.path,
            method=request.method,
            query_params=dict(request.query_params) if request.query_params else None
        )
        
        # 요청 본문 추출
        request_body = await self._get_request_body(request)
        
        # 요청 로깅
        await self.logging_service.log_api_call_start(context, request_body)
        
        # 요청 헤더에 request_id 추가 (하위 서비스에서 사용 가능)
        request.state.request_id = request_id
        request.state.log_context = context
        
        try:
            # 실제 요청 처리
            response = await call_next(request)
            
            # 응답 시간 계산
            duration_ms = (time.time() - start_time) * 1000
            
            # 응답 본문 추출
            response_body = self._get_response_body(response)
            
            # 응답 로깅
            await self.logging_service.log_api_call_end(
                context,
                response_body,
                response.status_code,
                duration_ms
            )
            
            # 응답 헤더에 request_id 추가
            response.headers["X-Request-ID"] = request_id
            
            return response
            
        except Exception as e:
            # 에러 발생시 로깅
            duration_ms = (time.time() - start_time) * 1000
            
            await self.logging_service.log_error(
                context,
                e,
                {"duration_ms": duration_ms}
            )
            
            # 에러 응답 생성
            error_response = JSONResponse(
                status_code=500,
                content={
                    "success": False,
                    "message": "내부 서버 오류가 발생했습니다.",
                    "request_id": request_id,
                    "errors": [str(e)]
                }
            )
            error_response.headers["X-Request-ID"] = request_id
            
            return error_response

class BusinessEventLogger:
    """비즈니스 이벤트 로깅을 위한 데코레이터 클래스"""
    
    def __init__(self, logging_service: LoggingService):
        self.logging_service = logging_service
    
    def log_business_event(self, event_name: str):
        """비즈니스 이벤트 로깅 데코레이터"""
        def decorator(func):
            async def wrapper(*args, **kwargs):
                # Request 객체에서 로그 컨텍스트 추출
                context = None
                for arg in args:
                    if hasattr(arg, "state") and hasattr(arg.state, "log_context"):
                        context = arg.state.log_context
                        break
                
                if not context:
                    # 컨텍스트가 없으면 기본 컨텍스트 생성
                    context = await self.logging_service.create_context()
                
                try:
                    # 함수 실행 전 로깅
                    await self.logging_service.log_business_event(
                        context,
                        f"{event_name}_시작",
                        {"function": func.__name__, "args": str(args), "kwargs": str(kwargs)}
                    )
                    
                    # 실제 함수 실행
                    result = await func(*args, **kwargs)
                    
                    # 함수 실행 후 로깅
                    await self.logging_service.log_business_event(
                        context,
                        f"{event_name}_완료",
                        {"function": func.__name__, "result_type": type(result).__name__}
                    )
                    
                    return result
                    
                except Exception as e:
                    # 에러 발생시 로깅
                    await self.logging_service.log_error(
                        context,
                        e,
                        {"function": func.__name__, "event": event_name}
                    )
                    raise
            
            return wrapper
        return decorator
