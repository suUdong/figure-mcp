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
import MainLayout from '@/components/layout/main-layout'

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
    site.url?.toLowerCase().includes(searchQuery.toLowerCase())
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
    <MainLayout>
      <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">회사 관리</h1>
          <p className="text-gray-600 mt-1">IT 운영업무를 하는 회사를 등록하고 관리할 수 있습니다</p>
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
            <span>회사 추가</span>
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
              placeholder="회사명 또는 부서명으로 검색..."
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
          <CardTitle>등록된 회사 목록</CardTitle>
          <CardDescription>
            총 {filteredSites?.length || 0}개의 회사
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
                      <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-100 text-blue-600">
                        <span className="font-semibold text-sm">{site.company.charAt(0)}</span>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-gray-900">{site.name}</h3>
                          {site.department && (
                            <span className="text-sm text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                              {site.department}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center space-x-4 text-sm text-gray-600">
                          <span className="font-medium">{site.company}</span>
                          {site.business_type && (
                            <span className="text-gray-500">• {site.business_type}</span>
                          )}
                          <span className="text-gray-500">• {site.document_count || 0}개 문서</span>
                          {site.url && (
                            <a 
                              href={site.url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="flex items-center space-x-1 text-blue-600 hover:text-blue-800"
                            >
                              <span>{new URL(site.url).hostname}</span>
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                        {site.contact_person && (
                          <div className="mt-2 text-sm text-gray-500">
                            담당자: {site.contact_person}
                            {site.contact_email && (
                              <span> ({site.contact_email})</span>
                            )}
                          </div>
                        )}
                        <div className="mt-2 text-xs text-gray-500">
                          {site.last_crawled ? 
                            `마지막 크롤링: ${formatDistanceToNow(new Date(site.last_crawled), { 
                              addSuffix: true, 
                              locale: ko 
                            })}` : 
                            site.url ? '크롤링 대기 중' : '웹사이트 없음'
                          }
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
    </MainLayout>
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
    company: initialData?.company || '',
    department: initialData?.department || '',
    business_type: initialData?.business_type || '',
    contact_person: initialData?.contact_person || '',
    contact_email: initialData?.contact_email || '',
    contact_phone: initialData?.contact_phone || '',
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
      company: formData.company,
      department: formData.department || undefined,
      business_type: formData.business_type || undefined,
      contact_person: formData.contact_person || undefined,
      contact_email: formData.contact_email || undefined,
      contact_phone: formData.contact_phone || undefined,
      url: formData.url || undefined,
      description: formData.description || undefined,
      crawl_frequency: formData.crawl_frequency,
      max_depth: formData.max_depth,
      include_patterns: formData.include_patterns ? formData.include_patterns.split('\n').filter(p => p.trim()) : undefined,
      exclude_patterns: formData.exclude_patterns ? formData.exclude_patterns.split('\n').filter(p => p.trim()) : undefined
    })
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold">{title}</h2>
              <p className="text-sm text-gray-600 mt-1">IT 운영업무를 하는 회사 정보를 입력해주세요</p>
            </div>
            <Button
              onClick={onClose}
              variant="ghost"
              size="sm"
              disabled={isLoading}
            >
              ✕
            </Button>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* 기본 회사 정보 섹션 */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="text-lg font-semibold mb-3 text-gray-800">기본 회사 정보</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    회사/조직 이름 *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="예: 삼성전자, 네이버"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    회사명 *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.company}
                    onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="정식 회사명"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    부서명
                  </label>
                  <input
                    type="text"
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="예: IT사업부, 개발팀"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    업종/사업 분야
                  </label>
                  <input
                    type="text"
                    value={formData.business_type}
                    onChange={(e) => setFormData({ ...formData, business_type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="예: IT서비스, 전자제품 제조"
                  />
                </div>
              </div>
            </div>

            {/* 담당자 정보 섹션 */}
            <div className="bg-blue-50 p-4 rounded-lg">
              <h3 className="text-lg font-semibold mb-3 text-gray-800">담당자 정보</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    담당자 이름
                  </label>
                  <input
                    type="text"
                    value={formData.contact_person}
                    onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="담당자 이름"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    담당자 이메일
                  </label>
                  <input
                    type="email"
                    value={formData.contact_email}
                    onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="contact@company.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    연락처
                  </label>
                  <input
                    type="tel"
                    value={formData.contact_phone}
                    onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="010-1234-5678"
                  />
                </div>
              </div>
            </div>

            {/* 웹사이트 정보 섹션 */}
            <div className="bg-green-50 p-4 rounded-lg">
              <h3 className="text-lg font-semibold mb-3 text-gray-800">웹사이트 정보 (선택사항)</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    회사 웹사이트 URL
                  </label>
                  <input
                    type="url"
                    value={formData.url}
                    onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="https://company.com (선택사항)"
                  />
                  <p className="text-xs text-gray-500 mt-1">웹사이트가 있는 경우 크롤링을 수행할 수 있습니다</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    회사/업무 설명
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="회사 소개, 주요 업무, 특징 등을 입력해주세요"
                  />
                </div>
              </div>
            </div>

            {/* 크롤링 설정 섹션 (웹사이트 URL이 있는 경우만 표시) */}
            {formData.url && (
              <div className="bg-yellow-50 p-4 rounded-lg">
                <h3 className="text-lg font-semibold mb-3 text-gray-800">크롤링 설정</h3>
                <div className="grid grid-cols-2 gap-4 mb-4">
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
              </div>
            )}

            <div className="flex justify-end space-x-3 pt-4 border-t">
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
                className="bg-blue-600 hover:bg-blue-700"
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