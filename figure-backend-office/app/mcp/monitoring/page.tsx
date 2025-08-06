'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Activity,
  RefreshCw,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertCircle,
  Zap,
  Database,
  Globe,
  BarChart3,
  Eye,
  Filter
} from 'lucide-react'
import MainLayout from '@/components/layout/main-layout'
import { MCPApiLog } from '@/types/mcp'
import { formatDistanceToNow } from 'date-fns'
import { ko } from 'date-fns/locale'

// 모의 데이터 (실제로는 백엔드에서 가져올 예정)
const mockApiLogs: MCPApiLog[] = [
  {
    id: '1',
    endpoint: '/api/rag/query',
    method: 'POST',
    status: 200,
    duration: 1250,
    timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(), // 5분 전
    requestData: { query: '프로젝트 문서에 대해 알려주세요' },
    responseData: { success: true, answer: '프로젝트 문서는...' },
    userAgent: 'MCP-Client/1.0',
    ip: '192.168.1.100'
  },
  {
    id: '2',
    endpoint: '/api/documents/search',
    method: 'GET',
    status: 200,
    duration: 340,
    timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(), // 15분 전
    userAgent: 'MCP-Client/1.0',
    ip: '192.168.1.100'
  },
  {
    id: '3',
    endpoint: '/api/documents/upload-file',
    method: 'POST',
    status: 500,
    duration: 5000,
    timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(), // 30분 전
    error: 'Embedding generation failed',
    userAgent: 'MCP-Client/1.0',
    ip: '192.168.1.100'
  },
  {
    id: '4',
    endpoint: '/api/analysis/method-dependency',
    method: 'POST',
    status: 200,
    duration: 8500,
    timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString(), // 45분 전
    userAgent: 'MCP-Client/1.0',
    ip: '192.168.1.100'
  },
  {
    id: '5',
    endpoint: '/api/sites/',
    method: 'GET',
    status: 200,
    duration: 120,
    timestamp: new Date(Date.now() - 1000 * 60 * 60).toISOString(), // 1시간 전
    userAgent: 'MCP-Client/1.0',
    ip: '192.168.1.100'
  }
]

