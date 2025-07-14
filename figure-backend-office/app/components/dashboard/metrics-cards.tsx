'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useSystemMetrics, useSystemHealth } from '@/hooks/use-admin-stats';
import { useWebSocket } from '@/hooks/use-websocket';
import { Activity, Database, FileText, Users, Loader2, AlertTriangle, Wifi } from 'lucide-react';
import { useEffect } from 'react';

export default function MetricsCards() {
  const { data: metrics, isLoading: metricsLoading, error: metricsError } = useSystemMetrics();
  const { data: health, isLoading: healthLoading } = useSystemHealth();
  
  // WebSocket으로 실시간 업데이트
  const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8001/admin/ws';
  const { isConnected, lastMessage } = useWebSocket(wsUrl);

  // WebSocket으로부터 받은 실시간 데이터가 있으면 우선 사용
  const realTimeMetrics = lastMessage?.metrics || metrics;

  if (metricsLoading || healthLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">로딩 중...</CardTitle>
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">--</div>
              <p className="text-xs text-muted-foreground">데이터 로드 중</p>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (metricsError) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="border-destructive">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">연결 오류</CardTitle>
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">오류</div>
              <p className="text-xs text-muted-foreground">
                백엔드 서버에 연결할 수 없습니다
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const isSystemHealthy = health?.success && health?.data?.status === 'healthy';

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
      <Card className="relative">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">활성 작업</CardTitle>
          <div className="flex items-center space-x-1">
            {isConnected && (
              <Wifi className="h-3 w-3 text-green-500" />
            )}
            <Activity className="h-4 w-4 text-muted-foreground" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{realTimeMetrics?.active_jobs || 0}</div>
          <p className="text-xs text-muted-foreground">
            {isConnected ? '실시간 업데이트' : '현재 처리 중인 작업'}
          </p>
        </CardContent>
      </Card>

      <Card className="relative">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">총 문서</CardTitle>
          <div className="flex items-center space-x-1">
            {isConnected && (
              <Wifi className="h-3 w-3 text-green-500" />
            )}
            <FileText className="h-4 w-4 text-muted-foreground" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{realTimeMetrics?.total_documents || 0}</div>
          <p className="text-xs text-muted-foreground">
            벡터 DB에 저장된 문서
          </p>
        </CardContent>
      </Card>

      <Card className="relative">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">등록된 사이트</CardTitle>
          <div className="flex items-center space-x-1">
            {isConnected && (
              <Wifi className="h-3 w-3 text-green-500" />
            )}
            <Database className="h-4 w-4 text-muted-foreground" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{realTimeMetrics?.total_sites || 0}</div>
          <p className="text-xs text-muted-foreground">
            활성 사이트 수
          </p>
        </CardContent>
      </Card>

      <Card className="relative">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">시스템 상태</CardTitle>
          <div className="flex items-center space-x-1">
            {isConnected && (
              <Wifi className="h-3 w-3 text-green-500" />
            )}
            <Users className="h-4 w-4 text-muted-foreground" />
          </div>
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${
            isSystemHealthy ? 'text-green-600' : 'text-red-600'
          }`}>
            {isSystemHealthy ? '정상' : '오류'}
          </div>
          <p className="text-xs text-muted-foreground">
            {isSystemHealthy ? 'All systems operational' : 'System issues detected'}
          </p>
        </CardContent>
      </Card>
    </div>
  );
} 