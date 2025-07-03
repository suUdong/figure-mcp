import { useState } from 'react'
import { 
  Send, 
  Brain, 
  FileText, 
  Clock, 
  Copy,
  ThumbsUp,
  ThumbsDown,
  RotateCcw,
  Lightbulb,
  BookOpen,
  MessageCircle
} from 'lucide-react'
import { motion } from 'framer-motion'

// 모의 대화 데이터
const mockConversations = [
  {
    id: 1,
    question: 'React 컴포넌트에서 상태 관리는 어떻게 해야 하나요?',
    answer: 'React에서 상태 관리는 여러 방법이 있습니다:\n\n1. **useState Hook**: 함수형 컴포넌트에서 로컬 상태 관리\n2. **useReducer Hook**: 복잡한 상태 로직을 위한 Hook\n3. **Context API**: 전역 상태 공유\n4. **외부 라이브러리**: Redux, Zustand, Recoil 등\n\n기본적으로는 useState를 사용하고, 상태가 복잡해지면 useReducer나 외부 라이브러리를 고려하세요.',
    sources: ['React 개발 가이드.pdf', 'Frontend 아키텍처.docx'],
    timestamp: '2024-01-16 10:30',
    rating: 'positive'
  },
  {
    id: 2,
    question: 'API 설계 시 RESTful 원칙은 무엇인가요?',
    answer: 'RESTful API 설계 원칙:\n\n1. **자원 중심 설계**: URL은 자원을 나타내야 함\n2. **HTTP 메서드 활용**: GET, POST, PUT, DELETE 적절히 사용\n3. **무상태성**: 각 요청은 독립적이어야 함\n4. **일관성**: 명명 규칙과 응답 형식 통일\n5. **계층화**: 시스템의 계층 구조 반영\n\n예: GET /users/123 (사용자 조회), POST /users (사용자 생성)',
    sources: ['API 설계 문서.docx', '백엔드 개발 표준.md'],
    timestamp: '2024-01-16 09:15',
    rating: null
  }
]

const suggestedQuestions = [
  '코드 리뷰 체크리스트는 무엇인가요?',
  '데이터베이스 인덱스 설계 방법을 알려주세요',
  'Git 브랜치 전략에 대해 설명해주세요',
  '테스트 코드 작성 가이드라인은?',
  '보안 취약점 체크 방법은?',
  '성능 최적화 방법을 알려주세요'
]

