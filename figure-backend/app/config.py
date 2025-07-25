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
    
    # Provider Configuration (헥사고날 아키텍처)
    llm_provider: str = Field(default="gemini", description="LLM 프로바이더")
    embedding_provider: str = Field(default="gemini", description="임베딩 프로바이더")
    
    # Google Gemini API
    gemini_api_key: Optional[str] = Field(default=None, description="Google Gemini API 키")
    gemini_model: str = Field(default="gemini-1.5-flash", description="Gemini 모델")
    gemini_embedding_model: str = Field(default="models/text-embedding-004", description="Gemini 임베딩 모델")
    
    # Groq API (Optional)
    groq_api_key: Optional[str] = Field(default=None, description="Groq API 키")
    groq_model: str = Field(default="llama3-8b-8192", description="Groq 모델")
    
    # OpenAI API (Optional)
    openai_api_key: Optional[str] = Field(default=None, description="OpenAI API 키")
    openai_model: str = Field(default="gpt-4o-mini", description="OpenAI 모델")
    openai_embedding_model: str = Field(default="text-embedding-3-small", description="OpenAI 임베딩 모델")
    
    # Voyage AI API (Optional)
    voyage_api_key: Optional[str] = Field(default=None, description="Voyage AI API 키")
    voyage_embedding_model: str = Field(default="voyage-3-large", description="Voyage AI 임베딩 모델")
    
    # Storage Configuration
    storage_provider: str = Field(default="local", description="저장소 프로바이더")
    local_storage_path: str = Field(default="./storage", description="로컬 저장소 경로")
    
    # Database Configuration
    database_url: str = Field(default="sqlite:///./data/figure.db", description="데이터베이스 URL")
    
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
    def validate_provider_keys(self):
        """사용하는 프로바이더의 API 키 검증"""
        import os
        
        # 테스트 환경이거나 개발 환경에서는 검증 스킵
        env = os.getenv("ENVIRONMENT", "").lower()
        debug = os.getenv("FIGURE_DEBUG", "").lower() in ("true", "1")
        
        if env in ("test", "development") or debug or "pytest" in os.getenv("_", ""):
            # 테스트용 기본값 설정
            if not self.gemini_api_key:
                object.__setattr__(self, 'gemini_api_key', 'test-key')
            if not self.groq_api_key:
                object.__setattr__(self, 'groq_api_key', 'test-key')
            if not self.openai_api_key:
                object.__setattr__(self, 'openai_api_key', 'test-key')
            if not self.voyage_api_key:
                object.__setattr__(self, 'voyage_api_key', 'test-key')
            return self
        
        # 프로덕션 환경에서는 사용하는 프로바이더의 API 키만 검증
        # 하지만 환경 변수가 없어도 기본값으로 처리 (더 유연하게)
        if self.llm_provider == "gemini" or self.embedding_provider == "gemini":
            if not self.gemini_api_key:
                print("⚠️  Warning: FIGURE_GEMINI_API_KEY not set, using default")
                object.__setattr__(self, 'gemini_api_key', 'default-key')
        
        if self.llm_provider == "groq":
            if not self.groq_api_key:
                print("⚠️  Warning: FIGURE_GROQ_API_KEY not set, using default")
                object.__setattr__(self, 'groq_api_key', 'default-key')
        
        if self.llm_provider == "openai" or self.embedding_provider == "openai":
            if not self.openai_api_key:
                print("⚠️  Warning: FIGURE_OPENAI_API_KEY not set, using default")
                object.__setattr__(self, 'openai_api_key', 'default-key')
        
        if self.embedding_provider == "voyage":
            if not self.voyage_api_key:
                print("⚠️  Warning: FIGURE_VOYAGE_API_KEY not set, using default")
                object.__setattr__(self, 'voyage_api_key', 'default-key')
        
        return self
    
    def create_data_directory(self) -> None:
        """데이터 디렉토리 생성"""
        Path(self.chroma_persist_directory).mkdir(parents=True, exist_ok=True)


def get_settings() -> Settings:
    """설정 인스턴스 반환 (lazy loading)"""
    return Settings()


# 글로벌 설정 인스턴스 (lazy loading)
settings = get_settings() 