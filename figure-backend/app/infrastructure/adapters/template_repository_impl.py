"""
Template Repository Implementation
템플릿 리포지토리 구현체 (SQLite/PostgreSQL + 파일 시스템)
"""
import json
import logging
from typing import List, Optional, Dict, Any
from datetime import datetime
import sqlite3
import asyncio
from pathlib import Path

from app.domain.entities.template_entities import (
    Template, 
    TemplateType, 
    TemplateFormat,
    TemplateUsage,
    TemplateSearchRequest
)
from app.domain.repositories.template_repository import (
    TemplateRepository, 
    TemplateUsageRepository,
    TemplateStorageRepository
)

logger = logging.getLogger(__name__)


class SQLiteTemplateRepository(TemplateRepository):
    """SQLite 기반 템플릿 리포지토리 구현"""
    
    def __init__(self, db_path: str = "./data/templates.db"):
        self.db_path = db_path
        self._ensure_db_exists()
    
    def _ensure_db_exists(self):
        """데이터베이스 및 테이블 생성"""
        Path(self.db_path).parent.mkdir(parents=True, exist_ok=True)
        
        conn = sqlite3.connect(self.db_path)
        try:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS templates (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    description TEXT,
                    template_type TEXT NOT NULL,
                    format TEXT NOT NULL DEFAULT 'markdown',
                    version TEXT DEFAULT '1.0.0',
                    site_id TEXT,
                    content TEXT NOT NULL,
                    variables TEXT DEFAULT '{}',
                    file_path TEXT,
                    file_size INTEGER,
                    tags TEXT DEFAULT '[]',
                    metadata TEXT DEFAULT '{}',
                    usage_count INTEGER DEFAULT 0,
                    is_active BOOLEAN DEFAULT 1,
                    is_default BOOLEAN DEFAULT 0,
                    created_by TEXT,
                    created_at TIMESTAMP,
                    updated_by TEXT,
                    updated_at TIMESTAMP,
                    
                    UNIQUE(name, site_id)
                )
            """)
            
            # 인덱스 생성
            conn.execute("CREATE INDEX IF NOT EXISTS idx_templates_type ON templates(template_type)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_templates_site ON templates(site_id)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_templates_active ON templates(is_active)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_templates_default ON templates(is_default)")
            
            conn.commit()
            logger.info(f"템플릿 데이터베이스 초기화 완료: {self.db_path}")
        finally:
            conn.close()
    
    async def create(self, template: Template) -> Template:
        """템플릿 생성"""
        def _create():
            conn = sqlite3.connect(self.db_path)
            try:
                conn.execute("""
                    INSERT INTO templates (
                        id, name, description, template_type, format, version,
                        site_id, content, variables, file_path, file_size,
                        tags, metadata, usage_count, is_active, is_default,
                        created_by, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    template.id, template.name, template.description,
                    template.template_type.value, template.format.value, template.version,
                    template.site_id, template.content, json.dumps(template.variables),
                    template.file_path, template.file_size,
                    json.dumps(template.tags), json.dumps(template.metadata),
                    template.usage_count, template.is_active, template.is_default,
                    template.created_by, template.created_at.isoformat() if template.created_at else None
                ))
                conn.commit()
                return template
            finally:
                conn.close()
        
        return await asyncio.get_event_loop().run_in_executor(None, _create)
    
    async def get_by_id(self, template_id: str) -> Optional[Template]:
        """ID로 템플릿 조회"""
        def _get():
            conn = sqlite3.connect(self.db_path)
            conn.row_factory = sqlite3.Row
            try:
                cursor = conn.execute("SELECT * FROM templates WHERE id = ?", (template_id,))
                row = cursor.fetchone()
                return self._row_to_template(row) if row else None
            finally:
                conn.close()
        
        return await asyncio.get_event_loop().run_in_executor(None, _get)
    
    async def get_by_name(self, name: str, site_id: Optional[str] = None) -> Optional[Template]:
        """이름으로 템플릿 조회"""
        def _get():
            conn = sqlite3.connect(self.db_path)
            conn.row_factory = sqlite3.Row
            try:
                if site_id:
                    cursor = conn.execute(
                        "SELECT * FROM templates WHERE name = ? AND site_id = ?", 
                        (name, site_id)
                    )
                else:
                    cursor = conn.execute(
                        "SELECT * FROM templates WHERE name = ? AND site_id IS NULL", 
                        (name,)
                    )
                row = cursor.fetchone()
                return self._row_to_template(row) if row else None
            finally:
                conn.close()
        
        return await asyncio.get_event_loop().run_in_executor(None, _get)
    
    async def search(self, search_request: TemplateSearchRequest) -> List[Template]:
        """템플릿 검색"""
        def _search():
            conn = sqlite3.connect(self.db_path)
            conn.row_factory = sqlite3.Row
            try:
                conditions = []
                params = []
                
                if search_request.template_type:
                    conditions.append("template_type = ?")
                    params.append(search_request.template_type.value)
                
                if search_request.site_id:
                    conditions.append("site_id = ?")
                    params.append(search_request.site_id)
                
                if search_request.is_active is not None:
                    conditions.append("is_active = ?")
                    params.append(search_request.is_active)
                
                if search_request.search_query:
                    conditions.append("(name LIKE ? OR description LIKE ? OR content LIKE ?)")
                    query_param = f"%{search_request.search_query}%"
                    params.extend([query_param, query_param, query_param])
                
                where_clause = " AND ".join(conditions) if conditions else "1=1"
                
                # 페이징
                offset = (search_request.page - 1) * search_request.size
                
                sql = f"""
                    SELECT * FROM templates 
                    WHERE {where_clause}
                    ORDER BY usage_count DESC, created_at DESC
                    LIMIT ? OFFSET ?
                """
                params.extend([search_request.size, offset])
                
                cursor = conn.execute(sql, params)
                rows = cursor.fetchall()
                return [self._row_to_template(row) for row in rows]
            finally:
                conn.close()
        
        return await asyncio.get_event_loop().run_in_executor(None, _search)
    
    async def get_by_type(
        self, 
        template_type: TemplateType, 
        site_id: Optional[str] = None,
        is_active: bool = True
    ) -> List[Template]:
        """유형별 템플릿 조회"""
        def _get():
            conn = sqlite3.connect(self.db_path)
            conn.row_factory = sqlite3.Row
            try:
                if site_id:
                    cursor = conn.execute(
                        "SELECT * FROM templates WHERE template_type = ? AND site_id = ? AND is_active = ? ORDER BY is_default DESC, usage_count DESC",
                        (template_type.value, site_id, is_active)
                    )
                else:
                    cursor = conn.execute(
                        "SELECT * FROM templates WHERE template_type = ? AND site_id IS NULL AND is_active = ? ORDER BY is_default DESC, usage_count DESC",
                        (template_type.value, is_active)
                    )
                rows = cursor.fetchall()
                return [self._row_to_template(row) for row in rows]
            finally:
                conn.close()
        
        return await asyncio.get_event_loop().run_in_executor(None, _get)
    
    async def get_default_template(
        self, 
        template_type: TemplateType, 
        site_id: Optional[str] = None
    ) -> Optional[Template]:
        """기본 템플릿 조회"""
        def _get():
            conn = sqlite3.connect(self.db_path)
            conn.row_factory = sqlite3.Row
            try:
                if site_id:
                    cursor = conn.execute(
                        "SELECT * FROM templates WHERE template_type = ? AND site_id = ? AND is_default = 1 AND is_active = 1",
                        (template_type.value, site_id)
                    )
                else:
                    cursor = conn.execute(
                        "SELECT * FROM templates WHERE template_type = ? AND site_id IS NULL AND is_default = 1 AND is_active = 1",
                        (template_type.value,)
                    )
                row = cursor.fetchone()
                return self._row_to_template(row) if row else None
            finally:
                conn.close()
        
        return await asyncio.get_event_loop().run_in_executor(None, _get)
    
    async def update(self, template_id: str, updates: Dict[str, Any]) -> Optional[Template]:
        """템플릿 업데이트"""
        def _update():
            conn = sqlite3.connect(self.db_path)
            try:
                # 업데이트 쿼리 구성
                set_clauses = []
                params = []
                
                for key, value in updates.items():
                    if key in ['variables', 'tags', 'metadata'] and isinstance(value, (dict, list)):
                        set_clauses.append(f"{key} = ?")
                        params.append(json.dumps(value))
                    elif key in ['created_at', 'updated_at'] and isinstance(value, datetime):
                        set_clauses.append(f"{key} = ?")
                        params.append(value.isoformat())
                    else:
                        set_clauses.append(f"{key} = ?")
                        params.append(value)
                
                params.append(template_id)
                
                sql = f"UPDATE templates SET {', '.join(set_clauses)} WHERE id = ?"
                conn.execute(sql, params)
                conn.commit()
                
                # 업데이트된 템플릿 반환
                conn.row_factory = sqlite3.Row
                cursor = conn.execute("SELECT * FROM templates WHERE id = ?", (template_id,))
                row = cursor.fetchone()
                return self._row_to_template(row) if row else None
            finally:
                conn.close()
        
        return await asyncio.get_event_loop().run_in_executor(None, _update)
    
    async def delete(self, template_id: str) -> bool:
        """템플릿 삭제"""
        def _delete():
            conn = sqlite3.connect(self.db_path)
            try:
                cursor = conn.execute("DELETE FROM templates WHERE id = ?", (template_id,))
                conn.commit()
                return cursor.rowcount > 0
            finally:
                conn.close()
        
        return await asyncio.get_event_loop().run_in_executor(None, _delete)
    
    async def list_all(
        self, 
        site_id: Optional[str] = None,
        is_active: Optional[bool] = None,
        page: int = 1,
        size: int = 20
    ) -> List[Template]:
        """템플릿 목록 조회"""
        def _list():
            conn = sqlite3.connect(self.db_path)
            conn.row_factory = sqlite3.Row
            try:
                conditions = []
                params = []
                
                if site_id:
                    conditions.append("site_id = ?")
                    params.append(site_id)
                
                if is_active is not None:
                    conditions.append("is_active = ?")
                    params.append(is_active)
                
                where_clause = " AND ".join(conditions) if conditions else "1=1"
                offset = (page - 1) * size
                
                sql = f"""
                    SELECT * FROM templates 
                    WHERE {where_clause}
                    ORDER BY created_at DESC
                    LIMIT ? OFFSET ?
                """
                params.extend([size, offset])
                
                cursor = conn.execute(sql, params)
                rows = cursor.fetchall()
                return [self._row_to_template(row) for row in rows]
            finally:
                conn.close()
        
        return await asyncio.get_event_loop().run_in_executor(None, _list)
    
    async def count(
        self, 
        site_id: Optional[str] = None,
        template_type: Optional[TemplateType] = None,
        is_active: Optional[bool] = None
    ) -> int:
        """템플릿 개수 조회"""
        def _count():
            conn = sqlite3.connect(self.db_path)
            try:
                conditions = []
                params = []
                
                if site_id:
                    conditions.append("site_id = ?")
                    params.append(site_id)
                
                if template_type:
                    conditions.append("template_type = ?")
                    params.append(template_type.value)
                
                if is_active is not None:
                    conditions.append("is_active = ?")
                    params.append(is_active)
                
                where_clause = " AND ".join(conditions) if conditions else "1=1"
                
                cursor = conn.execute(f"SELECT COUNT(*) FROM templates WHERE {where_clause}", params)
                return cursor.fetchone()[0]
            finally:
                conn.close()
        
        return await asyncio.get_event_loop().run_in_executor(None, _count)
    
    async def increment_usage(self, template_id: str) -> bool:
        """사용 횟수 증가"""
        def _increment():
            conn = sqlite3.connect(self.db_path)
            try:
                cursor = conn.execute(
                    "UPDATE templates SET usage_count = usage_count + 1 WHERE id = ?",
                    (template_id,)
                )
                conn.commit()
                return cursor.rowcount > 0
            finally:
                conn.close()
        
        return await asyncio.get_event_loop().run_in_executor(None, _increment)
    
    async def get_popular_templates(
        self, 
        limit: int = 10,
        site_id: Optional[str] = None
    ) -> List[Template]:
        """인기 템플릿 조회"""
        def _get_popular():
            conn = sqlite3.connect(self.db_path)
            conn.row_factory = sqlite3.Row
            try:
                if site_id:
                    cursor = conn.execute(
                        "SELECT * FROM templates WHERE site_id = ? AND is_active = 1 ORDER BY usage_count DESC LIMIT ?",
                        (site_id, limit)
                    )
                else:
                    cursor = conn.execute(
                        "SELECT * FROM templates WHERE is_active = 1 ORDER BY usage_count DESC LIMIT ?",
                        (limit,)
                    )
                rows = cursor.fetchall()
                return [self._row_to_template(row) for row in rows]
            finally:
                conn.close()
        
        return await asyncio.get_event_loop().run_in_executor(None, _get_popular)
    
    def _row_to_template(self, row: sqlite3.Row) -> Template:
        """SQLite Row를 Template 객체로 변환"""
        return Template(
            id=row["id"],
            name=row["name"],
            description=row["description"],
            template_type=TemplateType(row["template_type"]),
            format=TemplateFormat(row["format"]),
            version=row["version"],
            site_id=row["site_id"],
            content=row["content"],
            variables=json.loads(row["variables"]) if row["variables"] else {},
            file_path=row["file_path"],
            file_size=row["file_size"],
            tags=json.loads(row["tags"]) if row["tags"] else [],
            metadata=json.loads(row["metadata"]) if row["metadata"] else {},
            usage_count=row["usage_count"],
            is_active=bool(row["is_active"]),
            is_default=bool(row["is_default"]),
            created_by=row["created_by"],
            created_at=datetime.fromisoformat(row["created_at"]) if row["created_at"] else None,
            updated_by=row["updated_by"],
            updated_at=datetime.fromisoformat(row["updated_at"]) if row["updated_at"] else None
        )


