/**
 * Authentication Storage Utilities
 * JWT 토큰 저장 및 관리를 위한 유틸리티
 */

import { TokenStorage } from "@/types/auth";

const ACCESS_TOKEN_KEY = "figure_access_token";
const REFRESH_TOKEN_KEY = "figure_refresh_token";
const EXPIRES_AT_KEY = "figure_token_expires_at";

export class AuthStorage {
  /**
   * 토큰 저장
   */
  static setTokens(
    accessToken: string,
    refreshToken: string,
    expiresIn: number
  ): void {
    try {
      const expiresAt = Date.now() + expiresIn * 1000;

      localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
      localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
      localStorage.setItem(EXPIRES_AT_KEY, expiresAt.toString());
    } catch (error) {
      console.error("토큰 저장 실패:", error);
    }
  }

  /**
   * 액세스 토큰 조회
   */
  static getAccessToken(): string | null {
    try {
      return localStorage.getItem(ACCESS_TOKEN_KEY);
    } catch (error) {
      console.error("액세스 토큰 조회 실패:", error);
      return null;
    }
  }

  /**
   * 리프레시 토큰 조회
   */
  static getRefreshToken(): string | null {
    try {
      return localStorage.getItem(REFRESH_TOKEN_KEY);
    } catch (error) {
      console.error("리프레시 토큰 조회 실패:", error);
      return null;
    }
  }

  /**
   * 모든 토큰 정보 조회
   */
  static getTokens(): TokenStorage {
    return {
      access_token: this.getAccessToken(),
      refresh_token: this.getRefreshToken(),
      expires_at: this.getTokenExpirationTime(),
    };
  }

  /**
   * 토큰 만료 시간 조회
   */
  static getTokenExpirationTime(): number | null {
    try {
      const expiresAt = localStorage.getItem(EXPIRES_AT_KEY);
      return expiresAt ? parseInt(expiresAt) : null;
    } catch (error) {
      console.error("토큰 만료 시간 조회 실패:", error);
      return null;
    }
  }

  /**
   * 토큰 만료 여부 확인
   */
  static isTokenExpired(): boolean {
    const expiresAt = this.getTokenExpirationTime();
    if (!expiresAt) return true;

    // 5분 여유를 두고 만료 체크 (자동 갱신 위해)
    const bufferTime = 5 * 60 * 1000; // 5분
    return Date.now() >= expiresAt - bufferTime;
  }

  /**
   * 토큰 유효성 확인
   */
  static hasValidToken(): boolean {
    const accessToken = this.getAccessToken();
    return !!(accessToken && !this.isTokenExpired());
  }

  /**
   * 모든 토큰 삭제
   */
  static clearTokens(): void {
    try {
      localStorage.removeItem(ACCESS_TOKEN_KEY);
      localStorage.removeItem(REFRESH_TOKEN_KEY);
      localStorage.removeItem(EXPIRES_AT_KEY);
    } catch (error) {
      console.error("토큰 삭제 실패:", error);
    }
  }

  /**
   * 액세스 토큰만 업데이트
   */
  static updateAccessToken(accessToken: string, expiresIn: number): void {
    try {
      const expiresAt = Date.now() + expiresIn * 1000;

      localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
      localStorage.setItem(EXPIRES_AT_KEY, expiresAt.toString());
    } catch (error) {
      console.error("액세스 토큰 업데이트 실패:", error);
    }
  }

  /**
   * 토큰 남은 시간 (초)
   */
  static getTimeUntilExpiry(): number {
    const expiresAt = this.getTokenExpirationTime();
    if (!expiresAt) return 0;

    const remainingTime = Math.max(0, expiresAt - Date.now());
    return Math.floor(remainingTime / 1000);
  }

  /**
   * 브라우저 저장소 사용 가능 여부 확인
   */
  static isLocalStorageAvailable(): boolean {
    try {
      const test = "__localStorage_test__";
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch {
      return false;
    }
  }
}
