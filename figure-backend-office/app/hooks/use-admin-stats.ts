'use client';

import { useQuery } from '@tanstack/react-query';
import { adminApi, systemApi } from '@/lib/api';
import { AdminStats, SystemMetrics, SystemStatus } from '@/types/api';

export function useAdminStats() {
  return useQuery({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      const response = await adminApi.getStats();
      return response.data.data as AdminStats;
    },
    refetchInterval: 60000, // 1분마다 새로고침 (30초 → 60초)
    retry: 1,
    staleTime: 30000, // 30초간 캐시 유지
  });
}

export function useSystemMetrics() {
  return useQuery({
    queryKey: ['system-metrics'],
    queryFn: async () => {
      const response = await adminApi.getMetrics();
      return response.data.data as SystemMetrics;
    },
    refetchInterval: 30000, // 30초마다 새로고침 (5초 → 30초)
    retry: 1,
    staleTime: 15000, // 15초간 캐시 유지
  });
}

export function useSystemHealth() {
  return useQuery({
    queryKey: ['system-health'],
    queryFn: async () => {
      const response = await systemApi.getHealth();
      return response.data;
    },
    refetchInterval: 60000, // 1분마다 새로고침 (10초 → 60초)
    retry: 1,
    staleTime: 30000, // 30초간 캐시 유지
  });
}

export function useSystemStatus() {
  return useQuery({
    queryKey: ['system-status'],
    queryFn: async () => {
      const response = await systemApi.getStatus();
      return response.data.data as SystemStatus;
    },
    refetchInterval: 120000, // 2분마다 새로고침 (30초 → 2분)
    retry: 1,
    staleTime: 60000, // 1분간 캐시 유지
  });
} 