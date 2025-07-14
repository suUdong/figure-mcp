'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { useSites } from '@/hooks/use-sites'
import { queryRAG } from '@/lib/api'
import MainLayout from '@/components/layout/main-layout'

interface RAGResponse {
  success: boolean
  data?: {
    query: string
    answer: string
    sources: Array<{
      title: string
      content: string
      doc_type: string
      similarity: number
      source_url?: string
    }>
    processing_time: number
    job_id?: string
  }
  message?: string
}

export default function RAGTestPage() {
  const [query, setQuery] = useState('')
  const [response, setResponse] = useState<RAGResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [maxResults, setMaxResults] = useState(5)
  const [similarityThreshold, setSimilarityThreshold] = useState(0.7)
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

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'text': return 'bg-blue-100 text-blue-800'
      case 'pdf': return 'bg-red-100 text-red-800'
      case 'doc': return 'bg-green-100 text-green-800'
      case 'website': return 'bg-purple-100 text-purple-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <MainLayout>
      <div className="container mx-auto max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">RAG 테스트</h1>
        <p className="text-gray-600">문서 검색 기반 질의응답 시스템을 테스트해보세요</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 질의 입력 섹션 */}
        <div className="lg:col-span-1">
          <Card className="p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="query">질문</Label>
                <Textarea
                  id="query"
                  placeholder="Figure 디자인 도구에 대해 궁금한 점을 질문해주세요..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="min-h-[120px]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="maxResults">최대 결과 수</Label>
                  <Input
                    id="maxResults"
                    type="number"
                    min="1"
                    max="20"
                    value={maxResults}
                    onChange={(e) => setMaxResults(Number(e.target.value))}
                  />
                </div>

                <div>
                  <Label htmlFor="similarity">유사도 임계값</Label>
                  <Input
                    id="similarity"
                    type="number"
                    min="0"
                    max="1"
                    step="0.1"
                    value={similarityThreshold}
                    onChange={(e) => setSimilarityThreshold(Number(e.target.value))}
                  />
                </div>
              </div>

              {/* 사이트 필터 */}
              {sites && sites.length > 0 && (
                <div>
                  <Label>사이트 필터 (선택사항)</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {sites.map((site) => (
                      <Badge
                        key={site.id}
                        variant={selectedSites.includes(site.id) ? "default" : "secondary"}
                        className="cursor-pointer"
                        onClick={() => handleSiteToggle(site.id)}
                      >
                        {site.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <Button 
                type="submit" 
                disabled={!query.trim() || isLoading}
                className="w-full"
              >
                {isLoading ? '처리 중...' : '질문하기'}
              </Button>
            </form>
          </Card>
        </div>

        {/* 응답 표시 섹션 */}
        <div className="lg:col-span-2">
          {response && (
            <div className="space-y-6">
              {/* 답변 */}
              <Card className="p-6">
                <h3 className="text-xl font-semibold mb-4">답변</h3>
                {response.success ? (
                  <div className="space-y-4">
                    <div className="prose prose-sm max-w-none">
                      <p className="whitespace-pre-wrap text-gray-800">
                        {response.data?.answer}
                      </p>
                    </div>
                    <div className="flex justify-between text-sm text-gray-500 pt-4 border-t">
                      <span>처리 시간: {response.data?.processing_time}초</span>
                      {response.data?.job_id && (
                        <span>작업 ID: {response.data.job_id}</span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-red-600 bg-red-50 p-4 rounded">
                    {response.message || '응답 생성에 실패했습니다.'}
                  </div>
                )}
              </Card>

              {/* 참고 문서 */}
              {response.success && response.data?.sources && response.data.sources.length > 0 && (
                <Card className="p-6">
                  <h3 className="text-xl font-semibold mb-4">참고 문서</h3>
                  <div className="space-y-4">
                    {response.data.sources.map((source, index) => (
                      <div key={index} className="border rounded-lg p-4 bg-gray-50">
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="font-medium text-gray-900">{source.title}</h4>
                          <div className="flex items-center gap-2">
                            <Badge className={getTypeColor(source.doc_type)}>
                              {source.doc_type}
                            </Badge>
                            <Badge variant="secondary">
                              {Math.round(source.similarity * 100)}%
                            </Badge>
                          </div>
                        </div>
                        <p className="text-sm text-gray-600 mb-2">{source.content}</p>
                        {source.source_url && (
                          <a 
                            href={source.source_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 text-sm"
                          >
                            원본 보기 →
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </div>
          )}

          {/* 초기 상태 메시지 */}
          {!response && !isLoading && (
            <Card className="p-6 text-center">
              <div className="text-gray-500">
                <p className="text-lg mb-2">질문을 입력해주세요</p>
                <p className="text-sm">업로드된 문서들을 검색하여 답변을 제공합니다</p>
              </div>
            </Card>
          )}

          {/* 로딩 상태 */}
          {isLoading && (
            <Card className="p-6 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">AI가 답변을 생성하고 있습니다...</p>
            </Card>
          )}
        </div>
      </div>
      </div>
    </MainLayout>
  )
} 