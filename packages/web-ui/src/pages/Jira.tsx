import { useState } from 'react'
import { 
  ExternalLink, 
  Plus, 
  Search, 
  Filter,
  Bug,
  CheckCircle,
  Clock,
  AlertTriangle,
  User,
  Calendar,
  Tag,
  MoreHorizontal
} from 'lucide-react'
import { motion } from 'framer-motion'

// 모의 Jira 이슈 데이터
const mockIssues = [
  {
    id: 1,
    key: 'PROJ-123',
    title: 'API 응답 시간 개선',
    type: 'Task',
    priority: 'High',
    status: 'In Progress',
    assignee: '김개발',
    reporter: '이매니저',
    created: '2024-01-15',
    updated: '2024-01-16',
    description: 'API 응답 시간이 느려서 성능 개선이 필요합니다.',
    labels: ['performance', 'api', 'backend']
  },
  {
    id: 2,
    key: 'PROJ-124',
    title: '로그인 페이지 버그 수정',
    type: 'Bug',
    priority: 'Critical',
    status: 'To Do',
    assignee: '박프론트',
    reporter: '최테스터',
    created: '2024-01-14',
    updated: '2024-01-15',
    description: '특정 브라우저에서 로그인이 되지 않는 문제가 있습니다.',
    labels: ['bug', 'frontend', 'urgent']
  },
  {
    id: 3,
    key: 'PROJ-125',
    title: '사용자 대시보드 개발',
    type: 'Story',
    priority: 'Medium',
    status: 'Done',
    assignee: '이UI',
    reporter: '김기획',
    created: '2024-01-10',
    updated: '2024-01-13',
    description: '사용자가 자신의 활동을 한눈에 볼 수 있는 대시보드를 개발합니다.',
    labels: ['feature', 'dashboard', 'frontend']
  },
]

const getTypeIcon = (type: string) => {
  switch (type.toLowerCase()) {
    case 'bug':
      return <Bug className="h-4 w-4 text-red-500" />
    case 'task':
      return <CheckCircle className="h-4 w-4 text-blue-500" />
    case 'story':
      return <Clock className="h-4 w-4 text-green-500" />
    default:
      return <AlertTriangle className="h-4 w-4 text-gray-500" />
  }
}

const getPriorityColor = (priority: string) => {
  switch (priority.toLowerCase()) {
    case 'critical':
      return 'text-red-600 bg-red-100'
    case 'high':
      return 'text-orange-600 bg-orange-100'
    case 'medium':
      return 'text-yellow-600 bg-yellow-100'
    case 'low':
      return 'text-green-600 bg-green-100'
    default:
      return 'text-gray-600 bg-gray-100'
  }
}

const getStatusColor = (status: string) => {
  switch (status.toLowerCase()) {
    case 'to do':
      return 'text-gray-600 bg-gray-100'
    case 'in progress':
      return 'text-blue-600 bg-blue-100'
    case 'done':
      return 'text-green-600 bg-green-100'
    case 'blocked':
      return 'text-red-600 bg-red-100'
    default:
      return 'text-gray-600 bg-gray-100'
  }
}