class FileSystemTemplateStorageRepository(TemplateStorageRepository):
    """파일 시스템 기반 템플릿 저장소 구현"""
    
    def __init__(self, storage_path: str = "./data/template_files"):
        self.storage_path = Path(storage_path)
        self.storage_path.mkdir(parents=True, exist_ok=True)
        logger.info(f"템플릿 파일 저장소 초기화: {self.storage_path}")
    
    async def store_file(
        self, 
        file_content: bytes, 
        file_name: str,
        content_type: str
    ) -> str:
        """파일 저장"""
        def _store():
            # 파일명 생성 (중복 방지)
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            safe_name = "".join(c for c in file_name if c.isalnum() or c in '._-')
            unique_name = f"{timestamp}_{safe_name}"
            
            file_path = self.storage_path / unique_name
            file_path.write_bytes(file_content)
            
            # 절대 경로 반환 (Docker 환경에서 relative_to 오류 방지)
            return str(file_path.absolute())
        
        return await asyncio.get_event_loop().run_in_executor(None, _store)
    
    async def get_file(self, file_path: str) -> Optional[bytes]:
        """파일 조회"""
        def _get():
            path = Path(file_path)
            if path.exists() and path.is_file():
                return path.read_bytes()
            return None
        
        return await asyncio.get_event_loop().run_in_executor(None, _get)
    
    async def delete_file(self, file_path: str) -> bool:
        """파일 삭제"""
        def _delete():
            path = Path(file_path)
            if path.exists() and path.is_file():
                path.unlink()
                return True
            return False
        
        return await asyncio.get_event_loop().run_in_executor(None, _delete)
    
    async def get_file_info(self, file_path: str) -> Optional[Dict[str, Any]]:
        """파일 정보 조회"""
        def _get_info():
            path = Path(file_path)
            if path.exists() and path.is_file():
                stat = path.stat()
                return {
                    "name": path.name,
                    "size": stat.st_size,
                    "created": datetime.fromtimestamp(stat.st_ctime),
                    "modified": datetime.fromtimestamp(stat.st_mtime),
                    "path": str(path)
                }
            return None
        
        return await asyncio.get_event_loop().run_in_executor(None, _get_info)