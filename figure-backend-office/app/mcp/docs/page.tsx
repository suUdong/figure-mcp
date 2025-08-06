'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  FileText,
  Copy,
  ExternalLink,
  Code,
  BookOpen,
  Zap,
  Database,
  Globe,
  Settings,
  Activity,
  CheckCircle,
  Info
} from 'lucide-react'
import MainLayout from '@/components/layout/main-layout'
import { MCP_API_ENDPOINTS, MCPApiEndpoint } from '@/types/mcp'

export default function MCPDocsPage() {
  const [selectedEndpoint, setSelectedEndpoint] = useState<MCPApiEndpoint | null>(null)
  const [copiedCode, setCopiedCode] = useState<string>('')

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text)
    setCopiedCode(type)
    setTimeout(() => setCopiedCode(''), 2000)
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

  const getMethodColor = (method: string) => {
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

  const generateCurlExample = (endpoint: MCPApiEndpoint) => {
    let curl = `curl -X ${endpoint.method} "http://localhost:8001${endpoint.path}"`
    
    if (endpoint.parameters && endpoint.parameters.length > 0) {
      const params = endpoint.parameters
        .filter(p => p.example !== undefined)
        .map(p => `${p.name}=${p.example}`)
        .join('&')
      
      if (params && endpoint.method === 'GET') {
        curl += `?${params}`
      }
    }

    curl += ` \\\n  -H "Content-Type: application/json"`
    
    if (endpoint.requestBody && (endpoint.method === 'POST' || endpoint.method === 'PUT')) {
      curl += ` \\\n  -d '${JSON.stringify(endpoint.requestBody, null, 2).replace(/\n/g, '\n    ')}'`
    }

    return curl
  }

  const generateJavaScriptExample = (endpoint: MCPApiEndpoint) => {
    const method = endpoint.method.toLowerCase()
    let code = `// ${endpoint.name}\n`
    code += `const response = await fetch('http://localhost:8001${endpoint.path}'`
    
    if (endpoint.parameters && endpoint.parameters.length > 0 && endpoint.method === 'GET') {
      const params = endpoint.parameters
        .filter(p => p.example !== undefined)
        .map(p => `${p.name}=${p.example}`)
        .join('&')
      
      if (params) {
        code = code.replace(endpoint.path, `${endpoint.path}?${params}`)
      }
    }

    code += `, {\n  method: '${endpoint.method}',\n  headers: {\n    'Content-Type': 'application/json'\n  }`
    
    if (endpoint.requestBody && (endpoint.method === 'POST' || endpoint.method === 'PUT')) {
      code += `,\n  body: JSON.stringify(${JSON.stringify(endpoint.requestBody, null, 2).replace(/\n/g, '\n    ')})`
    }
    
    code += `\n});\n\nconst data = await response.json();\nconsole.log(data);`
    
    return code
  }

  const generatePythonExample = (endpoint: MCPApiEndpoint) => {
    let code = `import requests\nimport json\n\n# ${endpoint.name}\n`
    code += `url = "http://localhost:8001${endpoint.path}"\n`
    
    if (endpoint.parameters && endpoint.parameters.length > 0 && endpoint.method === 'GET') {
      code += `params = {\n`
      endpoint.parameters.forEach(p => {
        if (p.example !== undefined) {
          const value = typeof p.example === 'string' ? `"${p.example}"` : p.example
          code += `    "${p.name}": ${value},\n`
        }
      })
      code += `}\n\n`
    }

    code += `headers = {"Content-Type": "application/json"}\n\n`
    
    if (endpoint.requestBody && (endpoint.method === 'POST' || endpoint.method === 'PUT')) {
      code += `data = ${JSON.stringify(endpoint.requestBody, null, 2).replace(/\n/g, '\n')}\n\n`
    }

    const method = endpoint.method.toLowerCase()
    if (endpoint.method === 'GET') {
      code += `response = requests.${method}(url, headers=headers`
      if (endpoint.parameters && endpoint.parameters.length > 0) {
        code += `, params=params`
      }
      code += `)\n`
    } else {
      code += `response = requests.${method}(url, headers=headers`
      if (endpoint.requestBody) {
        code += `, json=data`
      }
      code += `)\n`
    }
    
    code += `\nprint(response.status_code)\nprint(response.json())`
    
    return code
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">MCP API 문서</h1>
            <p className="text-gray-600 mt-2">
              Model Context Protocol에서 사용하는 모든 API 엔드포인트의 상세 문서입니다
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
              <BookOpen className="h-3 w-3 mr-1" />
              API Docs v1.0
            </Badge>
          </div>
        </div>

        {/* 개요 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="h-5 w-5" />
              API 개요
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold mb-2">기본 정보</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Base URL:</span>
                    <code className="bg-gray-100 px-2 py-1 rounded">http://localhost:8001</code>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Content-Type:</span>
                    <code className="bg-gray-100 px-2 py-1 rounded">application/json</code>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">API Version:</span>
                    <code className="bg-gray-100 px-2 py-1 rounded">v1</code>
                  </div>
                </div>
              </div>
              <div>
                <h3 className="font-semibold mb-2">응답 형식</h3>
                <pre className="bg-gray-100 p-3 rounded-lg text-sm">
{`{
  "success": true,
  "message": "요청 성공",
  "data": { ... },
  "errors": null
}`}
                </pre>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* API 카테고리 및 엔드포인트 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 카테고리 목록 */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle>API 카테고리</CardTitle>
                <CardDescription>
                  {MCP_API_ENDPOINTS.reduce((total, cat) => total + cat.endpoints.length, 0)}개의 엔드포인트
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="space-y-1 p-4">
                  {MCP_API_ENDPOINTS.map((category) => (
                    <div key={category.id} className="space-y-2">
                      <div className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-2">
                          {getCategoryIcon(category.id)}
                          <span className="font-medium">{category.name}</span>
                        </div>
                        <Badge variant="secondary" className="text-xs">
                          {category.endpoints.length}
                        </Badge>
                      </div>
                      <div className="ml-6 space-y-1">
                        {category.endpoints.map((endpoint) => (
                          <div
                            key={endpoint.id}
                            onClick={() => setSelectedEndpoint(endpoint)}
                            className={`p-2 rounded cursor-pointer transition-colors text-sm ${
                              selectedEndpoint?.id === endpoint.id
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : 'hover:bg-gray-50'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <Badge className={`text-xs ${getMethodColor(endpoint.method)}`}>
                                {endpoint.method}
                              </Badge>
                              <span className="truncate">{endpoint.name}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 엔드포인트 상세 정보 */}
          <div className="lg:col-span-2">
            {selectedEndpoint ? (
              <div className="space-y-6">
                {/* 엔드포인트 정보 */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Badge className={getMethodColor(selectedEndpoint.method)}>
                          {selectedEndpoint.method}
                        </Badge>
                        <div>
                          <CardTitle>{selectedEndpoint.name}</CardTitle>
                          <CardDescription className="mt-1">
                            <code className="bg-gray-100 px-2 py-1 rounded text-sm">
                              {selectedEndpoint.path}
                            </code>
                          </CardDescription>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-700">{selectedEndpoint.description}</p>
                    <div className="flex flex-wrap gap-1 mt-3">
                      {selectedEndpoint.tags.map((tag) => (
                        <Badge key={tag} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* 파라미터 */}
                {selectedEndpoint.parameters && selectedEndpoint.parameters.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>파라미터</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {selectedEndpoint.parameters.map((param) => (
                          <div key={param.name} className="border border-gray-200 rounded-lg p-4">
                            <div className="flex items-center gap-2 mb-2">
                              <code className="font-medium">{param.name}</code>
                              <Badge variant={param.required ? "destructive" : "secondary"} className="text-xs">
                                {param.required ? 'Required' : 'Optional'}
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                {param.type}
                              </Badge>
                            </div>
                            <p className="text-sm text-gray-600 mb-2">{param.description}</p>
                            {param.example !== undefined && (
                              <div>
                                <span className="text-xs text-gray-500">예제:</span>
                                <code className="ml-2 bg-gray-100 px-2 py-1 rounded text-sm">
                                  {typeof param.example === 'string' ? `"${param.example}"` : String(param.example)}
                                </code>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Request Body */}
                {selectedEndpoint.requestBody && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Request Body</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <pre className="bg-gray-100 p-4 rounded-lg text-sm overflow-x-auto">
                        {JSON.stringify(selectedEndpoint.requestBody, null, 2)}
                      </pre>
                    </CardContent>
                  </Card>
                )}

                {/* 코드 예제 */}
                <Card>
                  <CardHeader>
                    <CardTitle>코드 예제</CardTitle>
                    <CardDescription>다양한 언어로 작성된 API 호출 예제</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Tabs defaultValue="curl" className="w-full">
                      <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="curl">cURL</TabsTrigger>
                        <TabsTrigger value="javascript">JavaScript</TabsTrigger>
                        <TabsTrigger value="python">Python</TabsTrigger>
                      </TabsList>
                      
                      <TabsContent value="curl" className="space-y-2">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium">cURL 명령어</h4>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => copyToClipboard(generateCurlExample(selectedEndpoint), 'curl')}
                          >
                            {copiedCode === 'curl' ? (
                              <CheckCircle className="h-4 w-4 mr-1 text-green-500" />
                            ) : (
                              <Copy className="h-4 w-4 mr-1" />
                            )}
                            {copiedCode === 'curl' ? 'Copied!' : 'Copy'}
                          </Button>
                        </div>
                        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-sm overflow-x-auto">
                          {generateCurlExample(selectedEndpoint)}
                        </pre>
                      </TabsContent>
                      
                      <TabsContent value="javascript" className="space-y-2">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium">JavaScript (Fetch API)</h4>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => copyToClipboard(generateJavaScriptExample(selectedEndpoint), 'js')}
                          >
                            {copiedCode === 'js' ? (
                              <CheckCircle className="h-4 w-4 mr-1 text-green-500" />
                            ) : (
                              <Copy className="h-4 w-4 mr-1" />
                            )}
                            {copiedCode === 'js' ? 'Copied!' : 'Copy'}
                          </Button>
                        </div>
                        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-sm overflow-x-auto">
                          {generateJavaScriptExample(selectedEndpoint)}
                        </pre>
                      </TabsContent>
                      
                      <TabsContent value="python" className="space-y-2">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium">Python (Requests)</h4>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => copyToClipboard(generatePythonExample(selectedEndpoint), 'python')}
                          >
                            {copiedCode === 'python' ? (
                              <CheckCircle className="h-4 w-4 mr-1 text-green-500" />
                            ) : (
                              <Copy className="h-4 w-4 mr-1" />
                            )}
                            {copiedCode === 'python' ? 'Copied!' : 'Copy'}
                          </Button>
                        </div>
                        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-sm overflow-x-auto">
                          {generatePythonExample(selectedEndpoint)}
                        </pre>
                      </TabsContent>
                    </Tabs>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <Card className="h-96 flex items-center justify-center">
                <div className="text-center">
                  <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    API를 선택하세요
                  </h3>
                  <p className="text-gray-600">
                    왼쪽 목록에서 API 엔드포인트를 선택하면 상세 문서를 확인할 수 있습니다
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