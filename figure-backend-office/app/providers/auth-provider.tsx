"use client";

/**
 * Authentication Provider
 * 인증 상태 관리를 위한 Context와 Provider
 */

import React, { createContext, useContext, useReducer, useEffect } from "react";
import { AuthState, AuthContextType, LoginRequest, User } from "@/types/auth";
import { AuthStorage } from "@/lib/auth-storage";
import {
  login as apiLogin,
  logout as apiLogout,
  getCurrentUser,
  refreshAccessToken,
} from "@/lib/auth-api";

// 인증 상태 액션 타입
type AuthAction =
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_USER"; payload: User | null }
  | { type: "SET_ERROR"; payload: string | null }
  | { type: "LOGIN_SUCCESS"; payload: User }
  | { type: "LOGOUT" }
  | { type: "CLEAR_ERROR" };

// 초기 상태
const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,
};

// 리듀서
function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case "SET_LOADING":
      return {
        ...state,
        isLoading: action.payload,
      };

    case "SET_USER":
      return {
        ...state,
        user: action.payload,
        isAuthenticated: !!action.payload,
        isLoading: false,
        error: null,
      };

    case "SET_ERROR":
      return {
        ...state,
        error: action.payload,
        isLoading: false,
      };

    case "LOGIN_SUCCESS":
      return {
        ...state,
        user: action.payload,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      };

    case "LOGOUT":
      return {
        ...state,
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      };

    case "CLEAR_ERROR":
      return {
        ...state,
        error: null,
      };

    default:
      return state;
  }
}

// Context 생성
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Provider 컴포넌트
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // 초기화 - 저장된 토큰으로 사용자 정보 복원
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        dispatch({ type: "SET_LOADING", payload: true });

        if (!AuthStorage.hasValidToken()) {
          dispatch({ type: "SET_USER", payload: null });
          return;
        }

        // 토큰이 만료되었지만 리프레시 토큰이 있는 경우
        if (AuthStorage.isTokenExpired() && AuthStorage.getRefreshToken()) {
          try {
            await refreshAccessToken();
          } catch (error) {
            console.warn("토큰 갱신 실패:", error);
            AuthStorage.clearTokens();
            dispatch({ type: "SET_USER", payload: null });
            return;
          }
        }

        // 사용자 정보 조회
        const user = await getCurrentUser();
        dispatch({ type: "SET_USER", payload: user });
      } catch (error) {
        console.error("인증 초기화 실패:", error);
        AuthStorage.clearTokens();
        dispatch({ type: "SET_USER", payload: null });
      }
    };

    initializeAuth();
  }, []);

  // 로그인 함수
  const login = async (credentials: LoginRequest) => {
    try {
      dispatch({ type: "SET_LOADING", payload: true });
      dispatch({ type: "CLEAR_ERROR" });

      const loginResponse = await apiLogin(credentials);
      dispatch({ type: "LOGIN_SUCCESS", payload: loginResponse.user });
    } catch (error: any) {
      dispatch({ type: "SET_ERROR", payload: error.message });
      throw error;
    }
  };

  // 로그아웃 함수
  const logout = async () => {
    try {
      await apiLogout();
    } catch (error) {
      console.warn("로그아웃 요청 실패:", error);
    } finally {
      dispatch({ type: "LOGOUT" });
    }
  };

  // 토큰 갱신 함수
  const refreshToken = async () => {
    try {
      const loginResponse = await refreshAccessToken();
      dispatch({ type: "SET_USER", payload: loginResponse.user });
    } catch (error) {
      console.error("토큰 갱신 실패:", error);
      dispatch({ type: "LOGOUT" });
      throw error;
    }
  };

  // 에러 클리어 함수
  const clearError = () => {
    dispatch({ type: "CLEAR_ERROR" });
  };

  const contextValue: AuthContextType = {
    ...state,
    login,
    logout,
    refreshToken,
    clearError,
  };

  return (
    <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
  );
}

// Hook for using auth context
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
