"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import MainLayout from "@/components/layout/main-layout";
import SimplifiedAdvancedUpload from "@/components/documents/simplified-advanced-upload";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Upload,
  CheckCircle2,
  AlertTriangle,
  Info,
  ChevronRight,
} from "lucide-react";

export default function DocumentUploadPage() {
  const router = useRouter();
  const [uploadStats, setUploadStats] = useState({
    completed: 0,
    failed: 0,
    total: 0,
  });

  const handleUploadComplete = () => {
    setUploadStats((prev) => ({ ...prev, completed: prev.completed + 1 }));
  };

  const handleUploadError = () => {
    setUploadStats((prev) => ({ ...prev, failed: prev.failed + 1 }));
  };

  const handleAllComplete = (files: any[]) => {
    console.log("모든 파일 업로드 완료:", files);
    // 여기서 성공 페이지로 이동하거나 알림을 표시할 수 있습니다
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button
              onClick={() => router.push("/documents")}
              variant="outline"
              size="sm"
              className="flex items-center space-x-2"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>문서 목록으로</span>
            </Button>
            <div>
              <div className="flex items-center space-x-3">
                <h1 className="text-display-md font-bold text-gray-900">
                  문서 업로드
                </h1>
              </div>
              <p className="text-gray-600 mt-2">
                드래그앤드롭, 청크 업로드, 일시정지/재개가 지원되는 문서 업로드
              </p>
            </div>
          </div>

          {/* 업로드 통계 */}
          <div className="flex items-center space-x-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-success-600">
                {uploadStats.completed}
              </div>
              <div className="text-xs text-gray-500">완료</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-error-600">
                {uploadStats.failed}
              </div>
              <div className="text-xs text-gray-500">실패</div>
            </div>
          </div>
        </div>

        {/* 기능 소개 */}
        <Card className="border-figure-500 bg-figure-50">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Upload className="h-5 w-5 text-figure-600" />
              <span className="text-figure-700">문서 업로드 기능</span>
            </CardTitle>
            <CardDescription className="text-figure-600">
              향상된 사용자 경험을 위한 문서 업로드 기능들을 제공합니다
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="flex items-center space-x-3 p-3 bg-white rounded-lg border border-figure-200">
                <div className="w-8 h-8 rounded-full bg-success-100 flex items-center justify-center">
                  <CheckCircle2 className="h-4 w-4 text-success-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">드래그앤드롭</p>
                  <p className="text-xs text-gray-500">직관적인 파일 업로드</p>
                </div>
              </div>

              <div className="flex items-center space-x-3 p-3 bg-white rounded-lg border border-figure-200">
                <div className="w-8 h-8 rounded-full bg-figure-100 flex items-center justify-center">
                  <Upload className="h-4 w-4 text-figure-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">청크 업로드</p>
                  <p className="text-xs text-gray-500">대용량 파일 안정성</p>
                </div>
              </div>

              <div className="flex items-center space-x-3 p-3 bg-white rounded-lg border border-figure-200">
                <div className="w-8 h-8 rounded-full bg-warning-100 flex items-center justify-center">
                  <AlertTriangle className="h-4 w-4 text-warning-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">일시정지/재개</p>
                  <p className="text-xs text-gray-500">업로드 제어 가능</p>
                </div>
              </div>

              <div className="flex items-center space-x-3 p-3 bg-white rounded-lg border border-figure-200">
                <div className="w-8 h-8 rounded-full bg-info-100 flex items-center justify-center">
                  <Info className="h-4 w-4 text-info-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">업로드 진행률</p>
                  <p className="text-xs text-gray-500">상세한 진행 상황</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 문서 업로드 컴포넌트 */}
        <SimplifiedAdvancedUpload
          maxFiles={10}
          maxSize={100 * 1024 * 1024} // 100MB
          autoUpload={false}
          showPreview={true}
          onUploadComplete={handleUploadComplete}
          onUploadError={handleUploadError}
          onAllComplete={handleAllComplete}
        />

        {/* 사용 가이드 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>📖 사용 가이드</CardTitle>
              <CardDescription>
                문서 업로드 기능을 효과적으로 사용하는 방법
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 rounded-full bg-figure-500 text-white text-xs flex items-center justify-center font-bold">
                    1
                  </div>
                  <div>
                    <h4 className="font-medium">파일 드래그앤드롭</h4>
                    <p className="text-sm text-gray-600">
                      파일을 업로드 영역으로 끌어다 놓거나 클릭하여 선택하세요
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 rounded-full bg-figure-500 text-white text-xs flex items-center justify-center font-bold">
                    2
                  </div>
                  <div>
                    <h4 className="font-medium">메타데이터 설정</h4>
                    <p className="text-sm text-gray-600">
                      사이트 ID, 태그, 설명 등을 설정하여 파일을 분류하세요
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 rounded-full bg-figure-500 text-white text-xs flex items-center justify-center font-bold">
                    3
                  </div>
                  <div>
                    <h4 className="font-medium">업로드 제어</h4>
                    <p className="text-sm text-gray-600">
                      개별 파일을 업로드하거나 전체 파일을 한번에 업로드하세요
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 rounded-full bg-figure-500 text-white text-xs flex items-center justify-center font-bold">
                    4
                  </div>
                  <div>
                    <h4 className="font-medium">진행 상황 모니터링</h4>
                    <p className="text-sm text-gray-600">
                      진행률과 업로드 상태를 확인하고 필요시 제어하세요
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>⚡ 핵심 기능</CardTitle>
              <CardDescription>
                안정적이고 편리한 문서 업로드 기능들
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <h4 className="font-medium">청크 업로드</h4>
                    <p className="text-sm text-gray-500">
                      대용량 파일을 안정적으로 업로드
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-gray-400" />
                </div>

                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <h4 className="font-medium">일시정지/재개</h4>
                    <p className="text-sm text-gray-500">
                      업로드를 제어하고 재개 가능
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-gray-400" />
                </div>

                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <h4 className="font-medium">자동 재시도</h4>
                    <p className="text-sm text-gray-500">
                      네트워크 오류시 자동 재시도
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-gray-400" />
                </div>

                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <h4 className="font-medium">파일 미리보기</h4>
                    <p className="text-sm text-gray-500">
                      이미지 파일 미리보기 지원
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-gray-400" />
                </div>

                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <h4 className="font-medium">상세 진행률</h4>
                    <p className="text-sm text-gray-500">
                      청크별 업로드 진행 상황
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-gray-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 기술 정보 */}
        <Card>
          <CardHeader>
            <CardTitle>🔧 기술 정보</CardTitle>
            <CardDescription>문서 업로드 시스템의 기술적 특징</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center p-4 bg-figure-50 rounded-lg">
                <div className="text-2xl font-bold text-figure-600 mb-2">
                  2MB
                </div>
                <p className="text-sm font-medium text-gray-900">청크 크기</p>
                <p className="text-xs text-gray-500">최적화된 업로드 성능</p>
              </div>

              <div className="text-center p-4 bg-success-50 rounded-lg">
                <div className="text-2xl font-bold text-success-600 mb-2">
                  100MB
                </div>
                <p className="text-sm font-medium text-gray-900">
                  최대 파일 크기
                </p>
                <p className="text-xs text-gray-500">대용량 파일 지원</p>
              </div>

              <div className="text-center p-4 bg-warning-50 rounded-lg">
                <div className="text-2xl font-bold text-warning-600 mb-2">
                  3회
                </div>
                <p className="text-sm font-medium text-gray-900">자동 재시도</p>
                <p className="text-xs text-gray-500">안정적인 업로드 보장</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
