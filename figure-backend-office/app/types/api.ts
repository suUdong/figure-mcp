// 공통 API 응답 타입
export interface APIResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  errors?: string[];
}

// 작업 관련 타입
export enum JobStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

export enum JobType {
  RAG_QUERY = 'rag_query',
  DOCUMENT_UPLOAD = 'document_upload',
  SITE_CREATION = 'site_creation',
  SYSTEM_MAINTENANCE = 'system_maintenance'
}

export interface Job {
  id: string;
  type: JobType;
  status: JobStatus;
  progress: number;
  message: string;
  site_id?: string;
  started_at: string;
  completed_at?: string;
  error?: string;
  metadata?: Record<string, any>;
}

export interface JobUpdate {
  status?: JobStatus;
  progress?: number;
  message?: string;
  error?: string;
  metadata?: Record<string, any>;
}

// 시스템 메트릭 타입
export interface SystemMetrics {
  active_jobs: number;
  cpu_usage: number;
  memory_usage: number;
  disk_usage: number;
  total_documents: number;
  total_sites: number;
  uptime_seconds: number;
}

// 관리자 통계 타입
export interface AdminStats {
  system_metrics: SystemMetrics;
  recent_jobs: Job[];
  error_summary: {
    total_errors: number;
    recent_errors: number;
    error_rate: number;
  };
  performance_summary: {
    avg_processing_time: number;
    success_rate: number;
    throughput: number;
  };
}

// 문서 관련 타입
export enum DocumentType {
  WEBSITE = 'website',
  PDF = 'pdf',
  TEXT = 'text',
  CONFLUENCE = 'confluence',
  JIRA = 'jira'
}

export interface Document {
  id: string
  filename: string
  content?: string
  metadata?: string
  size: number
  type: string
  status: 'pending' | 'processing' | 'processed' | 'failed'
  vector_count?: number
  created_at: string
  updated_at: string
  site_id?: string
  job_id?: string
}

export interface Site {
  id: string
  name: string
  url: string
  enabled: boolean
  description?: string
  crawl_frequency?: number
  max_depth?: number
  include_patterns?: string[]
  exclude_patterns?: string[]
  created_at: string
  updated_at: string
  last_crawled?: string
  document_count?: number
  status: 'active' | 'inactive' | 'error'
}

export interface CreateSiteRequest {
  name: string
  url: string
  description?: string
  crawl_frequency?: number
  max_depth?: number
  include_patterns?: string[]
  exclude_patterns?: string[]
}

export interface UpdateSiteRequest {
  name?: string
  url?: string
  description?: string
  crawl_frequency?: number
  max_depth?: number
  include_patterns?: string[]
  exclude_patterns?: string[]
  enabled?: boolean
}

export interface UploadDocumentRequest {
  title: string;
  content: string;
  doc_type: DocumentType;
  source_url?: string;
  site_id?: string;
  metadata?: Record<string, any>;
}

// 사이트 관련 타입


// RAG 관련 타입
export interface QueryRequest {
  query: string;
  site_ids?: string[];
  max_results?: number;
  similarity_threshold?: number;
}

export interface QueryResponse {
  answer: string;
  sources: Array<{
    content: string;
    metadata: Record<string, any>;
    similarity_score: number;
  }>;
  processing_time: number;
  job_id?: string;
}

export interface RAGStatus {
  rag_service_initialized: boolean;
  vector_store_status: string;
  llm_model: string;
  embedding_model: string;
  total_documents: number;
}

// 사용량 관련 타입
export interface UsageStats {
  period_days: number;
  total_requests: number;
  successful_requests: number;
  failed_requests: number;
  average_response_time: number;
  peak_usage_hour: number;
  daily_breakdown: Array<{
    date: string;
    requests: number;
    avg_response_time: number;
  }>;
}

// 시스템 상태 타입
export interface SystemStatus {
  app_name: string;
  version: string;
  debug_mode: boolean;
  vector_store: {
    status: string;
    total_chunks: number;
    collections: string[];
  };
  rag_service: RAGStatus;
  configuration: {
    llm_provider: string;
    embedding_provider: string;
    current_llm_model: string;
    current_embedding_model: string;
    chroma_collection: string;
  };
}

// 로그 관련 타입
export interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  component?: string;
}

export interface LogResponse {
  logs: string[];
} 