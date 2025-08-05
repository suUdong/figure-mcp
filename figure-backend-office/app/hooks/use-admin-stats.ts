"use client";

import { useQuery } from "@tanstack/react-query";
import { adminApi, systemApi } from "@/lib/api";
import { AdminStats, SystemMetrics, SystemStatus } from "@/types/api";

export function useAdminStats() {
  return useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const response = await adminApi.getStats();
      return response.data.data as AdminStats;
    },
    refetchInterval: 5 * 60 * 1000, // 5분마다 새로고침 (성능 개선)
    retry: 1,
    staleTime: 2 * 60 * 1000, // 2분간 캐시 유지
    refetchOnWindowFocus: false, // 윈도우 포커스 시 자동 새로고침 비활성화
  });
}

export function useSystemMetrics() {
  return useQuery({
    queryKey: ["system-metrics"],
    queryFn: async () => {
      const response = await adminApi.getMetrics();
      return response.data.data as SystemMetrics;
    },
    refetchInterval: 2 * 60 * 1000, // 2분마다 새로고침 (성능 개선)
    retry: 1,
    staleTime: 60 * 1000, // 1분간 캐시 유지
    refetchOnWindowFocus: false, // 윈도우 포커스 시 자동 새로고침 비활성화
  });
}

export function useSystemHealth() {
  return useQuery({
    queryKey: ["system-health"],
    queryFn: async () => {
      const response = await systemApi.getHealth();
      return response.data;
    },
    refetchInterval: 3 * 60 * 1000, // 3분마다 새로고침 (성능 개선)
    retry: 1,
    staleTime: 90 * 1000, // 90초간 캐시 유지
    refetchOnWindowFocus: false, // 윈도우 포커스 시 자동 새로고침 비활성화
  });
}

export function useSystemStatus() {
  return useQuery({
    queryKey: ["system-status"],
    queryFn: async () => {
      const response = await systemApi.getStatus();
      return response.data.data as SystemStatus;
    },
    refetchInterval: 120000, // 2분마다 새로고침 (30초 → 2분)
    retry: 1,
    staleTime: 60000, // 1분간 캐시 유지
  });
}
