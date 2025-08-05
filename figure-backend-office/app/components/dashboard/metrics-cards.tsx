"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSystemMetrics, useSystemHealth } from "@/hooks/use-admin-stats";

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
  Server,
  Brain,
  Zap,
} from "lucide-react";
import { useEffect, useState } from "react";

interface MetricCardProps {
  title: string;
  value: string | number;
  change?: {
    value: number;
    trend: "up" | "down" | "neutral";
    timeframe: string;
  };
  icon: React.ReactNode;
  gradient: string;
  status: "healthy" | "warning" | "error" | "loading";
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
  isRealTime = false,
}: MetricCardProps) {
  const [isAnimating, setIsAnimating] = useState(false);
  const [previousValue, setPreviousValue] = useState(value);

  useEffect(() => {
    if (isRealTime && value !== previousValue) {
      setIsAnimating(true);
      const timer = setTimeout(() => setIsAnimating(false), 600);
      setPreviousValue(value);
      return () => clearTimeout(timer);
    } else if (value !== previousValue) {
      setPreviousValue(value);
    }
  }, [value, isRealTime]);

  const getTrendIcon = () => {
    if (!change) return null;

    switch (change.trend) {
      case "up":
        return (
          <TrendingUp className="h-3 w-3 text-success-600" aria-hidden="true" />
        );
      case "down":
        return (
          <TrendingDown className="h-3 w-3 text-error-600" aria-hidden="true" />
        );
      default:
        return (
          <div
            className="h-3 w-3 rounded-full bg-gray-400"
            aria-hidden="true"
          />
        );
    }
  };

  const getTrendColor = () => {
    if (!change) return "text-gray-500";

    switch (change.trend) {
      case "up":
        return "text-success-600";
      case "down":
        return "text-error-600";
      default:
        return "text-gray-500";
    }
  };

  const getStatusIndicator = () => {
    switch (status) {
      case "healthy":
        return (
          <div
            className="w-2 h-2 rounded-full bg-success-500 animate-pulse"
            aria-hidden="true"
          />
        );
      case "warning":
        return (
          <div
            className="w-2 h-2 rounded-full bg-warning-500 animate-pulse"
            aria-hidden="true"
          />
        );
      case "error":
        return (
          <div
            className="w-2 h-2 rounded-full bg-error-500 animate-pulse"
            aria-hidden="true"
          />
        );
      case "loading":
        return (
          <Loader2
            className="w-3 h-3 animate-spin text-gray-400"
            aria-hidden="true"
          />
        );
    }
  };

  const getStatusText = () => {
    switch (status) {
      case "healthy":
        return "정상";
      case "warning":
        return "주의";
      case "error":
        return "오류";
      case "loading":
        return "로딩 중";
    }
  };

  const getTrendDescription = () => {
    if (!change) return "";

    const trendText =
      change.trend === "up"
        ? "증가"
        : change.trend === "down"
        ? "감소"
        : "변화 없음";
    return `${change.timeframe} 대비 ${Math.abs(change.value)}% ${trendText}`;
  };

  const cardId = `metric-${title.replace(/\s+/g, "-").toLowerCase()}`;

  return (
    <Card
      className={`
        group relative overflow-hidden border-0 shadow-sm hover:shadow-xl
        transition-all duration-300 ease-out hover:-translate-y-1
        bg-white backdrop-blur-sm focus-within:ring-2 focus-within:ring-figure-500 focus-within:ring-offset-2
        ${isAnimating ? "scale-105 shadow-lg" : ""}
      `}
      role="article"
      aria-labelledby={`${cardId}-title`}
      aria-describedby={`${cardId}-description`}
      tabIndex={0}
    >
      {/* Background Gradient */}
      <div className={`absolute inset-0 opacity-5 ${gradient}`} />

      {/* Gradient Border Effect */}
      <div
        className={`absolute inset-x-0 top-0 h-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300 ${gradient}`}
      />

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
                aria-label="최신 데이터"
              >
                <Wifi
                  className="w-2.5 h-2.5 text-figure-600"
                  aria-hidden="true"
                />
                <span className="text-xs font-medium text-figure-700">
                  Live
                </span>
              </div>
            )}
          </CardTitle>
        </div>

        <div
          className={`p-3 rounded-xl ${gradient} shadow-sm`}
          role="img"
          aria-label={`${title} 아이콘`}
        >
          <div className="text-white">{icon}</div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="space-y-1">
          <div
            className={`text-3xl font-bold text-gray-900 transition-all duration-300 ${
              isAnimating ? "scale-110" : ""
            }`}
            role="status"
            aria-live={isRealTime ? "polite" : "off"}
            aria-label={`${title} 값: ${value}`}
          >
            {status === "loading" ? (
              <div className="flex items-center gap-2">
                <Loader2
                  className="w-6 h-6 animate-spin text-gray-400"
                  aria-hidden="true"
                />
                <span className="text-lg text-gray-400">로딩 중</span>
              </div>
            ) : (
              <span aria-label={`현재 값 ${value}`}>{value}</span>
            )}
          </div>

          {change && status !== "loading" && (
            <div
              className={`flex items-center gap-1 text-sm ${getTrendColor()}`}
              role="status"
              aria-label={getTrendDescription()}
            >
              {getTrendIcon()}
              <span className="font-medium">
                {change.value > 0 ? "+" : ""}
                {change.value}%
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
          {isRealTime && `이 데이터는 자동으로 업데이트됩니다. `}
          {change && getTrendDescription()}
          {description && `. ${description}`}
        </div>
      </CardContent>
    </Card>
  );
}

