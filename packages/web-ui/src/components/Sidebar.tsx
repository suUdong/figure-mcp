import { NavLink } from 'react-router-dom'
import { 
  LayoutDashboard, 
  FileText, 
  ExternalLink, 
  MessageCircle, 
  Settings,
  Brain,
  Zap
} from 'lucide-react'
import { motion } from 'framer-motion'

const navigation = [
  { name: '대시보드', href: '/', icon: LayoutDashboard },
  { name: '문서 관리', href: '/documents', icon: FileText },
  { name: 'Jira 연동', href: '/jira', icon: ExternalLink },
  { name: 'RAG 쿼리', href: '/rag', icon: Brain },
  { name: '설정', href: '/settings', icon: Settings },
]

export default function Sidebar() {
  return (
    <div className="flex w-64 flex-col bg-white border-r border-gray-200">
      {/* 로고 영역 */}
      <div className="flex h-16 items-center px-6 border-b border-gray-200">
        <div className="flex items-center space-x-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-600">
            <Zap className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Figure-MCP</h1>
            <p className="text-xs text-gray-500">자동 산출물 생성</p>
          </div>
        </div>
      </div>

      {/* 네비게이션 메뉴 */}
      <nav className="flex-1 px-4 py-6 space-y-1">
        {navigation.map((item, index) => {
          const Icon = item.icon
          return (
            <NavLink
              key={item.name}
              to={item.href}
              className={({ isActive }) =>
                `group flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                  isActive
                    ? 'bg-primary-50 text-primary-700 border-r-2 border-primary-600'
                    : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                }`
              }
            >
              {({ isActive }) => (
                <motion.div
                  initial={false}
                  animate={{ x: isActive ? 4 : 0 }}
                  transition={{ duration: 0.2 }}
                  className="flex items-center space-x-3 w-full"
                >
                  <Icon 
                    className={`h-5 w-5 ${
                      isActive ? 'text-primary-600' : 'text-gray-400 group-hover:text-gray-600'
                    }`} 
                  />
                  <span>{item.name}</span>
                </motion.div>
              )}
            </NavLink>
          )
        })}
      </nav>

      {/* 하단 정보 */}
      <div className="border-t border-gray-200 p-4">
        <div className="flex items-center space-x-3">
          <div className="flex-shrink-0">
            <div className="h-8 w-8 rounded-full bg-gray-300 flex items-center justify-center">
              <span className="text-sm font-medium text-gray-700">시</span>
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900">시스템 관리자</p>
            <p className="text-xs text-gray-500 truncate">admin@company.com</p>
          </div>
        </div>
      </div>
    </div>
  )
} 