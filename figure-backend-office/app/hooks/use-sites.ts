'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Site, CreateSiteRequest, UpdateSiteRequest } from '@/types/api'

export function useSites() {
  const queryClient = useQueryClient()

  // Get all sites
  const { data: sites, isLoading, error, refetch } = useQuery({
    queryKey: ['sites'],
    queryFn: async () => {
      const response = await api.get<Site[]>('/api/sites')
      return response.data
    }
  })

  // Create site
  const createSiteMutation = useMutation({
    mutationFn: async (data: CreateSiteRequest) => {
      const response = await api.post<Site>('/api/sites', data)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sites'] })
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] })
    }
  })

  // Update site
  const updateSiteMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateSiteRequest }) => {
      const response = await api.put<Site>(`/api/sites/${id}`, data)
      return response.data
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

// Get single site
export function useSite(siteId: string) {
  return useQuery({
    queryKey: ['site', siteId],
    queryFn: async () => {
      const response = await api.get<Site>(`/api/sites/${siteId}`)
      return response.data
    },
    enabled: !!siteId
  })
} 