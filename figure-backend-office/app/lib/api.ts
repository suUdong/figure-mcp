import axios from "axios";
import { AuthStorage } from "./auth-storage";

// API 기본 설정 - 백엔드 직접 연결
const getBaseURL = () => {
  // 개발 환경에서는 백엔드에 직접 연결
  if (typeof window !== "undefined") {
    return "http://localhost:8001";
  }
  // 서버 사이드에서는 Docker 내부 네트워크 사용
  return process.env.BACKEND_API_URL || "http://figure-backend:8001";
};

export const api = axios.create({
  baseURL: getBaseURL(),
  timeout: 30000, // RAG 질의를 위해 30초로 확장
  headers: {
    "Content-Type": "application/json",
  },
});

// 요청 인터셉터 - 인증 토큰 자동 추가 및 FormData 처리 (로그 제거)
api.interceptors.request.use(
  (config) => {
    // 🆕 FormData인 경우 Content-Type 헤더 제거 (브라우저가 자동으로 boundary 설정)
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
      console.log('[API Debug] FormData detected, removing Content-Type header');
    }

    // 인증 토큰 추가 (로그인/리프레시 요청 제외)
    const token = AuthStorage.getAccessToken();
    if (
      token &&
      !config.url?.includes("/auth/login") &&
      !config.url?.includes("/auth/refresh")
    ) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 응답 인터셉터 - 토큰 만료 시 자동 갱신 또는 로그아웃 (로그 최소화)
api.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    // 개발 환경에서만 에러 로그 출력
    if (process.env.NODE_ENV === "development") {
      console.error(
        `[API Error] ${error.response?.status} ${error.config?.url}`
      );
    }

    const originalRequest = error.config;

    // 401 에러이고 아직 재시도하지 않은 경우
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      // 토큰 갱신 시도
      const refreshToken = AuthStorage.getRefreshToken();
      if (refreshToken && !originalRequest.url?.includes("/auth/")) {
        try {
          // 토큰 갱신 요청 - 직접 백엔드 URL 사용
          const refreshResponse = await axios.post(
            `${getBaseURL()}/api/auth/refresh`,
            {
              refresh_token: refreshToken,
            }
          );

          if (refreshResponse.data.success) {
            const loginData = refreshResponse.data.data;

            // 새 토큰 저장
            AuthStorage.setTokens(
              loginData.access_token,
              loginData.refresh_token,
              loginData.expires_in
            );

            // 원래 요청에 새 토큰 적용
            originalRequest.headers.Authorization = `Bearer ${loginData.access_token}`;
            return api(originalRequest);
          }
        } catch (refreshError) {
          if (process.env.NODE_ENV === "development") {
            console.error("토큰 갱신 실패:", refreshError);
          }
          AuthStorage.clearTokens();

          // 로그인 페이지로 리다이렉트 (브라우저 환경에서만)
          if (typeof window !== "undefined") {
            window.location.href = "/login";
          }
        }
      } else {
        // 리프레시 토큰이 없거나 auth 요청인 경우
        AuthStorage.clearTokens();

        if (
          typeof window !== "undefined" &&
          !originalRequest.url?.includes("/auth/")
        ) {
          window.location.href = "/login";
        }
      }
    }

    return Promise.reject(error);
  }
);

// API 함수들
export const adminApi = {
  // 대시보드 관련 - /admin prefix (not /api/admin)
  getStats: () => api.get("/admin/stats"),
  getMetrics: () => api.get("/admin/metrics"),

  // 작업 관리
  getJobs: (params?: { status?: string; job_type?: string; limit?: number }) =>
    api.get("/admin/jobs", { params }),
  getJob: (jobId: string) => api.get(`/admin/jobs/${jobId}`),
  updateJob: (jobId: string, data: any) =>
    api.patch(`/admin/jobs/${jobId}`, data),
  cancelJob: (jobId: string) => api.delete(`/admin/jobs/${jobId}`),
  cleanupJobs: (olderThanHours: number = 24) =>
    api.post("/admin/cleanup", null, {
      params: { older_than_hours: olderThanHours },
    }),

  // 로그 조회
  getLogs: (params?: { lines?: number; level?: string }) =>
    api.get("/admin/logs", { params }),
};

