"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  FileText,
  Database,
  Upload,
  Activity,
  MessageSquare,
  Settings,
  BarChart3,
  Search,
  Download,
  RefreshCw,
  Plus,
  ArrowRight,
} from "lucide-react";

interface QuickActionProps {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  priority: "primary" | "secondary" | "tertiary";
  status?: "new" | "beta" | "updated";
  color: string;
  stats?: string;
}

const quickActions: QuickActionProps[] = [
  {
    title: "사이트 관리",
    description: "새로운 사이트 등록 및 설정 관리",
    icon: Database,
    href: "/sites",
    priority: "primary",
    color: "figure",
    stats: "8개 사이트",
  },
  {
    title: "문서 관리",
    description: "업로드된 문서를 검색, 조회, 관리합니다",
    icon: FileText,
    href: "/documents",
    priority: "primary",
    color: "warning",
    stats: "1,247개 문서",
  },
  {
    title: "문서 업로드",
    description: "드래그앤드롭, 청크 업로드, 일시정지/재개 지원",
    icon: Upload,
    href: "/documents/upload",
    priority: "primary",
    status: "new",
    color: "success",
    stats: "최대 10GB",
  },
  {
    title: "RAG 질의응답",
    description: "AI 기반 문서 검색 및 질의응답 테스트",
    icon: MessageSquare,
    href: "/rag",
    priority: "primary",
    status: "beta",
    color: "info",
    stats: "AI 검색",
  },
];

function ActionCard({ action }: { action: QuickActionProps }) {
  const getGradientClass = (color: string) => {
    switch (color) {
      case "figure":
        return "bg-gradient-to-br from-figure-500 to-figure-600";
      case "success":
        return "bg-gradient-to-br from-success-500 to-success-600";
      case "info":
        return "bg-gradient-to-br from-info-500 to-info-600";
      case "warning":
        return "bg-gradient-to-br from-warning-500 to-warning-600";
      default:
        return "bg-gradient-to-br from-gray-500 to-gray-600";
    }
  };

  const getBadgeColor = (status?: string) => {
    switch (status) {
      case "new":
        return "bg-success-100 text-success-700 border-success-200";
      case "beta":
        return "bg-warning-100 text-warning-700 border-warning-200";
      case "updated":
        return "bg-info-100 text-info-700 border-info-200";
      default:
        return "";
    }
  };

  const isPrimary = action.priority === "primary";

  return (
    <Card
      className={`
      group relative overflow-hidden border-0 shadow-sm hover:shadow-xl
      transition-all duration-300 ease-out hover:-translate-y-2
      bg-white backdrop-blur-sm cursor-pointer
      ${isPrimary ? "lg:row-span-2" : ""}
    `}
    >
      {/* Background Gradient Overlay */}
      <div
        className={`absolute inset-0 opacity-5 ${getGradientClass(
          action.color
        )}`}
      />

      {/* Top Gradient Border */}
      <div
        className={`absolute inset-x-0 top-0 h-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300 ${getGradientClass(
          action.color
        )}`}
      />

      {/* Status Badge */}
      {action.status && (
        <div className="absolute top-4 right-4 z-10">
          <span
            className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getBadgeColor(
              action.status
            )}`}
          >
            {action.status === "new" && "새로운"}
            {action.status === "beta" && "베타"}
            {action.status === "updated" && "업데이트"}
          </span>
        </div>
      )}

      <Link href={action.href} className="block h-full">
        <CardHeader className={`${isPrimary ? "pb-4" : "pb-3"}`}>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`
                p-3 rounded-xl shadow-sm ${getGradientClass(action.color)}
                ${isPrimary ? "p-4" : "p-3"}
              `}
              >
                <action.icon
                  className={`text-white ${isPrimary ? "h-6 w-6" : "h-5 w-5"}`}
                />
              </div>

              <div className="space-y-1">
                <CardTitle
                  className={`text-gray-900 group-hover:text-gray-700 transition-colors ${
                    isPrimary ? "text-lg" : "text-base"
                  }`}
                >
                  {action.title}
                </CardTitle>
                {action.stats && (
                  <p className="text-xs text-gray-500 font-medium">
                    {action.stats}
                  </p>
                )}
              </div>
            </div>

            <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <ArrowRight className="h-4 w-4 text-gray-400" />
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <p
            className={`text-gray-600 leading-relaxed ${
              isPrimary ? "text-base" : "text-sm"
            }`}
          >
            {action.description}
          </p>

          {isPrimary && (
            <div className="flex items-center gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                className="flex items-center gap-2 hover:bg-gray-50 border-gray-200"
              >
                <span>시작하기</span>
                <ArrowRight className="h-3 w-3" />
              </Button>
            </div>
          )}
        </CardContent>
      </Link>
    </Card>
  );
}

export default function QuickActions() {
  return (
    <>
      {quickActions.map((action, index) => (
        <ActionCard key={index} action={action} />
      ))}
    </>
  );
}
