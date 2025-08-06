'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  TestTube,
  Play,
  Copy,
  CheckCircle,
  AlertCircle,
  Clock,
  Code,
  FileText,
  Zap,
  Activity,
  Globe,
  Database,
  Settings
} from 'lucide-react'
import MainLayout from '@/components/layout/main-layout'
import { MCP_API_ENDPOINTS, MCPApiEndpoint, MCPApiCategory, MCPTestResponse } from '@/types/mcp'
import { api } from '@/lib/api'

export default function MCPApiTestPage() {
  const [selectedEndpoint, setSelectedEndpoint] = useState<MCPApiEndpoint | null>(null)
  const [testParameters, setTestParameters] = useState<Record<string, any>>({})
  const [testBody, setTestBody] = useState<string>('')
  const [testResponse, setTestResponse] = useState<MCPTestResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<string>('documents')

  const handleParameterChange = (paramName: string, value: any) => {
    setTestParameters(prev => ({
      ...prev,
      [paramName]: value
    }))
  }

  const handleTestApi = async () => {
    if (!selectedEndpoint) return

    setIsLoading(true)
    const startTime = Date.now()

    try {
      let response
      const config: any = {}

      // 파라미터가 있는 경우 쿼리 스트링으로 추가
      if (selectedEndpoint.parameters && Object.keys(testParameters).length > 0) {
        config.params = testParameters
      }

      // POST/PUT 요청인 경우 body 추가
      if ((selectedEndpoint.method === 'POST' || selectedEndpoint.method === 'PUT') && testBody) {
        try {
          config.data = JSON.parse(testBody)
        } catch (e) {
          throw new Error('Invalid JSON in request body')
        }
      }

      // API 호출
      switch (selectedEndpoint.method) {
        case 'GET':
          response = await api.get(selectedEndpoint.path, config)
          break
        case 'POST':
          response = await api.post(selectedEndpoint.path, config.data, { params: config.params })
          break
        case 'PUT':
          response = await api.put(selectedEndpoint.path, config.data, { params: config.params })
          break
        case 'DELETE':
          response = await api.delete(selectedEndpoint.path, config)
          break
        default:
          throw new Error(`Unsupported method: ${selectedEndpoint.method}`)
      }

      const duration = Date.now() - startTime

      setTestResponse({
        success: true,
        status: response.status,
        data: response.data,
        duration,
        timestamp: new Date().toISOString()
      })

    } catch (error: any) {
      const duration = Date.now() - startTime
      setTestResponse({
        success: false,
        status: error.response?.status || 0,
        data: error.response?.data || null,
        error: error.message,
        duration,
        timestamp: new Date().toISOString()
      })
    } finally {
      setIsLoading(false)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  const getCategoryIcon = (categoryId: string) => {
    switch (categoryId) {
      case 'documents':
        return <FileText className="h-4 w-4" />
      case 'rag':
        return <Zap className="h-4 w-4" />
      case 'analysis':
        return <Code className="h-4 w-4" />
      case 'sites':
        return <Globe className="h-4 w-4" />
      case 'admin':
        return <Settings className="h-4 w-4" />
      default:
        return <Activity className="h-4 w-4" />
    }
  }

  const getMethodBadgeColor = (method: string) => {
    switch (method) {
      case 'GET':
        return 'bg-green-500 text-white'
      case 'POST':
        return 'bg-blue-500 text-white'
      case 'PUT':
        return 'bg-yellow-500 text-white'
      case 'DELETE':
        return 'bg-red-500 text-white'
      default:
        return 'bg-gray-500 text-white'
    }
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">MCP API 테스트</h1>
            <p className="text-gray-600 mt-2">
              Model Context Protocol에서 사용하는 API 엔드포인트를 테스트하고 검증할 수 있습니다
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
              <TestTube className="h-3 w-3 mr-1" />
              {MCP_API_ENDPOINTS.reduce((total, cat) => total + cat.endpoints.length, 0)} APIs
            </Badge>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* API 목록 */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  API 엔드포인트
                </CardTitle>
                <CardDescription>
                  테스트할 API를 선택하세요
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Tabs value={selectedCategory} onValueChange={setSelectedCategory} className="w-full">
                  <TabsList className="grid w-full grid-cols-2 lg:grid-cols-1 h-auto p-1 m-4 mb-2">
                    {MCP_API_ENDPOINTS.map((category) => (
                      <TabsTrigger
                        key={category.id}
                        value={category.id}
                        className="flex items-center gap-2 justify-start p-2"
                      >
                        {getCategoryIcon(category.id)}
                        <span className="hidden lg:inline">{category.name}</span>
                        <Badge variant="secondary" className="ml-auto text-xs">
                          {category.endpoints.length}
                        </Badge>
                      </TabsTrigger>
                    ))}
                  </TabsList>
                  
                  {MCP_API_ENDPOINTS.map((category) => (
                    <TabsContent key={category.id} value={category.id} className="mt-0">
                      <div className="space-y-1 p-4 pt-2">
                        {category.endpoints.map((endpoint) => (
                          <div
                            key={endpoint.id}
                            onClick={() => {
                              setSelectedEndpoint(endpoint)
                              setTestParameters({})
                              setTestBody('')
                              setTestResponse(null)
                            }}
                            className={`p-3 rounded-lg border cursor-pointer transition-all hover:shadow-sm ${
                              selectedEndpoint?.id === endpoint.id
                                ? 'border-blue-300 bg-blue-50'
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <Badge className={`text-xs ${getMethodBadgeColor(endpoint.method)}`}>
                                {endpoint.method}
                              </Badge>
                              <span className="font-medium text-sm">{endpoint.name}</span>
                            </div>
                            <p className="text-xs text-gray-600 mb-2">{endpoint.description}</p>
                            <div className="flex flex-wrap gap-1">
                              {endpoint.tags.map((tag) => (
                                <Badge key={tag} variant="outline" className="text-xs">
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </TabsContent>
                  ))}
                </Tabs>
              </CardContent>
            </Card>
          </div>

          {/* 테스트 영역 */}
          <div className="lg:col-span-2 space-y-6">
            {selectedEndpoint ? (
              <>
                {/* API 정보 */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <Badge className={getMethodBadgeColor(selectedEndpoint.method)}>
                          {selectedEndpoint.method}
                        </Badge>
                        {selectedEndpoint.name}
                      </CardTitle>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(selectedEndpoint.path)}
                      >
                        <Copy className="h-4 w-4 mr-1" />
                        Copy Path
                      </Button>
                    </div>
                    <CardDescription>
                      <code className="bg-gray-100 px-2 py-1 rounded text-sm">
                        {selectedEndpoint.path}
                      </code>
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-700">{selectedEndpoint.description}</p>
                  </CardContent>
                </Card>

                {/* 파라미터 설정 */}
                {selectedEndpoint.parameters && selectedEndpoint.parameters.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>파라미터</CardTitle>
                      <CardDescription>API 호출에 필요한 파라미터를 설정하세요</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {selectedEndpoint.parameters.map((param) => (
                        <div key={param.name} className="space-y-2">
                          <div className="flex items-center gap-2">
                            <label className="font-medium text-sm">{param.name}</label>
                            {param.required && (
                              <Badge variant="destructive" className="text-xs">Required</Badge>
                            )}
                            <Badge variant="outline" className="text-xs">{param.type}</Badge>
                          </div>
                          <p className="text-xs text-gray-600">{param.description}</p>
                          <input
                            type={param.type === 'number' ? 'number' : 'text'}
                            placeholder={param.example ? String(param.example) : `Enter ${param.name}`}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                            value={testParameters[param.name] || ''}
                            onChange={(e) => handleParameterChange(param.name, 
                              param.type === 'number' ? Number(e.target.value) : e.target.value
                            )}
                          />
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {/* Request Body */}
                {(selectedEndpoint.method === 'POST' || selectedEndpoint.method === 'PUT') && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Request Body</CardTitle>
                      <CardDescription>JSON 형식으로 요청 본문을 입력하세요</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <textarea
                        className="w-full h-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none font-mono text-sm"
                        placeholder={selectedEndpoint.requestBody ? 
                          JSON.stringify(selectedEndpoint.requestBody, null, 2) : 
                          '{\n  "key": "value"\n}'
                        }
                        value={testBody}
                        onChange={(e) => setTestBody(e.target.value)}
                      />
                    </CardContent>
                  </Card>
                )}

                {/* 테스트 실행 */}
                <Card>
                  <CardContent className="pt-6">
                    <Button 
                      onClick={handleTestApi}
                      disabled={isLoading}
                      className="w-full"
                      size="lg"
                    >
                      {isLoading ? (
                        <>
                          <Clock className="h-4 w-4 mr-2 animate-spin" />
                          테스트 실행 중...
                        </>
                      ) : (
                        <>
                          <Play className="h-4 w-4 mr-2" />
                          API 테스트 실행
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>

                {/* 테스트 결과 */}
                {testResponse && (
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2">
                          {testResponse.success ? (
                            <CheckCircle className="h-5 w-5 text-green-500" />
                          ) : (
                            <AlertCircle className="h-5 w-5 text-red-500" />
                          )}
                          테스트 결과
                        </CardTitle>
                        <div className="flex items-center gap-2">
                          <Badge variant={testResponse.success ? "default" : "destructive"}>
                            {testResponse.status}
                          </Badge>
                          <Badge variant="outline">
                            {testResponse.duration}ms
                          </Badge>
                        </div>
                      </div>
                      <CardDescription>
                        {new Date(testResponse.timestamp).toLocaleString('ko-KR')}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {testResponse.error && (
                        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                          <p className="text-red-700 font-medium">오류:</p>
                          <p className="text-red-600 text-sm">{testResponse.error}</p>
                        </div>
                      )}
                      
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium">응답 데이터:</h4>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => copyToClipboard(JSON.stringify(testResponse.data, null, 2))}
                          >
                            <Copy className="h-4 w-4 mr-1" />
                            Copy
                          </Button>
                        </div>
                        <pre className="bg-gray-100 p-3 rounded-lg text-sm overflow-x-auto">
                          {JSON.stringify(testResponse.data, null, 2)}
                        </pre>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            ) : (
              <Card className="h-96 flex items-center justify-center">
                <div className="text-center">
                  <TestTube className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    API를 선택하세요
                  </h3>
                  <p className="text-gray-600">
                    왼쪽 목록에서 테스트할 API 엔드포인트를 선택하세요
                  </p>
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>
    </MainLayout>
  )
}