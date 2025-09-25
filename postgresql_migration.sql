-- Figure Backend PostgreSQL Migration Script
-- SQLite에서 PostgreSQL로 마이그레이션을 위한 DDL
-- Generated for Supabase Migration

-- ==========================================
-- 1. Extensions 및 초기 설정
-- ==========================================

-- UUID 확장 활성화 (Supabase에서는 기본적으로 활성화되어 있음)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================  
-- 2. Enum 타입 정의
-- ==========================================

-- 사용자 역할 enum
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('admin', 'user');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ==========================================
-- 3. 테이블 생성
-- ==========================================

-- Sites 테이블 (사이트 정보 - IT 운영업무를 하는 회사 정보)
CREATE TABLE IF NOT EXISTS sites (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    company VARCHAR(255) NOT NULL, 
    department VARCHAR(255),
    business_type VARCHAR(255),
    contact_person VARCHAR(255),
    contact_email VARCHAR(255),
    contact_phone VARCHAR(255),
    url VARCHAR(500),
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    
    -- 크롤링 설정 필드
    crawl_frequency INTEGER NOT NULL DEFAULT 24,
    max_depth INTEGER NOT NULL DEFAULT 3,
    include_patterns JSONB,
    exclude_patterns JSONB,
    
    -- 크롤링 상태 필드
    last_crawled TIMESTAMP WITH TIME ZONE,
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    document_count INTEGER NOT NULL DEFAULT 0,
    
    -- 메타데이터
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Documents 테이블 (문서 정보 - 메타데이터만 저장)
CREATE TABLE IF NOT EXISTS documents (
    id VARCHAR(255) PRIMARY KEY,
    site_id VARCHAR(255),
    title VARCHAR(500) NOT NULL,
    doc_type VARCHAR(100) NOT NULL,
    source_url VARCHAR(1000),
    file_path VARCHAR(1000),
    file_size INTEGER,
    content_hash VARCHAR(255),
    processing_status VARCHAR(50) NOT NULL DEFAULT 'pending',
    extra_data JSONB,
    
    -- 템플릿 관련 필드 (통합)
    is_template BOOLEAN NOT NULL DEFAULT false,
    template_type VARCHAR(100),
    template_name VARCHAR(255),
    template_description TEXT,
    template_version VARCHAR(20) NOT NULL DEFAULT '1.0.0',
    template_format VARCHAR(50) NOT NULL DEFAULT 'markdown',
    template_variables JSONB,
    template_tags TEXT, -- 쉼표 구분 태그
    usage_count INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_default BOOLEAN NOT NULL DEFAULT false,
    created_by VARCHAR(255),
    updated_by VARCHAR(255),
    
    -- 메타데이터
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- 외래키 제약조건
    CONSTRAINT fk_documents_site_id 
        FOREIGN KEY (site_id) REFERENCES sites(id) 
        ON DELETE SET NULL ON UPDATE CASCADE
);

-- Usage Logs 테이블 (API 사용량 로그)
CREATE TABLE IF NOT EXISTS usage_logs (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    provider VARCHAR(50) NOT NULL,
    service VARCHAR(50) NOT NULL, 
    model VARCHAR(100) NOT NULL,
    tokens_used INTEGER NOT NULL,
    cost DECIMAL(10, 6) NOT NULL,
    request_type VARCHAR(50) NOT NULL,
    success BOOLEAN NOT NULL DEFAULT true,
    error_message TEXT,
    extra_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Users 테이블 (사용자 정보)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255),
    full_name VARCHAR(255),
    hashed_password VARCHAR(255) NOT NULL,
    role user_role NOT NULL DEFAULT 'user',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP WITH TIME ZONE
);

