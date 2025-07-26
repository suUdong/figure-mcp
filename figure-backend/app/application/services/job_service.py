import uuid
import psutil
import time
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from collections import defaultdict, deque

from app.domain.entities.schemas import Job, JobCreate, JobUpdate, JobStatus, JobType, SystemMetrics
from app.utils.logger import get_logger

logger = get_logger(__name__)

class JobService:
    """작업 상태 추적 및 관리 서비스"""
    
    def __init__(self):
        self.jobs: Dict[str, Job] = {}
        self.job_history: deque = deque(maxlen=1000)  # 최근 1000개 작업 이력
        self.start_time = time.time()
        self._last_cpu_check = 0
        self._cached_cpu_usage = 0.0
        
    def create_job(self, job_create: JobCreate) -> Job:
        """새 작업 생성"""
        job_id = str(uuid.uuid4())
        now = datetime.now()
        
        job = Job(
            id=job_id,
            type=job_create.type,
            status=JobStatus.PENDING,
            site_id=job_create.site_id,
            document_id=job_create.document_id,
            created_at=now,
            updated_at=now,
            metadata=job_create.metadata
        )
        
        self.jobs[job_id] = job
        logger.info(f"작업 생성됨: {job_id}, 타입: {job_create.type}")
        return job
    
    def update_job(self, job_id: str, job_update: JobUpdate) -> Optional[Job]:
        """작업 상태 업데이트"""
        if job_id not in self.jobs:
            logger.warning(f"존재하지 않는 작업 ID: {job_id}")
            return None
            
        job = self.jobs[job_id]
        now = datetime.now()
        
        # 상태 업데이트
        if job_update.status:
            old_status = job.status
            job.status = job_update.status
            
            if old_status == JobStatus.PENDING and job_update.status == JobStatus.PROCESSING:
                job.started_at = now
            elif job_update.status in [JobStatus.COMPLETED, JobStatus.FAILED, JobStatus.CANCELLED]:
                job.completed_at = now
                # 완료된 작업은 히스토리로 이동
                self.job_history.append(self._serialize_job_for_history(job))
                
        if job_update.progress is not None:
            job.progress = max(0.0, min(100.0, job_update.progress))
            
        if job_update.message:
            job.message = job_update.message
            
        if job_update.error:
            job.error = job_update.error
            job.status = JobStatus.FAILED
            job.completed_at = now
            # 실패한 작업은 히스토리로 이동
            self.job_history.append(self._serialize_job_for_history(job))
            
        if job_update.metadata:
            job.metadata.update(job_update.metadata)
            
        job.updated_at = now
        
        logger.info(f"작업 업데이트됨: {job_id}, 상태: {job.status}, 진행률: {job.progress}%")
        return job
    
    def get_job(self, job_id: str) -> Optional[Job]:
        """작업 조회"""
        return self.jobs.get(job_id)
    
    def get_active_jobs(self) -> List[Job]:
        """활성 작업 목록 조회"""
        return [
            job for job in self.jobs.values() 
            if job.status in [JobStatus.PENDING, JobStatus.PROCESSING]
        ]
    
    def get_recent_jobs(self, limit: int = 50) -> List[Job]:
        """최근 작업 목록 조회"""
        active_jobs = list(self.jobs.values())
        completed_jobs = [Job(**job_data) for job_data in list(self.job_history)[-limit:]]
        
        all_jobs = active_jobs + completed_jobs
        # 시간순 정렬 (최신 순)
        all_jobs.sort(key=lambda x: x.updated_at, reverse=True)
        
        return all_jobs[:limit]
    
    def get_jobs_by_status(self, status: JobStatus) -> List[Job]:
        """상태별 작업 조회"""
        return [job for job in self.jobs.values() if job.status == status]
    
    def get_jobs_by_type(self, job_type: JobType) -> List[Job]:
        """타입별 작업 조회"""
        return [job for job in self.jobs.values() if job.type == job_type]
    
    def cleanup_completed_jobs(self, older_than_hours: int = 24):
        """완료된 작업 정리"""
        cutoff_time = datetime.now() - timedelta(hours=older_than_hours)
        to_remove = []
        
        for job_id, job in self.jobs.items():
            if (job.status in [JobStatus.COMPLETED, JobStatus.FAILED, JobStatus.CANCELLED] 
                and job.completed_at and job.completed_at < cutoff_time):
                to_remove.append(job_id)
                
        for job_id in to_remove:
            del self.jobs[job_id]
            
        if to_remove:
            logger.info(f"{len(to_remove)}개 완료된 작업 정리됨")
    
    def get_system_metrics(self) -> SystemMetrics:
        """시스템 메트릭스 조회"""
        now = datetime.now()
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        
        # 활성 작업 수
        active_jobs = len([j for j in self.jobs.values() 
                          if j.status in [JobStatus.PENDING, JobStatus.PROCESSING]])
        pending_jobs = len([j for j in self.jobs.values() if j.status == JobStatus.PENDING])
        
        # 오늘 완료/실패한 작업 수
        completed_today = 0
        failed_today = 0
        
        for job_data in self.job_history:
            completed_at_str = job_data.get('completed_at')
            if completed_at_str and completed_at_str.strip():
                try:
                    job_completed_at = datetime.fromisoformat(completed_at_str)
                    if job_completed_at >= today_start:
                        if job_data.get('status') == JobStatus.COMPLETED:
                            completed_today += 1
                        elif job_data.get('status') == JobStatus.FAILED:
                            failed_today += 1
                except ValueError:
                    # 잘못된 datetime 형식은 무시
                    continue
        
        # 시스템 리소스 사용량 (CPU는 캐시 사용)
        try:
            current_time = time.time()
            # CPU 사용량은 5초마다만 새로 측정 (캐시 사용)
            if current_time - self._last_cpu_check > 5:
                self._cached_cpu_usage = psutil.cpu_percent(interval=0.1)  # 0.1초로 단축
                self._last_cpu_check = current_time
            cpu_usage = self._cached_cpu_usage
            
            memory = psutil.virtual_memory()
            disk = psutil.disk_usage('/')
            
            memory_usage = memory.percent
            disk_usage = disk.percent
        except Exception as e:
            logger.warning(f"시스템 메트릭 수집 실패: {e}")
            cpu_usage = memory_usage = disk_usage = 0.0
        
        # 실제 문서 및 사이트 수 가져오기
        total_documents = 0
        total_sites = 0
        
        try:
            # vector_store_service에서 문서 수 가져오기
            from app.application.services.vector_store import vector_store_service
            if hasattr(vector_store_service, 'collection') and vector_store_service.collection:
                collection_info = vector_store_service.collection.count()
                total_documents = collection_info if isinstance(collection_info, int) else 0
        except Exception as e:
            logger.warning(f"문서 수 조회 실패: {e}")
            
        try:
            # sites API에서 사이트 수 가져오기 (모의 데이터)
            # TODO: 실제 데이터베이스 연결 후 수정
            total_sites = 3  # 임시 데이터
        except Exception as e:
            logger.warning(f"사이트 수 조회 실패: {e}")

        uptime = time.time() - self.start_time
        
        return SystemMetrics(
            timestamp=now,
            cpu_usage=cpu_usage,
            memory_usage=memory_usage,
            disk_usage=disk_usage,
            active_jobs=active_jobs,
            pending_jobs=pending_jobs,
            completed_jobs_today=completed_today,
            failed_jobs_today=failed_today,
            total_documents=total_documents,
            total_sites=total_sites,
            vector_db_size=None,
            uptime_seconds=uptime
        )
    
    def get_error_summary(self) -> Dict[str, int]:
        """에러 요약 통계"""
        error_counts = defaultdict(int)
        
        # 활성 작업의 에러
        for job in self.jobs.values():
            if job.status == JobStatus.FAILED and job.error:
                error_type = job.error.split(':')[0] if ':' in job.error else job.error
                error_counts[error_type] += 1
        
        # 히스토리의 에러
        for job_data in self.job_history:
            if job_data.get('status') == JobStatus.FAILED and job_data.get('error'):
                error = job_data['error']
                error_type = error.split(':')[0] if ':' in error else error
                error_counts[error_type] += 1
        
        return dict(error_counts)
    
    def get_performance_summary(self) -> Dict[str, float]:
        """성능 요약 통계"""
        performance = {}
        
        # 작업 유형별 평균 처리 시간
        type_durations = defaultdict(list)
        
        for job_data in self.job_history:
            if (job_data.get('status') == JobStatus.COMPLETED 
                and job_data.get('started_at') and job_data.get('completed_at')):
                
                start_time = datetime.fromisoformat(job_data['started_at'])
                end_time = datetime.fromisoformat(job_data['completed_at'])
                duration = (end_time - start_time).total_seconds()
                
                job_type = job_data.get('type')
                type_durations[job_type].append(duration)
        
        for job_type, durations in type_durations.items():
            if durations:
                performance[f"{job_type}_avg_duration"] = sum(durations) / len(durations)
                performance[f"{job_type}_max_duration"] = max(durations)
                performance[f"{job_type}_min_duration"] = min(durations)
        
        # 전체 성공률
        total_jobs = len(self.job_history)
        if total_jobs > 0:
            successful_jobs = len([j for j in self.job_history 
                                 if j.get('status') == JobStatus.COMPLETED])
            performance['success_rate'] = (successful_jobs / total_jobs) * 100
        
        return performance

    def _serialize_job_for_history(self, job: Job) -> Dict[str, Any]:
        """작업을 히스토리에 저장하기 위해 안전하게 직렬화"""
        job_dict = job.dict()
        # datetime 객체를 문자열로 변환
        for key, value in job_dict.items():
            if isinstance(value, datetime):
                job_dict[key] = value.isoformat()
            elif value is None:
                job_dict[key] = None
        return job_dict

# 글로벌 JobService 인스턴스
job_service = JobService() 