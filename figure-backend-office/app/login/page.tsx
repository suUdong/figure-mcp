"use client";

// 정적 생성 시 AuthProvider 에러를 방지하기 위해 동적 렌더링 강제
export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Eye,
  EyeOff,
  LogIn,
  Shield,
  User,
  Lock,
  Loader2,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { LoginRequest } from "@/types/auth";

export default function LoginPage() {
  const router = useRouter();
  const { login, isAuthenticated, isLoading, error, clearError } = useAuth();

  const [formData, setFormData] = useState<LoginRequest>({
    username: "",
    password: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 이미 인증된 사용자는 메인 페이지로 리다이렉트
  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      router.push("/");
    }
  }, [isAuthenticated, isLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.username || !formData.password) {
      return;
    }

    setIsSubmitting(true);

    try {
      await login(formData);
      // 로그인 성공 시 메인 페이지로 이동 (useEffect에서 자동 처리됨)
    } catch (error) {
      console.error("로그인 실패:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field: keyof LoginRequest, value: string) => {
    // 입력값 변경 시 에러 클리어
    if (error) {
      clearError();
    }

    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  // 로딩 중이면 로딩 화면 표시
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-figure-500" />
          <p className="text-gray-600">인증 상태를 확인하고 있습니다...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-figure-50 to-gray-100 p-4">
      <div className="w-full max-w-md space-y-6">
        {/* 헤더 */}
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-figure-500 rounded-xl flex items-center justify-center mx-auto">
            <Shield className="h-8 w-8 text-white" />
          </div>
          <div>
            <h1 className="text-display-md font-bold text-gray-900">
              Figure Backend Office
            </h1>
            <p className="text-gray-600 mt-2">관리자 로그인이 필요합니다</p>
          </div>
        </div>

        {/* 로그인 폼 */}
        <Card className="shadow-lg border-0">
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl font-semibold">로그인</CardTitle>
            <CardDescription>계정 정보를 입력하여 로그인하세요</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* 에러 메시지 */}
              {error && (
                <div className="p-3 bg-error-50 border border-error-200 rounded-lg">
                  <div className="flex items-center space-x-2 text-error-700">
                    <AlertCircle className="h-4 w-4" />
                    <span className="text-sm font-medium">로그인 실패</span>
                  </div>
                  <p className="text-sm text-error-600 mt-1">{error}</p>
                </div>
              )}

              {/* 사용자명 */}
              <div className="space-y-2">
                <Label htmlFor="username">사용자명</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="username"
                    type="text"
                    value={formData.username}
                    onChange={(e) =>
                      handleInputChange("username", e.target.value)
                    }
                    placeholder="사용자명을 입력하세요"
                    className="pl-10"
                    required
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              {/* 비밀번호 */}
              <div className="space-y-2">
                <Label htmlFor="password">비밀번호</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={(e) =>
                      handleInputChange("password", e.target.value)
                    }
                    placeholder="비밀번호를 입력하세요"
                    className="pl-10 pr-10"
                    required
                    disabled={isSubmitting}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    disabled={isSubmitting}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* 로그인 버튼 */}
              <Button
                type="submit"
                className="w-full"
                disabled={
                  isSubmitting || !formData.username || !formData.password
                }
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    로그인 중...
                  </>
                ) : (
                  <>
                    <LogIn className="h-4 w-4 mr-2" />
                    로그인
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* 기본 계정 안내 */}
        <Card className="border-info-200 bg-info-50">
          <CardContent className="pt-6">
            <div className="flex items-start space-x-3">
              <CheckCircle2 className="h-5 w-5 text-info-600 mt-0.5" />
              <div>
                <h3 className="font-medium text-info-800">기본 관리자 계정</h3>
                <p className="text-sm text-info-700 mt-1">
                  시스템 초기 설정 시 기본 관리자 계정이 자동으로 생성됩니다.
                </p>
                <div className="mt-3 space-y-2">
                  <div className="flex items-center space-x-2">
                    <Badge variant="secondary" className="text-xs">
                      사용자명: admin
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      비밀번호: admin123!
                    </Badge>
                  </div>
                  <p className="text-xs text-info-600">
                    ⚠️ 보안을 위해 로그인 후 비밀번호를 변경하세요
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 기능 안내 */}
        <div className="text-center text-xs text-gray-500">
          <p>Figure MCP 백엔드 관리 시스템 • JWT 인증 • 자동 토큰 갱신</p>
        </div>
      </div>
    </div>
  );
}
