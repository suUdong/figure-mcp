'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { AlertCircle, Search, Clock, FileText, Globe, Database, CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { useSites } from '@/hooks/use-sites'
import { queryRAG } from '@/lib/api'
import MainLayout from '@/components/layout/main-layout'

// 새로운 API 스키마에 맞춘 인터페이스
interface SourceInfo {
  content: string
  metadata: {
    [key: string]: any
    title?: string
    doc_type?: string
    source_url?: string
    site_name?: string
  }
}

interface RAGResponse {
  success: boolean
  message?: string
  data?: {
    answer: string
    sources?: SourceInfo[]
    query_time?: number
    job_id?: string
    total_results?: number
  }
}

export default function RAGTestPage() {
  const [query, setQuery] = useState('')
  const [response, setResponse] = useState<RAGResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [maxResults, setMaxResults] = useState(5)
  const [similarityThreshold, setSimilarityThreshold] = useState(0.200)
  const [selectedSites, setSelectedSites] = useState<string[]>([])
  
  const { sites } = useSites()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return

    setIsLoading(true)
    setResponse(null)

    try {
      const requestBody = {
        query: query.trim(),
        max_results: maxResults,
        similarity_threshold: similarityThreshold,
        site_ids: selectedSites.length > 0 ? selectedSites : undefined
      }

      const data = await queryRAG(requestBody)
      setResponse(data)
    } catch (error) {
      console.error('RAG 요청 실패:', error)
      setResponse({
        success: false,
        message: '요청 처리 중 오류가 발생했습니다.'
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleSiteToggle = (siteId: string) => {
    setSelectedSites(prev => 
      prev.includes(siteId) 
        ? prev.filter(id => id !== siteId)
        : [...prev, siteId]
    )
  }

  const getDocTypeIcon = (docType?: string) => {
    switch (docType?.toLowerCase()) {
      case 'pdf': return <FileText className="h-4 w-4 text-red-600" />
      case 'website': case 'web': return <Globe className="h-4 w-4 text-blue-600" />
      case 'text': case 'txt': return <FileText className="h-4 w-4 text-gray-600" />
      case 'doc': case 'docx': return <FileText className="h-4 w-4 text-blue-800" />
      default: return <Database className="h-4 w-4 text-gray-500" />
    }
  }

  const getDocTypeBadgeColor = (docType?: string) => {
    switch (docType?.toLowerCase()) {
      case 'pdf': return 'bg-red-50 text-red-700 border-red-200'
      case 'website': case 'web': return 'bg-blue-50 text-blue-700 border-blue-200'
      case 'text': case 'txt': return 'bg-gray-50 text-gray-700 border-gray-200'
      case 'doc': case 'docx': return 'bg-indigo-50 text-indigo-700 border-indigo-200'
      default: return 'bg-gray-50 text-gray-600 border-gray-200'
    }
  }

  return (
    <MainLayout>
      <div className="min-h-screen bg-gradient-to-br from-gray-25 via-white to-figure-25">
        <div className="mx-auto max-w-none px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10 xl:px-12 xl:py-12">
          
          {/* Enhanced Page Header */}
          <header className="mb-8 lg:mb-12">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-2">
                <h1 className="text-3xl font-bold text-gray-900 tracking-tight sm:text-4xl lg:text-5xl">
                  RAG 질의응답 테스트
                </h1>
                <p className="text-base text-gray-600 sm:text-lg lg:text-xl lg:leading-relaxed">
                  문서 검색 기반 AI 질의응답 시스템을 테스트하고 검증하세요
                </p>
              </div>
              
              {/* Status Badge */}
              <div className="flex items-center gap-3 rounded-2xl border border-figure-200 bg-figure-50 px-6 py-3 shadow-sm">
                <Search className="h-5 w-5 text-figure-600" />
                <span className="text-sm font-semibold text-figure-700">
                  AI 검색 엔진 활성화
                </span>
              </div>
            </div>
          </header>

          {/* Main Content Grid */}
          <div className="grid gap-8 lg:gap-12 lg:grid-cols-5">
            
            {/* Query Input Section - Enhanced */}
            <div className="lg:col-span-2">
              <Card className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition-all hover:shadow-lg">
                <div className="border-b border-gray-100 bg-gradient-to-r from-figure-50 to-figure-100 px-6 py-4">
                  <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                    <Search className="h-5 w-5 text-figure-600" />
                    질의 설정
                  </h2>
                </div>
                
                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                  {/* Query Input */}
                  <div className="space-y-2">
                    <Label htmlFor="query" className="text-sm font-semibold text-gray-700">
                      질문
                    </Label>
                    <Textarea
                      id="query"
                      placeholder="Figure 디자인 도구에 대해 궁금한 점을 자세히 질문해주세요..."
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      className="min-h-[140px] resize-none border-gray-200 focus:border-figure-400 focus:ring-figure-400/20"
                    />
                  </div>

                  {/* Advanced Settings */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="maxResults" className="text-sm font-semibold text-gray-700">
                        최대 결과 수
                      </Label>
                      <Input
                        id="maxResults"
                        type="number"
                        min="1"
                        max="20"
                        value={maxResults}
                        onChange={(e) => setMaxResults(Number(e.target.value))}
                        className="border-gray-200 focus:border-figure-400 focus:ring-figure-400/20"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="similarity" className="text-sm font-semibold text-gray-700">
                        유사도 임계값
                      </Label>
                      <Input
                        id="similarity"
                        type="number"
                        min="0"
                        max="1"
                        step="0.001"
                        value={similarityThreshold}
                        onChange={(e) => setSimilarityThreshold(Number(e.target.value))}
                        placeholder="0.200"
                        className="border-gray-200 focus:border-figure-400 focus:ring-figure-400/20"
                      />
                    </div>
                  </div>

                  {/* Site Filters */}
                  {sites && sites.length > 0 && (
                    <div className="space-y-3">
                      <Label className="text-sm font-semibold text-gray-700">
                        사이트 필터 (선택사항)
                      </Label>
                      <div className="flex flex-wrap gap-2">
                        {sites.map((site) => (
                          <Badge
                            key={site.id}
                            variant={selectedSites.includes(site.id) ? "default" : "secondary"}
                            className="cursor-pointer transition-all hover:scale-105"
                            onClick={() => handleSiteToggle(site.id)}
                          >
                            {site.name}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Submit Button */}
                  <Button 
                    type="submit" 
                    disabled={!query.trim() || isLoading}
                    className="w-full bg-figure-600 hover:bg-figure-700 text-white font-semibold py-3 rounded-xl transition-all"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        AI가 답변을 생성 중...
                      </>
                    ) : (
                      <>
                        <Search className="h-4 w-4 mr-2" />
                        질문하기
                      </>
                    )}
                  </Button>
                </form>
              </Card>
            </div>

            {/* Response Section - Enhanced */}
            <div className="lg:col-span-3">
              {response && (
                <div className="space-y-6">
                  {/* Status Header */}
                  <Card className="rounded-2xl border bg-white shadow-sm">
                    <div className={`border-b px-6 py-4 ${response.success ? 'bg-gradient-to-r from-success-50 to-success-100 border-success-200' : 'bg-gradient-to-r from-destructive-50 to-destructive-100 border-destructive-200'}`}>
                      <div className="flex items-center gap-3">
                        {response.success ? (
                          <>
                            <CheckCircle2 className="h-6 w-6 text-success-600" />
                            <div>
                              <h3 className="text-lg font-bold text-success-800">응답 생성 완료</h3>
                              {response.data?.query_time && (
                                <p className="text-sm text-success-600 flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  처리 시간: {response.data.query_time.toFixed(3)}초
                                </p>
                              )}
                            </div>
                          </>
                        ) : (
                          <>
                            <XCircle className="h-6 w-6 text-destructive-600" />
                            <div>
                              <h3 className="text-lg font-bold text-destructive-800">응답 생성 실패</h3>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </Card>

                  {response.success && response.data ? (
                    <>
                      {/* AI Answer */}
                      <Card className="rounded-2xl border border-gray-100 bg-white shadow-sm">
                        <div className="border-b border-gray-100 bg-gradient-to-r from-figure-50 to-figure-100 px-6 py-4">
                          <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                            <Database className="h-5 w-5 text-figure-600" />
                            AI 답변
                          </h3>
                        </div>
                        <div className="p-6">
                          <div className="prose max-w-none text-gray-800 leading-relaxed">
                            {response.data.answer}
                          </div>
                        </div>
                      </Card>

                      {/* Sources */}
                      {response.data.sources && response.data.sources.length > 0 && (
                        <Card className="rounded-2xl border border-gray-100 bg-white shadow-sm">
                          <div className="border-b border-gray-100 bg-gradient-to-r from-info-50 to-info-100 px-6 py-4">
                            <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                              <FileText className="h-5 w-5 text-info-600" />
                              참조 소스 ({response.data.sources.length}개)
                            </h3>
                          </div>
                          <div className="p-6 space-y-4">
                            {response.data.sources.map((source, index) => (
                              <div key={index} className="group rounded-xl border border-gray-200 bg-gray-50/50 p-4 transition-all hover:border-gray-300 hover:bg-white hover:shadow-sm">
                                <div className="flex items-start gap-3">
                                  <div className="flex-shrink-0 mt-1">
                                    {getDocTypeIcon(source.metadata.doc_type)}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-2">
                                      <h4 className="font-semibold text-gray-900 truncate">
                                        {source.metadata.title || `문서 ${index + 1}`}
                                      </h4>
                                      {source.metadata.doc_type && (
                                        <Badge className={`text-xs border ${getDocTypeBadgeColor(source.metadata.doc_type)}`}>
                                          {source.metadata.doc_type.toUpperCase()}
                                        </Badge>
                                      )}
                                    </div>
                                    <p className="text-sm text-gray-600 leading-relaxed line-clamp-3">
                                      {source.content.length > 200 
                                        ? `${source.content.substring(0, 200)}...` 
                                        : source.content
                                      }
                                    </p>
                                    {source.metadata.source_url && (
                                      <div className="mt-2">
                                        <a 
                                          href={source.metadata.source_url} 
                                          target="_blank" 
                                          rel="noopener noreferrer"
                                          className="inline-flex items-center gap-1 text-xs text-figure-600 hover:text-figure-800 hover:underline"
                                        >
                                          <Globe className="h-3 w-3" />
                                          원본 보기
                                        </a>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </Card>
                      )}
                    </>
                  ) : (
                    /* Error Message */
                    <Card className="rounded-2xl border border-destructive-200 bg-destructive-50 p-6">
                      <div className="flex items-center gap-3 text-destructive-800">
                        <AlertCircle className="h-5 w-5" />
                        <p className="font-medium">{response.message || '알 수 없는 오류가 발생했습니다.'}</p>
                      </div>
                    </Card>
                  )}
                </div>
              )}

              {/* Empty State */}
              {!response && !isLoading && (
                <Card className="rounded-2xl border border-gray-100 bg-white p-12 text-center shadow-sm">
                  <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100">
                    <Search className="h-8 w-8 text-gray-500" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">질문을 입력해주세요</h3>
                  <p className="text-gray-600 max-w-md mx-auto">
                    업로드된 문서들을 AI가 검색하여 정확하고 상세한 답변을 제공합니다
                  </p>
                </Card>
              )}

              {/* Loading State */}
              {isLoading && (
                <Card className="rounded-2xl border border-gray-100 bg-white p-12 text-center shadow-sm">
                  <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-figure-100">
                    <Loader2 className="h-8 w-8 text-figure-600 animate-spin" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">AI가 답변을 생성하고 있습니다</h3>
                  <p className="text-gray-600">
                    문서를 검색하고 최적의 답변을 생성하는 중입니다...
                  </p>
                </Card>
              )}
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  )
}