export default function Jira() {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedStatus, setSelectedStatus] = useState('all')
  const [selectedPriority, setSelectedPriority] = useState('all')
  const [showCreateModal, setShowCreateModal] = useState(false)

  const filteredIssues = mockIssues.filter(issue => {
    const matchesSearch = issue.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         issue.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         issue.labels.some(label => label.toLowerCase().includes(searchQuery.toLowerCase()))
    
    const matchesStatus = selectedStatus === 'all' || issue.status.toLowerCase() === selectedStatus.toLowerCase()
    const matchesPriority = selectedPriority === 'all' || issue.priority.toLowerCase() === selectedPriority.toLowerCase()
    
    return matchesSearch && matchesStatus && matchesPriority
  })

  return (
    <div className="space-y-6">
      {/* 페이지 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Jira 연동</h1>
          <p className="mt-2 text-gray-600">Jira 이슈를 관리하고 새로운 이슈를 생성하세요</p>
        </div>
        <div className="flex space-x-3">
          <button className="btn btn-outline">
            <ExternalLink className="h-4 w-4 mr-2" />
            Jira에서 보기
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn btn-primary"
          >
            <Plus className="h-4 w-4 mr-2" />
            이슈 생성
          </button>
        </div>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="card">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Clock className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">전체 이슈</p>
              <p className="text-2xl font-bold text-gray-900">24</p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center">
            <div className="p-2 bg-orange-100 rounded-lg">
              <AlertTriangle className="h-6 w-6 text-orange-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">진행 중</p>
              <p className="text-2xl font-bold text-gray-900">8</p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">완료</p>
              <p className="text-2xl font-bold text-gray-900">12</p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center">
            <div className="p-2 bg-red-100 rounded-lg">
              <Bug className="h-6 w-6 text-red-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">버그</p>
              <p className="text-2xl font-bold text-gray-900">4</p>
            </div>
          </div>
        </div>
      </div>

      {/* 검색 및 필터 */}
      <div className="card">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="이슈 키, 제목, 라벨로 검색..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input pl-10"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="input"
            >
              <option value="all">전체 상태</option>
              <option value="to do">To Do</option>
              <option value="in progress">In Progress</option>
              <option value="done">Done</option>
            </select>
            <select
              value={selectedPriority}
              onChange={(e) => setSelectedPriority(e.target.value)}
              className="input"
            >
              <option value="all">전체 우선순위</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            <button className="btn btn-outline">
              <Filter className="h-4 w-4 mr-2" />
              고급 필터
            </button>
          </div>
        </div>
      </div>

      {/* 이슈 목록 */}
      <div className="space-y-4">
        {filteredIssues.map((issue, index) => (
          <motion.div
            key={issue.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.1 }}
            className="card hover:shadow-lg transition-shadow duration-200 cursor-pointer"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-4 flex-1">
                <div className="flex items-center space-x-2">
                  {getTypeIcon(issue.type)}
                  <span className="text-sm font-medium text-gray-500">{issue.key}</span>
                </div>
                
                <div className="flex-1">
                  <h3 className="text-lg font-medium text-gray-900 hover:text-primary-600 transition-colors">
                    {issue.title}
                  </h3>
                  <p className="text-sm text-gray-600 mt-1 line-clamp-2">{issue.description}</p>
                  
                  <div className="flex items-center space-x-4 mt-3">
                    <div className="flex items-center space-x-1 text-sm text-gray-500">
                      <User className="h-4 w-4" />
                      <span>{issue.assignee}</span>
                    </div>
                    <div className="flex items-center space-x-1 text-sm text-gray-500">
                      <Calendar className="h-4 w-4" />
                      <span>{issue.updated}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2 mt-2">
                    {issue.labels.map(label => (
                      <span key={label} className="inline-flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        <Tag className="h-3 w-3" />
                        <span>{label}</span>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              
              <div className="flex flex-col items-end space-y-2">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPriorityColor(issue.priority)}`}>
                  {issue.priority}
                </span>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(issue.status)}`}>
                  {issue.status}
                </span>
                <button className="p-1 text-gray-400 hover:text-gray-600 rounded">
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {filteredIssues.length === 0 && (
        <div className="card text-center py-12">
          <ExternalLink className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">이슈가 없습니다</h3>
          <p className="mt-1 text-sm text-gray-500">
            {searchQuery ? '검색 조건에 맞는 이슈가 없습니다.' : '첫 번째 이슈를 생성해보세요.'}
          </p>
        </div>
      )}

      {/* 이슈 생성 모달 (간단 버전) */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-lg p-6 w-full max-w-lg"
          >
            <h3 className="text-lg font-medium text-gray-900 mb-4">새 이슈 생성</h3>
            <form className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">제목</label>
                <input type="text" className="input" placeholder="이슈 제목을 입력하세요" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">타입</label>
                <select className="input">
                  <option value="task">Task</option>
                  <option value="bug">Bug</option>
                  <option value="story">Story</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">우선순위</label>
                <select className="input">
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                  <option value="low">Low</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">설명</label>
                <textarea className="input h-24" placeholder="이슈에 대한 상세 설명을 입력하세요"></textarea>
              </div>
            </form>
            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => setShowCreateModal(false)}
                className="btn btn-secondary"
              >
                취소
              </button>
              <button className="btn btn-primary">생성</button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
} 