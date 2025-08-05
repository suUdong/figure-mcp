/**
 * Authentication API Client
 * 인증 관련 API 호출 함수들
 */

import axios from "axios";
import {
  LoginRequest,
  LoginResponse,
  RefreshTokenRequest,
  User,
} from "@/types/auth";
import { AuthStorage } from "./auth-storage";

// 기본 API 클라이언트 (토큰 없이)
// Next.js rewrite를 통해 백엔드와 통신 (상대 경로 사용)
const authApi = axios.create({
  baseURL: "", // 상대 경로 사용으로 Next.js rewrite 활용
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});

// 인증이 필요한 API 클라이언트 (토큰 포함)
const authenticatedApi = axios.create({
  baseURL: "", // 상대 경로 사용으로 Next.js rewrite 활용
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});

// 인증된 API 요청 인터셉터 - 토큰 자동 추가
authenticatedApi.interceptors.request.use(
  (config) => {
    const token = AuthStorage.getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 인증된 API 응답 인터셉터 - 토큰 만료 시 자동 갱신
authenticatedApi.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        await refreshAccessToken();

        // 새 토큰으로 원래 요청 재시도
        const newToken = AuthStorage.getAccessToken();
        if (newToken) {
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return authenticatedApi(originalRequest);
        }
      } catch (refreshError) {
        // 토큰 갱신 실패 시 로그아웃
        AuthStorage.clearTokens();
        window.location.href = "/login";
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

/**
 * 로그인
 */
export async function login(credentials: LoginRequest): Promise<LoginResponse> {
  try {
    const response = await authApi.post("/api/auth/login", credentials);

    if (response.data.success) {
      const loginData = response.data.data as LoginResponse;

      // 토큰 저장
      AuthStorage.setTokens(
        loginData.access_token,
        loginData.refresh_token,
        loginData.expires_in
      );

      return loginData;
    } else {
      throw new Error(response.data.message || "로그인에 실패했습니다");
    }
  } catch (error: any) {
    if (error.response?.data?.detail) {
      throw new Error(error.response.data.detail);
    }
    throw new Error(error.message || "로그인 중 오류가 발생했습니다");
  }
}

/**
 * 로그아웃
 */
export async function logout(): Promise<void> {
  try {
    // 서버에 로그아웃 요청
    await authenticatedApi.post("/api/auth/logout");
  } catch (error) {
    console.warn("서버 로그아웃 요청 실패:", error);
  } finally {
    // 로컬 토큰 삭제
    AuthStorage.clearTokens();
  }
}

/**
 * 토큰 갱신
 */
export async function refreshAccessToken(): Promise<LoginResponse> {
  const refreshToken = AuthStorage.getRefreshToken();

  if (!refreshToken) {
    throw new Error("리프레시 토큰이 없습니다");
  }

  try {
    const response = await authApi.post("/api/auth/refresh", {
      refresh_token: refreshToken,
    } as RefreshTokenRequest);

    if (response.data.success) {
      const loginData = response.data.data as LoginResponse;

      // 새 토큰 저장
      AuthStorage.setTokens(
        loginData.access_token,
        loginData.refresh_token,
        loginData.expires_in
      );

      return loginData;
    } else {
      throw new Error(response.data.message || "토큰 갱신에 실패했습니다");
    }
  } catch (error: any) {
    // 리프레시 토큰도 만료된 경우
    AuthStorage.clearTokens();

    if (error.response?.data?.detail) {
      throw new Error(error.response.data.detail);
    }
    throw new Error(error.message || "토큰 갱신 중 오류가 발생했습니다");
  }
}

/**
 * 현재 사용자 정보 조회
 */
export async function getCurrentUser(): Promise<User> {
  try {
    const response = await authenticatedApi.get("/api/auth/me");

    if (response.data.success) {
      return response.data.data as User;
    } else {
      throw new Error(
        response.data.message || "사용자 정보 조회에 실패했습니다"
      );
    }
  } catch (error: any) {
    if (error.response?.data?.detail) {
      throw new Error(error.response.data.detail);
    }
    throw new Error(error.message || "사용자 정보 조회 중 오류가 발생했습니다");
  }
}

/**
 * 토큰 검증
 */
export async function verifyToken(): Promise<boolean> {
  try {
    const response = await authenticatedApi.get("/api/auth/verify");
    return response.data.success;
  } catch (error) {
    return false;
  }
}

export { authenticatedApi };
