'use client'

import { useState } from 'react'
import { useDocuments } from '@/hooks/use-documents'
import SimplifiedAdvancedUpload from '@/components/documents/simplified-advanced-upload'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Search, 
  FileText, 
  Calendar, 
  Download, 
  Trash2, 
  Eye, 
  Filter, 
  RefreshCw,
  SlidersHorizontal,
  ArrowUpDown,
  Grid3X3,
  List,
  Plus,
  Upload,
  ChevronDown,
  X,
  CheckCircle,
  AlertCircle,
  Clock,
  Database
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ko } from 'date-fns/locale'
import { Document } from '@/types/api'
import MainLayout from '@/components/layout/main-layout'

type ViewMode = 'grid' | 'list';
type SortField = 'name' | 'date' | 'size' | 'status';
type SortOrder = 'asc' | 'desc';

// 템플릿 타입 상수 import (전체 23개 문서 타입 지원)
import { TEMPLATE_TYPES } from '@/lib/constants/template-types';

interface FilterOptions {
  type: 'all' | 'pdf' | 'txt' | 'doc' | 'docx';
  status: 'all' | 'processed' | 'processing' | 'failed' | 'pending';
  dateRange: 'all' | 'today' | 'week' | 'month';
  templateType: 'all' | keyof typeof TEMPLATE_TYPES;
  siteId: string;
}