-- Template Matching Rules 테이블 (템플릿 매칭 규칙)
CREATE TABLE IF NOT EXISTS template_matching_rules (
    id SERIAL PRIMARY KEY,
    mcp_request_type VARCHAR(50) NOT NULL,
    template_type VARCHAR(50) NOT NULL,
    site_id VARCHAR(255),
    priority INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(100),
    
    -- 외래키 제약조건
    CONSTRAINT fk_template_matching_rules_site_id 
        FOREIGN KEY (site_id) REFERENCES sites(id) 
        ON DELETE SET NULL ON UPDATE CASCADE
);

-- ==========================================
-- 4. 인덱스 생성
-- ==========================================

-- Sites 테이블 인덱스
CREATE INDEX IF NOT EXISTS idx_sites_name ON sites(name);
CREATE INDEX IF NOT EXISTS idx_sites_company ON sites(company);
CREATE INDEX IF NOT EXISTS idx_sites_url ON sites(url);
CREATE INDEX IF NOT EXISTS idx_sites_is_active ON sites(is_active);
CREATE INDEX IF NOT EXISTS idx_sites_status ON sites(status);
CREATE INDEX IF NOT EXISTS idx_sites_created_at ON sites(created_at);

-- Documents 테이블 인덱스
CREATE INDEX IF NOT EXISTS idx_documents_site_id ON documents(site_id);
CREATE INDEX IF NOT EXISTS idx_documents_title ON documents(title);
CREATE INDEX IF NOT EXISTS idx_documents_doc_type ON documents(doc_type);
CREATE INDEX IF NOT EXISTS idx_documents_processing_status ON documents(processing_status);
CREATE INDEX IF NOT EXISTS idx_documents_is_template ON documents(is_template);
CREATE INDEX IF NOT EXISTS idx_documents_template_type ON documents(template_type);
CREATE INDEX IF NOT EXISTS idx_documents_template_name ON documents(template_name);
CREATE INDEX IF NOT EXISTS idx_documents_is_active ON documents(is_active);
CREATE INDEX IF NOT EXISTS idx_documents_is_default ON documents(is_default);
CREATE INDEX IF NOT EXISTS idx_documents_created_at ON documents(created_at);
CREATE INDEX IF NOT EXISTS idx_documents_updated_at ON documents(updated_at);

-- Usage Logs 테이블 인덱스
CREATE INDEX IF NOT EXISTS idx_usage_logs_timestamp ON usage_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_usage_logs_provider ON usage_logs(provider);
CREATE INDEX IF NOT EXISTS idx_usage_logs_service ON usage_logs(service);
CREATE INDEX IF NOT EXISTS idx_usage_logs_success ON usage_logs(success);
CREATE INDEX IF NOT EXISTS idx_usage_logs_created_at ON usage_logs(created_at);

-- Users 테이블 인덱스  
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);

-- Template Matching Rules 테이블 인덱스
CREATE INDEX IF NOT EXISTS idx_template_matching_rules_mcp_request_type ON template_matching_rules(mcp_request_type);
CREATE INDEX IF NOT EXISTS idx_template_matching_rules_template_type ON template_matching_rules(template_type);
CREATE INDEX IF NOT EXISTS idx_template_matching_rules_site_id ON template_matching_rules(site_id);
CREATE INDEX IF NOT EXISTS idx_template_matching_rules_priority ON template_matching_rules(priority);
CREATE INDEX IF NOT EXISTS idx_template_matching_rules_is_active ON template_matching_rules(is_active);

-- ==========================================
-- 5. 트리거 생성 (updated_at 자동 업데이트)
-- ==========================================

-- updated_at 자동 업데이트 함수
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Sites 테이블 트리거
CREATE TRIGGER update_sites_updated_at 
    BEFORE UPDATE ON sites 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Documents 테이블 트리거
CREATE TRIGGER update_documents_updated_at 
    BEFORE UPDATE ON documents 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Users 테이블 트리거
CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Template Matching Rules 테이블 트리거
CREATE TRIGGER update_template_matching_rules_updated_at 
    BEFORE UPDATE ON template_matching_rules 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- ==========================================