export default function MetricsCards() {
  const {
    data: metricsData,
    error: metricsError,
    isLoading: metricsLoading,
  } = useSystemMetrics();
  const {
    data: healthData,
    error: healthError,
    isLoading: healthLoading,
  } = useSystemHealth();

  const isSystemHealthy =
    !healthError && !healthLoading && healthData?.status === "healthy";

  // AI 모델 정보 추출
  const aiModelInfo = healthData?.data?.config || {};
  const llmProvider = aiModelInfo.llm_provider || "Loading...";
  const embeddingProvider = aiModelInfo.embedding_provider || "Loading...";
  const llmModel = aiModelInfo.current_llm_model || "Loading...";
  const embeddingModel = aiModelInfo.current_embedding_model || "Loading...";

  // 모델명을 더 간결하게 표시
  const formatModelName = (model: string) => {
    if (model === "Loading...") return model;
    if (model.includes("claude-3-sonnet")) return "Claude-3-Sonnet";
    if (model.includes("text-embedding-004")) return "Gemini-Embedding-004";
    return model;
  };

  const getMetricStatus = (
    hasError: boolean,
    isLoading: boolean
  ): "healthy" | "warning" | "error" | "loading" => {
    if (isLoading) return "loading";
    if (hasError) return "error";
    return "healthy";
  };

  const metricsCardsData = [
    {
      title: "총 문서",
      value: metricsData?.total_documents?.toLocaleString() || "0",
      change: {
        value: 5.2,
        trend: "up" as const,
        timeframe: "어제",
      },
      icon: <FileText className="h-5 w-5" />,
      gradient: "bg-gradient-to-br from-success-500 to-success-600",
      status: getMetricStatus(!!metricsError, metricsLoading) as
        | "healthy"
        | "warning"
        | "error"
        | "loading",
      description: "벡터 데이터베이스에 인덱싱된 문서",
      isRealTime: false,
    },
    {
      title: "등록된 사이트",
      value: metricsData?.total_sites || 0,
      change: {
        value: 0,
        trend: "neutral" as const,
        timeframe: "지난 주",
      },
      icon: <Database className="h-5 w-5" />,
      gradient: "bg-gradient-to-br from-info-500 to-info-600",
      status: getMetricStatus(!!metricsError, metricsLoading) as
        | "healthy"
        | "warning"
        | "error"
        | "loading",
      description: "활성 상태의 사이트 수",
      isRealTime: false,
    },

    {
      title: "AI 모델",
      value: healthLoading
        ? "Loading..."
        : `${llmProvider.charAt(0).toUpperCase() + llmProvider.slice(1)} + ${
            embeddingProvider.charAt(0).toUpperCase() +
            embeddingProvider.slice(1)
          }`,
      change: {
        value: 0,
        trend: "neutral" as const,
        timeframe: "현재 설정",
      },
      icon: <Brain className="h-5 w-5" />,
      gradient: "bg-gradient-to-br from-purple-500 to-purple-600",
      status: getMetricStatus(!!healthError, healthLoading) as
        | "healthy"
        | "warning"
        | "error"
        | "loading",
      description: `LLM: ${formatModelName(
        llmModel
      )} | 임베딩: ${formatModelName(embeddingModel)}`,
      isRealTime: false,
    },
    {
      title: "총 사용자",
      value: "1",
      change: {
        value: 0,
        trend: "neutral" as const,
        timeframe: "이번 달",
      },
      icon: <Users className="h-5 w-5" />,
      gradient: "bg-gradient-to-br from-purple-500 to-purple-600",
      status: getMetricStatus(!!metricsError, metricsLoading) as
        | "healthy"
        | "warning"
        | "error"
        | "loading",
      description: "등록된 관리자 계정 수",
      isRealTime: false,
    },
  ];

  return (
    <>
      {metricsCardsData.map((metric, index) => (
        <MetricCard
          key={`metric-${index}`}
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
    </>
  );
}
