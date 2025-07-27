'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Site, CreateSiteRequest, UpdateSiteRequest } from '@/types/api'

export function useSites() {
  const queryClient = useQueryClient()

  // Get all sites with optimized caching
  const { data: sites, isLoading, error, refetch } = useQuery({
    queryKey: ['sites'],
    queryFn: async () => {
      const response = await api.get<Site[]>('/api/sites')
      return response.data
    },
    staleTime: 2 * 60 * 1000, // 2분간 캐시 유지
    gcTime: 10 * 60 * 1000, // 10분간 메모리에 유지
    refetchOnWindowFocus: false, // 윈도우 포커스 시 자동 새로고침 비활성화
  })

  // Create site with optimistic updates
  const createSiteMutation = useMutation({
    mutationFn: async (data: CreateSiteRequest) => {
      const response = await api.post<Site>('/api/sites', data)
      return response.data
    },
    onMutate: async (newSite) => {
      // 진행 중인 refetch 취소
      await queryClient.cancelQueries({ queryKey: ['sites'] })
      
      // 이전 데이터 백업
      const previousSites = queryClient.getQueryData(['sites'])
      
      // 낙관적 업데이트
      queryClient.setQueryData(['sites'], (old: Site[] | undefined) => {
        if (!old) return []
        const tempSite: Site = {
          id: `temp-${Date.now()}`,
          name: newSite.name,
          company: newSite.company,
          department: newSite.department || '',
          url: newSite.url,
          description: newSite.description || '',
          enabled: true,
          status: 'active',
          crawl_frequency: newSite.crawl_frequency || 24,
          max_depth: newSite.max_depth || 3,
          include_patterns: newSite.include_patterns || [],
          exclude_patterns: newSite.exclude_patterns || [],
          document_count: 0,
          last_crawled: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
        return [...old, tempSite]
      })
      
      return { previousSites }
    },
    onError: (err, newSite, context) => {
      // 에러 발생 시 이전 데이터로 롤백
      queryClient.setQueryData(['sites'], context?.previousSites)
    },
    onSuccess: () => {
      // 성공 시 데이터 새로고침
      queryClient.invalidateQueries({ queryKey: ['sites'] })
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] })
    }
  })

  // Update site with optimistic updates
  const updateSiteMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateSiteRequest }) => {
      const response = await api.put<Site>(`/api/sites/${id}`, data)
      return response.data
    },
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: ['sites'] })
      const previousSites = queryClient.getQueryData(['sites'])
      
      queryClient.setQueryData(['sites'], (old: Site[] | undefined) => {
        if (!old) return []
        return old.map(site => 
          site.id === id 
            ? { ...site, ...data, updated_at: new Date().toISOString() }
            : site
        )
      })
      
      return { previousSites }
    },
    onError: (err, variables, context) => {
      queryClient.setQueryData(['sites'], context?.previousSites)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sites'] })
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] })
    }
  })

  // Delete site
  const deleteSiteMutation = useMutation({
    mutationFn: async (siteId: string) => {
      await api.delete(`/api/sites/${siteId}`)
    },
    onMutate: async (siteId) => {
      await queryClient.cancelQueries({ queryKey: ['sites'] })
      const previousSites = queryClient.getQueryData(['sites'])
      
      queryClient.setQueryData(['sites'], (old: Site[] | undefined) => {
        if (!old) return []
        return old.filter(site => site.id !== siteId)
      })
      
      return { previousSites }
    },
    onError: (err, siteId, context) => {
      queryClient.setQueryData(['sites'], context?.previousSites)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sites'] })
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] })
    }
  })

  // Toggle site status
  const toggleSiteStatusMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const response = await api.patch<Site>(`/api/sites/${id}/status`, { enabled })
      return response.data
    },
    onMutate: async ({ id, enabled }) => {
      await queryClient.cancelQueries({ queryKey: ['sites'] })
      const previousSites = queryClient.getQueryData(['sites'])
      
      queryClient.setQueryData(['sites'], (old: Site[] | undefined) => {
        if (!old) return []
        return old.map(site => 
          site.id === id 
            ? { ...site, enabled, updated_at: new Date().toISOString() }
            : site
        )
      })
      
      return { previousSites }
    },
    onError: (err, variables, context) => {
      queryClient.setQueryData(['sites'], context?.previousSites)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sites'] })
    }
  })

  return {
    sites,
    isLoading,
    error,
    refetch,
    createSite: createSiteMutation.mutate,
    updateSite: updateSiteMutation.mutate,
    deleteSite: deleteSiteMutation.mutate,
    toggleSiteStatus: toggleSiteStatusMutation.mutate,
    isCreating: createSiteMutation.isPending,
    isUpdating: updateSiteMutation.isPending,
    isDeleting: deleteSiteMutation.isPending,
    isToggling: toggleSiteStatusMutation.isPending
  }
}

// Get single site with caching
export function useSite(siteId: string) {
  return useQuery({
    queryKey: ['site', siteId],
    queryFn: async () => {
      const response = await api.get<Site>(`/api/sites/${siteId}`)
      return response.data
    },
    enabled: !!siteId,
    staleTime: 5 * 60 * 1000, // 5분간 캐시 유지
    gcTime: 10 * 60 * 1000, // 10분간 메모리에 유지
  })
} 