"""
Template Service
템플릿 관리 애플리케이션 서비스 (헥사고날 아키텍처)
"""
import logging
from typing import List, Optional, Dict, Any, Tuple
from datetime import datetime
import uuid
import hashlib

from app.domain.entities.template_entities import (
    Template, 
    TemplateType, 
    TemplateFormat,
    TemplateUsage,
    TemplateCreateRequest,
    TemplateUpdateRequest,
    TemplateSearchRequest
)
from app.domain.repositories.template_repository import (
    TemplateRepository, 
    TemplateUsageRepository,
    TemplateStorageRepository
)

logger = logging.getLogger(__name__)


class TemplateService:
    """템플릿 관리 애플리케이션 서비스"""
    
    def __init__(
        self,
        template_repository: TemplateRepository,
        usage_repository: TemplateUsageRepository,
        storage_repository: TemplateStorageRepository
    ):
        self.template_repo = template_repository
        self.usage_repo = usage_repository
        self.storage_repo = storage_repository
    
    async def create_template(
        self, 
        request: TemplateCreateRequest,
        created_by: Optional[str] = None,
        file_content: Optional[bytes] = None,
        file_name: Optional[str] = None,
        content_type: Optional[str] = None
    ) -> Template:
        """템플릿 생성"""
        logger.info(f"템플릿 생성 요청: {request.name} ({request.template_type})")
        
        # 중복 이름 검사
        existing = await self.template_repo.get_by_name(request.name, request.site_id)
        if existing:
            raise ValueError(f"이미 존재하는 템플릿 이름입니다: {request.name}")
        
        # 파일 저장 (업로드된 경우)
        file_path = None
        file_size = None
        if file_content and file_name:
            file_path = await self.storage_repo.store_file(
                file_content, file_name, content_type or "text/plain"
            )
            file_size = len(file_content)
            logger.info(f"템플릿 파일 저장 완료: {file_path}")
        
        # 기본 템플릿 중복 검사
        if request.is_default:
            await self._ensure_single_default_template(request.template_type, request.site_id)
        
        # 템플릿 엔티티 생성
        template = Template(
            id=str(uuid.uuid4()),
            name=request.name,
            description=request.description,
            template_type=request.template_type,
            format=request.format,
            site_id=request.site_id,
            content=request.content,
            variables=request.variables,
            tags=request.tags,
            is_default=request.is_default,
            file_path=file_path,
            file_size=file_size,
            created_by=created_by,
            created_at=datetime.now()
        )
        
        # 저장
        created_template = await self.template_repo.create(template)
        logger.info(f"템플릿 생성 완료: {created_template.id}")
        
        return created_template
    
    async def get_template(self, template_id: str) -> Optional[Template]:
        """템플릿 조회"""
        return await self.template_repo.get_by_id(template_id)
    
    async def search_templates(self, search_request: TemplateSearchRequest) -> List[Template]:
        """템플릿 검색"""
        return await self.template_repo.search(search_request)
    
    async def get_templates_by_type(
        self, 
        template_type: TemplateType,
        site_id: Optional[str] = None,
        is_active: bool = True
    ) -> List[Template]:
        """유형별 템플릿 조회"""
        return await self.template_repo.get_by_type(template_type, site_id, is_active)
    
    async def get_templates_by_filters(
        self,
        template_type: Optional[TemplateType] = None,
        site_id: Optional[str] = None,
        is_active: bool = True,
        limit: Optional[int] = None
    ) -> List[Template]:
        """필터 조건으로 템플릿 조회"""
        # 검색 요청 구성
        search_request = TemplateSearchRequest(
            template_type=template_type,
            site_id=site_id,
            is_active=is_active,
            page=1,
            size=limit or 100
        )
        
        return await self.template_repo.search(search_request)
    
    async def get_default_template(
        self, 
        template_type: TemplateType,
        site_id: Optional[str] = None
    ) -> Optional[Template]:
        """기본 템플릿 조회"""
        return await self.template_repo.get_default_template(template_type, site_id)
    
    async def update_template(
        self, 
        template_id: str, 
        request: TemplateUpdateRequest,
        updated_by: Optional[str] = None
    ) -> Optional[Template]:
        """템플릿 업데이트"""
        logger.info(f"템플릿 업데이트: {template_id}")
        
        # 기존 템플릿 확인
        existing = await self.template_repo.get_by_id(template_id)
        if not existing:
            raise ValueError(f"템플릿을 찾을 수 없습니다: {template_id}")
        
        # 업데이트 데이터 준비
        updates = {}
        
        if request.name is not None:
            # 이름 중복 검사 (다른 템플릿과)
            name_duplicate = await self.template_repo.get_by_name(request.name, existing.site_id)
            if name_duplicate and name_duplicate.id != template_id:
                raise ValueError(f"이미 존재하는 템플릿 이름입니다: {request.name}")
            updates["name"] = request.name
        
        if request.description is not None:
            updates["description"] = request.description
        if request.content is not None:
            updates["content"] = request.content
        if request.variables is not None:
            updates["variables"] = request.variables
        if request.tags is not None:
            updates["tags"] = request.tags
        if request.is_active is not None:
            updates["is_active"] = request.is_active
        
        # 기본 템플릿 설정
        if request.is_default is not None:
            if request.is_default:
                await self._ensure_single_default_template(existing.template_type, existing.site_id)
            updates["is_default"] = request.is_default
        
        # 감사 필드
        updates["updated_by"] = updated_by
        updates["updated_at"] = datetime.now()
        
        # 업데이트 실행
        updated_template = await self.template_repo.update(template_id, updates)
        logger.info(f"템플릿 업데이트 완료: {template_id}")
        
        return updated_template
    
    async def delete_template(self, template_id: str) -> bool:
        """템플릿 삭제"""
        logger.info(f"템플릿 삭제: {template_id}")
        
        # 템플릿 정보 조회 (파일 삭제를 위해)
        template = await self.template_repo.get_by_id(template_id)
        if not template:
            return False
        
        # 연관된 파일 삭제
        if template.file_path:
            try:
                await self.storage_repo.delete_file(template.file_path)
                logger.info(f"템플릿 파일 삭제 완료: {template.file_path}")
            except Exception as e:
                logger.warning(f"템플릿 파일 삭제 실패: {template.file_path}, 오류: {e}")
        
        # 템플릿 삭제
        result = await self.template_repo.delete(template_id)
        logger.info(f"템플릿 삭제 완료: {template_id}")
        
        return result
    
    async def use_template(
        self,
        template_id: str,
        context: Dict[str, Any],
        user_id: Optional[str] = None,
        jira_ticket_id: Optional[str] = None,
        site_id: Optional[str] = None
    ) -> Tuple[Template, str]:
        """템플릿 사용 (컨텍스트와 함께 반환)"""
        logger.info(f"템플릿 사용: {template_id}")
        
        # 템플릿 조회
        template = await self.template_repo.get_by_id(template_id)
        if not template or not template.is_active:
            raise ValueError(f"사용할 수 없는 템플릿입니다: {template_id}")
        
        # 사용 횟수 증가
        await self.template_repo.increment_usage(template_id)
        
        # 사용 이력 기록
        usage = TemplateUsage(
            id=str(uuid.uuid4()),
            template_id=template_id,
            user_id=user_id,
            jira_ticket_id=jira_ticket_id,
            site_id=site_id,
            success=True,
            used_at=datetime.now()
        )
        
        try:
            await self.usage_repo.record_usage(usage)
        except Exception as e:
            logger.warning(f"사용 이력 기록 실패: {e}")
        
        # 템플릿과 컨텍스트 함께 반환
        context_info = {
            "template": template.dict(),
            "context": context,
            "instructions": self._generate_instructions(template, context)
        }
        
        logger.info(f"템플릿 사용 완료: {template_id}")
        return template, context_info
    
    async def get_popular_templates(
        self, 
        limit: int = 10,
        site_id: Optional[str] = None
    ) -> List[Template]:
        """인기 템플릿 조회"""
        return await self.template_repo.get_popular_templates(limit, site_id)
    
    async def get_usage_stats(
        self, 
        template_id: str,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """템플릿 사용 통계"""
        return await self.usage_repo.get_usage_stats(template_id, start_date, end_date)
    
    async def _ensure_single_default_template(
        self, 
        template_type: TemplateType,
        site_id: Optional[str]
    ):
        """기본 템플릿이 하나만 존재하도록 보장"""
        existing_default = await self.template_repo.get_default_template(template_type, site_id)
        if existing_default:
            await self.template_repo.update(existing_default.id, {"is_default": False})
            logger.info(f"기존 기본 템플릿 해제: {existing_default.id}")
    
    def _generate_instructions(self, template: Template, context: Dict[str, Any]) -> str:
        """LLM을 위한 사용 지침 생성"""
        instructions = f"""
다음 템플릿과 컨텍스트를 사용해서 {template.template_type.value} 문서를 생성해주세요.

**템플릿 정보:**
- 이름: {template.name}
- 유형: {template.template_type.value}
- 설명: {template.description or "없음"}

**템플릿 내용:**
```{template.format.value}
{template.content}
```

**변수 정의:**
{template.variables}

**컨텍스트 데이터:**
{context}

**생성 지침:**
1. 템플릿의 변수들을 컨텍스트 데이터로 치환하세요
2. 표준을 준수하면서 구체적이고 명확하게 작성하세요
3. 템플릿의 구조와 형식을 유지하세요
4. 누락된 정보가 있다면 합리적인 기본값을 사용하세요
"""
        
        if template.tags:
            instructions += f"\n**태그:** {', '.join(template.tags)}"
        
        return instructions.strip()


# 싱글톤 서비스 인스턴스 (의존성 주입을 위해)
template_service: Optional[TemplateService] = None


def get_template_service() -> TemplateService:
    """템플릿 서비스 인스턴스 반환"""
    if template_service is None:
        raise RuntimeError("TemplateService가 초기화되지 않았습니다")
    return template_service


def initialize_template_service(
    template_repository: TemplateRepository,
    usage_repository: TemplateUsageRepository,
    storage_repository: TemplateStorageRepository
):
    """템플릿 서비스 초기화"""
    global template_service
    template_service = TemplateService(
        template_repository,
        usage_repository,
        storage_repository
    )
    logger.info("TemplateService 초기화 완료")