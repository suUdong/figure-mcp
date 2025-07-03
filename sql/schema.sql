-- Figure-MCP 데이터베이스 스키마
-- PostgreSQL 14+ 권장

-- 확장 프로그램 활성화
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";

-- 사이트 정보 테이블
CREATE TABLE sites (
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
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    document_id VARCHAR(200) NOT NULL, -- 사용자 정의 문서 ID
    file_name VARCHAR(500) NOT NULL,
    file_path TEXT NOT NULL,
    file_size BIGINT,
    file_type VARCHAR(50),
    mime_type VARCHAR(100),
    category VARCHAR(100),
    title TEXT,
    description TEXT,
    content_hash VARCHAR(64), -- SHA-256 해시
    processing_status VARCHAR(20) DEFAULT 'pending' 
        CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed', 'deleted')),
    processing_metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP WITH TIME ZONE,
    
    UNIQUE(site_id, document_id)
);

-- 문서 청크 테이블
CREATE TABLE document_chunks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    content_tokens INTEGER,
    start_index INTEGER,
    end_index INTEGER,
    chunk_type VARCHAR(50) DEFAULT 'text', -- text, code, table, heading 등
    metadata JSONB DEFAULT '{}',
    embedding_id VARCHAR(200), -- 벡터 DB의 임베딩 ID
    embedding_model VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(document_id, chunk_index)
);