export const documentsApi = {
  // 문서 관리
  upload: (data: any) => api.post("/api/documents/upload", data),
  search: (params: {
    query: string;
    max_results?: number;
    similarity_threshold?: number;
    site_ids?: string;
  }) => api.get("/api/documents/search", { params }),
  getStats: () => api.get("/api/documents/stats"),
  delete: (documentId: string) => api.delete(`/api/documents/${documentId}`),
  // 🆕 문서 내용 조회
  getContent: (documentId: string) => api.get(`/api/documents/${documentId}/content`),
};

export const sitesApi = {
  // 사이트 관리
  create: (data: any) => api.post("/api/sites/", data),
  list: (activeOnly: boolean = true) =>
    api.get("/api/sites/", { params: { active_only: activeOnly } }),
  get: (siteId: string) => api.get(`/api/sites/${siteId}`),
  update: (siteId: string, data: any) => api.put(`/api/sites/${siteId}`, data),
  delete: (siteId: string) => api.delete(`/api/sites/${siteId}`),
};

export const ragApi = {
  // RAG 기능
  query: (data: {
    query: string;
    site_ids?: string[];
    max_results?: number;
    similarity_threshold?: number;
  }) => api.post("/api/rag/query", data),
  getStatus: () => api.get("/api/rag/status"),
  healthCheck: () => api.post("/api/rag/health"),
};

export const usageApi = {
  // 사용량 조회
  getCurrentUsage: (days: number = 30) =>
    api.get("/api/usage/current", { params: { days } }),
};

export const systemApi = {
  // 시스템 상태 - root level endpoints (프록시 우회하고 직접 백엔드 호출)
  getHealth: () => {
    // 브라우저에서는 직접 백엔드로 요청
    if (typeof window !== "undefined") {
      return axios.get("http://localhost:8001/health", {
        timeout: 5000,
        headers: { "Content-Type": "application/json" },
      });
    }
    return api.get("/health");
  },
  getStatus: () => {
    if (typeof window !== "undefined") {
      return axios.get("http://localhost:8001/status", {
        timeout: 5000,
        headers: { "Content-Type": "application/json" },
      });
    }
    return api.get("/status");
  },
  getRoot: () => api.get("/"),
};

// RAG 질의응답 API
export async function queryRAG(data: {
  query: string;
  max_results?: number;
  similarity_threshold?: number;
  site_ids?: string[];
}) {
  const response = await api.post("/api/rag/query", data);
  return response.data;
}

// RAG 서비스 상태 조회
export async function getRAGStatus() {
  const response = await api.get("/api/rag/status");
  return response.data;
}

// RAG 서비스 헬스체크
export async function checkRAGHealth() {
  const response = await api.post("/api/rag/health");
  return response.data;
}

// 🆕 Guidelines API
export const guidelinesApi = {
  // 지침 목록 조회
  list: (params?: {
    guideline_type?: string;
    scope?: string;
    site_id?: string;
    is_active?: boolean;
    search_query?: string;
    limit?: number;
    offset?: number;
  }) => api.get('/api/guidelines/', { params }),

  // 지침 상세 조회
  get: (id: string) => api.get(`/api/guidelines/${id}`),

  // 지침 생성
  create: (data: any) => api.post('/api/guidelines/', data),

  // 지침 수정
  update: (id: string, data: any) => api.put(`/api/guidelines/${id}`, data),

  // 지침 삭제
  delete: (id: string) => api.delete(`/api/guidelines/${id}`),

  // 지침 종합 조회 (MCP용)
  aggregate: (guideline_type: string, site_id?: string) => 
    api.get(`/api/guidelines/aggregate/${guideline_type}`, { 
      params: site_id ? { site_id } : {} 
    }),
};
