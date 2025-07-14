'use client';

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Document } from '@/types/api'

export function useDocuments() {
  const queryClient = useQueryClient()
  const [searchResults, setSearchResults] = useState<Document[]>([])
  const [isSearching, setIsSearching] = useState(false)

  // Get all documents
  const { data: documents, isLoading, error, refetch } = useQuery({
    queryKey: ['documents'],
    queryFn: async () => {
      const response = await api.get('/api/documents/list')
      return response.data.data.documents // APIResponse 구조에서 실제 문서 배열 추출
    }
  })

  // Search documents
  const searchDocuments = async (query: string) => {
    setIsSearching(true)
    try {
      const response = await api.get('/api/documents/search', {
        params: { query, max_results: 50 }
      })
      setSearchResults(response.data.data.results)
    } catch (error) {
      console.error('Search error:', error)
      setSearchResults([])
    } finally {
      setIsSearching(false)
    }
  }

  // Delete document
  const deleteDocumentMutation = useMutation({
    mutationFn: async (documentId: string) => {
      await api.delete(`/api/documents/${documentId}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] })
      queryClient.invalidateQueries({ queryKey: ['document-stats'] })
    }
  })

  // Upload document
  const uploadDocumentMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await api.post('/api/documents/upload-file', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      })
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] })
      queryClient.invalidateQueries({ queryKey: ['document-stats'] })
    }
  })

  return {
    documents: searchResults.length > 0 ? searchResults : documents,
    isLoading: isLoading || isSearching,
    error,
    refetch,
    searchDocuments,
    deleteDocument: deleteDocumentMutation.mutate,
    uploadDocument: uploadDocumentMutation.mutate,
    isDeleting: deleteDocumentMutation.isPending,
    isUploading: uploadDocumentMutation.isPending
  }
}

export function useDocumentStats() {
  return useQuery({
    queryKey: ['document-stats'],
    queryFn: async () => {
      const response = await api.get('/api/documents/stats')
      return response.data.data // APIResponse 구조에서 실제 데이터 추출
    }
  })
} 