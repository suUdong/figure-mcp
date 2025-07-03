import { Link } from 'react-router-dom'
import { Home, ArrowLeft, Search } from 'lucide-react'
import { motion } from 'framer-motion'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* 404 일러스트 */}
          <div className="mb-8">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="text-9xl font-bold text-primary-600 mb-4"
            >
              404
            </motion.div>
            <div className="flex justify-center space-x-2 mb-4">
              <motion.div
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="w-3 h-3 bg-primary-400 rounded-full"
              />
              <motion.div
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 2, repeat: Infinity, delay: 0.2 }}
                className="w-3 h-3 bg-primary-500 rounded-full"
              />
              <motion.div
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 2, repeat: Infinity, delay: 0.4 }}
                className="w-3 h-3 bg-primary-600 rounded-full"
              />
            </div>
          </div>

          {/* 메시지 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="mb-8"
          >
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              페이지를 찾을 수 없습니다
            </h1>
            <p className="text-gray-600">
              요청하신 페이지가 존재하지 않거나 이동되었을 수 있습니다.
            </p>
          </motion.div>

          {/* 액션 버튼들 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.6 }}
            className="space-y-4"
          >
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                to="/"
                className="btn btn-primary"
              >
                <Home className="h-4 w-4 mr-2" />
                홈으로 돌아가기
              </Link>
              <button
                onClick={() => window.history.back()}
                className="btn btn-outline"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                이전 페이지
              </button>
            </div>

            {/* 검색 제안 */}
            <div className="mt-8 p-4 bg-white rounded-lg border border-gray-200">
              <h3 className="text-sm font-medium text-gray-900 mb-3">
                원하시는 페이지를 찾으시나요?
              </h3>
              <div className="space-y-2 text-sm">
                <Link
                  to="/documents"
                  className="flex items-center space-x-2 text-gray-600 hover:text-primary-600 transition-colors"
                >
                  <span className="w-2 h-2 bg-gray-300 rounded-full"></span>
                  <span>문서 관리</span>
                </Link>
                <Link
                  to="/jira"
                  className="flex items-center space-x-2 text-gray-600 hover:text-primary-600 transition-colors"
                >
                  <span className="w-2 h-2 bg-gray-300 rounded-full"></span>
                  <span>Jira 연동</span>
                </Link>
                <Link
                  to="/rag"
                  className="flex items-center space-x-2 text-gray-600 hover:text-primary-600 transition-colors"
                >
                  <span className="w-2 h-2 bg-gray-300 rounded-full"></span>
                  <span>RAG 쿼리</span>
                </Link>
                <Link
                  to="/settings"
                  className="flex items-center space-x-2 text-gray-600 hover:text-primary-600 transition-colors"
                >
                  <span className="w-2 h-2 bg-gray-300 rounded-full"></span>
                  <span>시스템 설정</span>
                </Link>
              </div>
            </div>
          </motion.div>

          {/* 도움말 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.8 }}
            className="mt-8 text-xs text-gray-500"
          >
            <p>
              문제가 지속된다면{' '}
              <a href="mailto:support@company.com" className="text-primary-600 hover:underline">
                지원팀에 문의
              </a>
              하세요.
            </p>
          </motion.div>
        </motion.div>
      </div>
    </div>
  )
} 