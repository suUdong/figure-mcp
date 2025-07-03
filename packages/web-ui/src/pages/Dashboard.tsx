import { useState } from 'react'
import { 
  FileText, 
  ExternalLink, 
  Brain, 
  TrendingUp, 
  Clock, 
  CheckCircle, 
  AlertTriangle,
  Users,
  Database,
  Activity
} from 'lucide-react'
import { motion } from 'framer-motion'

// 모의 데이터
const stats = [
  { name: '총 문서 수', value: '1,234', icon: FileText, change: '+12%', trend: 'up' },
  { name: 'Jira 이슈', value: '856', icon: ExternalLink, change: '+8%', trend: 'up' },
  { name: 'RAG 쿼리', value: '2,145', icon: Brain, change: '+23%', trend: 'up' },
  { name: '처리 중인 작업', value: '42', icon: Clock, change: '-5%', trend: 'down' },
]

const recentActivities = [
  { id: 1, type: 'document', title: '개발 가이드라인 문서 업로드', time: '2분 전', status: 'success' },
  { id: 2, type: 'jira', title: 'PROJ-123 이슈 생성', time: '5분 전', status: 'success' },
  { id: 3, type: 'rag', title: 'API 설계 관련 질의 처리', time: '10분 전', status: 'success' },
  { id: 4, type: 'system', title: '시스템 백업 완료', time: '1시간 전', status: 'success' },
  { id: 5, type: 'document', title: '테스트 계획서 처리 중', time: '2시간 전', status: 'processing' },
]

const quickActions = [
  { name: '문서 업로드', icon: FileText, href: '/documents', color: 'bg-blue-500' },
  { name: 'Jira 이슈 생성', icon: ExternalLink, href: '/jira', color: 'bg-green-500' },
  { name: 'RAG 질의', icon: Brain, href: '/rag', color: 'bg-purple-500' },
  { name: '시스템 설정', icon: Activity, href: '/settings', color: 'bg-gray-500' },
]

export default function Dashboard() {
  const [selectedPeriod, setSelectedPeriod] = useState('7d')

  return (
    <div className="space-y-8">
      {/* 페이지 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">대시보드</h1>
          <p className="mt-2 text-gray-600">Figure-MCP 시스템 현황을 한눈에 확인하세요</p>
        </div>
        <div className="flex items-center space-x-3">
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="input"
          >
            <option value="1d">최근 1일</option>
            <option value="7d">최근 7일</option>
            <option value="30d">최근 30일</option>
            <option value="90d">최근 90일</option>
          </select>
        </div>
      </div>

      {/* 통계 카드들 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => {
          const Icon = stat.icon
          return (
            <motion.div
              key={stat.name}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="card hover:shadow-lg transition-shadow duration-200"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">{stat.name}</p>
                  <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
                  <div className="flex items-center mt-2">
                    <TrendingUp 
                      className={`h-4 w-4 mr-1 ${
                        stat.trend === 'up' ? 'text-green-500' : 'text-red-500'
                      }`} 
                    />
                    <span 
                      className={`text-sm font-medium ${
                        stat.trend === 'up' ? 'text-green-600' : 'text-red-600'
                      }`}
                    >
                      {stat.change}
                    </span>
                  </div>
                </div>
                <div className={`p-3 rounded-lg ${
                  index === 0 ? 'bg-blue-100' :
                  index === 1 ? 'bg-green-100' :
                  index === 2 ? 'bg-purple-100' : 'bg-orange-100'
                }`}>
                  <Icon className={`h-6 w-6 ${
                    index === 0 ? 'text-blue-600' :
                    index === 1 ? 'text-green-600' :
                    index === 2 ? 'text-purple-600' : 'text-orange-600'
                  }`} />
                </div>
              </div>
            </motion.div>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* 최근 활동 */}
        <div className="lg:col-span-2">
          <div className="card">
            <div className="card-header">
              <h2 className="text-lg font-semibold text-gray-900">최근 활동</h2>
            </div>
            <div className="space-y-4">
              {recentActivities.map((activity, index) => (
                <motion.div
                  key={activity.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.1 }}
                  className="flex items-center space-x-4 p-3 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className={`p-2 rounded-lg ${
                    activity.type === 'document' ? 'bg-blue-100' :
                    activity.type === 'jira' ? 'bg-green-100' :
                    activity.type === 'rag' ? 'bg-purple-100' : 'bg-gray-100'
                  }`}>
                    {activity.type === 'document' && <FileText className="h-4 w-4 text-blue-600" />}
                    {activity.type === 'jira' && <ExternalLink className="h-4 w-4 text-green-600" />}
                    {activity.type === 'rag' && <Brain className="h-4 w-4 text-purple-600" />}
                    {activity.type === 'system' && <Database className="h-4 w-4 text-gray-600" />}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">{activity.title}</p>
                    <p className="text-sm text-gray-500">{activity.time}</p>
                  </div>
                  <div>
                    {activity.status === 'success' && (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    )}
                    {activity.status === 'processing' && (
                      <Clock className="h-5 w-5 text-orange-500" />
                    )}
                    {activity.status === 'error' && (
                      <AlertTriangle className="h-5 w-5 text-red-500" />
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>

        {/* 빠른 작업 */}
        <div>
          <div className="card">
            <div className="card-header">
              <h2 className="text-lg font-semibold text-gray-900">빠른 작업</h2>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {quickActions.map((action, index) => {
                const Icon = action.icon
                return (
                  <motion.a
                    key={action.name}
                    href={action.href}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3, delay: index * 0.1 }}
                    className="flex flex-col items-center p-4 rounded-lg border border-gray-200 hover:border-gray-300 hover:shadow-md transition-all duration-200 group"
                  >
                    <div className={`p-3 rounded-lg ${action.color} group-hover:scale-110 transition-transform duration-200`}>
                      <Icon className="h-6 w-6 text-white" />
                    </div>
                    <span className="mt-2 text-sm font-medium text-gray-700 text-center">{action.name}</span>
                  </motion.a>
                )
              })}
            </div>
          </div>

          {/* 시스템 상태 */}
          <div className="card mt-6">
            <div className="card-header">
              <h2 className="text-lg font-semibold text-gray-900">시스템 상태</h2>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">MCP 서버</span>
                <div className="flex items-center space-x-2">
                  <div className="h-2 w-2 bg-green-500 rounded-full"></div>
                  <span className="text-sm font-medium text-green-600">정상</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">RAG 엔진</span>
                <div className="flex items-center space-x-2">
                  <div className="h-2 w-2 bg-green-500 rounded-full"></div>
                  <span className="text-sm font-medium text-green-600">정상</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Jira 연동</span>
                <div className="flex items-center space-x-2">
                  <div className="h-2 w-2 bg-green-500 rounded-full"></div>
                  <span className="text-sm font-medium text-green-600">정상</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">데이터베이스</span>
                <div className="flex items-center space-x-2">
                  <div className="h-2 w-2 bg-yellow-500 rounded-full"></div>
                  <span className="text-sm font-medium text-yellow-600">주의</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 