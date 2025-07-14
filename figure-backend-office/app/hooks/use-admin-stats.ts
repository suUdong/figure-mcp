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
    refetchInterval: 30000, // 30초마다 새로고침
    retry: 1,
  });
}

export function useSystemMetrics() {
  return useQuery({
    queryKey: ['system-metrics'],
    queryFn: async () => {
      const response = await adminApi.getMetrics();
      return response.data.data as SystemMetrics;
    },
    refetchInterval: 5000, // 5초마다 새로고침
    retry: 1,
  });
}

export function useSystemHealth() {
  return useQuery({
    queryKey: ['system-health'],
    queryFn: async () => {
      const response = await systemApi.getHealth();
      return response.data;
    },
    refetchInterval: 10000, // 10초마다 새로고침
    retry: 1,
  });
}

export function useSystemStatus() {
  return useQuery({
    queryKey: ['system-status'],
    queryFn: async () => {
      const response = await systemApi.getStatus();
      return response.data.data as SystemStatus;
    },
    refetchInterval: 30000, // 30초마다 새로고침
    retry: 1,
  });
} 