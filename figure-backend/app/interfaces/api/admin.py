from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import HTMLResponse

from app.domain.entities.schemas import Job, JobUpdate, SystemMetrics, AdminStats, JobStatus, JobType, APIResponse
from app.application.services.job_service import job_service
from app.utils.logger import get_logger

logger = get_logger(__name__)

router = APIRouter(prefix="/admin", tags=["admin"])

@router.get("/", response_class=HTMLResponse)
async def admin_dashboard():
    """관리자 대시보드 HTML 페이지"""
    html_content = """
    <!DOCTYPE html>
    <html lang="ko">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Figure-MCP 관리자 대시보드</title>
        <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
        <script src="https://cdn.tailwindcss.com"></script>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
    </head>
    <body class="bg-gray-100">
        <div class="min-h-screen">
            <!-- Header -->
            <header class="bg-blue-600 text-white shadow-lg">
                <div class="container mx-auto px-4 py-4">
                    <h1 class="text-2xl font-bold flex items-center">
                        <i class="fas fa-cogs mr-3"></i>
                        Figure-MCP 관리자 대시보드
                    </h1>
                </div>
            </header>

            <!-- Main Content -->
            <main class="container mx-auto px-4 py-8">
                <!-- System Metrics Cards -->
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    <div class="bg-white rounded-lg shadow p-6">
                        <div class="flex items-center justify-between">
                            <div>
                                <p class="text-sm text-gray-600">활성 작업</p>
                                <p class="text-2xl font-bold text-blue-600" id="active-jobs">-</p>
                            </div>
                            <i class="fas fa-tasks text-3xl text-blue-300"></i>
                        </div>
                    </div>

                    <div class="bg-white rounded-lg shadow p-6">
                        <div class="flex items-center justify-between">
                            <div>
                                <p class="text-sm text-gray-600">CPU 사용률</p>
                                <p class="text-2xl font-bold text-green-600" id="cpu-usage">-</p>
                            </div>
                            <i class="fas fa-microchip text-3xl text-green-300"></i>
                        </div>
                    </div>

                    <div class="bg-white rounded-lg shadow p-6">
                        <div class="flex items-center justify-between">
                            <div>
                                <p class="text-sm text-gray-600">메모리 사용률</p>
                                <p class="text-2xl font-bold text-yellow-600" id="memory-usage">-</p>
                            </div>
                            <i class="fas fa-memory text-3xl text-yellow-300"></i>
                        </div>
                    </div>

                    <div class="bg-white rounded-lg shadow p-6">
                        <div class="flex items-center justify-between">
                            <div>
                                <p class="text-sm text-gray-600">오늘 완료</p>
                                <p class="text-2xl font-bold text-purple-600" id="completed-today">-</p>
                            </div>
                            <i class="fas fa-check-circle text-3xl text-purple-300"></i>
                        </div>
                    </div>
                </div>

                <!-- Charts Section -->
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                    <!-- Job Status Chart -->
                    <div class="bg-white rounded-lg shadow p-6">
                        <h3 class="text-lg font-semibold mb-4">작업 상태 분포</h3>
                        <canvas id="jobStatusChart"></canvas>
                    </div>

                    <!-- System Usage Chart -->
                    <div class="bg-white rounded-lg shadow p-6">
                        <h3 class="text-lg font-semibold mb-4">시스템 리소스 사용량</h3>
                        <canvas id="systemUsageChart"></canvas>
                    </div>
                </div>

                <!-- Jobs Table -->
                <div class="bg-white rounded-lg shadow">
                    <div class="p-6 border-b border-gray-200">
                        <div class="flex justify-between items-center">
                            <h3 class="text-lg font-semibold">최근 작업</h3>
                            <div class="flex space-x-2">
                                <button id="refresh-btn" class="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
                                    <i class="fas fa-sync-alt mr-2"></i>새로고침
                                </button>
                                <select id="status-filter" class="border rounded px-3 py-2">
                                    <option value="">모든 상태</option>
                                    <option value="pending">대기중</option>
                                    <option value="processing">처리중</option>
                                    <option value="completed">완료</option>
                                    <option value="failed">실패</option>
                                </select>
                            </div>
                        </div>
                    </div>
                    <div class="p-6">
                        <div class="overflow-x-auto">
                            <table class="min-w-full">
                                <thead>
                                    <tr class="border-b">
                                        <th class="text-left py-2">작업 ID</th>
                                        <th class="text-left py-2">타입</th>
                                        <th class="text-left py-2">상태</th>
                                        <th class="text-left py-2">진행률</th>
                                        <th class="text-left py-2">메시지</th>
                                        <th class="text-left py-2">시작 시간</th>
                                        <th class="text-left py-2">소요 시간</th>
                                    </tr>
                                </thead>
                                <tbody id="jobs-table-body">
                                    <!-- Jobs will be populated here -->
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </main>
        </div>

        <script src="/static/admin.js"></script>
    </body>
    </html>
    """
    return HTMLResponse(content=html_content)