-- 작업 이력 테이블
CREATE TABLE job_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id VARCHAR(100) NOT NULL UNIQUE,
    job_type VARCHAR(50) NOT NULL, -- document_upload, design_figure, bulk_process 등
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
CREATE TABLE rag_query_logs (
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

-- 사용자 세션 테이블 (웹 UI용)
CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id VARCHAR(200) NOT NULL UNIQUE,
    site_id UUID REFERENCES sites(id) ON DELETE SET NULL,
    user_identifier VARCHAR(200), -- 사용자 식별자 (익명 가능)
    conversation_history JSONB DEFAULT '[]',
    metadata JSONB DEFAULT '{}',
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 시스템 설정 테이블
CREATE TABLE system_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    setting_key VARCHAR(100) NOT NULL UNIQUE,
    setting_value JSONB NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 인덱스 생성
-- 사이트 관련
CREATE INDEX idx_sites_site_name ON sites(site_name);
CREATE INDEX idx_sites_status ON sites(status);

-- 문서 관련
CREATE INDEX idx_documents_site_id ON documents(site_id);
CREATE INDEX idx_documents_document_id ON documents(document_id);
CREATE INDEX idx_documents_processing_status ON documents(processing_status);
CREATE INDEX idx_documents_file_type ON documents(file_type);
CREATE INDEX idx_documents_category ON documents(category);
CREATE INDEX idx_documents_created_at ON documents(created_at);
CREATE INDEX idx_documents_content_hash ON documents(content_hash);

-- 문서 청크 관련
CREATE INDEX idx_document_chunks_document_id ON document_chunks(document_id);
CREATE INDEX idx_document_chunks_embedding_id ON document_chunks(embedding_id);
CREATE INDEX idx_document_chunks_chunk_type ON document_chunks(chunk_type);

-- 작업 이력 관련
CREATE INDEX idx_job_history_job_id ON job_history(job_id);
CREATE INDEX idx_job_history_job_type ON job_history(job_type);
CREATE INDEX idx_job_history_site_id ON job_history(site_id);
CREATE INDEX idx_job_history_status ON job_history(status);
CREATE INDEX idx_job_history_created_at ON job_history(created_at);

-- RAG 쿼리 로그 관련
CREATE INDEX idx_rag_query_logs_site_id ON rag_query_logs(site_id);
CREATE INDEX idx_rag_query_logs_created_at ON rag_query_logs(created_at);
CREATE INDEX idx_rag_query_logs_success ON rag_query_logs(success);

-- 사용자 세션 관련
CREATE INDEX idx_user_sessions_session_id ON user_sessions(session_id);
CREATE INDEX idx_user_sessions_site_id ON user_sessions(site_id);
CREATE INDEX idx_user_sessions_expires_at ON user_sessions(expires_at);

-- 전문 검색 인덱스 (GIN)
CREATE INDEX idx_documents_content_gin ON documents USING gin(to_tsvector('korean', coalesce(title, '') || ' ' || coalesce(description, '')));
CREATE INDEX idx_document_chunks_content_gin ON document_chunks USING gin(to_tsvector('korean', content));

-- 메타데이터 검색용 GIN 인덱스
CREATE INDEX idx_documents_metadata_gin ON documents USING gin(processing_metadata);
CREATE INDEX idx_document_chunks_metadata_gin ON document_chunks USING gin(metadata);
CREATE INDEX idx_job_history_metadata_gin ON job_history USING gin(metadata);

-- updated_at 자동 업데이트 함수
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- updated_at 트리거 생성
CREATE TRIGGER update_sites_updated_at BEFORE UPDATE ON sites 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON documents 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_job_history_updated_at BEFORE UPDATE ON job_history 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_sessions_updated_at BEFORE UPDATE ON user_sessions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_system_settings_updated_at BEFORE UPDATE ON system_settings 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 뷰 생성

-- 문서 요약 뷰
CREATE VIEW document_summary AS
SELECT 
    d.id,
    d.site_id,
    s.site_name,
    d.document_id,
    d.file_name,
    d.category,
    d.title,
    d.processing_status,
    COUNT(dc.id) as chunk_count,
    SUM(dc.content_tokens) as total_tokens,
    d.created_at,
    d.updated_at,
    d.processed_at
FROM documents d
LEFT JOIN sites s ON d.site_id = s.id
LEFT JOIN document_chunks dc ON d.id = dc.document_id
GROUP BY d.id, s.site_name;

-- 사이트별 통계 뷰
CREATE VIEW site_statistics AS
SELECT 
    s.id,
    s.site_name,
    s.display_name,
    COUNT(DISTINCT d.id) as total_documents,
    COUNT(DISTINCT CASE WHEN d.processing_status = 'completed' THEN d.id END) as processed_documents,
    COUNT(DISTINCT dc.id) as total_chunks,
    SUM(d.file_size) as total_file_size,
    COUNT(DISTINCT rql.id) as total_queries,
    AVG(rql.confidence_score) as avg_confidence,
    s.created_at,
    s.updated_at
FROM sites s
LEFT JOIN documents d ON s.id = d.site_id
LEFT JOIN document_chunks dc ON d.id = dc.document_id
LEFT JOIN rag_query_logs rql ON s.id = rql.site_id
GROUP BY s.id, s.site_name, s.display_name, s.created_at, s.updated_at;

-- 작업 상태 뷰
CREATE VIEW job_status_summary AS
SELECT 
    jh.job_id,
    jh.job_type,
    jh.status,
    jh.progress,
    jh.total_items,
    jh.processed_items,
    CASE 
        WHEN jh.total_items > 0 THEN 
            ROUND((jh.processed_items::NUMERIC / jh.total_items::NUMERIC) * 100, 2)
        ELSE jh.progress 
    END as completion_percentage,
    jh.started_at,
    jh.completed_at,
    CASE 
        WHEN jh.status = 'running' AND jh.started_at IS NOT NULL THEN 
            EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - jh.started_at))
        WHEN jh.completed_at IS NOT NULL AND jh.started_at IS NOT NULL THEN
            EXTRACT(EPOCH FROM (jh.completed_at - jh.started_at))
        ELSE NULL
    END as duration_seconds,
    jh.error_message,
    s.site_name
FROM job_history jh
LEFT JOIN sites s ON jh.site_id = s.id;

-- 기본 데이터 삽입

-- 시스템 설정 기본값
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
('maintenance_mode', 'false', '유지보수 모드');

-- 권한 및 보안 설정
-- 읽기 전용 사용자 생성 (옵션)
-- CREATE USER figure_mcp_readonly WITH PASSWORD 'your_readonly_password';
-- GRANT CONNECT ON DATABASE figure_mcp TO figure_mcp_readonly;
-- GRANT USAGE ON SCHEMA public TO figure_mcp_readonly;
-- GRANT SELECT ON ALL TABLES IN SCHEMA public TO figure_mcp_readonly;

-- 애플리케이션 사용자 권한 설정 (옵션)
-- CREATE USER figure_mcp_app WITH PASSWORD 'your_app_password';
-- GRANT CONNECT ON DATABASE figure_mcp TO figure_mcp_app;
-- GRANT USAGE ON SCHEMA public TO figure_mcp_app;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO figure_mcp_app;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO figure_mcp_app; 