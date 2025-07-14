'use client'

import { useState } from 'react'
import { useSites } from '@/hooks/use-sites'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus, Globe, Edit, Trash2, Power, PowerOff, ExternalLink, RefreshCw, Search } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ko } from 'date-fns/locale'
import { Site, CreateSiteRequest, UpdateSiteRequest } from '@/types/api'

export default function SitesPage() {
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingSite, setEditingSite] = useState<Site | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  
  const { 
    sites, 
    isLoading, 
    error, 
    createSite, 
    updateSite, 
    deleteSite, 
    toggleSiteStatus,
    isCreating,
    isUpdating,
    isDeleting,
    isToggling,
    refetch
  } = useSites()

  const handleCreateSite = (data: CreateSiteRequest) => {
    createSite(data)
    setShowCreateModal(false)
  }

  const handleUpdateSite = (data: UpdateSiteRequest) => {
    if (editingSite) {
      updateSite({ id: editingSite.id, data })
      setEditingSite(null)
    }
  }

  const handleDeleteSite = (siteId: string) => {
    if (confirm('이 사이트를 삭제하시겠습니까? 관련된 모든 문서도 삭제됩니다.')) {
      deleteSite(siteId)
    }
  }

  const handleToggleStatus = (siteId: string, enabled: boolean) => {
    toggleSiteStatus({ id: siteId, enabled })
  }

  const filteredSites = sites?.filter(site => 
    site.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    site.url.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const getStatusBadge = (status: string, enabled: boolean) => {
    if (!enabled) {
      return <Badge className="bg-gray-500 text-white text-xs">비활성</Badge>
    }
    
    const statusConfig = {
      'active': { label: '활성', color: 'bg-green-500' },
      'inactive': { label: '비활성', color: 'bg-gray-500' },
      'error': { label: '오류', color: 'bg-red-500' }
    }
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.inactive
    
    return (
      <Badge className={`${config.color} text-white text-xs`}>
        {config.label}
      </Badge>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">사이트 관리</h1>
          <p className="text-gray-600 mt-1">웹 사이트를 추가하고 관리할 수 있습니다</p>
        </div>
        <div className="flex items-center space-x-3">
          <Button
            onClick={() => refetch()}
            variant="outline"
            size="sm"
            className="flex items-center space-x-2"
          >
            <RefreshCw className="h-4 w-4" />
            <span>새로고침</span>
          </Button>
          <Button
            onClick={() => setShowCreateModal(true)}
            size="sm"
            className="flex items-center space-x-2"
          >
            <Plus className="h-4 w-4" />
            <span>사이트 추가</span>
          </Button>
        </div>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="사이트 이름 또는 URL로 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </CardContent>
      </Card>

      {/* Sites List */}
      <Card>
        <CardHeader>
          <CardTitle>사이트 목록</CardTitle>
          <CardDescription>
            총 {filteredSites?.length || 0}개의 사이트
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
              <span className="ml-2">로딩 중...</span>
            </div>
          ) : error ? (
            <div className="text-center py-8 text-red-500">
              오류가 발생했습니다: {error.message}
            </div>
          ) : !filteredSites || filteredSites.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Globe className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>사이트가 없습니다</p>
              <p className="text-sm">첫 번째 사이트를 추가해보세요</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredSites.map((site) => (
                <div
                  key={site.id}
                  className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <Globe className="h-5 w-5 text-blue-500" />
                      <div>
                        <h3 className="font-semibold text-gray-900">{site.name}</h3>
                        <div className="flex items-center space-x-4 mt-1 text-sm text-gray-500">
                          <a 
                            href={site.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex items-center space-x-1 hover:text-blue-600"
                          >
                            <span>{site.url}</span>
                            <ExternalLink className="h-3 w-3" />
                          </a>
                          <span>{site.document_count || 0}개 문서</span>
                          <span>
                            {site.last_crawled ? 
                              `마지막 크롤링: ${formatDistanceToNow(new Date(site.last_crawled), { 
                                addSuffix: true, 
                                locale: ko 
                              })}` : 
                              '크롤링 없음'
                            }
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      {getStatusBadge(site.status, site.enabled)}
                      <Button
                        onClick={() => handleToggleStatus(site.id, !site.enabled)}
                        variant="ghost"
                        size="sm"
                        className={site.enabled ? "text-red-600 hover:text-red-800" : "text-green-600 hover:text-green-800"}
                        disabled={isToggling}
                      >
                        {site.enabled ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                      </Button>
                      <Button
                        onClick={() => setEditingSite(site)}
                        variant="ghost"
                        size="sm"
                        className="text-blue-600 hover:text-blue-800"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        onClick={() => handleDeleteSite(site.id)}
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:text-red-800"
                        disabled={isDeleting}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  
                  {site.description && (
                    <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-700">{site.description}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Site Modal */}
      {showCreateModal && (
        <SiteFormModal
          title="사이트 추가"
          onSubmit={handleCreateSite}
          onClose={() => setShowCreateModal(false)}
          isLoading={isCreating}
        />
      )}

      {/* Edit Site Modal */}
      {editingSite && (
        <SiteFormModal
          title="사이트 수정"
          initialData={editingSite}
          onSubmit={handleUpdateSite}
          onClose={() => setEditingSite(null)}
          isLoading={isUpdating}
        />
      )}
    </div>
  )
}

// Site Form Modal Component
function SiteFormModal({ 
  title, 
  initialData, 
  onSubmit, 
  onClose, 
  isLoading 
}: {
  title: string
  initialData?: Site
  onSubmit: (data: any) => void
  onClose: () => void
  isLoading: boolean
}) {
  const [formData, setFormData] = useState({
    name: initialData?.name || '',
    url: initialData?.url || '',
    description: initialData?.description || '',
    crawl_frequency: initialData?.crawl_frequency || 24,
    max_depth: initialData?.max_depth || 3,
    include_patterns: initialData?.include_patterns?.join('\n') || '',
    exclude_patterns: initialData?.exclude_patterns?.join('\n') || ''
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit({
      name: formData.name,
      url: formData.url,
      description: formData.description || undefined,
      crawl_frequency: formData.crawl_frequency,
      max_depth: formData.max_depth,
      include_patterns: formData.include_patterns ? formData.include_patterns.split('\n').filter(p => p.trim()) : undefined,
      exclude_patterns: formData.exclude_patterns ? formData.exclude_patterns.split('\n').filter(p => p.trim()) : undefined
    })
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">{title}</h2>
            <Button
              onClick={onClose}
              variant="ghost"
              size="sm"
              disabled={isLoading}
            >
              ✕
            </Button>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  사이트 이름 *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  사이트 URL *
                </label>
                <input
                  type="url"
                  required
                  value={formData.url}
                  onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                설명
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  크롤링 주기 (시간)
                </label>
                <input
                  type="number"
                  min="1"
                  value={formData.crawl_frequency}
                  onChange={(e) => setFormData({ ...formData, crawl_frequency: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  최대 깊이
                </label>
                <input
                  type="number"
                  min="1"
                  value={formData.max_depth}
                  onChange={(e) => setFormData({ ...formData, max_depth: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  포함 패턴 (한 줄에 하나씩)
                </label>
                <textarea
                  value={formData.include_patterns}
                  onChange={(e) => setFormData({ ...formData, include_patterns: e.target.value })}
                  rows={4}
                  placeholder="/blog/*&#10;/docs/*"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  제외 패턴 (한 줄에 하나씩)
                </label>
                <textarea
                  value={formData.exclude_patterns}
                  onChange={(e) => setFormData({ ...formData, exclude_patterns: e.target.value })}
                  rows={4}
                  placeholder="/admin/*&#10;/login/*"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-4">
              <Button
                type="button"
                onClick={onClose}
                variant="outline"
                disabled={isLoading}
              >
                취소
              </Button>
              <Button
                type="submit"
                disabled={isLoading}
              >
                {isLoading ? '저장 중...' : '저장'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
} 