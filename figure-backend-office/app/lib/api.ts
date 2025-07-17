import axios from 'axios';

// API 기본 설정 - 클라이언트에서는 localhost로 직접 접근
export const api = axios.create({
  baseURL: 'http://localhost:8001',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 요청 인터셉터
api.interceptors.request.use(
  (config) => {
    console.log(`[API Request] ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 응답 인터셉터
api.interceptors.response.use(
  (response) => {
    console.log(`[API Response] ${response.status} ${response.config.url}`);
    return response;
  },
  (error) => {
    console.error(`[API Error] ${error.response?.status} ${error.config?.url}`, error.response?.data);
    return Promise.reject(error);
  }
);

// API 함수들
export const adminApi = {
  // 대시보드 관련
  getStats: () => api.get('/admin/stats'),
  getMetrics: () => api.get('/admin/metrics'),
  
  // 작업 관리
  getJobs: (params?: { status?: string; job_type?: string; limit?: number }) => 
    api.get('/admin/jobs', { params }),
  getJob: (jobId: string) => api.get(`/admin/jobs/${jobId}`),
  updateJob: (jobId: string, data: any) => api.patch(`/admin/jobs/${jobId}`, data),
  cancelJob: (jobId: string) => api.delete(`/admin/jobs/${jobId}`),
  cleanupJobs: (olderThanHours: number = 24) => 
    api.post('/admin/cleanup', null, { params: { older_than_hours: olderThanHours } }),
  
  // 로그 조회
  getLogs: (params?: { lines?: number; level?: string }) => 
    api.get('/admin/logs', { params }),
};

export const documentsApi = {
  // 문서 관리
  upload: (data: any) => api.post('/api/documents/upload', data),
  search: (params: { query: string; max_results?: number; similarity_threshold?: number; site_ids?: string }) => 
    api.get('/api/documents/search', { params }),
  getStats: () => api.get('/api/documents/stats'),
  delete: (documentId: string) => api.delete(`/api/documents/${documentId}`),
};

export const sitesApi = {
  // 사이트 관리
  create: (data: any) => api.post('/api/sites/', data),
  list: (activeOnly: boolean = true) => api.get('/api/sites/', { params: { active_only: activeOnly } }),
  get: (siteId: string) => api.get(`/api/sites/${siteId}`),
  update: (siteId: string, data: any) => api.put(`/api/sites/${siteId}`, data),
  delete: (siteId: string) => api.delete(`/api/sites/${siteId}`),
};

export const ragApi = {
  // RAG 기능
  query: (data: { query: string; site_ids?: string[]; max_results?: number; similarity_threshold?: number }) => 
    api.post('/api/rag/query', data),
  getStatus: () => api.get('/api/rag/status'),
  healthCheck: () => api.post('/api/rag/health'),
};

export const usageApi = {
  // 사용량 조회
  getCurrentUsage: (days: number = 30) => api.get('/api/usage/current', { params: { days } }),
};

export const systemApi = {
  // 시스템 상태
  getHealth: () => api.get('/health'),
  getStatus: () => api.get('/status'),
  getRoot: () => api.get('/'),
}; 

// RAG 질의응답 API
export async function queryRAG(data: {
  query: string;
  max_results?: number;
  similarity_threshold?: number;
  site_ids?: string[];
}) {
  const response = await api.post('/api/rag/query', data);
  return response.data;
}

// RAG 서비스 상태 조회
export async function getRAGStatus() {
  const response = await api.get('/api/rag/status');
  return response.data;
}

// RAG 서비스 헬스체크
export async function checkRAGHealth() {
  const response = await api.post('/api/rag/health');
  return response.data;
} 