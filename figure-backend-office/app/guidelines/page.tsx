'use client'

import { useState } from 'react'
import { useGuidelines } from '@/hooks/use-guidelines'
import { useSites } from '@/hooks/use-sites'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { 
  Plus, 
  Edit, 
  Trash2, 
  Search, 
  Filter, 
  Eye,
  Target,
  Users,
  Globe,
  Building2,
  AlertCircle,
  CheckCircle,
  XCircle,
  RefreshCw
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ko } from 'date-fns/locale'
import { 
  Guideline, 
  GuidelineCreateRequest, 
  GuidelineUpdateRequest, 
  GuidelineType,
  GuidelineScope,
  GUIDELINE_TYPES,
  GUIDELINE_SCOPES,
  GUIDELINE_PRIORITIES
} from '@/types/guidelines'
import MainLayout from '@/components/layout/main-layout'
import { GuidelineFormModal } from '@/components/guidelines/guideline-form-modal'
import { GuidelineViewModal } from '@/components/guidelines/guideline-view-modal'

export default function GuidelinesPage() {
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingGuideline, setEditingGuideline] = useState<Guideline | null>(null)
  const [viewingGuideline, setViewingGuideline] = useState<Guideline | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('')
  const [scopeFilter, setScopeFilter] = useState<string>('')
  const [siteFilter, setSiteFilter] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  
  const { sites } = useSites()
  const { 
    guidelines, 
    isLoading, 
    error, 
    createGuideline, 
    updateGuideline, 
    deleteGuideline,
    refetch,
    isCreating,
    isUpdating,
    isDeleting,
    createError,
    updateError,
    deleteError
  } = useGuidelines({
    search_query: searchQuery || undefined,
    guideline_type: typeFilter || undefined,
    scope: scopeFilter || undefined,
    site_id: siteFilter || undefined,
    is_active: statusFilter === 'active' ? true : statusFilter === 'inactive' ? false : undefined,
  })

  // 필터링된 지침
  const filteredGuidelines = guidelines.filter(({ guideline }) => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      guideline.title.toLowerCase().includes(query) ||
      guideline.description?.toLowerCase().includes(query) ||
      guideline.role_instruction.toLowerCase().includes(query) ||
      guideline.objective_instruction.toLowerCase().includes(query)
    )
  })

  // 모달 상태 리셋
  const resetModals = () => {
    setShowCreateModal(false)
    setEditingGuideline(null)
    setViewingGuideline(null)
  }

  // 생성 모달 열기
  const handleCreate = () => {
    setShowCreateModal(true)
  }

  // 수정 모달 열기
  const handleEdit = (guideline: Guideline) => {
    setEditingGuideline(guideline)
  }

  // 상세 보기 모달 열기
  const handleView = (guideline: Guideline) => {
    setViewingGuideline(guideline)
  }

  // 삭제 확인
  const handleDelete = (id: string, title: string) => {
    if (window.confirm(`정말로 '${title}' 지침을 삭제하시겠습니까?`)) {
      deleteGuideline(id)
    }
  }

  // 지침 타입 색상 매핑
  const getTypeColor = (type: GuidelineType) => {
    const colors: Record<GuidelineType, string> = {
      'BUSINESS_FLOW': 'bg-blue-100 text-blue-800',
      'SEQUENCE_DIAGRAM': 'bg-purple-100 text-purple-800',
      'REQUIREMENTS': 'bg-green-100 text-green-800',
      'PROGRAM_DESIGN_ONLINE': 'bg-orange-100 text-orange-800',
      'PROGRAM_DESIGN_BATCH': 'bg-red-100 text-red-800',
      'PROGRAM_DESIGN_COMMON': 'bg-yellow-100 text-yellow-800',
      'IMPACT_ANALYSIS': 'bg-rose-100 text-rose-800',
      'TABLE_SPECIFICATION': 'bg-indigo-100 text-indigo-800',
      'INTERFACE_SPECIFICATION': 'bg-teal-100 text-teal-800',
      'GENERAL': 'bg-gray-100 text-gray-800'
    }
    return colors[type] || 'bg-gray-100 text-gray-800'
  }

  // 우선순위 색상 가져오기
  const getPriorityColor = (priority: number) => {
    if (priority >= 100) return 'text-red-600 font-bold'
    if (priority >= 80) return 'text-orange-600 font-semibold'
    if (priority >= 60) return 'text-yellow-600'
    if (priority >= 40) return 'text-blue-600'
    return 'text-gray-600'
  }

  // 사이트명 가져오기
  const getSiteName = (siteId?: string) => {
    if (!siteId) return '전역'
    const site = sites?.find(s => s.id === siteId)
    return site?.name || siteId
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* 헤더 */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">🎯 LLM 지침 관리</h1>
            <p className="text-gray-600">문서 생성 시 LLM이 따를 지침을 관리합니다</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => refetch()} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              새로고침
            </Button>
            <Button onClick={handleCreate} className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              새 지침 추가
            </Button>
          </div>
        </div>

        {/* 통계 카드 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">전체 지침</p>
                  <p className="text-2xl font-bold">{guidelines.length}</p>
                </div>
                <Target className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">활성 지침</p>
                  <p className="text-2xl font-bold text-green-600">
                    {guidelines.filter(({ guideline }) => guideline.is_active).length}
                  </p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">전역 지침</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {guidelines.filter(({ guideline }) => guideline.scope === 'GLOBAL').length}
                  </p>
                </div>
                <Globe className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">사이트별 지침</p>
                  <p className="text-2xl font-bold text-purple-600">
                    {guidelines.filter(({ guideline }) => guideline.scope === 'SITE_SPECIFIC').length}
                  </p>
                </div>
                <Building2 className="h-8 w-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 필터링 및 검색 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              필터 및 검색
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              {/* 검색 */}
              <div>
                <Label htmlFor="search">검색</Label>
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                  <Input
                    id="search"
                    placeholder="제목, 설명, 지침 내용..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>

              {/* 문서 타입 필터 */}
              <div>
                <Label htmlFor="type-filter">문서 타입</Label>
                <select
                  id="type-filter"
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">전체 타입</option>
                  {Object.entries(GUIDELINE_TYPES).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>

              {/* 범위 필터 */}
              <div>
                <Label htmlFor="scope-filter">적용 범위</Label>
                <select
                  id="scope-filter"
                  value={scopeFilter}
                  onChange={(e) => setScopeFilter(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">전체 범위</option>
                  {Object.entries(GUIDELINE_SCOPES).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>

              {/* 사이트 필터 */}
              <div>
                <Label htmlFor="site-filter">사이트</Label>
                <select
                  id="site-filter"
                  value={siteFilter}
                  onChange={(e) => setSiteFilter(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">전체 사이트</option>
                  {sites?.map(site => (
                    <option key={site.id} value={site.id}>{site.name}</option>
                  ))}
                </select>
              </div>

              {/* 상태 필터 */}
              <div>
                <Label htmlFor="status-filter">상태</Label>
                <select
                  id="status-filter"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">전체 상태</option>
                  <option value="active">활성</option>
                  <option value="inactive">비활성</option>
                </select>
              </div>
            </div>

            {/* 필터 초기화 */}
            {(searchQuery || typeFilter || scopeFilter || siteFilter || statusFilter) && (
              <div className="mt-4 flex justify-end">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => {
                    setSearchQuery('')
                    setTypeFilter('')
                    setScopeFilter('')
                    setSiteFilter('')
                    setStatusFilter('')
                  }}
                >
                  필터 초기화
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 지침 목록 */}
        {error && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-red-600">
                <AlertCircle className="h-5 w-5" />
                <span>지침을 불러오는 중 오류가 발생했습니다: {error.message}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {isLoading ? (
          <div className="text-center py-8">
            <div className="inline-flex items-center px-4 py-2 font-semibold leading-6 text-sm shadow rounded-md text-gray-500 bg-white">
              <RefreshCw className="animate-spin -ml-1 mr-3 h-5 w-5 text-gray-500" />
              지침을 불러오는 중...
            </div>
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredGuidelines.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center text-gray-500">
                  {guidelines.length === 0 ? (
                    <div className="space-y-2">
                      <Target className="h-12 w-12 mx-auto text-gray-300" />
                      <p className="text-lg font-medium">아직 지침이 없습니다</p>
                      <p>새로운 LLM 지침을 추가해보세요.</p>
                      <Button onClick={handleCreate} className="mt-4">
                        <Plus className="h-4 w-4 mr-2" />
                        첫 번째 지침 추가
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Search className="h-12 w-12 mx-auto text-gray-300" />
                      <p className="text-lg font-medium">검색 결과가 없습니다</p>
                      <p>다른 검색어나 필터를 시도해보세요.</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              filteredGuidelines.map(({ guideline, can_edit, can_delete }) => (
                <Card key={guideline.id} className="hover:shadow-lg transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-3">
                          <h3 className="text-lg font-semibold text-gray-900">{guideline.title}</h3>
                          <Badge className={getTypeColor(guideline.guideline_type)}>
                            {GUIDELINE_TYPES[guideline.guideline_type]}
                          </Badge>
                          <Badge variant={guideline.scope === 'GLOBAL' ? 'default' : 'secondary'}>
                            {guideline.scope === 'GLOBAL' ? (
                              <>
                                <Globe className="h-3 w-3 mr-1" />
                                전역
                              </>
                            ) : (
                              <>
                                <Building2 className="h-3 w-3 mr-1" />
                                {getSiteName(guideline.site_id)}
                              </>
                            )}
                          </Badge>
                          <Badge variant={guideline.is_active ? 'default' : 'secondary'} className={
                            guideline.is_active 
                              ? 'bg-green-100 text-green-800 hover:bg-green-200' 
                              : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                          }>
                            {guideline.is_active ? (
                              <>
                                <CheckCircle className="h-3 w-3 mr-1" />
                                활성
                              </>
                            ) : (
                              <>
                                <XCircle className="h-3 w-3 mr-1" />
                                비활성
                              </>
                            )}
                          </Badge>
                        </div>
                        <p className="text-gray-600 text-sm">{guideline.description}</p>
                        <div className="flex items-center gap-4 text-sm text-gray-500">
                          <span className={`font-medium ${getPriorityColor(guideline.priority)}`}>
                            우선순위: {guideline.priority}
                          </span>
                          <span>
                            수정: {formatDistanceToNow(new Date(guideline.updated_at!), { addSuffix: true, locale: ko })}
                          </span>
                          {guideline.tags.length > 0 && (
                            <div className="flex gap-1">
                              {guideline.tags.slice(0, 3).map((tag, index) => (
                                <Badge key={index} variant="outline" className="text-xs">
                                  {tag}
                                </Badge>
                              ))}
                              {guideline.tags.length > 3 && (
                                <Badge variant="outline" className="text-xs">
                                  +{guideline.tags.length - 3}
                                </Badge>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleView(guideline)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {can_edit && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(guideline)}
                            disabled={isUpdating}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        )}
                        {can_delete && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDelete(guideline.id, guideline.title)}
                            disabled={isDeleting}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* 지침 내용 미리보기 */}
                    <div className="grid md:grid-cols-2 gap-4 mt-4 p-4 bg-gray-50 rounded-lg">
                      <div>
                        <Label className="text-sm font-medium text-gray-700">📋 역할 지침</Label>
                        <p className="text-sm text-gray-600 mt-1 line-clamp-3">
                          {guideline.role_instruction.substring(0, 100)}
                          {guideline.role_instruction.length > 100 && '...'}
                        </p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-gray-700">🎯 목표 지침</Label>
                        <p className="text-sm text-gray-600 mt-1 line-clamp-3">
                          {guideline.objective_instruction.substring(0, 100)}
                          {guideline.objective_instruction.length > 100 && '...'}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}

        {/* 지침 생성/수정 모달 */}
        <GuidelineFormModal
          isOpen={showCreateModal || editingGuideline !== null}
          editingGuideline={editingGuideline}
          onClose={resetModals}
          onSubmit={(data) => {
            if ('id' in data) {
              // 수정
              updateGuideline(data)
            } else {
              // 생성
              createGuideline(data)
            }
          }}
          isLoading={isCreating || isUpdating}
          error={createError || updateError}
        />

        {/* 지침 상세 보기 모달 */}
        <GuidelineViewModal
          isOpen={viewingGuideline !== null}
          guideline={viewingGuideline}
          onClose={resetModals}
          onEdit={(guideline) => {
            setViewingGuideline(null)
            setEditingGuideline(guideline)
          }}
          onDelete={handleDelete}
        />
      </div>
    </MainLayout>
  )
}
