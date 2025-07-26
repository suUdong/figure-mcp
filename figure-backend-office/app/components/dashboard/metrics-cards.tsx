'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useSystemMetrics, useSystemHealth } from '@/hooks/use-admin-stats';
import { useWebSocket } from '@/hooks/use-websocket';
import { 
  Activity, 
  Database, 
  FileText, 
  Users, 
  Loader2, 
  AlertTriangle, 
  Wifi,
  TrendingUp,
  TrendingDown,
  Clock,
  Server
} from 'lucide-react';
import { useEffect, useState } from 'react';

interface MetricCardProps {
  title: string;
  value: string | number;
  change?: {
    value: number;
    trend: 'up' | 'down' | 'neutral';
    timeframe: string;
  };
  icon: React.ReactNode;
  gradient: string;
  status: 'healthy' | 'warning' | 'error' | 'loading';
  description?: string;
  isRealTime?: boolean;
}

function MetricCard({ 
  title, 
  value, 
  change, 
  icon, 
  gradient, 
  status, 
  description,
  isRealTime = false 
}: MetricCardProps) {
  const [isAnimating, setIsAnimating] = useState(false);
  const [previousValue, setPreviousValue] = useState(value);

  useEffect(() => {
    if (isRealTime && value !== previousValue) {
      setIsAnimating(true);
      const timer = setTimeout(() => setIsAnimating(false), 600);
      return () => clearTimeout(timer);
    }
    setPreviousValue(value);
  }, [value, isRealTime, previousValue]);

  const getTrendIcon = () => {
    if (!change) return null;
    
    switch (change.trend) {
      case 'up':
        return <TrendingUp className="h-3 w-3 text-success-600" aria-hidden="true" />;
      case 'down':
        return <TrendingDown className="h-3 w-3 text-error-600" aria-hidden="true" />;
      default:
        return <div className="h-3 w-3 rounded-full bg-gray-400" aria-hidden="true" />;
    }
  };

  const getTrendColor = () => {
    if (!change) return 'text-gray-500';
    
    switch (change.trend) {
      case 'up':
        return 'text-success-600';
      case 'down':
        return 'text-error-600';
      default:
        return 'text-gray-500';
    }
  };

  const getStatusIndicator = () => {
    switch (status) {
      case 'healthy':
        return <div className="w-2 h-2 rounded-full bg-success-500 animate-pulse" aria-hidden="true" />;
      case 'warning':
        return <div className="w-2 h-2 rounded-full bg-warning-500 animate-pulse" aria-hidden="true" />;
      case 'error':
        return <div className="w-2 h-2 rounded-full bg-error-500 animate-pulse" aria-hidden="true" />;
      case 'loading':
        return <Loader2 className="w-3 h-3 animate-spin text-gray-400" aria-hidden="true" />;
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'healthy':
        return '정상';
      case 'warning':
        return '주의';
      case 'error':
        return '오류';
      case 'loading':
        return '로딩 중';
    }
  };

  const getTrendDescription = () => {
    if (!change) return '';
    
    const trendText = change.trend === 'up' ? '증가' : change.trend === 'down' ? '감소' : '변화 없음';
    return `${change.timeframe} 대비 ${Math.abs(change.value)}% ${trendText}`;
  };

  const cardId = `metric-${title.replace(/\s+/g, '-').toLowerCase()}`;

  return (
    <Card 
      className={`
        group relative overflow-hidden border-0 shadow-sm hover:shadow-xl
        transition-all duration-300 ease-out hover:-translate-y-1
        bg-white backdrop-blur-sm focus-within:ring-2 focus-within:ring-figure-500 focus-within:ring-offset-2
        ${isAnimating ? 'scale-105 shadow-lg' : ''}
      `}
      role="article"
      aria-labelledby={`${cardId}-title`}
      aria-describedby={`${cardId}-description`}
      tabIndex={0}
    >
      {/* Background Gradient */}
      <div className={`absolute inset-0 opacity-5 ${gradient}`} />
      
      {/* Gradient Border Effect */}
      <div className={`absolute inset-x-0 top-0 h-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300 ${gradient}`} />
      
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <div className="space-y-1">
          <CardTitle 
            id={`${cardId}-title`}
            className="text-sm font-medium text-gray-600 flex items-center gap-2"
          >
            {title}
            {getStatusIndicator()}
            <span className="sr-only">{getStatusText()}</span>
            {isRealTime && (
              <div 
                className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-figure-50 border border-figure-200"
                role="status"
                aria-label="실시간 데이터"
              >
                <Wifi className="w-2.5 h-2.5 text-figure-600" aria-hidden="true" />
                <span className="text-xs font-medium text-figure-700">Live</span>
              </div>
            )}
          </CardTitle>
        </div>
        
        <div 
          className={`p-3 rounded-xl ${gradient} shadow-sm`}
          role="img"
          aria-label={`${title} 아이콘`}
        >
          <div className="text-white">
            {icon}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-3">
        <div className="space-y-1">
          <div 
            className={`text-3xl font-bold text-gray-900 transition-all duration-300 ${
              isAnimating ? 'scale-110' : ''
            }`}
            role="status"
            aria-live={isRealTime ? "polite" : "off"}
            aria-label={`${title} 값: ${value}`}
          >
            {status === 'loading' ? (
              <div className="flex items-center gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-gray-400" aria-hidden="true" />
                <span className="text-lg text-gray-400">로딩 중</span>
              </div>
            ) : (
              <span aria-label={`현재 값 ${value}`}>{value}</span>
            )}
          </div>
          
          {change && status !== 'loading' && (
            <div 
              className={`flex items-center gap-1 text-sm ${getTrendColor()}`}
              role="status"
              aria-label={getTrendDescription()}
            >
              {getTrendIcon()}
              <span className="font-medium">
                {change.value > 0 ? '+' : ''}{change.value}%
              </span>
              <span className="text-gray-500">vs {change.timeframe}</span>
            </div>
          )}
        </div>
        
        {description && (
          <p 
            id={`${cardId}-description`}
            className="text-xs text-gray-500 leading-relaxed"
          >
            {description}
          </p>
        )}

        {/* Additional accessibility information */}
        <div className="sr-only">
          {isRealTime && `이 데이터는 실시간으로 업데이트됩니다. `}
          {change && getTrendDescription()}
          {description && `. ${description}`}
        </div>
      </CardContent>
    </Card>
  );
}

