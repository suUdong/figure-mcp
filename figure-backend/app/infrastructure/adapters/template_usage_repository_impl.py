"""
Template Usage Repository Implementation
템플릿 사용 이력 리포지토리 구현체
"""
import json
import logging
import sqlite3
import asyncio
from typing import List, Dict, Any, Optional
from datetime import datetime
from pathlib import Path

from app.domain.entities.template_entities import TemplateUsage
from app.domain.repositories.template_repository import TemplateUsageRepository

logger = logging.getLogger(__name__)


class SQLiteTemplateUsageRepository(TemplateUsageRepository):
    """SQLite 기반 템플릿 사용 이력 리포지토리 구현"""
    
    def __init__(self, db_path: str = "./data/template_usage.db"):
        self.db_path = db_path
        self._ensure_db_exists()
    
    def _ensure_db_exists(self):
        """데이터베이스 및 테이블 생성"""
        Path(self.db_path).parent.mkdir(parents=True, exist_ok=True)
        
        conn = sqlite3.connect(self.db_path)
        try:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS template_usage (
                    id TEXT PRIMARY KEY,
                    template_id TEXT NOT NULL,
                    user_id TEXT,
                    jira_ticket_id TEXT,
                    site_id TEXT,
                    success BOOLEAN DEFAULT 1,
                    error_message TEXT,
                    generated_content_length INTEGER,
                    used_at TIMESTAMP NOT NULL,
                    duration_ms INTEGER
                )
            """)
            
            # 인덱스 생성
            conn.execute("CREATE INDEX IF NOT EXISTS idx_usage_template ON template_usage(template_id)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_usage_user ON template_usage(user_id)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_usage_date ON template_usage(used_at)")
            
            conn.commit()
            logger.info(f"템플릿 사용 이력 데이터베이스 초기화 완료: {self.db_path}")
        finally:
            conn.close()
    
    async def record_usage(self, usage: TemplateUsage) -> TemplateUsage:
        """사용 이력 기록"""
        def _record():
            conn = sqlite3.connect(self.db_path)
            try:
                conn.execute("""
                    INSERT INTO template_usage (
                        id, template_id, user_id, jira_ticket_id, site_id,
                        success, error_message, generated_content_length,
                        used_at, duration_ms
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    usage.id, usage.template_id, usage.user_id, 
                    usage.jira_ticket_id, usage.site_id,
                    usage.success, usage.error_message, usage.generated_content_length,
                    usage.used_at.isoformat(), usage.duration_ms
                ))
                conn.commit()
                return usage
            finally:
                conn.close()
        
        return await asyncio.get_event_loop().run_in_executor(None, _record)
    
    async def get_usage_history(
        self, 
        template_id: str,
        limit: int = 50
    ) -> List[TemplateUsage]:
        """템플릿 사용 이력 조회"""
        def _get_history():
            conn = sqlite3.connect(self.db_path)
            conn.row_factory = sqlite3.Row
            try:
                cursor = conn.execute("""
                    SELECT * FROM template_usage 
                    WHERE template_id = ? 
                    ORDER BY used_at DESC 
                    LIMIT ?
                """, (template_id, limit))
                rows = cursor.fetchall()
                return [self._row_to_usage(row) for row in rows]
            finally:
                conn.close()
        
        return await asyncio.get_event_loop().run_in_executor(None, _get_history)
    
    async def get_user_usage_history(
        self, 
        user_id: str,
        limit: int = 50
    ) -> List[TemplateUsage]:
        """사용자 사용 이력 조회"""
        def _get_user_history():
            conn = sqlite3.connect(self.db_path)
            conn.row_factory = sqlite3.Row
            try:
                cursor = conn.execute("""
                    SELECT * FROM template_usage 
                    WHERE user_id = ? 
                    ORDER BY used_at DESC 
                    LIMIT ?
                """, (user_id, limit))
                rows = cursor.fetchall()
                return [self._row_to_usage(row) for row in rows]
            finally:
                conn.close()
        
        return await asyncio.get_event_loop().run_in_executor(None, _get_user_history)
    
    async def get_usage_stats(
        self, 
        template_id: str,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """사용 통계 조회"""
        def _get_stats():
            conn = sqlite3.connect(self.db_path)
            try:
                conditions = ["template_id = ?"]
                params = [template_id]
                
                if start_date:
                    conditions.append("used_at >= ?")
                    params.append(start_date.isoformat())
                
                if end_date:
                    conditions.append("used_at <= ?")
                    params.append(end_date.isoformat())
                
                where_clause = " AND ".join(conditions)
                
                # 기본 통계
                cursor = conn.execute(f"""
                    SELECT 
                        COUNT(*) as total_usage,
                        COUNT(CASE WHEN success = 1 THEN 1 END) as successful_usage,
                        COUNT(CASE WHEN success = 0 THEN 1 END) as failed_usage,
                        AVG(duration_ms) as avg_duration_ms,
                        AVG(generated_content_length) as avg_content_length
                    FROM template_usage 
                    WHERE {where_clause}
                """, params)
                
                stats = dict(cursor.fetchone())
                
                # 일별 사용량 (최근 30일)
                cursor = conn.execute(f"""
                    SELECT 
                        DATE(used_at) as date,
                        COUNT(*) as count
                    FROM template_usage 
                    WHERE {where_clause}
                    GROUP BY DATE(used_at)
                    ORDER BY date DESC
                    LIMIT 30
                """, params)
                
                daily_usage = [dict(row) for row in cursor.fetchall()]
                stats["daily_usage"] = daily_usage
                
                # 사용자별 통계
                cursor = conn.execute(f"""
                    SELECT 
                        user_id,
                        COUNT(*) as usage_count
                    FROM template_usage 
                    WHERE {where_clause} AND user_id IS NOT NULL
                    GROUP BY user_id
                    ORDER BY usage_count DESC
                    LIMIT 10
                """, params)
                
                user_stats = [dict(row) for row in cursor.fetchall()]
                stats["top_users"] = user_stats
                
                return stats
            finally:
                conn.close()
        
        return await asyncio.get_event_loop().run_in_executor(None, _get_stats)
    
    def _row_to_usage(self, row: sqlite3.Row) -> TemplateUsage:
        """SQLite Row를 TemplateUsage 객체로 변환"""
        return TemplateUsage(
            id=row["id"],
            template_id=row["template_id"],
            user_id=row["user_id"],
            jira_ticket_id=row["jira_ticket_id"],
            site_id=row["site_id"],
            success=bool(row["success"]),
            error_message=row["error_message"],
            generated_content_length=row["generated_content_length"],
            used_at=datetime.fromisoformat(row["used_at"]),
            duration_ms=row["duration_ms"]
        )