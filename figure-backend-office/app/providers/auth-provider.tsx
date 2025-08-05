"use client";

/**
 * Authentication Provider
 * 인증 상태 관리를 위한 Context와 Provider
 */

import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
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
  const initializingRef = useRef(false);

  // 초기화 - 저장된 토큰으로 사용자 정보 복원
  useEffect(() => {
    const initializeAuth = async () => {
      // 이미 초기화 중이면 중단 (React Strict Mode 중복 실행 방지)
      if (initializingRef.current) {
        return;
      }

      initializingRef.current = true;

      try {
        dispatch({ type: "SET_LOADING", payload: true });

        // localStorage 사용 가능 여부 확인
        if (!AuthStorage.isLocalStorageAvailable()) {
          dispatch({ type: "SET_USER", payload: null });
          initializingRef.current = false;
          return;
        }

        const accessToken = AuthStorage.getAccessToken();
        const refreshToken = AuthStorage.getRefreshToken();

        // 토큰이 전혀 없는 경우
        if (!accessToken && !refreshToken) {
          dispatch({ type: "SET_USER", payload: null });
          initializingRef.current = false;
          return;
        }

        // 액세스 토큰이 만료되었지만 리프레시 토큰이 있는 경우
        if (AuthStorage.isTokenExpired() && refreshToken) {
          try {
            await Promise.race([
              refreshAccessToken(),
              new Promise<void>((_, reject) =>
                setTimeout(() => reject(new Error("토큰 갱신 타임아웃")), 3000)
              ),
            ]);
          } catch (error) {
            AuthStorage.clearTokens();
            dispatch({ type: "SET_USER", payload: null });
            initializingRef.current = false;
            return;
          }
        }

        // 토큰이 있지만 만료된 경우 (리프레시 토큰도 없음)
        if (AuthStorage.isTokenExpired() && !refreshToken) {
          AuthStorage.clearTokens();
          dispatch({ type: "SET_USER", payload: null });
          initializingRef.current = false;
          return;
        }

        // 사용자 정보 조회 (3초 타임아웃)
        const user = await Promise.race([
          getCurrentUser(),
          new Promise<User>((_, reject) =>
            setTimeout(
              () => reject(new Error("사용자 정보 조회 타임아웃")),
              3000
            )
          ),
        ]);
        dispatch({ type: "SET_USER", payload: user });
      } catch (error) {
        AuthStorage.clearTokens();
        dispatch({ type: "SET_USER", payload: null });
      } finally {
        initializingRef.current = false;
      }
    };

    initializeAuth();
  }, []);

  // 로그인 함수
  const login = useCallback(async (credentials: LoginRequest) => {
    try {
      dispatch({ type: "SET_LOADING", payload: true });
      dispatch({ type: "CLEAR_ERROR" });

      const loginResponse = await apiLogin(credentials);
      dispatch({ type: "LOGIN_SUCCESS", payload: loginResponse.user });
    } catch (error: any) {
      dispatch({ type: "SET_ERROR", payload: error.message });
      throw error;
    }
  }, []);

  // 로그아웃 함수
  const logout = useCallback(async () => {
    try {
      await apiLogout();
    } catch (error) {
      console.warn("로그아웃 요청 실패:", error);
    } finally {
      dispatch({ type: "LOGOUT" });
    }
  }, []);

  // 토큰 갱신 함수
  const refreshToken = useCallback(async () => {
    try {
      const loginResponse = await refreshAccessToken();
      dispatch({ type: "SET_USER", payload: loginResponse.user });
    } catch (error) {
      console.error("토큰 갱신 실패:", error);
      dispatch({ type: "LOGOUT" });
      throw error;
    }
  }, []);

  // 에러 클리어 함수
  const clearError = useCallback(() => {
    dispatch({ type: "CLEAR_ERROR" });
  }, []);

  const contextValue: AuthContextType = useMemo(
    () => ({
      ...state,
      login,
      logout,
      refreshToken,
      clearError,
    }),
    [state, login, logout, refreshToken, clearError]
  );

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