export default function MetricsCards() {
  const { data: metricsData, error: metricsError, isLoading: metricsLoading } = useSystemMetrics();
  const { data: healthData, error: healthError, isLoading: healthLoading } = useSystemHealth();
  
  const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8001/admin/ws';
  const { lastMessage, isConnected, error: wsError } = useWebSocket(wsUrl);

  // WebSocket으로부터 받은 실시간 데이터 추출
  const realTimeMetrics = lastMessage?.metrics || {};

  const isSystemHealthy = !healthError && !healthLoading && healthData?.status === 'healthy';

  const getMetricStatus = (hasError: boolean, isLoading: boolean, isConnected: boolean): 'healthy' | 'warning' | 'error' | 'loading' => {
    if (isLoading) return 'loading';
    if (hasError || !isConnected) return 'error';
    return 'healthy';
  };

  const metricsCardsData = [
    {
      title: '활성 작업',
      value: realTimeMetrics?.active_jobs?.toLocaleString() || '--',
      change: {
        value: 12.5,
        trend: 'up' as const,
        timeframe: '지난 시간'
      },
      icon: <Activity className="h-5 w-5" />,
      gradient: 'bg-gradient-to-br from-figure-500 to-figure-600',
      status: getMetricStatus(!!metricsError, metricsLoading, isConnected) as 'healthy' | 'warning' | 'error' | 'loading',
      description: '현재 처리 중인 백그라운드 작업',
      isRealTime: isConnected
    },
    {
      title: '총 문서',
      value: realTimeMetrics?.total_documents?.toLocaleString() || '0',
      change: {
        value: 5.2,
        trend: 'up' as const,
        timeframe: '어제'
      },
      icon: <FileText className="h-5 w-5" />,
      gradient: 'bg-gradient-to-br from-success-500 to-success-600',
      status: getMetricStatus(!!metricsError, metricsLoading, isConnected) as 'healthy' | 'warning' | 'error' | 'loading',
      description: '벡터 데이터베이스에 인덱싱된 문서',
      isRealTime: isConnected
    },
    {
      title: '등록된 사이트',
      value: realTimeMetrics?.total_sites || 0,
      change: {
        value: 0,
        trend: 'neutral' as const,
        timeframe: '지난 주'
      },
      icon: <Database className="h-5 w-5" />,
      gradient: 'bg-gradient-to-br from-info-500 to-info-600',
      status: getMetricStatus(!!metricsError, metricsLoading, isConnected) as 'healthy' | 'warning' | 'error' | 'loading',
      description: '활성 상태의 사이트 수',
      isRealTime: isConnected
    },
    {
      title: '시스템 상태',
      value: isSystemHealthy ? '정상' : '점검 중',
      change: {
        value: isSystemHealthy ? 99.9 : 85.2,
        trend: isSystemHealthy ? 'up' as const : 'down' as const,
        timeframe: '가동률'
      },
      icon: <Server className="h-5 w-5" />,
      gradient: isSystemHealthy 
        ? 'bg-gradient-to-br from-success-500 to-success-600'
        : 'bg-gradient-to-br from-warning-500 to-warning-600',
      status: (isSystemHealthy ? 'healthy' : 'warning') as 'healthy' | 'warning' | 'error' | 'loading',
      description: isSystemHealthy ? '모든 서비스가 정상 작동 중' : '일부 서비스 점검 중',
      isRealTime: isConnected
    }
  ];

  return (
    <>
      {/* Live region for real-time updates */}
      <div 
        aria-live="polite" 
        aria-atomic="true" 
        className="sr-only"
        id="metrics-updates"
      >
        {isConnected ? '실시간 메트릭 데이터가 업데이트되고 있습니다.' : '메트릭 데이터 연결이 끊어졌습니다.'}
      </div>

      {/* 상태 표시 */}
      <div 
        className="flex items-center justify-end mb-4"
        role="status"
        aria-label={isConnected ? '실시간 연결 상태' : '오프라인 상태'}
      >
        {isConnected ? (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-success-50 border border-success-200">
            <div className="w-2 h-2 rounded-full bg-success-500 animate-pulse" aria-hidden="true" />
            <span className="text-xs font-medium text-success-700">실시간 연결</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-warning-50 border border-warning-200">
            <Clock className="w-3 h-3 text-warning-600" aria-hidden="true" />
            <span className="text-xs font-medium text-warning-700">오프라인</span>
          </div>
        )}
      </div>

      {/* 메트릭 카드들 - 그리드 없이 개별 카드만 */}
      {metricsCardsData.map((metric, index) => (
        <MetricCard
          key={index}
          title={metric.title}
          value={metric.value}
          change={metric.change}
          icon={metric.icon}
          gradient={metric.gradient}
          status={metric.status}
          description={metric.description}
          isRealTime={metric.isRealTime}
        />
      ))}

      {/* Error State */}
      {metricsError && (
        <div 
          className="col-span-full mt-6 p-4 rounded-xl border border-error-200 bg-error-50"
          role="alert"
          aria-labelledby="error-title"
          aria-describedby="error-description"
        >
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-error-600 flex-shrink-0" aria-hidden="true" />
            <div>
              <h3 id="error-title" className="text-sm font-medium text-error-800">
                메트릭 데이터 로드 오류
              </h3>
              <p id="error-description" className="text-sm text-error-600 mt-1">
                백엔드 서버와의 연결을 확인해주세요. 문제가 지속되면 시스템 관리자에게 문의하세요.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
} 