"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useWebSocket } from "@/hooks/use-websocket";
import {
  Activity,
  Clock,
  CheckCircle2,
  XCircle,
  Pause,
  Play,
  RotateCcw,
  AlertCircle,
  Trash2,
  MoreHorizontal,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";
import { Job, JobStatus, JobType } from "@/types/api";

interface RealTimeJobsProps {
  className?: string;
}

export default function RealTimeJobs({ className }: RealTimeJobsProps) {
  const [activeJobs, setActiveJobs] = useState<Job[]>([]);
  const [jobHistory, setJobHistory] = useState<Job[]>([]);

  // WebSocket 연결
  const wsUrl =
    process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8001/admin/ws";
  const { isConnected, lastMessage } = useWebSocket(wsUrl);

  // WebSocket 메시지 처리
  useEffect(() => {
    if (lastMessage?.type === "metrics_update" && lastMessage.active_jobs) {
      const jobs = lastMessage.active_jobs as Job[];
      setActiveJobs(jobs);

      // 완료된 작업은 히스토리에 추가
      const completedJobs = jobs.filter(
        (job) =>
          job.status === JobStatus.COMPLETED || job.status === JobStatus.FAILED
      );

      if (completedJobs.length > 0) {
        setJobHistory((prev) => {
          const updated = [...completedJobs, ...prev];
          return updated.slice(0, 20); // 최근 20개만 유지
        });
      }
    }
  }, [lastMessage]);

  // 작업 상태별 색상 및 아이콘
  const getJobStatusConfig = (status: JobStatus) => {
    switch (status) {
      case JobStatus.PENDING:
        return {
          color: "bg-gray-500",
          icon: <Clock className="h-4 w-4" />,
          label: "대기중",
        };
      case JobStatus.PROCESSING:
        return {
          color: "bg-figure-500",
          icon: <Activity className="h-4 w-4 animate-spin" />,
          label: "처리중",
        };
      case JobStatus.COMPLETED:
        return {
          color: "bg-success-500",
          icon: <CheckCircle2 className="h-4 w-4" />,
          label: "완료",
        };
      case JobStatus.FAILED:
        return {
          color: "bg-error-500",
          icon: <XCircle className="h-4 w-4" />,
          label: "실패",
        };
      case JobStatus.CANCELLED:
        return {
          color: "bg-gray-500",
          icon: <Pause className="h-4 w-4" />,
          label: "취소됨",
        };
      default:
        return {
          color: "bg-gray-500",
          icon: <AlertCircle className="h-4 w-4" />,
          label: "알 수 없음",
        };
    }
  };

  // 작업 타입별 라벨
  const getJobTypeLabel = (type: JobType) => {
    switch (type) {
      case JobType.RAG_QUERY:
        return "RAG 쿼리";
      case JobType.DOCUMENT_UPLOAD:
        return "문서 업로드";
      case JobType.SITE_CREATION:
        return "사이트 생성";
      case JobType.SYSTEM_MAINTENANCE:
        return "시스템 유지보수";
      default:
        return "기타";
    }
  };

  // 진행률 계산
  const getProgress = (job: Job): number => {
    if (job.status === JobStatus.COMPLETED) return 100;
    if (job.status === JobStatus.FAILED || job.status === JobStatus.CANCELLED)
      return 0;
    return Math.max(0, Math.min(100, job.progress || 0));
  };

  // 소요 시간 계산
  const getDuration = (job: Job): string => {
    const startTime = new Date(job.started_at);
    const endTime = job.completed_at ? new Date(job.completed_at) : new Date();

    return formatDistanceToNow(startTime, {
      locale: ko,
      addSuffix: false,
    });
  };

  // 작업 카드 컴포넌트
  const JobCard = ({
    job,
    showActions = true,
  }: {
    job: Job;
    showActions?: boolean;
  }) => {
    const statusConfig = getJobStatusConfig(job.status);
    const progress = getProgress(job);

    return (
      <Card className="hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center space-x-3 mb-2">
                <Badge className={`${statusConfig.color} text-white`}>
                  <div className="flex items-center space-x-1">
                    {statusConfig.icon}
                    <span>{statusConfig.label}</span>
                  </div>
                </Badge>
                <Badge variant="secondary">{getJobTypeLabel(job.type)}</Badge>
                <span className="text-xs text-gray-500">ID: {job.id}</span>
              </div>

              <h4 className="font-medium text-gray-900 mb-1">
                {job.message || "작업 처리 중..."}
              </h4>

              {job.site_id && (
                <p className="text-sm text-gray-500 mb-2">
                  사이트 ID: {job.site_id}
                </p>
              )}

              {/* 진행률 바 */}
              {job.status === JobStatus.PROCESSING && (
                <div className="mb-2">
                  <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                    <span>진행률</span>
                    <span>{progress}%</span>
                  </div>
                  <Progress value={progress} className="h-2" />
                </div>
              )}

              <div className="flex items-center space-x-4 text-xs text-gray-500">
                <div className="flex items-center space-x-1">
                  <Clock className="h-3 w-3" />
                  <span>
                    {format(new Date(job.started_at), "HH:mm:ss", {
                      locale: ko,
                    })}
                  </span>
                </div>
                <div>소요: {getDuration(job)}</div>
                {job.completed_at && (
                  <div>
                    완료:{" "}
                    {format(new Date(job.completed_at), "HH:mm:ss", {
                      locale: ko,
                    })}
                  </div>
                )}
              </div>

              {/* 오류 메시지 */}
              {job.error && (
                <div className="mt-2 p-2 bg-error-50 border border-error-200 rounded text-sm text-error-600">
                  <div className="flex items-center space-x-1">
                    <AlertCircle className="h-3 w-3" />
                    <span className="font-medium">오류:</span>
                  </div>
                  <p className="mt-1">{job.error}</p>
                </div>
              )}

              {/* 메타데이터 */}
              {job.metadata && Object.keys(job.metadata).length > 0 && (
                <div className="mt-2 text-xs text-gray-500">
                  <details>
                    <summary className="cursor-pointer hover:text-gray-700">
                      메타데이터 보기
                    </summary>
                    <pre className="mt-1 p-2 bg-gray-50 rounded text-xs overflow-x-auto">
                      {JSON.stringify(job.metadata, null, 2)}
                    </pre>
                  </details>
                </div>
              )}
            </div>

            {/* 액션 버튼 */}
            {showActions && job.status === JobStatus.PROCESSING && (
              <div className="flex items-center space-x-1 ml-3">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  title="작업 재시도"
                >
                  <RotateCcw className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  title="작업 취소"
                >
                  <Trash2 className="h-3 w-3 text-error-500" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  title="더 보기"
                >
                  <MoreHorizontal className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  const runningJobs = activeJobs.filter(
    (job) =>
      job.status === JobStatus.PROCESSING || job.status === JobStatus.PENDING
  );

  return (
    <div className={`space-y-6 ${className}`}>
      {/* 활성 작업 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Activity className="h-5 w-5" />
            <span>활성 작업</span>
            <Badge className="bg-figure-500 text-white">
              {runningJobs.length}개
            </Badge>
          </CardTitle>
          <CardDescription>
            현재 실행 중이거나 대기 중인 작업 목록
          </CardDescription>
        </CardHeader>
        <CardContent>
          {runningJobs.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Activity className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>현재 실행 중인 작업이 없습니다</p>
              <p className="text-sm">
                새로운 작업이 시작되면 여기에 표시됩니다
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {runningJobs.map((job) => (
                <JobCard key={job.id} job={job} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 최근 완료된 작업 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <CheckCircle2 className="h-5 w-5" />
            <span>최근 완료 작업</span>
          </CardTitle>
          <CardDescription>최근에 완료되거나 실패한 작업들</CardDescription>
        </CardHeader>
        <CardContent>
          {jobHistory.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>최근 완료된 작업이 없습니다</p>
            </div>
          ) : (
            <div className="space-y-3">
              {jobHistory.slice(0, 10).map((job) => (
                <JobCard
                  key={`${job.id}-${job.completed_at}`}
                  job={job}
                  showActions={false}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 연결 상태 */}
      {!isConnected && (
        <Card className="border-warning-500 bg-warning-50">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2 text-warning-600">
              <AlertCircle className="h-5 w-5" />
              <span className="font-medium">실시간 업데이트 사용 불가</span>
            </div>
            <p className="text-sm text-warning-600 mt-2">
              WebSocket 연결이 끊어졌습니다. 작업 상태가 실시간으로 업데이트되지
              않을 수 있습니다.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
