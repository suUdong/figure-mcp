"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  Activity,
  Cpu,
  MemoryStick,
  HardDrive,
  Wifi,
  WifiOff,
  TrendingUp,
  TrendingDown,
  Maximize2,
  Minimize2,
  RefreshCw,
  Pause,
  Play,
  Download,
  Settings,
  BarChart3,
  PieChart as PieChartIcon,
  LineChart as LineChartIcon,
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

type ChartViewMode = 'split' | 'combined' | 'overview';
type ChartType = 'line' | 'area' | 'bar';

// 반응형 차트 높이 계산 훅
const useResponsiveChartHeight = () => {
  const [dimensions, setDimensions] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 1200,
    height: typeof window !== 'undefined' ? window.innerHeight : 800,
  });

  useEffect(() => {
    const handleResize = () => {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 반응형 차트 높이 계산
  const getChartHeight = (viewMode: ChartViewMode) => {
    const { width, height } = dimensions;
    
    if (width < 640) { // Mobile
      return viewMode === 'combined' ? 250 : 220;
    } else if (width < 1024) { // Tablet
      return viewMode === 'combined' ? 320 : 280;
    } else { // Desktop
      return viewMode === 'combined' ? 400 : 350;
    }
  };

  return { dimensions, getChartHeight };
};

export default function RealTimeCharts({ className }: RealTimeChartsProps) {
  const [metricsHistory, setMetricsHistory] = useState<MetricData[]>([]);
  const [currentMetrics, setCurrentMetrics] = useState<MetricData | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [viewMode, setViewMode] = useState<ChartViewMode>('split');
  const [chartType, setChartType] = useState<ChartType>('line');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const maxDataPoints = 50;

  const { dimensions, getChartHeight } = useResponsiveChartHeight();

  // WebSocket 연결
  const wsUrl = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8001/admin/ws";
  const { isConnected, lastMessage, error } = useWebSocket(wsUrl);

  // WebSocket 메시지 처리
  useEffect(() => {
    if (isPaused) return; // 일시정지 상태에서는 업데이트 중지
    
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
        return updated.slice(-maxDataPoints);
      });
    }
  }, [lastMessage, isPaused]);

  // 차트 색상 시스템
  const chartColors = {
    cpu: "hsl(var(--figure-500))",
    memory: "hsl(var(--warning-500))",
    disk: "hsl(var(--info-500))",
    jobs: "hsl(var(--success-500))",
    gradient: {
      cpu: "url(#cpuGradient)",
      memory: "url(#memoryGradient)",
      disk: "url(#diskGradient)",
      jobs: "url(#jobsGradient)",
    }
  };

  // 그라디언트 정의 컴포넌트
  const ChartGradients = () => (
    <defs>
      <linearGradient id="cpuGradient" x1="0" y1="0" x2="0" y2="1">
        <stop offset="5%" stopColor={chartColors.cpu} stopOpacity={0.8}/>
        <stop offset="95%" stopColor={chartColors.cpu} stopOpacity={0.1}/>
      </linearGradient>
      <linearGradient id="memoryGradient" x1="0" y1="0" x2="0" y2="1">
        <stop offset="5%" stopColor={chartColors.memory} stopOpacity={0.8}/>
        <stop offset="95%" stopColor={chartColors.memory} stopOpacity={0.1}/>
      </linearGradient>
      <linearGradient id="diskGradient" x1="0" y1="0" x2="0" y2="1">
        <stop offset="5%" stopColor={chartColors.disk} stopOpacity={0.8}/>
        <stop offset="95%" stopColor={chartColors.disk} stopOpacity={0.1}/>
      </linearGradient>
      <linearGradient id="jobsGradient" x1="0" y1="0" x2="0" y2="1">
        <stop offset="5%" stopColor={chartColors.jobs} stopOpacity={0.8}/>
        <stop offset="95%" stopColor={chartColors.jobs} stopOpacity={0.1}/>
      </linearGradient>
    </defs>
  );

  // 연결 상태 표시
  const ConnectionStatus = () => (
    <div className="flex items-center gap-3">
      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all ${
        isConnected
          ? 'bg-success-50 text-success-700 border-success-200'
          : 'bg-error-50 text-error-700 border-error-200'
      }`}>
        {isConnected ? (
          <>
            <div className="relative">
              <Wifi className="h-4 w-4" />
              <div className="absolute inset-0 h-4 w-4 animate-ping">
                <Wifi className="h-4 w-4 opacity-75" />
              </div>
            </div>
            <span className="text-sm font-medium">실시간 연결</span>
          </>
        ) : (
          <>
            <WifiOff className="h-4 w-4" />
            <span className="text-sm font-medium">연결 끊김</span>
          </>
        )}
      </div>

      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsPaused(!isPaused)}
          className="h-8 px-2"
        >
          {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
        </Button>
        
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsFullscreen(!isFullscreen)}
          className="h-8 px-2"
        >
          {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );

  // 업타임 포맷팅
  const formatUptime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return `${hours}시간 ${minutes}분 ${secs}초`;
  };

  // 메트릭 변화율 계산
  const getMetricTrend = (currentValue: number, previousValue: number) => {
    if (!previousValue) return { trend: 'neutral', percentage: 0 };
    
    const change = ((currentValue - previousValue) / previousValue) * 100;
    const trend = change > 5 ? 'up' : change < -5 ? 'down' : 'neutral';
    
    return { trend, percentage: Math.abs(change) };
  };

  // 고도화된 메트릭 카드 컴포넌트
  const EnhancedMetricCard = ({
    title,
    value,
    unit,
    icon,
    color,
    description,
    trend,
    previousValue,
  }: {
    title: string;
    value: number | string;
    unit?: string;
    icon: React.ReactNode;
    color: string;
    description?: string;
    trend?: 'up' | 'down' | 'neutral';
    previousValue?: number;
  }) => {
    const trendInfo = typeof value === 'number' && previousValue 
      ? getMetricTrend(value, previousValue) 
      : { trend: 'neutral', percentage: 0 };

    return (
      <Card className="group relative overflow-hidden border-0 shadow-sm hover:shadow-xl transition-all duration-300 ease-out hover:-translate-y-1 bg-white backdrop-blur-sm">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-5 bg-gradient-to-br from-gray-50 to-gray-100" />
        
        {/* Top Gradient Border */}
        <div className={`absolute inset-x-0 top-0 h-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300 ${color}`} />
        
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <div className="space-y-1">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              {title}
              {isPaused && <Pause className="h-3 w-3 text-gray-400" />}
            </CardTitle>
          </div>
          <div className={`p-3 rounded-xl shadow-sm ${color}`}>
            <div className="text-white">
              {icon}
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <div className="text-3xl font-bold text-gray-900 transition-all duration-300">
              {value}{unit}
            </div>
            
            {trendInfo.percentage > 0 && (
              <div className={`flex items-center gap-1 text-sm ${
                trendInfo.trend === 'up' ? 'text-success-600' : 
                trendInfo.trend === 'down' ? 'text-error-600' : 'text-gray-500'
              }`}>
                {trendInfo.trend === 'up' ? (
                  <TrendingUp className="h-3 w-3" />
                ) : trendInfo.trend === 'down' ? (
                  <TrendingDown className="h-3 w-3" />
                ) : null}
                <span className="font-medium">
                  {trendInfo.percentage.toFixed(1)}%
                </span>
                <span className="text-gray-500">vs 이전</span>
              </div>
            )}
          </div>
          
          {description && (
            <p className="text-xs text-gray-500 leading-relaxed">
              {description}
            </p>
          )}
        </CardContent>
      </Card>
    );
  };

  // 커스텀 툴팁 컴포넌트
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-4 border border-gray-200 rounded-xl shadow-lg">
          <p className="text-sm font-medium text-gray-900 mb-2">{`시간: ${label}`}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center gap-2 text-sm">
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-gray-600">{entry.name}:</span>
              <span className="font-semibold text-gray-900">
                {entry.value}{entry.name.includes('CPU') || entry.name.includes('메모리') || entry.name.includes('디스크') ? '%' : '개'}
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  // 커스텀 범례 컴포넌트
  const CustomLegend = ({ payload }: any) => (
    <div className="flex flex-wrap justify-center gap-4 mt-4 p-3 bg-gray-50 rounded-lg border">
      {payload?.map((entry: any, index: number) => (
        <div key={index} className="flex items-center gap-2 text-sm">
          <div 
            className="w-4 h-4 rounded-full border-2 border-white shadow-sm" 
            style={{ backgroundColor: entry.color }}
          />
          <span className="font-medium text-gray-700">{entry.value}</span>
        </div>
      ))}
    </div>
  );

  // 통합 차트 컴포넌트
  const CombinedChart = () => (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-lg">
              <BarChart3 className="h-5 w-5 text-figure-500" />
              <span>통합 시스템 모니터링</span>
            </CardTitle>
            <CardDescription>
              실시간 시스템 리소스 및 작업 상태 통합 뷰
              {isPaused && (
                <Badge variant="secondary" className="ml-2 text-xs">
                  <Pause className="h-3 w-3 mr-1" />
                  일시정지
                </Badge>
              )}
            </CardDescription>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="flex items-center border border-gray-200 rounded-lg p-1">
              <Button
                variant={chartType === 'line' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setChartType('line')}
                className="h-8 px-2"
              >
                <LineChartIcon className="h-4 w-4" />
              </Button>
              <Button
                variant={chartType === 'area' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setChartType('area')}
                className="h-8 px-2"
              >
                <BarChart3 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <ResponsiveContainer width="100%" height={getChartHeight('combined')}>
          {chartType === 'line' ? (
            <LineChart data={metricsHistory} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
              <ChartGradients />
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis 
                dataKey="timestamp" 
                tick={{ fontSize: 11, fill: '#6b7280' }}
                axisLine={{ stroke: '#e5e7eb' }}
                tickLine={{ stroke: '#e5e7eb' }}
                interval="preserveStartEnd"
              />
              <YAxis 
                domain={[0, 100]}
                tick={{ fontSize: 11, fill: '#6b7280' }}
                axisLine={{ stroke: '#e5e7eb' }}
                tickLine={{ stroke: '#e5e7eb' }}
                label={{
                  value: "사용률 (%)",
                  angle: -90,
                  position: "insideLeft",
                  style: { textAnchor: 'middle', fontSize: '12px', fill: '#6b7280' }
                }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend content={<CustomLegend />} />
              <Line
                type="monotone"
                dataKey="cpu_usage"
                stroke={chartColors.cpu}
                strokeWidth={3}
                name="CPU"
                dot={{ r: 4 }}
                activeDot={{ r: 6, stroke: chartColors.cpu, strokeWidth: 2 }}
                animationDuration={300}
              />
              <Line
                type="monotone"
                dataKey="memory_usage"
                stroke={chartColors.memory}
                strokeWidth={3}
                name="메모리"
                dot={{ r: 4 }}
                activeDot={{ r: 6, stroke: chartColors.memory, strokeWidth: 2 }}
                animationDuration={300}
              />
              <Line
                type="monotone"
                dataKey="disk_usage"
                stroke={chartColors.disk}
                strokeWidth={3}
                name="디스크"
                dot={{ r: 4 }}
                activeDot={{ r: 6, stroke: chartColors.disk, strokeWidth: 2 }}
                animationDuration={300}
              />
            </LineChart>
          ) : (
            <AreaChart data={metricsHistory} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
              <ChartGradients />
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis 
                dataKey="timestamp" 
                tick={{ fontSize: 11, fill: '#6b7280' }}
                axisLine={{ stroke: '#e5e7eb' }}
                tickLine={{ stroke: '#e5e7eb' }}
                interval="preserveStartEnd"
              />
              <YAxis 
                domain={[0, 100]}
                tick={{ fontSize: 11, fill: '#6b7280' }}
                axisLine={{ stroke: '#e5e7eb' }}
                tickLine={{ stroke: '#e5e7eb' }}
                label={{
                  value: "사용률 (%)",
                  angle: -90,
                  position: "insideLeft",
                  style: { textAnchor: 'middle', fontSize: '12px', fill: '#6b7280' }
                }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend content={<CustomLegend />} />
              <Area
                type="monotone"
                dataKey="cpu_usage"
                stackId="1"
                stroke={chartColors.cpu}
                fill={chartColors.gradient.cpu}
                strokeWidth={2}
                name="CPU"
                animationDuration={300}
              />
              <Area
                type="monotone"
                dataKey="memory_usage"
                stackId="2"
                stroke={chartColors.memory}
                fill={chartColors.gradient.memory}
                strokeWidth={2}
                name="메모리"
                animationDuration={300}
              />
              <Area
                type="monotone"
                dataKey="disk_usage"
                stackId="3"
                stroke={chartColors.disk}
                fill={chartColors.gradient.disk}
                strokeWidth={2}
                name="디스크"
                animationDuration={300}
              />
            </AreaChart>
          )}
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );

  // 분할 차트 컴포넌트들
  const SplitCharts = () => (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      {/* CPU & 메모리 차트 */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-figure-500" />
            <span>CPU & 메모리 사용률</span>
          </CardTitle>
          <CardDescription>프로세서 및 메모리 실시간 사용량</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={getChartHeight('split')}>
            <LineChart data={metricsHistory} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
              <ChartGradients />
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="timestamp"
                tick={{ fontSize: 11, fill: '#6b7280' }}
                axisLine={{ stroke: '#e5e7eb' }}
                tickLine={{ stroke: '#e5e7eb' }}
                interval="preserveStartEnd"
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 11, fill: '#6b7280' }}
                axisLine={{ stroke: '#e5e7eb' }}
                tickLine={{ stroke: '#e5e7eb' }}
                label={{
                  value: "사용률 (%)",
                  angle: -90,
                  position: "insideLeft",
                  style: { textAnchor: 'middle', fontSize: '12px', fill: '#6b7280' }
                }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend content={<CustomLegend />} />
              <Line
                type="monotone"
                dataKey="cpu_usage"
                stroke={chartColors.cpu}
                strokeWidth={3}
                name="CPU"
                dot={{ r: 4 }}
                activeDot={{ r: 6, stroke: chartColors.cpu, strokeWidth: 2 }}
                animationDuration={300}
              />
              <Line
                type="monotone"
                dataKey="memory_usage"
                stroke={chartColors.memory}
                strokeWidth={3}
                name="메모리"
                dot={{ r: 4 }}
                activeDot={{ r: 6, stroke: chartColors.memory, strokeWidth: 2 }}
                animationDuration={300}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* 디스크 & 활성 작업 차트 */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2">
            <HardDrive className="h-5 w-5 text-info-500" />
            <span>디스크 & 활성 작업</span>
          </CardTitle>
          <CardDescription>저장공간 사용률과 실행 중인 작업 수</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={getChartHeight('split')}>
            <AreaChart data={metricsHistory} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
              <ChartGradients />
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="timestamp"
                tick={{ fontSize: 11, fill: '#6b7280' }}
                axisLine={{ stroke: '#e5e7eb' }}
                tickLine={{ stroke: '#e5e7eb' }}
                interval="preserveStartEnd"
              />
              <YAxis
                yAxisId="disk"
                orientation="left"
                domain={[0, 100]}
                tick={{ fontSize: 11, fill: '#6b7280' }}
                axisLine={{ stroke: '#e5e7eb' }}
                tickLine={{ stroke: '#e5e7eb' }}
                label={{
                  value: "디스크 (%)",
                  angle: -90,
                  position: "insideLeft",
                  style: { textAnchor: 'middle', fontSize: '12px', fill: '#6b7280' }
                }}
              />
              <YAxis
                yAxisId="jobs"
                orientation="right"
                tick={{ fontSize: 11, fill: '#6b7280' }}
                axisLine={{ stroke: '#e5e7eb' }}
                tickLine={{ stroke: '#e5e7eb' }}
                label={{
                  value: "작업 수",
                  angle: 90,
                  position: "insideRight",
                  style: { textAnchor: 'middle', fontSize: '12px', fill: '#6b7280' }
                }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend content={<CustomLegend />} />
              <Area
                yAxisId="disk"
                type="monotone"
                dataKey="disk_usage"
                stroke={chartColors.disk}
                fill={chartColors.gradient.disk}
                strokeWidth={2}
                name="디스크"
                animationDuration={300}
              />
              <Line
                yAxisId="jobs"
                type="monotone"
                dataKey="active_jobs"
                stroke={chartColors.jobs}
                strokeWidth={3}
                name="활성 작업"
                dot={{ r: 4 }}
                activeDot={{ r: 6, stroke: chartColors.jobs, strokeWidth: 2 }}
                animationDuration={300}
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );

  const previousMetrics = metricsHistory[metricsHistory.length - 2];

  return (
    <div className={`space-y-6 ${className} ${isFullscreen ? 'fixed inset-0 z-50 bg-white p-6 overflow-y-auto' : ''}`}>
      {/* 헤더 섹션 */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold text-gray-900 sm:text-3xl">
            실시간 시스템 모니터링
          </h2>
          <p className="text-gray-600">
            시스템 리소스 사용량과 작업 상태를 실시간으로 모니터링합니다
            {isPaused && (
              <Badge variant="secondary" className="ml-2">
                <Pause className="h-3 w-3 mr-1" />
                일시정지 중
              </Badge>
            )}
          </p>
        </div>
        <ConnectionStatus />
      </div>

      {/* 현재 메트릭 카드 */}
      {currentMetrics && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
          <EnhancedMetricCard
            title="CPU 사용률"
            value={currentMetrics.cpu_usage}
            unit="%"
            icon={<Cpu className="h-5 w-5" />}
            color="bg-gradient-to-br from-figure-500 to-figure-600"
            description="현재 프로세서 사용량"
            previousValue={previousMetrics?.cpu_usage}
          />
          <EnhancedMetricCard
            title="메모리 사용률"
            value={currentMetrics.memory_usage}
            unit="%"
            icon={<MemoryStick className="h-5 w-5" />}
            color="bg-gradient-to-br from-warning-500 to-warning-600"
            description="현재 RAM 사용량"
            previousValue={previousMetrics?.memory_usage}
          />
          <EnhancedMetricCard
            title="디스크 사용률"
            value={currentMetrics.disk_usage}
            unit="%"
            icon={<HardDrive className="h-5 w-5" />}
            color="bg-gradient-to-br from-info-500 to-info-600"
            description="저장공간 사용량"
            previousValue={previousMetrics?.disk_usage}
          />
          <EnhancedMetricCard
            title="활성 작업"
            value={currentMetrics.active_jobs}
            unit="개"
            icon={<Activity className="h-5 w-5" />}
            color="bg-gradient-to-br from-success-500 to-success-600"
            description="현재 실행 중인 작업"
            previousValue={previousMetrics?.active_jobs}
          />
        </div>
      )}

      {/* 뷰 모드 전환 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">표시 모드:</span>
          <div className="flex items-center border border-gray-200 rounded-lg p-1">
            <Button
              variant={viewMode === 'combined' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('combined')}
              className="h-8 px-3 text-xs"
            >
              통합뷰
            </Button>
            <Button
              variant={viewMode === 'split' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('split')}
              className="h-8 px-3 text-xs"
            >
              분할뷰
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">
            {metricsHistory.length}개 데이터 포인트
          </span>
          <Button variant="outline" size="sm" className="h-8 px-3">
            <Download className="h-4 w-4 mr-1" />
            <span className="text-xs">내보내기</span>
          </Button>
        </div>
      </div>

      {/* 차트 영역 */}
      {viewMode === 'combined' ? <CombinedChart /> : <SplitCharts />}

      {/* 시스템 정보 */}
      {currentMetrics && (
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-gray-500" />
              시스템 정보
            </CardTitle>
            <CardDescription>현재 시스템 상태 및 운영 정보</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="space-y-2">
                <span className="text-sm font-medium text-gray-600">시스템 업타임</span>
                <div className="text-lg font-semibold text-gray-900">
                  {formatUptime(currentMetrics.uptime_seconds)}
                </div>
                <div className="text-xs text-gray-500">연속 운영 시간</div>
              </div>
              
              <div className="space-y-2">
                <span className="text-sm font-medium text-gray-600">마지막 업데이트</span>
                <div className="text-lg font-semibold text-gray-900">
                  {currentMetrics.timestamp}
                </div>
                <div className="text-xs text-gray-500">최신 데이터 수신</div>
              </div>
              
              <div className="space-y-2">
                <span className="text-sm font-medium text-gray-600">데이터 수집</span>
                <div className="flex items-center gap-2">
                  {isPaused ? (
                    <Badge variant="secondary" className="bg-warning-50 text-warning-700 border-warning-200">
                      <Pause className="h-3 w-3 mr-1" />
                      일시정지
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="bg-success-50 text-success-700 border-success-200">
                      <Play className="h-3 w-3 mr-1" />
                      실시간
                    </Badge>
                  )}
                </div>
                <div className="text-xs text-gray-500">실시간 모니터링 상태</div>
              </div>
              
              <div className="space-y-2">
                <span className="text-sm font-medium text-gray-600">연결 품질</span>
                <div className="flex items-center gap-2">
                  {isConnected ? (
                    <Badge className="bg-success-50 text-success-700 border-success-200">
                      <Wifi className="h-3 w-3 mr-1" />
                      우수
                    </Badge>
                  ) : (
                    <Badge variant="destructive">
                      <WifiOff className="h-3 w-3 mr-1" />
                      오류
                    </Badge>
                  )}
                </div>
                <div className="text-xs text-gray-500">WebSocket 연결 상태</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 연결 오류 시 표시 */}
      {error && (
        <Card className="border-error-200 bg-error-50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <WifiOff className="h-5 w-5 text-error-600 flex-shrink-0 mt-0.5" />
              <div className="space-y-2">
                <h3 className="font-medium text-error-800">WebSocket 연결 오류</h3>
                <p className="text-sm text-error-600 leading-relaxed">{error}</p>
                <div className="flex items-center gap-2 mt-3">
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="text-error-600 border-error-200 hover:bg-error-100"
                    onClick={() => window.location.reload()}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    다시 연결
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
