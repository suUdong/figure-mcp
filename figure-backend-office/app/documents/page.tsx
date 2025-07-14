'use client'

import { useState } from 'react'
import { useDocuments } from '@/hooks/use-documents'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Search, FileText, Calendar, Download, Trash2, Eye, Filter, RefreshCw } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ko } from 'date-fns/locale'
import { Document } from '@/types/api'

export default function DocumentsPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null)
  const [showViewModal, setShowViewModal] = useState(false)
  const [filterType, setFilterType] = useState<'all' | 'pdf' | 'txt' | 'doc'>('all')
  
  const { 
    documents, 
    isLoading, 
    error, 
    searchDocuments, 
    deleteDocument, 
    refetch
  } = useDocuments()

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

  const filteredDocuments = documents?.filter((doc: Document) => {
    if (filterType === 'all') return true
    return doc.type === filterType
  })

  const getFileIcon = (type: string) => {
    switch (type) {
      case 'pdf':
        return <FileText className="h-4 w-4 text-red-500" />
      case 'txt':
        return <FileText className="h-4 w-4 text-blue-500" />
      case 'doc':
        return <FileText className="h-4 w-4 text-blue-600" />
      default:
        return <FileText className="h-4 w-4 text-gray-500" />
    }
  }

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      'processed': { label: '처리완료', color: 'bg-green-500' },
      'processing': { label: '처리중', color: 'bg-yellow-500' },
      'failed': { label: '실패', color: 'bg-red-500' },
      'pending': { label: '대기중', color: 'bg-gray-500' }
    }
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending
    
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
          <h1 className="text-2xl font-bold text-gray-900">문서 관리</h1>
          <p className="text-gray-600 mt-1">업로드된 문서를 검색하고 관리할 수 있습니다</p>
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
        </div>
      </div>

      {/* Search and Filter */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Search className="h-5 w-5" />
            <span>문서 검색</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 flex space-x-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="문서 내용을 검색하세요..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <Button onClick={handleSearch} className="px-6">
                검색
              </Button>
            </div>
            
            <div className="flex items-center space-x-2">
              <Filter className="h-4 w-4 text-gray-500" />
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as any)}
                className="border border-gray-300 rounded-lg px-3 py-2"
              >
                <option value="all">모든 파일</option>
                <option value="pdf">PDF</option>
                <option value="txt">텍스트</option>
                <option value="doc">문서</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Documents List */}
      <Card>
        <CardHeader>
          <CardTitle>문서 목록</CardTitle>
          <CardDescription>
            총 {filteredDocuments?.length || 0}개의 문서
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
          ) : !filteredDocuments || filteredDocuments.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>문서가 없습니다</p>
              <p className="text-sm">첫 번째 문서를 업로드해보세요</p>
            </div>
          ) : (
                         <div className="space-y-4">
               {filteredDocuments.map((document: Document) => (
                 <div
                   key={document.id}
                   className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                 >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      {getFileIcon(document.type)}
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900">{document.filename}</h3>
                        <div className="flex items-center space-x-4 mt-1 text-sm text-gray-500">
                          <span className="flex items-center space-x-1">
                            <Calendar className="h-3 w-3" />
                            <span>
                              {formatDistanceToNow(new Date(document.created_at), { 
                                addSuffix: true, 
                                locale: ko 
                              })}
                            </span>
                          </span>
                          <span>{document.size} bytes</span>
                          <span>벡터 수: {document.vector_count || 0}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      {getStatusBadge(document.status)}
                      <Button
                        onClick={() => handleViewDocument(document)}
                        variant="ghost"
                        size="sm"
                        className="text-blue-600 hover:text-blue-800"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        onClick={() => handleDeleteDocument(document.id)}
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:text-red-800"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  
                  {document.metadata && (
                    <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-700">{document.metadata}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Document View Modal */}
      {showViewModal && selectedDocument && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">문서 상세정보</h2>
                <Button
                  onClick={() => setShowViewModal(false)}
                  variant="ghost"
                  size="sm"
                >
                  ✕
                </Button>
              </div>
              
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      파일명
                    </label>
                    <p className="text-gray-900">{selectedDocument.filename}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      상태
                    </label>
                    {getStatusBadge(selectedDocument.status)}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      파일 크기
                    </label>
                    <p className="text-gray-900">{selectedDocument.size} bytes</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      벡터 수
                    </label>
                    <p className="text-gray-900">{selectedDocument.vector_count || 0}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      생성일
                    </label>
                    <p className="text-gray-900">
                      {new Date(selectedDocument.created_at).toLocaleString('ko-KR')}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      파일 타입
                    </label>
                    <p className="text-gray-900">{selectedDocument.type}</p>
                  </div>
                </div>
                
                {selectedDocument.metadata && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      메타데이터
                    </label>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-gray-700">{selectedDocument.metadata}</p>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="mt-6 flex justify-end space-x-2">
                <Button
                  onClick={() => handleDeleteDocument(selectedDocument.id)}
                  variant="outline"
                  className="text-red-600 hover:text-red-800"
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
    </div>
  )
} 