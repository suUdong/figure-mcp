"use client";

import MainLayout from "@/components/layout/main-layout";
import RealTimeCharts from "@/components/dashboard/real-time-charts";
import RealTimeJobs from "@/components/dashboard/real-time-jobs";
import MetricsCards from "@/components/dashboard/metrics-cards";
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
  BarChart3,
  Activity,
  Settings,
  RefreshCw,
  Monitor,
  Zap,
  TrendingUp,
  AlertTriangle,
} from "lucide-react";
import { useState } from "react";

export default function RealTimeDashboardPage() {
  const [isAutoRefresh, setIsAutoRefresh] = useState(true);

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-display-lg font-bold text-gray-900">
              실시간 모니터링 대시보드
            </h1>
            <p className="text-text-lg text-gray-600 mt-2">
              시스템 상태와 작업 진행 상황을 실시간으로 모니터링합니다.
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <Badge
              className={`${
                isAutoRefresh ? "bg-success-500" : "bg-gray-500"
              } text-white`}
            >
              <Zap className="h-3 w-3 mr-1" />
              {isAutoRefresh ? "실시간 활성" : "수동 모드"}
            </Badge>

            <Button
              variant="outline"
              onClick={() => setIsAutoRefresh(!isAutoRefresh)}
              className="flex items-center space-x-2"
            >
              <RefreshCw className="h-4 w-4" />
              <span>{isAutoRefresh ? "수동 모드" : "실시간 모드"}</span>
            </Button>

            <Button variant="outline" className="flex items-center space-x-2">
              <Settings className="h-4 w-4" />
              <span>설정</span>
            </Button>
          </div>
        </div>

        {/* 경고 및 알림 */}
        <Card className="border-info-500 bg-info-50">
          <CardContent className="pt-6">
            <div className="flex items-start space-x-3">
              <Monitor className="h-6 w-6 text-info-500 mt-0.5" />
              <div>
                <h3 className="font-semibold text-info-700">
                  실시간 모니터링 활성
                </h3>
                <p className="text-sm text-info-600 mt-1">
                  WebSocket을 통해 시스템 메트릭과 작업 상태를 실시간으로
                  업데이트합니다. 연결이 끊어지면 자동으로 재연결을 시도합니다.
                </p>
                <div className="flex items-center space-x-4 mt-3 text-xs text-info-600">
                  <div className="flex items-center space-x-1">
                    <TrendingUp className="h-3 w-3" />
                    <span>5초마다 업데이트</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <BarChart3 className="h-3 w-3" />
                    <span>최근 50개 데이터 포인트</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Activity className="h-3 w-3" />
                    <span>실시간 작업 추적</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 기존 메트릭 카드 (WebSocket 연동) */}
        <MetricsCards />

        {/* 실시간 차트 */}
        <RealTimeCharts />

        {/* 실시간 작업 목록 */}
        <RealTimeJobs />

        {/* 추가 정보 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <BarChart3 className="h-5 w-5" />
                <span>성능 지표</span>
              </CardTitle>
              <CardDescription>시스템 성능에 대한 주요 지표들</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium">평균 응답 시간</p>
                    <p className="text-sm text-gray-500">API 요청 처리 속도</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-success-600">
                      &lt; 200ms
                    </p>
                    <p className="text-xs text-gray-500">양호</p>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium">처리량</p>
                    <p className="text-sm text-gray-500">분당 처리 요청 수</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-info-600">
                      ~45 req/min
                    </p>
                    <p className="text-xs text-gray-500">안정적</p>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium">오류율</p>
                    <p className="text-sm text-gray-500">실패한 요청 비율</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-success-600">
                      &lt; 1%
                    </p>
                    <p className="text-xs text-gray-500">우수</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <AlertTriangle className="h-5 w-5" />
                <span>시스템 알림</span>
              </CardTitle>
              <CardDescription>중요한 시스템 이벤트 및 알림</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-start space-x-3 p-3 bg-success-50 border border-success-200 rounded-lg">
                  <div className="w-2 h-2 bg-success-500 rounded-full mt-2"></div>
                  <div className="flex-1">
                    <p className="font-medium text-success-700">
                      시스템 정상 운영
                    </p>
                    <p className="text-sm text-success-600">
                      모든 서비스가 정상적으로 작동 중입니다.
                    </p>
                    <p className="text-xs text-success-500 mt-1">5분 전</p>
                  </div>
                </div>

                <div className="flex items-start space-x-3 p-3 bg-info-50 border border-info-200 rounded-lg">
                  <div className="w-2 h-2 bg-info-500 rounded-full mt-2"></div>
                  <div className="flex-1">
                    <p className="font-medium text-info-700">
                      WebSocket 연결 활성
                    </p>
                    <p className="text-sm text-info-600">
                      실시간 데이터 스트림이 활성화되었습니다.
                    </p>
                    <p className="text-xs text-info-500 mt-1">10분 전</p>
                  </div>
                </div>

                <div className="flex items-start space-x-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                  <div className="w-2 h-2 bg-gray-500 rounded-full mt-2"></div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-700">
                      대시보드 로딩 완료
                    </p>
                    <p className="text-sm text-gray-600">
                      실시간 모니터링 대시보드가 초기화되었습니다.
                    </p>
                    <p className="text-xs text-gray-500 mt-1">방금 전</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}
