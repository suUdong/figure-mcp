"""
사이트 관리 서비스
"""

import uuid
from typing import List, Optional, Dict, Any
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.database.models import Site as SiteModel, Document as DocumentModel
from app.database.connection import DatabaseManager
from app.models.schemas import Site, APIResponse
from app.utils.logger import get_logger

logger = get_logger(__name__)


class SiteService:
    """사이트 관리 서비스"""
    
    def __init__(self, db_manager: DatabaseManager):
        self.db_manager = db_manager
    
    def get_db(self) -> Session:
        """데이터베이스 세션 생성"""
        return self.db_manager.SessionLocal()
    
    def create_site(self, site_data: dict) -> Site:
        """사이트 생성"""
        db = self.get_db()
        try:
            # 사이트 ID 생성
            site_id = str(uuid.uuid4())
            
            # 사이트 모델 생성
            db_site = SiteModel(
                id=site_id,
                name=site_data["name"],
                company=site_data.get("company", ""),
                department=site_data.get("department", ""),
                url=site_data.get("url", ""),
                description=site_data.get("description", ""),
                is_active=site_data.get("is_active", True),
                created_at=datetime.now(),
                updated_at=datetime.now()
            )
            
            db.add(db_site)
            db.commit()
            db.refresh(db_site)
            
            logger.info(f"새 사이트 생성: {site_id} - {site_data['name']}")
            
            return Site(
                id=db_site.id,
                name=db_site.name,
                url=db_site.url,
                description=db_site.description,
                created_at=db_site.created_at,
                is_active=db_site.is_active
            )
            
        except Exception as e:
            db.rollback()
            logger.error(f"사이트 생성 실패: {e}")
            raise
        finally:
            db.close()
    
    def get_sites(self, active_only: bool = True) -> List[Dict[str, Any]]:
        """사이트 목록 조회"""
        db = self.get_db()
        try:
            query = db.query(SiteModel)
            
            if active_only:
                query = query.filter(SiteModel.is_active == True)
            
            sites = query.order_by(desc(SiteModel.created_at)).all()
            
            result = []
            for site in sites:
                # 사이트에 속한 문서 수 계산
                document_count = db.query(DocumentModel).filter(
                    DocumentModel.site_id == site.id
                ).count()
                
                result.append({
                    "id": site.id,
                    "name": site.name,
                    "company": site.company,
                    "department": site.department,
                    "url": site.url,
                    "description": site.description,
                    "is_active": site.is_active,
                    "created_at": site.created_at,
                    "updated_at": site.updated_at,
                    "document_count": document_count
                })
            
            logger.info(f"사이트 목록 조회: {len(result)}개")
            return result
            
        except Exception as e:
            logger.error(f"사이트 목록 조회 실패: {e}")
            raise
        finally:
            db.close()
    
    def get_site(self, site_id: str) -> Optional[Dict[str, Any]]:
        """특정 사이트 조회"""
        db = self.get_db()
        try:
            site = db.query(SiteModel).filter(SiteModel.id == site_id).first()
            
            if not site:
                return None
            
            # 사이트에 속한 문서 수 계산
            document_count = db.query(DocumentModel).filter(
                DocumentModel.site_id == site.id
            ).count()
            
            return {
                "id": site.id,
                "name": site.name,
                "company": site.company,
                "department": site.department,
                "url": site.url,
                "description": site.description,
                "is_active": site.is_active,
                "created_at": site.created_at,
                "updated_at": site.updated_at,
                "document_count": document_count
            }
            
        except Exception as e:
            logger.error(f"사이트 조회 실패: {e}")
            raise
        finally:
            db.close()
    
    def update_site(self, site_id: str, update_data: dict) -> Optional[Dict[str, Any]]:
        """사이트 업데이트"""
        db = self.get_db()
        try:
            site = db.query(SiteModel).filter(SiteModel.id == site_id).first()
            
            if not site:
                return None
            
            # 업데이트 가능한 필드만 업데이트
            if "name" in update_data:
                site.name = update_data["name"]
            if "company" in update_data:
                site.company = update_data["company"]
            if "department" in update_data:
                site.department = update_data["department"]
            if "url" in update_data:
                site.url = update_data["url"]
            if "description" in update_data:
                site.description = update_data["description"]
            if "is_active" in update_data:
                site.is_active = update_data["is_active"]
            
            site.updated_at = datetime.now()
            
            db.commit()
            db.refresh(site)
            
            logger.info(f"사이트 업데이트: {site_id}")
            
            return {
                "id": site.id,
                "name": site.name,
                "company": site.company,
                "department": site.department,
                "url": site.url,
                "description": site.description,
                "is_active": site.is_active,
                "created_at": site.created_at,
                "updated_at": site.updated_at
            }
            
        except Exception as e:
            db.rollback()
            logger.error(f"사이트 업데이트 실패: {e}")
            raise
        finally:
            db.close()
    
    def delete_site(self, site_id: str) -> bool:
        """사이트 삭제"""
        db = self.get_db()
        try:
            site = db.query(SiteModel).filter(SiteModel.id == site_id).first()
            
            if not site:
                return False
            
            # 사이트에 속한 문서들도 함께 삭제 (CASCADE 설정으로 자동 삭제)
            db.delete(site)
            db.commit()
            
            logger.info(f"사이트 삭제: {site_id}")
            return True
            
        except Exception as e:
            db.rollback()
            logger.error(f"사이트 삭제 실패: {e}")
            raise
        finally:
            db.close()
    
    def toggle_site_status(self, site_id: str) -> Optional[Dict[str, Any]]:
        """사이트 활성/비활성 상태 토글"""
        db = self.get_db()
        try:
            site = db.query(SiteModel).filter(SiteModel.id == site_id).first()
            
            if not site:
                return None
            
            site.is_active = not site.is_active
            site.updated_at = datetime.now()
            
            db.commit()
            db.refresh(site)
            
            logger.info(f"사이트 상태 토글: {site_id} -> {site.is_active}")
            
            return {
                "id": site.id,
                "name": site.name,
                "is_active": site.is_active,
                "updated_at": site.updated_at
            }
            
        except Exception as e:
            db.rollback()
            logger.error(f"사이트 상태 토글 실패: {e}")
            raise
        finally:
            db.close()
    
    def get_sites_for_document(self) -> List[Dict[str, Any]]:
        """문서 등록 시 사용할 사이트 목록 조회 (활성 사이트만)"""
        db = self.get_db()
        try:
            sites = db.query(SiteModel).filter(
                SiteModel.is_active == True
            ).order_by(SiteModel.name).all()
            
            result = []
            for site in sites:
                result.append({
                    "id": site.id,
                    "name": site.name,
                    "company": site.company,
                    "department": site.department
                })
            
            logger.info(f"문서 등록용 사이트 목록 조회: {len(result)}개")
            return result
            
        except Exception as e:
            logger.error(f"문서 등록용 사이트 목록 조회 실패: {e}")
            raise
        finally:
            db.close()


# 전역 서비스 인스턴스
site_service = None


def get_site_service() -> SiteService:
    """사이트 서비스 인스턴스 가져오기"""
    global site_service
    if site_service is None:
        from app.database.connection import DatabaseManager
        db_manager = DatabaseManager()
        site_service = SiteService(db_manager)
    return site_service 