export default function RAGQuery() {
  const [query, setQuery] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [conversations, setConversations] = useState(mockConversations)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return

    setIsLoading(true)
    
    // 모의 응답 처리
    setTimeout(() => {
      const newConversation = {
        id: conversations.length + 1,
        question: query,
        answer: '이것은 모의 응답입니다. 실제 구현에서는 RAG 엔진이 관련 문서를 검색하고 LLM이 답변을 생성합니다.',
        sources: ['관련 문서 1.pdf', '관련 문서 2.docx'],
        timestamp: new Date().toLocaleString('ko-KR'),
        rating: null
      }
      
      setConversations([newConversation, ...conversations])
      setQuery('')
      setIsLoading(false)
    }, 2000)
  }

  const handleSuggestedQuestion = (question: string) => {
    setQuery(question)
  }

  const handleRating = (id: number, rating: 'positive' | 'negative') => {
    setConversations(prev => 
      prev.map(conv => 
        conv.id === id ? { ...conv, rating } : conv
      )
    )
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* 페이지 헤더 */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900">RAG 지식 검색</h1>
        <p className="mt-2 text-gray-600">업로드된 문서를 기반으로 AI가 질문에 답변해드립니다</p>
      </div>

      {/* 질문 입력 폼 */}
      <div className="card">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="query" className="block text-sm font-medium text-gray-700 mb-2">
              질문을 입력하세요
            </label>
            <div className="relative">
              <textarea
                id="query"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                rows={4}
                className="input resize-none"
                placeholder="예: React에서 상태 관리는 어떻게 해야 하나요?"
                disabled={isLoading}
              />
              <div className="absolute bottom-3 right-3">
                <button
                  type="submit"
                  disabled={!query.trim() || isLoading}
                  className="btn btn-primary"
                >
                  {isLoading ? (
                    <>
                      <div className="spinner mr-2" />
                      처리 중...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      질문하기
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>

      {/* 추천 질문 */}
      {conversations.length === 0 && (
        <div className="card">
          <div className="flex items-center space-x-2 mb-4">
            <Lightbulb className="h-5 w-5 text-yellow-500" />
            <h3 className="text-lg font-medium text-gray-900">추천 질문</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {suggestedQuestions.map((question, index) => (
              <motion.button
                key={index}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
                onClick={() => handleSuggestedQuestion(question)}
                className="text-left p-3 rounded-lg border border-gray-200 hover:border-primary-300 hover:bg-primary-50 transition-all duration-200"
              >
                <span className="text-sm text-gray-700">{question}</span>
              </motion.button>
            ))}
          </div>
        </div>
      )}

      {/* 대화 기록 */}
      <div className="space-y-6">
        {conversations.map((conversation, index) => (
          <motion.div
            key={conversation.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: index * 0.1 }}
            className="space-y-4"
          >
            {/* 질문 */}
            <div className="flex justify-end">
              <div className="max-w-3xl bg-primary-600 text-white rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <MessageCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
                  <p className="text-sm">{conversation.question}</p>
                </div>
              </div>
            </div>

            {/* 답변 */}
            <div className="flex justify-start">
              <div className="max-w-3xl">
                <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                  <div className="flex items-start space-x-3 mb-4">
                    <div className="p-2 bg-primary-100 rounded-lg">
                      <Brain className="h-5 w-5 text-primary-600" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900">AI 어시스턴트</h4>
                      <p className="text-sm text-gray-500">{conversation.timestamp}</p>
                    </div>
                  </div>
                  
                  <div className="prose prose-sm max-w-none">
                    <pre className="whitespace-pre-wrap text-sm text-gray-700 font-sans">
                      {conversation.answer}
                    </pre>
                  </div>

                  {/* 참조 문서 */}
                  {conversation.sources.length > 0 && (
                    <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center space-x-2 mb-2">
                        <BookOpen className="h-4 w-4 text-gray-500" />
                        <span className="text-sm font-medium text-gray-700">참조 문서</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {conversation.sources.map((source, idx) => (
                          <span key={idx} className="inline-flex items-center space-x-1 px-2 py-1 bg-white rounded text-xs font-medium text-gray-600 border">
                            <FileText className="h-3 w-3" />
                            <span>{source}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 액션 버튼 */}
                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => copyToClipboard(conversation.answer)}
                        className="inline-flex items-center space-x-1 px-3 py-1 text-sm text-gray-600 hover:text-gray-900 transition-colors"
                      >
                        <Copy className="h-4 w-4" />
                        <span>복사</span>
                      </button>
                      <button className="inline-flex items-center space-x-1 px-3 py-1 text-sm text-gray-600 hover:text-gray-900 transition-colors">
                        <RotateCcw className="h-4 w-4" />
                        <span>재생성</span>
                      </button>
                    </div>

                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-gray-500">도움이 되었나요?</span>
                      <button
                        onClick={() => handleRating(conversation.id, 'positive')}
                        className={`p-1 rounded transition-colors ${
                          conversation.rating === 'positive' 
                            ? 'text-green-600 bg-green-100' 
                            : 'text-gray-400 hover:text-green-600'
                        }`}
                      >
                        <ThumbsUp className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleRating(conversation.id, 'negative')}
                        className={`p-1 rounded transition-colors ${
                          conversation.rating === 'negative' 
                            ? 'text-red-600 bg-red-100' 
                            : 'text-gray-400 hover:text-red-600'
                        }`}
                      >
                        <ThumbsDown className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* 빈 상태 */}
      {conversations.length === 0 && !isLoading && (
        <div className="text-center py-12">
          <Brain className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-4 text-lg font-medium text-gray-900">질문을 시작해보세요</h3>
          <p className="mt-2 text-gray-600">
            업로드된 문서를 기반으로 AI가 정확한 답변을 제공합니다.
          </p>
        </div>
      )}
    </div>
  )
} 