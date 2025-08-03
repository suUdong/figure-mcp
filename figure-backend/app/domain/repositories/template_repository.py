"""
Template Repository Interface
템플릿 리포지토리 인터페이스 (헥사고날 아키텍처)
"""
from abc import ABC, abstractmethod
from typing import List, Optional, Dict, Any
from datetime import datetime

from app.domain.entities.template_entities import (
    Template, 
    TemplateType, 
    TemplateUsage,
    TemplateSearchRequest
)


class TemplateRepository(ABC):
    """템플릿 리포지토리 인터페이스"""
    
    @abstractmethod
    async def create(self, template: Template) -> Template:
        """템플릿 생성"""
        pass
    
    @abstractmethod
    async def get_by_id(self, template_id: str) -> Optional[Template]:
        """ID로 템플릿 조회"""
        pass
    
    @abstractmethod
    async def get_by_name(self, name: str, site_id: Optional[str] = None) -> Optional[Template]:
        """이름으로 템플릿 조회"""
        pass
    
    @abstractmethod
    async def search(self, search_request: TemplateSearchRequest) -> List[Template]:
        """템플릿 검색"""
        pass
    
    @abstractmethod
    async def get_by_type(
        self, 
        template_type: TemplateType, 
        site_id: Optional[str] = None,
        is_active: bool = True
    ) -> List[Template]:
        """유형별 템플릿 조회"""
        pass
    
    @abstractmethod
    async def get_default_template(
        self, 
        template_type: TemplateType, 
        site_id: Optional[str] = None
    ) -> Optional[Template]:
        """기본 템플릿 조회"""
        pass
    
    @abstractmethod
    async def update(self, template_id: str, updates: Dict[str, Any]) -> Optional[Template]:
        """템플릿 업데이트"""
        pass
    
    @abstractmethod
    async def delete(self, template_id: str) -> bool:
        """템플릿 삭제"""
        pass
    
    @abstractmethod
    async def list_all(
        self, 
        site_id: Optional[str] = None,
        is_active: Optional[bool] = None,
        page: int = 1,
        size: int = 20
    ) -> List[Template]:
        """템플릿 목록 조회"""
        pass
    
    @abstractmethod
    async def count(
        self, 
        site_id: Optional[str] = None,
        template_type: Optional[TemplateType] = None,
        is_active: Optional[bool] = None
    ) -> int:
        """템플릿 개수 조회"""
        pass
    
    @abstractmethod
    async def increment_usage(self, template_id: str) -> bool:
        """사용 횟수 증가"""
        pass
    
    @abstractmethod
    async def get_popular_templates(
        self, 
        limit: int = 10,
        site_id: Optional[str] = None
    ) -> List[Template]:
        """인기 템플릿 조회"""
        pass


class TemplateUsageRepository(ABC):
    """템플릿 사용 이력 리포지토리 인터페이스"""
    
    @abstractmethod
    async def record_usage(self, usage: TemplateUsage) -> TemplateUsage:
        """사용 이력 기록"""
        pass
    
    @abstractmethod
    async def get_usage_history(
        self, 
        template_id: str,
        limit: int = 50
    ) -> List[TemplateUsage]:
        """템플릿 사용 이력 조회"""
        pass
    
    @abstractmethod
    async def get_user_usage_history(
        self, 
        user_id: str,
        limit: int = 50
    ) -> List[TemplateUsage]:
        """사용자 사용 이력 조회"""
        pass
    
    @abstractmethod
    async def get_usage_stats(
        self, 
        template_id: str,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """사용 통계 조회"""
        pass


class TemplateStorageRepository(ABC):
    """템플릿 파일 저장소 인터페이스"""
    
    @abstractmethod
    async def store_file(
        self, 
        file_content: bytes, 
        file_name: str,
        content_type: str
    ) -> str:
        """파일 저장"""
        pass
    
    @abstractmethod
    async def get_file(self, file_path: str) -> Optional[bytes]:
        """파일 조회"""
        pass
    
    @abstractmethod
    async def delete_file(self, file_path: str) -> bool:
        """파일 삭제"""
        pass
    
    @abstractmethod
    async def get_file_info(self, file_path: str) -> Optional[Dict[str, Any]]:
        """파일 정보 조회"""
        pass