-- 6. Row Level Security (RLS) 설정 (Supabase용)
-- ==========================================

-- Sites 테이블 RLS 활성화
ALTER TABLE sites ENABLE ROW LEVEL SECURITY;

-- Documents 테이블 RLS 활성화  
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Usage Logs 테이블 RLS 활성화
ALTER TABLE usage_logs ENABLE ROW LEVEL SECURITY;

-- Users 테이블 RLS 활성화
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Template Matching Rules 테이블 RLS 활성화
ALTER TABLE template_matching_rules ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- 7. 기본 RLS 정책 생성 (관리자만 접근 가능)
-- ==========================================

-- Sites 정책
CREATE POLICY "Sites access for authenticated users" ON sites
    FOR ALL USING (auth.role() = 'authenticated');

-- Documents 정책
CREATE POLICY "Documents access for authenticated users" ON documents
    FOR ALL USING (auth.role() = 'authenticated');

-- Usage Logs 정책 (관리자만)
CREATE POLICY "Usage logs access for admin only" ON usage_logs
    FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

-- Users 정책 (관리자만)
CREATE POLICY "Users access for admin only" ON users
    FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

-- Template Matching Rules 정책
CREATE POLICY "Template matching rules access for authenticated users" ON template_matching_rules
    FOR ALL USING (auth.role() = 'authenticated');

-- ==========================================
-- 8. 초기 데이터 (선택사항)
-- ==========================================

-- 기본 관리자 사용자 생성 
-- 기본 비밀번호: admin123 (로그인 후 반드시 변경하세요!)
-- bcrypt로 해시화된 비밀번호: $2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewDecLGXD4NPKpxm
INSERT INTO users (username, email, full_name, hashed_password, role, is_active)
VALUES ('admin', 'admin@figure.com', 'Administrator', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewDecLGXD4NPKpxm', 'admin', true)
ON CONFLICT (username) DO NOTHING;

-- ==========================================
-- 9. 성능 최적화를 위한 추가 설정
-- ==========================================

-- JSONB 필드 GIN 인덱스 (검색 성능 향상)
CREATE INDEX IF NOT EXISTS idx_sites_include_patterns_gin ON sites USING GIN(include_patterns);
CREATE INDEX IF NOT EXISTS idx_sites_exclude_patterns_gin ON sites USING GIN(exclude_patterns);
CREATE INDEX IF NOT EXISTS idx_documents_extra_data_gin ON documents USING GIN(extra_data);
CREATE INDEX IF NOT EXISTS idx_documents_template_variables_gin ON documents USING GIN(template_variables);
CREATE INDEX IF NOT EXISTS idx_usage_logs_extra_data_gin ON usage_logs USING GIN(extra_data);

-- 복합 인덱스 (자주 사용되는 쿼리 패턴 최적화)
CREATE INDEX IF NOT EXISTS idx_documents_site_template ON documents(site_id, is_template);
CREATE INDEX IF NOT EXISTS idx_documents_type_active ON documents(doc_type, is_active);
CREATE INDEX IF NOT EXISTS idx_usage_logs_provider_timestamp ON usage_logs(provider, timestamp);
CREATE INDEX IF NOT EXISTS idx_template_matching_rules_type_priority ON template_matching_rules(template_type, priority);

-- ==========================================
-- 완료 메시지
-- ==========================================

DO $$
BEGIN
    RAISE NOTICE '✅ Figure Backend PostgreSQL 마이그레이션 DDL 스크립트 실행 완료!';
    RAISE NOTICE '📝 다음 단계:';
    RAISE NOTICE '   1. Supabase에서 이 스크립트 실행';
    RAISE NOTICE '   2. figure-backend/app/config.py의 database_url 수정';
    RAISE NOTICE '   3. 기존 SQLite 데이터를 PostgreSQL로 마이그레이션';
    RAISE NOTICE '   4. 연결 테스트 및 검증';
END $$;
