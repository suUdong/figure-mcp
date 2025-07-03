import { useState } from 'react'
import { Search, Bell, RefreshCw, Activity } from 'lucide-react'
import { motion } from 'framer-motion'

export default function Header() {
  const [searchQuery, setSearchQuery] = useState('')
  const [isRefreshing, setIsRefreshing] = useState(false)

  const handleRefresh = async () => {
    setIsRefreshing(true)
    // 새로고침 로직 구현
    await new Promise(resolve => setTimeout(resolve, 1000))
    setIsRefreshing(false)
  }

  return (
    <header className="bg-white border-b border-gray-200 h-16">
      <div className="flex items-center justify-between px-6 h-full">
        {/* 검색 영역 */}
        <div className="flex items-center space-x-4 flex-1">
          <div className="relative max-w-md w-full">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="문서, 이슈, 설정 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-primary-500 focus:border-primary-500 text-sm"
            />
          </div>
        </div>

        {/* 우측 액션 영역 */}
        <div className="flex items-center space-x-4">
          {/* 시스템 상태 */}
          <div className="flex items-center space-x-2 text-sm">
            <Activity className="h-4 w-4 text-green-500" />
            <span className="text-gray-700">시스템 정상</span>
            <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></div>
          </div>

          {/* 새로고침 버튼 */}
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-2 text-gray-400 hover:text-gray-600 transition-colors rounded-lg hover:bg-gray-100"
          >
            <motion.div
              animate={isRefreshing ? { rotate: 360 } : { rotate: 0 }}
              transition={{ duration: 1, repeat: isRefreshing ? Infinity : 0, ease: "linear" }}
            >
              <RefreshCw className="h-5 w-5" />
            </motion.div>
          </button>

          {/* 알림 */}
          <button className="relative p-2 text-gray-400 hover:text-gray-600 transition-colors rounded-lg hover:bg-gray-100">
            <Bell className="h-5 w-5" />
            <span className="absolute top-1 right-1 h-2 w-2 bg-red-500 rounded-full"></span>
          </button>

          {/* 구분선 */}
          <div className="h-6 w-px bg-gray-300"></div>

          {/* 사용자 메뉴 */}
          <div className="flex items-center space-x-3">
            <div className="text-right">
              <div className="text-sm font-medium text-gray-900">관리자</div>
              <div className="text-xs text-gray-500">온라인</div>
            </div>
            <div className="h-8 w-8 rounded-full bg-primary-600 flex items-center justify-center">
              <span className="text-sm font-medium text-white">관</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
} 