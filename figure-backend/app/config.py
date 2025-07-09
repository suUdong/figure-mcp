"""
Configuration settings for Figure Backend
Pydantic Settings를 활용한 환경 변수 기반 설정
"""
from typing import Optional
from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from pathlib import Path


class Settings(BaseSettings):
    """애플리케이션 설정"""
    model_config = SettingsConfigDict(
        env_prefix="FIGURE_",
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        validate_default=True
    )
    
    # App Configuration
    app_name: str = Field(default="Figure Backend", description="애플리케이션 이름")
    debug: bool = Field(default=False, description="디버그 모드")
    api_version: str = Field(default="v1", description="API 버전")
    
    # Server Configuration  
    host: str = Field(default="0.0.0.0", description="서버 호스트")
    port: int = Field(default=8001, description="서버 포트")
    
    # OpenAI API
    openai_api_key: Optional[str] = Field(default=None, description="OpenAI API 키")
    openai_model: str = Field(default="gpt-4o-mini", description="OpenAI 모델")
    embedding_model: str = Field(default="text-embedding-3-small", description="임베딩 모델")
    
    # ChromaDB Configuration
    chroma_persist_directory: str = Field(
        default="./data/chroma", 
        description="ChromaDB 데이터 저장 경로"
    )
    chroma_collection_name: str = Field(
        default="figure_documents", 
        description="ChromaDB 컬렉션 이름"
    )
    
    # JIRA Configuration
    jira_server: Optional[str] = Field(default=None, description="JIRA 서버 URL")
    jira_email: Optional[str] = Field(default=None, description="JIRA 이메일")
    jira_api_token: Optional[str] = Field(default=None, description="JIRA API 토큰")
    
    # Redis Configuration (Optional)
    redis_url: Optional[str] = Field(default="redis://localhost:6379", description="Redis URL")
    
    @model_validator(mode='after')
    def validate_openai_key(self):
        """OpenAI API 키 검증 (테스트/개발 환경에서는 스킵)"""
        import os
        # 테스트 환경이거나 개발 환경에서는 검증 스킵
        env = os.getenv("ENVIRONMENT", "").lower()
        debug = os.getenv("DEBUG", "").lower() in ("true", "1")
        
        if env in ("test", "development") or debug or "pytest" in os.getenv("_", ""):
            # 테스트용 기본값 설정
            if not self.openai_api_key:
                object.__setattr__(self, 'openai_api_key', 'test-key')
            return self
            
        if not self.openai_api_key:
            raise ValueError("FIGURE_OPENAI_API_KEY 환경 변수가 설정되어야 합니다.")
        return self
    
    def create_data_directory(self) -> None:
        """데이터 디렉토리 생성"""
        Path(self.chroma_persist_directory).mkdir(parents=True, exist_ok=True)


def get_settings() -> Settings:
    """설정 인스턴스 반환 (lazy loading)"""
    return Settings()


# 글로벌 설정 인스턴스 (lazy loading)
settings = get_settings() 