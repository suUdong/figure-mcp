"""
SQLAlchemy 데이터베이스 모델 정의
"""

from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, Float, ForeignKey, JSON
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship

Base = declarative_base()


class Site(Base):
    """사이트 정보 모델"""
    __tablename__ = "sites"
    
    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False, index=True)
    company = Column(String, nullable=False, index=True)
    department = Column(String, nullable=True)
    url = Column(String, nullable=True)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # 관계 설정
    documents = relationship("Document", back_populates="site", cascade="all, delete-orphan")


class Document(Base):
    """문서 정보 모델 (메타데이터만 저장)"""
    __tablename__ = "documents"
    
    id = Column(String, primary_key=True, index=True)
    site_id = Column(String, ForeignKey("sites.id"), nullable=True, index=True)
    title = Column(String, nullable=False, index=True)
    doc_type = Column(String, nullable=False, index=True)
    source_url = Column(String, nullable=True)
    file_path = Column(String, nullable=True)  # 파일 저장 경로
    file_size = Column(Integer, nullable=True)  # 파일 크기 (bytes)
    content_hash = Column(String, nullable=True)  # 콘텐츠 해시
    processing_status = Column(String, default="pending")  # pending, processing, completed, failed
    extra_data = Column(JSON, nullable=True)  # 추가 메타데이터
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # 관계 설정
    site = relationship("Site", back_populates="documents")


class UsageLog(Base):
    """API 사용량 로그 모델"""
    __tablename__ = "usage_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    provider = Column(String, nullable=False, index=True)  # gemini, groq, openai
    service = Column(String, nullable=False, index=True)  # llm, embedding
    model = Column(String, nullable=False)
    tokens_used = Column(Integer, nullable=False)
    cost = Column(Float, nullable=False)
    request_type = Column(String, nullable=False)  # query, embed, etc.
    success = Column(Boolean, default=True)
    error_message = Column(Text, nullable=True)
    extra_data = Column(JSON, nullable=True)  # 추가 메타데이터
    created_at = Column(DateTime, default=datetime.utcnow) 