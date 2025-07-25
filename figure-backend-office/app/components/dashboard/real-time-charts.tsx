"use client";

import { useState, useEffect, useRef } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useWebSocket } from "@/hooks/use-websocket";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";
import {
  Activity,
  Cpu,
  MemoryStick,
  HardDrive,
  Wifi,
  WifiOff,
} from "lucide-react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";

interface MetricData {
  timestamp: string;
  cpu_usage: number;
  memory_usage: number;
  disk_usage: number;
  active_jobs: number;
  uptime_seconds: number;
}

interface RealTimeChartsProps {
  className?: string;
}

export default function RealTimeCharts({ className }: RealTimeChartsProps) {
  const [metricsHistory, setMetricsHistory] = useState<MetricData[]>([]);
  const [currentMetrics, setCurrentMetrics] = useState<MetricData | null>(null);
  const maxDataPoints = 50; // 최근 50개 데이터 포인트만 유지

  // WebSocket 연결
  const wsUrl =
    process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8001/admin/ws";
  const { isConnected, lastMessage, error } = useWebSocket(wsUrl);

  // WebSocket 메시지 처리
  useEffect(() => {
    if (lastMessage?.type === "metrics_update" && lastMessage.metrics) {
      const metrics = lastMessage.metrics;
      const newDataPoint: MetricData = {
        timestamp: format(new Date(), "HH:mm:ss", { locale: ko }),
        cpu_usage: Math.round(metrics.cpu_usage || 0),
        memory_usage: Math.round(metrics.memory_usage || 0),
        disk_usage: Math.round(metrics.disk_usage || 0),
        active_jobs: metrics.active_jobs || 0,
        uptime_seconds: metrics.uptime_seconds || 0,
      };

      setCurrentMetrics(newDataPoint);

      setMetricsHistory((prev) => {
        const updated = [...prev, newDataPoint];
        return updated.slice(-maxDataPoints); // 최근 데이터만 유지
      });
    }
  }, [lastMessage]);

  // 연결 상태 표시
  const ConnectionStatus = () => (
    <div className="flex items-center space-x-2">
      {isConnected ? (
        <>
          <Wifi className="h-4 w-4 text-success-500" />
          <Badge className="bg-success-500 text-success-foreground">
            실시간 연결
          </Badge>
        </>
      ) : (
        <>
          <WifiOff className="h-4 w-4 text-error-500" />
          <Badge className="bg-error-500 text-error-foreground">
            연결 끊김
          </Badge>
        </>
      )}
    </div>
  );

  // 업타임 포맷팅
  const formatUptime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return `${hours}시간 ${minutes}분 ${secs}초`;
  };

  // 메트릭 카드 컴포넌트
  const MetricCard = ({
    title,
    value,
    unit,
    icon,
    color,
    description,
  }: {
    title: string;
    value: number | string;
    unit?: string;
    icon: React.ReactNode;
    color: string;
    description?: string;
  }) => (
    <Card className="bg-gradient-card">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className={`p-2 rounded-lg ${color}`}>{icon}</div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">
          {value}
          {unit}
        </div>
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className={`space-y-6 ${className}`}>
      {/* 연결 상태 및 현재 메트릭 */}
      <div className="flex items-center justify-between">
        <h2 className="text-display-sm font-bold">실시간 시스템 모니터링</h2>
        <ConnectionStatus />
      </div>

      {/* 현재 메트릭 카드 */}
      {currentMetrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="CPU 사용률"
            value={currentMetrics.cpu_usage}
            unit="%"
            icon={<Cpu className="h-4 w-4 text-white" />}
            color="bg-figure-500"
            description="현재 프로세서 사용량"
          />
          <MetricCard
            title="메모리 사용률"
            value={currentMetrics.memory_usage}
            unit="%"
            icon={<MemoryStick className="h-4 w-4 text-white" />}
            color="bg-warning-500"
            description="현재 RAM 사용량"
          />
          <MetricCard
            title="디스크 사용률"
            value={currentMetrics.disk_usage}
            unit="%"
            icon={<HardDrive className="h-4 w-4 text-white" />}
            color="bg-info-500"
            description="저장공간 사용량"
          />
          <MetricCard
            title="활성 작업"
            value={currentMetrics.active_jobs}
            unit="개"
            icon={<Activity className="h-4 w-4 text-white" />}
            color="bg-success-500"
            description="현재 실행 중인 작업"
          />
        </div>
      )}

      {/* 실시간 리소스 사용량 차트 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Activity className="h-5 w-5" />
              <span>CPU & 메모리 사용률</span>
            </CardTitle>
            <CardDescription>실시간 시스템 리소스 사용량 추이</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={metricsHistory}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="timestamp"
                  tick={{ fontSize: 12 }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 12 }}
                  label={{
                    value: "사용률 (%)",
                    angle: -90,
                    position: "insideLeft",
                  }}
                />
                <Tooltip
                  labelFormatter={(value) => `시간: ${value}`}
                  formatter={(value: number, name: string) => [
                    `${value}%`,
                    name === "cpu_usage" ? "CPU" : "메모리",
                  ]}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="cpu_usage"
                  stroke="hsl(var(--figure-500))"
                  strokeWidth={2}
                  name="CPU"
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
                <Line
                  type="monotone"
                  dataKey="memory_usage"
                  stroke="hsl(var(--warning-500))"
                  strokeWidth={2}
                  name="메모리"
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <HardDrive className="h-5 w-5" />
              <span>디스크 & 활성 작업</span>
            </CardTitle>
            <CardDescription>디스크 사용률과 활성 작업 수 추이</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={metricsHistory}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="timestamp"
                  tick={{ fontSize: 12 }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  yAxisId="disk"
                  orientation="left"
                  domain={[0, 100]}
                  tick={{ fontSize: 12 }}
                  label={{
                    value: "디스크 (%)",
                    angle: -90,
                    position: "insideLeft",
                  }}
                />
                <YAxis
                  yAxisId="jobs"
                  orientation="right"
                  tick={{ fontSize: 12 }}
                  label={{
                    value: "작업 수",
                    angle: 90,
                    position: "insideRight",
                  }}
                />
                <Tooltip
                  labelFormatter={(value) => `시간: ${value}`}
                  formatter={(value: number, name: string) => {
                    if (name === "disk_usage") return [`${value}%`, "디스크"];
                    if (name === "active_jobs")
                      return [`${value}개`, "활성 작업"];
                    return [value, name];
                  }}
                />
                <Legend />
                <Area
                  yAxisId="disk"
                  type="monotone"
                  dataKey="disk_usage"
                  stackId="1"
                  stroke="hsl(var(--info-500))"
                  fill="hsl(var(--info-500))"
                  fillOpacity={0.3}
                  name="디스크"
                />
                <Line
                  yAxisId="jobs"
                  type="monotone"
                  dataKey="active_jobs"
                  stroke="hsl(var(--success-500))"
                  strokeWidth={3}
                  name="활성 작업"
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* 시스템 정보 */}
      {currentMetrics && (
        <Card>
          <CardHeader>
            <CardTitle>시스템 정보</CardTitle>
            <CardDescription>현재 시스템 상태 및 운영 정보</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex flex-col space-y-2">
                <span className="text-sm font-medium text-gray-600">
                  시스템 업타임
                </span>
                <span className="text-lg font-semibold">
                  {formatUptime(currentMetrics.uptime_seconds)}
                </span>
              </div>
              <div className="flex flex-col space-y-2">
                <span className="text-sm font-medium text-gray-600">
                  마지막 업데이트
                </span>
                <span className="text-lg font-semibold">
                  {currentMetrics.timestamp}
                </span>
              </div>
              <div className="flex flex-col space-y-2">
                <span className="text-sm font-medium text-gray-600">
                  연결 상태
                </span>
                <div className="flex items-center space-x-2">
                  {isConnected ? (
                    <Badge className="bg-success-500 text-success-foreground">
                      정상 연결
                    </Badge>
                  ) : (
                    <Badge className="bg-error-500 text-error-foreground">
                      연결 오류
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 연결 오류 시 표시 */}
      {error && (
        <Card className="border-error-500 bg-error-50">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2 text-error-600">
              <WifiOff className="h-5 w-5" />
              <span className="font-medium">WebSocket 연결 오류</span>
            </div>
            <p className="text-sm text-error-600 mt-2">{error}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
