-- Migration: 001_initial_schema.sql
-- Created: 2024-01-01
-- Description: 초기 Figure-MCP 데이터베이스 스키마 생성

-- 마이그레이션 버전 확인
DO $$
BEGIN
    -- migrations 테이블이 없으면 생성
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'migrations') THEN
        CREATE TABLE migrations (
            id SERIAL PRIMARY KEY,
            version VARCHAR(50) NOT NULL UNIQUE,
            description TEXT,
            applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
    END IF;
    
    -- 이미 적용된 마이그레이션인지 확인
    IF EXISTS (SELECT 1 FROM migrations WHERE version = '001_initial_schema') THEN
        RAISE NOTICE '마이그레이션 001_initial_schema은 이미 적용되었습니다.';
        RETURN;
    END IF;
END
$$;

-- 확장 프로그램 활성화
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";

-- 사이트 정보 테이블
CREATE TABLE IF NOT EXISTS sites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    site_name VARCHAR(100) NOT NULL UNIQUE,
    display_name VARCHAR(200),
    description TEXT,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'maintenance')),
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 문서 테이블
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    document_id VARCHAR(200) NOT NULL,
    file_name VARCHAR(500) NOT NULL,
    file_path TEXT NOT NULL,
    file_size BIGINT,
    file_type VARCHAR(50),
    mime_type VARCHAR(100),
    category VARCHAR(100),
    title TEXT,
    description TEXT,
    content_hash VARCHAR(64),
    processing_status VARCHAR(20) DEFAULT 'pending' 
        CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed', 'deleted')),
    processing_metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP WITH TIME ZONE,
    
    UNIQUE(site_id, document_id)
);

-- 문서 청크 테이블
CREATE TABLE IF NOT EXISTS document_chunks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    content_tokens INTEGER,
    start_index INTEGER,
    end_index INTEGER,
    chunk_type VARCHAR(50) DEFAULT 'text',
    metadata JSONB DEFAULT '{}',
    embedding_id VARCHAR(200),
    embedding_model VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(document_id, chunk_index)
);

-- 작업 이력 테이블
CREATE TABLE IF NOT EXISTS job_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id VARCHAR(100) NOT NULL UNIQUE,
    job_type VARCHAR(50) NOT NULL,
    site_id UUID REFERENCES sites(id) ON DELETE SET NULL,
    status VARCHAR(20) DEFAULT 'pending' 
        CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
    progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    total_items INTEGER DEFAULT 0,
    processed_items INTEGER DEFAULT 0,
    input_data JSONB,
    output_data JSONB,
    error_message TEXT,
    metadata JSONB DEFAULT '{}',
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- RAG 쿼리 로그 테이블
CREATE TABLE IF NOT EXISTS rag_query_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    site_id UUID REFERENCES sites(id) ON DELETE SET NULL,
    query_text TEXT NOT NULL,
    response_text TEXT,
    confidence_score REAL,
    retrieved_documents_count INTEGER DEFAULT 0,
    llm_model VARCHAR(100),
    retrieval_time_ms INTEGER,
    generation_time_ms INTEGER,
    total_time_ms INTEGER,
    tokens_used INTEGER,
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 사용자 세션 테이블
CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id VARCHAR(200) NOT NULL UNIQUE,
    site_id UUID REFERENCES sites(id) ON DELETE SET NULL,
    user_identifier VARCHAR(200),
    conversation_history JSONB DEFAULT '[]',
    metadata JSONB DEFAULT '{}',
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 시스템 설정 테이블
CREATE TABLE IF NOT EXISTS system_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    setting_key VARCHAR(100) NOT NULL UNIQUE,
    setting_value JSONB NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 인덱스 생성
DO $$ 
BEGIN
    -- 사이트 관련 인덱스
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_sites_site_name') THEN
        CREATE INDEX idx_sites_site_name ON sites(site_name);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_sites_status') THEN
        CREATE INDEX idx_sites_status ON sites(status);
    END IF;

    -- 문서 관련 인덱스
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_documents_site_id') THEN
        CREATE INDEX idx_documents_site_id ON documents(site_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_documents_document_id') THEN
        CREATE INDEX idx_documents_document_id ON documents(document_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_documents_processing_status') THEN
        CREATE INDEX idx_documents_processing_status ON documents(processing_status);
    END IF;
    
    -- 문서 청크 관련 인덱스
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_document_chunks_document_id') THEN
        CREATE INDEX idx_document_chunks_document_id ON document_chunks(document_id);
    END IF;
    
    -- 작업 이력 관련 인덱스
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_job_history_job_id') THEN
        CREATE INDEX idx_job_history_job_id ON job_history(job_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_job_history_status') THEN
        CREATE INDEX idx_job_history_status ON job_history(status);
    END IF;
END $$;

-- 트리거 함수 생성
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 트리거 생성
DO $$
BEGIN
    -- sites 테이블 트리거
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_sites_updated_at') THEN
        CREATE TRIGGER update_sites_updated_at 
            BEFORE UPDATE ON sites 
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    
    -- documents 테이블 트리거
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_documents_updated_at') THEN
        CREATE TRIGGER update_documents_updated_at 
            BEFORE UPDATE ON documents 
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    
    -- job_history 테이블 트리거
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_job_history_updated_at') THEN
        CREATE TRIGGER update_job_history_updated_at 
            BEFORE UPDATE ON job_history 
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    
    -- user_sessions 테이블 트리거
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_user_sessions_updated_at') THEN
        CREATE TRIGGER update_user_sessions_updated_at 
            BEFORE UPDATE ON user_sessions 
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    
    -- system_settings 테이블 트리거
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_system_settings_updated_at') THEN
        CREATE TRIGGER update_system_settings_updated_at 
            BEFORE UPDATE ON system_settings 
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- 기본 데이터 삽입
INSERT INTO system_settings (setting_key, setting_value, description) VALUES
('default_embedding_model', '"sentence-transformers/all-MiniLM-L6-v2"', '기본 임베딩 모델'),
('default_llm_model', '"gpt-3.5-turbo"', '기본 LLM 모델'),
('max_chunk_size', '1000', '최대 청크 크기'),
('chunk_overlap', '200', '청크 오버랩 크기'),
('max_retrieval_documents', '10', '최대 검색 문서 수'),
('similarity_threshold', '0.3', '유사도 임계값'),
('session_timeout_hours', '24', '세션 타임아웃 (시간)'),
('enable_query_logging', 'true', '쿼리 로깅 활성화'),
('enable_content_filtering', 'true', '콘텐츠 필터링 활성화'),
('maintenance_mode', 'false', '유지보수 모드')
ON CONFLICT (setting_key) DO NOTHING;

-- 마이그레이션 기록
INSERT INTO migrations (version, description) 
VALUES ('001_initial_schema', '초기 Figure-MCP 데이터베이스 스키마 생성')
ON CONFLICT (version) DO NOTHING;

COMMIT; 