"""
데이터베이스 연결 관리
"""

import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import StaticPool
from typing import Generator

from app.database.models import Base


class DatabaseManager:
    """데이터베이스 연결 관리자"""
    
    def __init__(self, database_url: str = None):
        if database_url is None:
            # 기본 SQLite 데이터베이스 경로
            database_url = os.getenv("FIGURE_DATABASE_URL", "sqlite:///./data/figure.db")
        
        self.database_url = database_url
        
        # SQLite 설정
        if database_url.startswith("sqlite"):
            self.engine = create_engine(
                database_url,
                connect_args={"check_same_thread": False},
                poolclass=StaticPool,
                echo=False
            )
        else:
            self.engine = create_engine(database_url, echo=False)
        
        self.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=self.engine)
        
        # 테이블 생성
        self.create_tables()
    
    def create_tables(self):
        """데이터베이스 테이블 생성"""
        try:
            # data 디렉토리 생성
            os.makedirs("./data", exist_ok=True)
            Base.metadata.create_all(bind=self.engine)
            print("✅ Database tables created successfully")
        except Exception as e:
            print(f"❌ Error creating database tables: {e}")
            raise
    
    def get_session(self) -> Session:
        """데이터베이스 세션 생성"""
        return self.SessionLocal()
    
    def close(self):
        """데이터베이스 연결 종료"""
        self.engine.dispose()


# 전역 데이터베이스 관리자 인스턴스
db_manager = DatabaseManager()


def get_db() -> Generator[Session, None, None]:
    """
    FastAPI 의존성 주입용 데이터베이스 세션 생성기
    """
    db = db_manager.get_session()
    try:
        yield db
    finally:
        db.close() 