@router.get("/stats", response_model=APIResponse[AdminStats])
async def get_admin_stats():
    """관리자 통계 정보 조회"""
    try:
        system_metrics = job_service.get_system_metrics()
        recent_jobs = job_service.get_recent_jobs(limit=50)
        error_summary = job_service.get_error_summary()
        performance_summary = job_service.get_performance_summary()
        
        stats = AdminStats(
            system_metrics=system_metrics,
            recent_jobs=recent_jobs,
            error_summary=error_summary,
            performance_summary=performance_summary
        )
        
        return APIResponse(
            success=True,
            message="관리자 통계 조회 성공",
            data=stats
        )
    except Exception as e:
        logger.error(f"관리자 통계 조회 실패: {e}")
        raise HTTPException(status_code=500, detail="통계 정보를 가져올 수 없습니다")

@router.get("/metrics", response_model=APIResponse[SystemMetrics])
async def get_system_metrics():
    """시스템 메트릭스 조회"""
    try:
        metrics = job_service.get_system_metrics()
        
        return APIResponse(
            success=True,
            message="시스템 메트릭스 조회 성공",
            data=metrics
        )
    except Exception as e:
        logger.error(f"시스템 메트릭스 조회 실패: {e}")
        raise HTTPException(status_code=500, detail="시스템 메트릭스를 가져올 수 없습니다")

@router.get("/jobs", response_model=List[Job])
async def get_jobs(
    status: Optional[JobStatus] = Query(None, description="작업 상태로 필터링"),
    job_type: Optional[JobType] = Query(None, description="작업 타입으로 필터링"),
    limit: int = Query(50, ge=1, le=500, description="조회할 작업 수")
):
    """작업 목록 조회"""
    try:
        if status:
            jobs = job_service.get_jobs_by_status(status)
        elif job_type:
            jobs = job_service.get_jobs_by_type(job_type)
        else:
            jobs = job_service.get_recent_jobs(limit)
        
        return jobs[:limit]
    except Exception as e:
        logger.error(f"작업 목록 조회 실패: {e}")
        raise HTTPException(status_code=500, detail="작업 목록을 가져올 수 없습니다")

@router.get("/jobs/{job_id}", response_model=Job)
async def get_job(job_id: str):
    """특정 작업 조회"""
    job = job_service.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="작업을 찾을 수 없습니다")
    return job

@router.patch("/jobs/{job_id}", response_model=Job)
async def update_job(job_id: str, job_update: JobUpdate):
    """작업 상태 업데이트 (관리자용)"""
    job = job_service.update_job(job_id, job_update)
    if not job:
        raise HTTPException(status_code=404, detail="작업을 찾을 수 없습니다")
    return job

@router.delete("/jobs/{job_id}")
async def cancel_job(job_id: str):
    """작업 취소"""
    job_update = JobUpdate(status=JobStatus.CANCELLED, message="관리자에 의해 취소됨")
    job = job_service.update_job(job_id, job_update)
    if not job:
        raise HTTPException(status_code=404, detail="작업을 찾을 수 없습니다")
    return {"message": "작업이 취소되었습니다"}

@router.post("/cleanup")
async def cleanup_jobs(older_than_hours: int = Query(24, ge=1, description="정리할 작업의 시간(시간)")):
    """완료된 작업 정리"""
    try:
        job_service.cleanup_completed_jobs(older_than_hours)
        return {"message": f"{older_than_hours}시간 이전의 완료된 작업들이 정리되었습니다"}
    except Exception as e:
        logger.error(f"작업 정리 실패: {e}")
        raise HTTPException(status_code=500, detail="작업 정리에 실패했습니다")

@router.get("/logs")
async def get_logs(
    lines: int = Query(100, ge=1, le=1000, description="조회할 로그 라인 수"),
    level: Optional[str] = Query(None, description="로그 레벨 필터 (INFO, WARNING, ERROR)")
):
    """시스템 로그 조회"""
    try:
        # TODO: 실제 로그 파일에서 읽어오도록 구현
        logs = [
            f"[INFO] {datetime.now().isoformat()} - 시스템이 정상적으로 동작 중입니다",
            f"[INFO] {datetime.now().isoformat()} - 새로운 작업이 시작되었습니다"
        ]
        return {"logs": logs[-lines:]}
    except Exception as e:
        logger.error(f"로그 조회 실패: {e}")
        raise HTTPException(status_code=500, detail="로그를 가져올 수 없습니다")


 