export default function DocumentsPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null)
  const [showViewModal, setShowViewModal] = useState(false)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [sortField, setSortField] = useState<SortField>('date')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
  const [showFilters, setShowFilters] = useState(false)
  const [selectedDocuments, setSelectedDocuments] = useState<string[]>([])
  
  const [filters, setFilters] = useState<FilterOptions>({
    type: 'all',
    status: 'all',
    dateRange: 'all',
    templateType: 'all',
    siteId: ''
  })
  
  const { 
    documents, 
    isLoading, 
    error, 
    searchDocuments, 
    deleteDocument, 
    refetch
  } = useDocuments({
    siteId: filters.siteId || undefined,
    templateType: filters.templateType !== 'all' ? filters.templateType : undefined
  })

  const handleSearch = () => {
    if (searchQuery.trim()) {
      searchDocuments(searchQuery)
    }
  }

  const handleDeleteDocument = async (documentId: string) => {
    if (confirm('이 문서를 삭제하시겠습니까?')) {
      await deleteDocument(documentId)
      refetch()
    }
  }

  const handleViewDocument = (document: any) => {
    setSelectedDocument(document)
    setShowViewModal(true)
  }

  const handleBulkDelete = async () => {
    if (selectedDocuments.length === 0) return
    if (confirm(`선택된 ${selectedDocuments.length}개의 문서를 삭제하시겠습니까?`)) {
      for (const docId of selectedDocuments) {
        await deleteDocument(docId)
      }
      setSelectedDocuments([])
      refetch()
    }
  }

  const toggleDocumentSelection = (docId: string) => {
    setSelectedDocuments(prev => 
      prev.includes(docId) 
        ? prev.filter(id => id !== docId)
        : [...prev, docId]
    )
  }

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortOrder('desc')
    }
  }

  const filteredDocuments = documents?.filter((doc: Document) => {
    // Type filter
    if (filters.type !== 'all' && doc.type !== filters.type) return false
    
    // Status filter
    if (filters.status !== 'all' && doc.status !== filters.status) return false
    
    // Date range filter
    if (filters.dateRange !== 'all') {
      const docDate = new Date(doc.created_at)
      const now = new Date()
      const diffInDays = Math.floor((now.getTime() - docDate.getTime()) / (1000 * 60 * 60 * 24))
      
      if (filters.dateRange === 'today' && diffInDays > 1) return false
      if (filters.dateRange === 'week' && diffInDays > 7) return false
      if (filters.dateRange === 'month' && diffInDays > 30) return false
    }
    
    return true
  })?.sort((a: Document, b: Document) => {
    let aValue: any = (a as any)[sortField]
    let bValue: any = (b as any)[sortField]
    
    if (sortField === 'date') {
      aValue = new Date(a.created_at).getTime()
      bValue = new Date(b.created_at).getTime()
    } else if (sortField === 'name') {
      aValue = a.filename.toLowerCase()
      bValue = b.filename.toLowerCase()
    }
    
    const comparison = aValue < bValue ? -1 : aValue > bValue ? 1 : 0
    return sortOrder === 'asc' ? comparison : -comparison
  })

  const getFileIcon = (type: string) => {
    switch (type) {
      case 'pdf':
        return <FileText className="h-5 w-5 text-error-500" />
      case 'txt':
        return <FileText className="h-5 w-5 text-info-500" />
      case 'doc':
      case 'docx':
        return <FileText className="h-5 w-5 text-figure-500" />
      default:
        return <FileText className="h-5 w-5 text-gray-500" />
    }
  }

  const getStorageStatusBadges = (storageStatus: any) => {
    if (!storageStatus) return null;
    
    return (
      <div className="flex flex-wrap gap-1">
        {/* Vector DB 상태 */}
        <Badge 
          variant={storageStatus.vector_db ? "default" : "secondary"}
          className={`text-xs ${storageStatus.vector_db ? "bg-blue-500 text-white" : "bg-gray-200 text-gray-600"}`}
        >
          <Database className="h-3 w-3 mr-1" />
          Vector
        </Badge>
        
        {/* RDB 상태 */}
        <Badge 
          variant={storageStatus.rdb ? "default" : "secondary"}
          className={`text-xs ${storageStatus.rdb ? "bg-green-500 text-white" : "bg-gray-200 text-gray-600"}`}
        >
          <Database className="h-3 w-3 mr-1" />
          RDB
        </Badge>
        
        {/* 파일 저장 상태 */}
        <Badge 
          variant={storageStatus.file_storage ? "default" : "secondary"}
          className={`text-xs ${storageStatus.file_storage ? "bg-purple-500 text-white" : "bg-gray-200 text-gray-600"}`}
        >
          <FileText className="h-3 w-3 mr-1" />
          File
        </Badge>
        
        {/* 전체 상태 표시 */}
        <Badge 
          variant={storageStatus.is_complete ? "default" : "destructive"}
          className={`text-xs ${storageStatus.is_complete ? "bg-emerald-500 text-white" : "bg-red-500 text-white"}`}
        >
          {storageStatus.is_complete ? (
            <CheckCircle className="h-3 w-3 mr-1" />
          ) : (
            <AlertCircle className="h-3 w-3 mr-1" />
          )}
          {storageStatus.total_storages}/3
        </Badge>
      </div>
    );
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      'processed': { 
        label: '처리완료', 
        icon: CheckCircle,
        className: 'bg-success-100 text-success-700 border-success-200' 
      },
      'processing': { 
        label: '처리중', 
        icon: Clock,
        className: 'bg-warning-100 text-warning-700 border-warning-200' 
      },
      'failed': { 
        label: '실패', 
        icon: AlertCircle,
        className: 'bg-error-100 text-error-700 border-error-200' 
      },
      'pending': { 
        label: '대기중', 
        icon: Clock,
        className: 'bg-gray-100 text-gray-700 border-gray-200' 
      }
    }
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending
    const IconComponent = config.icon
    
    return (
      <Badge className={`${config.className} text-sm font-medium border flex items-center gap-1.5 px-3 py-1.5`}>
        <IconComponent className="h-4 w-4" />
        {config.label}
      </Badge>
    )
  }

  const clearFilters = () => {
    setFilters({
      type: 'all',
      status: 'all',
      dateRange: 'all',
      templateType: 'all',
      siteId: ''
    })
    setSearchQuery('')
  }

  const activeFiltersCount = Object.values(filters).filter(value => value !== 'all' && value !== '').length

  // 업로드 관련 핸들러
  const handleUploadComplete = () => {
    refetch() // 문서 목록 새로고침
  }

  const handleUploadError = (error: any) => {
    console.error('업로드 오류:', error)
  }

  const handleAllComplete = (files: any[]) => {
    console.log('모든 파일 업로드 완료:', files)
    setShowUploadModal(false) // 모달 닫기
    refetch() // 문서 목록 새로고침
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">문서 관리</h1>
            <p className="text-gray-600">업로드된 문서를 검색하고 관리할 수 있습니다</p>
          </div>
          
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()} className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              <span className="hidden sm:inline">새로고침</span>
            </Button>
            
            <Button 
              size="sm" 
              onClick={() => setShowUploadModal(true)}
              className="flex items-center gap-2 bg-figure-500 hover:bg-figure-600"
            >
              <Upload className="h-4 w-4" />
              <span>문서 업로드</span>
            </Button>
          </div>
        </div>

        {/* Search and Filters Bar */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-6">
            <div className="space-y-4">
              {/* Search Input */}
              <div className="flex flex-col gap-4 sm:flex-row">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="문서 내용을 검색하세요..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                    className="w-full rounded-lg border border-gray-200 pl-10 pr-4 py-2.5 text-sm focus:border-figure-500 focus:ring-2 focus:ring-figure-500/20 focus:outline-none transition-colors"
                  />
                </div>
                
                <div className="flex items-center gap-2">
                  <Button onClick={handleSearch} className="bg-figure-500 hover:bg-figure-600">
                    <Search className="h-4 w-4 sm:mr-2" />
                    <span className="hidden sm:inline">검색</span>
                  </Button>
                  
                  <Button
                    variant="outline"
                    onClick={() => setShowFilters(!showFilters)}
                    className="relative"
                  >
                    <SlidersHorizontal className="h-4 w-4 sm:mr-2" />
                    <span className="hidden sm:inline">필터</span>
                    {activeFiltersCount > 0 && (
                      <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-figure-500 text-xs text-white flex items-center justify-center">
                        {activeFiltersCount}
                      </span>
                    )}
                  </Button>
                </div>
              </div>

              {/* Filters Panel */}
              {showFilters && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-4 p-4 bg-gray-50 rounded-lg border">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">파일 형식</label>
                    <select
                      value={filters.type}
                      onChange={(e) => setFilters(prev => ({ ...prev, type: e.target.value as any }))}
                      className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-figure-500 focus:ring-2 focus:ring-figure-500/20 focus:outline-none"
                    >
                      <option value="all">모든 형식</option>
                      <option value="pdf">PDF</option>
                      <option value="txt">텍스트</option>
                      <option value="doc">DOC</option>
                      <option value="docx">DOCX</option>
                    </select>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">상태</label>
                    <select
                      value={filters.status}
                      onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value as any }))}
                      className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-figure-500 focus:ring-2 focus:ring-figure-500/20 focus:outline-none"
                    >
                      <option value="all">모든 상태</option>
                      <option value="processed">처리완료</option>
                      <option value="processing">처리중</option>
                      <option value="failed">실패</option>
                      <option value="pending">대기중</option>
                    </select>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">기간</label>
                    <select
                      value={filters.dateRange}
                      onChange={(e) => setFilters(prev => ({ ...prev, dateRange: e.target.value as any }))}
                      className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-figure-500 focus:ring-2 focus:ring-figure-500/20 focus:outline-none"
                    >
                      <option value="all">전체 기간</option>
                      <option value="today">오늘</option>
                      <option value="week">최근 1주일</option>
                      <option value="month">최근 1개월</option>
                    </select>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">템플릿 유형</label>
                    <select
                      value={filters.templateType}
                      onChange={(e) => setFilters(prev => ({ ...prev, templateType: e.target.value as any }))}
                      className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-figure-500 focus:ring-2 focus:ring-figure-500/20 focus:outline-none"
                    >
                      <option value="all">모든 템플릿</option>
                      <option value="REQUIREMENTS">요구사항 정의서</option>
                      <option value="IMPACT_ANALYSIS">영향도 분석서</option>
                      <option value="API_DOCUMENTATION">API 문서</option>
                      <option value="DEPLOYMENT_GUIDE">배포 가이드</option>
                      <option value="TEST_PLAN">테스트 계획서</option>
                      <option value="TECHNICAL_SPECIFICATION">기술 명세서</option>
                      <option value="USER_MANUAL">사용자 매뉴얼</option>
                      <option value="RELEASE_NOTES">릴리즈 노트</option>
                      <option value="CUSTOM">사용자 정의</option>
                    </select>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">사이트</label>
                    <input
                      type="text"
                      value={filters.siteId}
                      onChange={(e) => setFilters(prev => ({ ...prev, siteId: e.target.value }))}
                      placeholder="사이트 ID 입력"
                      className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-figure-500 focus:ring-2 focus:ring-figure-500/20 focus:outline-none"
                    />
                  </div>
                  
                  <div className="flex items-end">
                    <Button variant="outline" onClick={clearFilters} className="w-full">
                      <X className="h-4 w-4 mr-2" />
                      초기화
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Controls Bar */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">
              총 {filteredDocuments?.length || 0}개의 문서
              {selectedDocuments.length > 0 && (
                <span className="ml-2 text-figure-600 font-medium">
                  ({selectedDocuments.length}개 선택됨)
                </span>
              )}
            </span>
            
            {selectedDocuments.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleBulkDelete}
                className="text-error-600 border-error-200 hover:bg-error-50"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                선택 삭제
              </Button>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            {/* Sort Dropdown */}
            <div className="relative">
              <select
                value={`${sortField}-${sortOrder}`}
                onChange={(e) => {
                  const [field, order] = e.target.value.split('-')
                  setSortField(field as SortField)
                  setSortOrder(order as SortOrder)
                }}
                className="appearance-none bg-white border border-gray-200 rounded-lg px-3 py-2 pr-8 text-sm focus:border-figure-500 focus:ring-2 focus:ring-figure-500/20 focus:outline-none"
              >
                <option value="date-desc">최신순</option>
                <option value="date-asc">오래된순</option>
                <option value="name-asc">이름순 (A-Z)</option>
                <option value="name-desc">이름순 (Z-A)</option>
                <option value="size-desc">크기순 (큰 것부터)</option>
                <option value="size-asc">크기순 (작은 것부터)</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
            
            {/* View Mode Toggle */}
            <div className="flex items-center border border-gray-200 rounded-lg p-1">
              <Button
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('list')}
                className="h-8 px-2"
              >
                <List className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'grid' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('grid')}
                className="h-8 px-2"
              >
                <Grid3X3 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Documents Display */}
        <Card className="border border-gray-200 shadow-sm bg-gray-50">
          <CardContent className="p-6 bg-gray-50">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-12 space-y-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-figure-500"></div>
                <span className="text-sm text-gray-500">문서를 불러오는 중...</span>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-12 space-y-4 text-center">
                <AlertCircle className="h-12 w-12 text-error-500" />
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">오류가 발생했습니다</h3>
                  <p className="text-sm text-gray-600 mb-4">{error.message}</p>
                  <Button onClick={() => refetch()} variant="outline">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    다시 시도
                  </Button>
                </div>
              </div>
            ) : !filteredDocuments || filteredDocuments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 space-y-4 text-center">
                <Database className="h-12 w-12 text-gray-300" />
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    {documents?.length === 0 ? '문서가 없습니다' : '검색 결과가 없습니다'}
                  </h3>
                  <p className="text-sm text-gray-600 mb-4">
                    {documents?.length === 0 
                      ? '첫 번째 문서를 업로드해보세요' 
                      : '다른 검색어나 필터를 시도해보세요'
                    }
                  </p>
                  {documents?.length === 0 ? (
                    <Button 
                      onClick={() => setShowUploadModal(true)}
                      className="bg-figure-500 hover:bg-figure-600"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      문서 업로드
                    </Button>
                  ) : (
                    <Button onClick={clearFilters} variant="outline">
                      <X className="h-4 w-4 mr-2" />
                      필터 초기화
                    </Button>
                  )}
                </div>
              </div>
            ) : viewMode === 'list' ? (
              <div className="space-y-1 py-2">
                {filteredDocuments.map((document: Document) => (
                  <div
                    key={document.id}
                    className={`group relative flex items-center gap-4 p-5 rounded-lg border transition-all hover:shadow-lg hover:border-gray-300 hover:-translate-y-0.5 ${
                      selectedDocuments.includes(document.id) 
                        ? 'border-figure-300 bg-figure-50 shadow-md ring-1 ring-figure-200' 
                        : 'border-gray-300 bg-white hover:bg-gray-50 shadow-md hover:shadow-lg'
                    } z-10 backdrop-blur-sm min-h-[80px]`}
                    style={{ marginBottom: '16px' }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedDocuments.includes(document.id)}
                      onChange={() => toggleDocumentSelection(document.id)}
                      className="h-5 w-5 rounded border-gray-300 text-figure-500 focus:ring-figure-500 focus:ring-offset-2 transition-all duration-200"
                    />
                    
                    <div className="flex-shrink-0">
                      {getFileIcon(document.type)}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-gray-900 truncate group-hover:text-figure-600 transition-colors">
                            {document.filename}
                          </h3>
                          <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {formatDistanceToNow(new Date(document.created_at), { 
                                addSuffix: true, 
                                locale: ko 
                              })}
                            </span>
                            <span>{(document.size / 1024).toFixed(1)} KB</span>
                            <span>벡터: {document.vector_count || 0}개</span>
                          </div>
                          {/* 템플릿 정보 표시 */}
                          {(document as any).template_type && (
                            <div className="flex items-center gap-2 mt-2">
                              <Badge variant="outline" className="text-xs">
                                {TEMPLATE_TYPES[(document as any).template_type] || (document as any).template_type}
                              </Badge>
                              {(document as any).template_version && (
                                <Badge variant="secondary" className="text-xs">
                                  v{(document as any).template_version}
                                </Badge>
                              )}
                            </div>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-3">
                          {/* 하이브리드 저장 상태 표시 */}
                          <div className="flex flex-col gap-1">
                            <div className="text-xs text-gray-500">저장 상태:</div>
                            {getStorageStatusBadges(document.storage_status)}
                          </div>
                          
                          {getStatusBadge(document.status)}
                          
                          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all duration-200">
                            <Button
                              onClick={() => handleViewDocument(document)}
                              variant="ghost"
                              size="sm"
                              className="h-10 w-10 p-0 text-gray-500 hover:text-figure-600 hover:bg-figure-50 rounded-lg transition-all duration-200 hover:scale-105"
                              title="문서 보기"
                            >
                              <Eye className="h-5 w-5" />
                            </Button>
                            <Button
                              onClick={() => handleDeleteDocument(document.id)}
                              variant="ghost"
                              size="sm"
                              className="h-10 w-10 p-0 text-gray-500 hover:text-error-600 hover:bg-error-50 rounded-lg transition-all duration-200 hover:scale-105"
                              title="문서 삭제"
                            >
                              <Trash2 className="h-5 w-5" />
                            </Button>
                          </div>
                        </div>
                      </div>
                      

                    </div>
                  </div>
                ))}
              </div>
            ) : (
              // Grid View
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredDocuments.map((document: Document) => (
                  <div
                    key={document.id}
                    className={`group relative p-4 rounded-lg border transition-all hover:shadow-md hover:border-gray-300 ${
                      selectedDocuments.includes(document.id) 
                        ? 'border-figure-200 bg-figure-50' 
                        : 'border-gray-100 bg-white hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedDocuments.includes(document.id)}
                      onChange={() => toggleDocumentSelection(document.id)}
                      className="absolute top-3 left-3 rounded border-gray-300 text-figure-500 focus:ring-figure-500"
                    />
                    
                    <div className="pt-6">
                      <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-gray-100 mx-auto mb-3">
                        {getFileIcon(document.type)}
                      </div>
                      
                      <h3 className="font-semibold text-gray-900 text-center truncate mb-2 group-hover:text-figure-600 transition-colors">
                        {document.filename}
                      </h3>
                      
                      <div className="space-y-2 text-xs text-gray-500 text-center">
                        <div>{formatDistanceToNow(new Date(document.created_at), { addSuffix: true, locale: ko })}</div>
                        <div>{(document.size / 1024).toFixed(1)} KB</div>
                      </div>
                      
                      <div className="flex justify-center mt-3">
                        {getStatusBadge(document.status)}
                      </div>
                      
                      {/* 하이브리드 저장 상태 표시 (Grid View) */}
                      <div className="flex justify-center mt-2">
                        <div className="text-center">
                          <div className="text-xs text-gray-500 mb-1">저장 상태</div>
                          {getStorageStatusBadges(document.storage_status)}
                        </div>
                      </div>
                      
                      <div className="flex justify-center gap-1 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          onClick={() => handleViewDocument(document)}
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-gray-400 hover:text-figure-600"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          onClick={() => handleDeleteDocument(document.id)}
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-gray-400 hover:text-error-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Document View Modal */}
        {showViewModal && selectedDocument && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto shadow-2xl">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-gray-900">문서 상세정보</h2>
                  <Button
                    onClick={() => setShowViewModal(false)}
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">파일명</label>
                      <p className="text-gray-900 font-medium">{selectedDocument.filename}</p>
                    </div>
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">상태</label>
                      {getStatusBadge(selectedDocument.status)}
                    </div>
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">파일 크기</label>
                      <p className="text-gray-900">{(selectedDocument.size / 1024).toFixed(1)} KB</p>
                    </div>
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">벡터 수</label>
                      <p className="text-gray-900">{selectedDocument.vector_count || 0}개</p>
                    </div>
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">생성일</label>
                      <p className="text-gray-900">
                        {new Date(selectedDocument.created_at).toLocaleString('ko-KR')}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">파일 타입</label>
                      <div className="flex items-center gap-2">
                        {getFileIcon(selectedDocument.type)}
                        <span className="text-gray-900 uppercase">{selectedDocument.type}</span>
                      </div>
                    </div>
                  </div>
                  
                  {selectedDocument.metadata && (
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">메타데이터</label>
                      <div className="bg-gray-50 rounded-lg p-4 border">
                        <p className="text-gray-700 leading-relaxed">{selectedDocument.metadata}</p>
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="mt-8 flex justify-end gap-3">
                  <Button
                    onClick={() => handleDeleteDocument(selectedDocument.id)}
                    variant="outline"
                    className="text-error-600 border-error-200 hover:bg-error-50"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    삭제
                  </Button>
                  <Button onClick={() => setShowViewModal(false)}>
                    닫기
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Upload Modal */}
        {showUploadModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-gray-900">문서 업로드</h2>
                  <Button
                    onClick={() => setShowUploadModal(false)}
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                
                {/* 업로드 컴포넌트 */}
                <SimplifiedAdvancedUpload
                  maxFiles={10}
                  maxSize={100 * 1024 * 1024} // 100MB
                  autoUpload={false}
                  showPreview={true}
                  onUploadComplete={handleUploadComplete}
                  onUploadError={handleUploadError}
                  onAllComplete={handleAllComplete}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  )
} 