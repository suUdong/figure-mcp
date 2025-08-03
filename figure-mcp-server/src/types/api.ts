/**
 * Backend API Types
 * 백엔드 API 응답 타입 정의
 */

export interface APIResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  errors?: string[];
}

export interface Template {
  id: string;
  name: string;
  description?: string;
  template_type: string;
  format: string;
  site_id?: string;
  content: string;
  variables: Record<string, any>;
  tags: string[];
  usage_count: number;
  is_active: boolean;
  is_default: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface TemplateGuideResponse {
  template: string;
  variables: Record<string, any>;
  instructions: string;
  usage_count: number;
}

export interface Site {
  id: string;
  name: string;
  description?: string;
  is_active: boolean;
}

export interface DocumentUploadResponse {
  document_id: string;
  job_id: string;
  filename: string;
  file_size: number;
  doc_type: string;
  created_at: string;
}

export interface JobStatus {
  id: string;
  type: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  message: string;
  metadata?: Record<string, any>;
  error?: string;
}