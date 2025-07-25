"use client";

/**
 * Protected Route Component
 * 인증이 필요한 페이지를 보호하는 컴포넌트
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/providers/auth-provider";
import { UserRole } from "@/types/auth";
import { Loader2, Shield, AlertTriangle } from "lucide-react";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: UserRole;
  fallbackPath?: string;
}

export default function ProtectedRoute({
  children,
  requiredRole,
  fallbackPath = "/login",
}: ProtectedRouteProps) {
  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    // 로딩이 완료되고 인증되지 않은 경우 로그인 페이지로 리다이렉트
    if (!isLoading && !isAuthenticated) {
      router.push(fallbackPath);
    }
  }, [isLoading, isAuthenticated, router, fallbackPath]);

  // 로딩 중
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-figure-500" />
          <div>
            <h3 className="text-lg font-medium text-gray-900">인증 확인 중</h3>
            <p className="text-sm text-gray-500">잠시만 기다려주세요...</p>
          </div>
        </div>
      </div>
    );
  }

  // 인증되지 않은 경우
  if (!isAuthenticated || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center space-y-4 max-w-md mx-auto p-6">
          <Shield className="h-12 w-12 mx-auto text-gray-400" />
          <div>
            <h3 className="text-lg font-medium text-gray-900">
              인증이 필요합니다
            </h3>
            <p className="text-sm text-gray-500 mt-2">
              이 페이지에 접근하려면 로그인이 필요합니다.
            </p>
          </div>
          <button
            onClick={() => router.push(fallbackPath)}
            className="text-figure-600 hover:text-figure-700 text-sm font-medium"
          >
            로그인 페이지로 이동 →
          </button>
        </div>
      </div>
    );
  }

  // 역할 기반 접근 제어
  if (requiredRole && user.role !== requiredRole) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center space-y-4 max-w-md mx-auto p-6">
          <AlertTriangle className="h-12 w-12 mx-auto text-warning-500" />
          <div>
            <h3 className="text-lg font-medium text-gray-900">
              접근 권한이 없습니다
            </h3>
            <p className="text-sm text-gray-500 mt-2">
              이 페이지에 접근하려면 {requiredRole} 권한이 필요합니다.
            </p>
            <p className="text-xs text-gray-400 mt-1">현재 권한: {user.role}</p>
          </div>
          <button
            onClick={() => router.push("/")}
            className="text-figure-600 hover:text-figure-700 text-sm font-medium"
          >
            메인 페이지로 이동 →
          </button>
        </div>
      </div>
    );
  }

  // 인증되고 권한이 있는 경우 자식 컴포넌트 렌더링
  return <>{children}</>;
}