export default function MCPMonitoringPage() {
  const [logs, setLogs] = useState<MCPApiLog[]>(mockApiLogs)
  const [selectedLog, setSelectedLog] = useState<MCPApiLog | null>(null)
  const [showDetails, setShowDetails] = useState(false)
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [isRefreshing, setIsRefreshing] = useState(false)

  const refreshLogs = async () => {
    setIsRefreshing(true)
    // 실제로는 API 호출
    await new Promise(resolve => setTimeout(resolve, 1000))
    setIsRefreshing(false)
  }

  const getStatusColor = (status: number) => {
    if (status >= 200 && status < 300) return 'text-green-600 bg-green-50 border-green-200'
    if (status >= 400 && status < 500) return 'text-yellow-600 bg-yellow-50 border-yellow-200'
    if (status >= 500) return 'text-red-600 bg-red-50 border-red-200'
    return 'text-gray-600 bg-gray-50 border-gray-200'
  }

  const getMethodColor = (method: string) => {
    switch (method) {
      case 'GET': return 'bg-green-500 text-white'
      case 'POST': return 'bg-blue-500 text-white'
      case 'PUT': return 'bg-yellow-500 text-white'
      case 'DELETE': return 'bg-red-500 text-white'
      default: return 'bg-gray-500 text-white'
    }
  }

  const getDurationColor = (duration: number) => {
    if (duration < 500) return 'text-green-600'
    if (duration < 2000) return 'text-yellow-600'
    return 'text-red-600'
  }

  const filteredLogs = logs.filter(log => {
    if (filterStatus === 'all') return true
    if (filterStatus === 'success') return log.status >= 200 && log.status < 300
    if (filterStatus === 'error') return log.status >= 400
    return true
  })

  // 통계 계산
  const totalRequests = logs.length
  const successRequests = logs.filter(log => log.status >= 200 && log.status < 300).length
  const errorRequests = logs.filter(log => log.status >= 400).length
  const avgDuration = Math.round(logs.reduce((sum, log) => sum + log.duration, 0) / logs.length)
  const successRate = Math.round((successRequests / totalRequests) * 100)

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">MCP API 모니터링</h1>
            <p className="text-gray-600 mt-2">
              Model Context Protocol API 호출 현황과 성능을 실시간으로 모니터링합니다
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={refreshLogs}
              disabled={isRefreshing}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
              새로고침
            </Button>
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
              <Activity className="h-3 w-3 mr-1" />
              실시간 모니터링
            </Badge>
          </div>
        </div>

        {/* 통계 카드 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">총 요청 수</p>
                  <p className="text-2xl font-bold text-gray-900">{totalRequests}</p>
                </div>
                <div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <BarChart3 className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">성공률</p>
                  <p className="text-2xl font-bold text-green-600">{successRate}%</p>
                </div>
                <div className="h-12 w-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">평균 응답시간</p>
                  <p className="text-2xl font-bold text-blue-600">{avgDuration}ms</p>
                </div>
                <div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Clock className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">오류 수</p>
                  <p className="text-2xl font-bold text-red-600">{errorRequests}</p>
                </div>
                <div className="h-12 w-12 bg-red-100 rounded-lg flex items-center justify-center">
                  <AlertCircle className="h-6 w-6 text-red-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 필터 및 로그 목록 */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  API 호출 로그
                </CardTitle>
                <CardDescription>
                  최근 MCP API 호출 기록을 확인할 수 있습니다
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-gray-500" />
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                >
                  <option value="all">전체</option>
                  <option value="success">성공</option>
                  <option value="error">오류</option>
                </select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {filteredLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
                  onClick={() => {
                    setSelectedLog(log)
                    setShowDetails(true)
                  }}
                >
                  <div className="flex items-center gap-4 flex-1">
                    <Badge className={`text-xs ${getMethodColor(log.method)}`}>
                      {log.method}
                    </Badge>
                    
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{log.endpoint}</p>
                      <p className="text-sm text-gray-600">
                        {formatDistanceToNow(new Date(log.timestamp), { addSuffix: true, locale: ko })}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <Badge className={`text-xs border ${getStatusColor(log.status)}`}>
                      {log.status}
                    </Badge>
                    
                    <div className="text-right">
                      <p className={`text-sm font-medium ${getDurationColor(log.duration)}`}>
                        {log.duration}ms
                      </p>
                      {log.error && (
                        <p className="text-xs text-red-600">오류 발생</p>
                      )}
                    </div>

                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      <Eye className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* 상세 정보 모달 */}
        {showDetails && selectedLog && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl max-w-4xl w-full max-h-[80vh] overflow-y-auto shadow-2xl">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Badge className={getMethodColor(selectedLog.method)}>
                      {selectedLog.method}
                    </Badge>
                    <h2 className="text-xl font-bold text-gray-900">{selectedLog.endpoint}</h2>
                  </div>
                  <Button
                    onClick={() => setShowDetails(false)}
                    variant="ghost"
                    size="sm"
                  >
                    ✕
                  </Button>
                </div>
              </div>

              <div className="p-6 space-y-6">
                {/* 기본 정보 */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-600">상태 코드</p>
                    <Badge className={`mt-1 ${getStatusColor(selectedLog.status)} border`}>
                      {selectedLog.status}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">응답 시간</p>
                    <p className={`text-lg font-bold mt-1 ${getDurationColor(selectedLog.duration)}`}>
                      {selectedLog.duration}ms
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">시간</p>
                    <p className="text-sm text-gray-900 mt-1">
                      {new Date(selectedLog.timestamp).toLocaleString('ko-KR')}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">IP 주소</p>
                    <p className="text-sm text-gray-900 mt-1">{selectedLog.ip}</p>
                  </div>
                </div>

                {/* 오류 정보 */}
                {selectedLog.error && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <h3 className="font-medium text-red-800 mb-2">오류 정보</h3>
                    <p className="text-red-700 text-sm">{selectedLog.error}</p>
                  </div>
                )}

                {/* 요청 데이터 */}
                {selectedLog.requestData && (
                  <div>
                    <h3 className="font-medium text-gray-900 mb-2">요청 데이터</h3>
                    <pre className="bg-gray-100 p-4 rounded-lg text-sm overflow-x-auto">
                      {JSON.stringify(selectedLog.requestData, null, 2)}
                    </pre>
                  </div>
                )}

                {/* 응답 데이터 */}
                {selectedLog.responseData && (
                  <div>
                    <h3 className="font-medium text-gray-900 mb-2">응답 데이터</h3>
                    <pre className="bg-gray-100 p-4 rounded-lg text-sm overflow-x-auto">
                      {JSON.stringify(selectedLog.responseData, null, 2)}
                    </pre>
                  </div>
                )}

                {/* User Agent */}
                {selectedLog.userAgent && (
                  <div>
                    <h3 className="font-medium text-gray-900 mb-2">User Agent</h3>
                    <p className="text-sm text-gray-700 bg-gray-100 p-3 rounded-lg">
                      {selectedLog.userAgent}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  )
}