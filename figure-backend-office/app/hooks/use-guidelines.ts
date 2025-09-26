"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { guidelinesApi } from "@/lib/api";
import { Guideline, GuidelineCreateRequest, GuidelineUpdateRequest, GuidelineResponse } from "@/types/guidelines";

export function useGuidelines(filters?: {
  guideline_type?: string;
  scope?: string;
  site_id?: string;
  is_active?: boolean;
  search_query?: string;
}) {
  const queryClient = useQueryClient();

  // Get all guidelines with optimized caching
  const {
    data: guidelines,
    isLoading,
    error,
    refetch,
  } = useQuery<GuidelineResponse[]>({
    queryKey: ["guidelines", filters],
    queryFn: async (): Promise<GuidelineResponse[]> => {
      const response = await guidelinesApi.list({
        ...filters,
        limit: 100 // 한 번에 많이 로드
      });
      return response.data.data || [];
    },
    staleTime: 5 * 60 * 1000, // 5분간 캐시 유효
    gcTime: 10 * 60 * 1000, // 10분간 가비지 컬렉션 유예
  });

  // Create guideline mutation
  const createMutation = useMutation({
    mutationFn: async (data: GuidelineCreateRequest): Promise<GuidelineResponse> => {
      const response = await guidelinesApi.create(data);
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["guidelines"] });
    },
  });

  // Update guideline mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: GuidelineUpdateRequest }): Promise<GuidelineResponse> => {
      const response = await guidelinesApi.update(id, data);
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["guidelines"] });
    },
  });

  // Delete guideline mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string): Promise<void> => {
      await guidelinesApi.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["guidelines"] });
    },
  });

  return {
    // Data
    guidelines: guidelines || [],
    isLoading,
    error,
    
    // Actions
    refetch,
    createGuideline: createMutation.mutate,
    updateGuideline: updateMutation.mutate,
    deleteGuideline: deleteMutation.mutate,
    
    // Mutation states
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    
    // Mutation errors
    createError: createMutation.error,
    updateError: updateMutation.error,
    deleteError: deleteMutation.error,
  };
}

export function useGuideline(id: string) {
  return useQuery<GuidelineResponse>({
    queryKey: ["guidelines", id],
    queryFn: async (): Promise<GuidelineResponse> => {
      const response = await guidelinesApi.get(id);
      return response.data.data;
    },
    enabled: !!id,
  });
}

export function useGuidelineAggregate(guideline_type: string, site_id?: string) {
  return useQuery({
    queryKey: ["guidelines", "aggregate", guideline_type, site_id],
    queryFn: async () => {
      const response = await guidelinesApi.aggregate(guideline_type, site_id);
      return response.data.data;
    },
    enabled: !!guideline_type,
    staleTime: 10 * 60 * 1000, // 10분간 캐시 유효 (지침 종합은 자주 바뀌지 않음)
  });
}
