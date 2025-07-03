import { useState } from 'react'
import { 
  Upload, 
  Search, 
  Filter, 
  Download, 
  FileText, 
  File, 
  Calendar,
  User,
  MoreVertical,
  Eye,
  Trash2,
  Edit
} from 'lucide-react'
import { motion } from 'framer-motion'

// 모의 문서 데이터
const mockDocuments = [
  {
    id: 1,
    name: '개발 가이드라인.pdf',
    type: 'PDF',
    size: '2.4 MB',
    uploadDate: '2024-01-15',
    uploadedBy: '김개발',
    status: 'processed',
    tags: ['개발', '가이드라인', '표준']
  },
  {
    id: 2,
    name: 'API 설계 문서.docx',
    type: 'Word',
    size: '1.8 MB',
    uploadDate: '2024-01-14',
    uploadedBy: '이설계',
    status: 'processing',
    tags: ['API', '설계', '백엔드']
  },
  {
    id: 3,
    name: '테스트 계획서.xlsx',
    type: 'Excel',
    size: '856 KB',
    uploadDate: '2024-01-13',
    uploadedBy: '박테스트',
    status: 'processed',
    tags: ['테스트', '계획', 'QA']
  },
  {
    id: 4,
    name: '코딩 표준.md',
    type: 'Markdown',
    size: '124 KB',
    uploadDate: '2024-01-12',
    uploadedBy: '최표준',
    status: 'processed',
    tags: ['코딩', '표준', '규칙']
  },
]

const getFileIcon = (type: string) => {
  switch (type.toLowerCase()) {
    case 'pdf':
      return <FileText className="h-8 w-8 text-red-500" />
    case 'word':
    case 'docx':
      return <FileText className="h-8 w-8 text-blue-500" />
    case 'excel':
    case 'xlsx':
      return <FileText className="h-8 w-8 text-green-500" />
    case 'markdown':
    case 'md':
      return <FileText className="h-8 w-8 text-purple-500" />
    default:
      return <File className="h-8 w-8 text-gray-500" />
  }
}

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'processed':
      return <span className="badge badge-success">처리 완료</span>
    case 'processing':
      return <span className="badge badge-warning">처리 중</span>
    case 'failed':
      return <span className="badge badge-danger">처리 실패</span>
    default:
      return <span className="badge">대기 중</span>
  }
}

export default function Documents() {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedFilter, setSelectedFilter] = useState('all')
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [selectedDocuments, setSelectedDocuments] = useState<number[]>([])

  const filteredDocuments = mockDocuments.filter(doc => {
    const matchesSearch = doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         doc.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
    
    const matchesFilter = selectedFilter === 'all' || doc.status === selectedFilter
    
    return matchesSearch && matchesFilter
  })

  const handleSelectDocument = (id: number) => {
    setSelectedDocuments(prev => 
      prev.includes(id) 
        ? prev.filter(docId => docId !== id)
        : [...prev, id]
    )
  }

  const handleSelectAll = () => {
    if (selectedDocuments.length === filteredDocuments.length) {
      setSelectedDocuments([])
    } else {
      setSelectedDocuments(filteredDocuments.map(doc => doc.id))
    }
  }

  return (
    <div className="space-y-6">
      {/* 페이지 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">문서 관리</h1>
          <p className="mt-2 text-gray-600">업로드된 문서를 관리하고 처리 상태를 확인하세요</p>
        </div>
        <button
          onClick={() => setShowUploadModal(true)}
          className="btn btn-primary"
        >
          <Upload className="h-4 w-4 mr-2" />
          문서 업로드
        </button>
      </div>

      {/* 검색 및 필터 */}
      <div className="card">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="문서명, 태그로 검색..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input pl-10"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <select
              value={selectedFilter}
              onChange={(e) => setSelectedFilter(e.target.value)}
              className="input"
            >
              <option value="all">전체 상태</option>
              <option value="processed">처리 완료</option>
              <option value="processing">처리 중</option>
              <option value="failed">처리 실패</option>
            </select>
            <button className="btn btn-outline">
              <Filter className="h-4 w-4 mr-2" />
              고급 필터
            </button>
          </div>
        </div>
      </div>

      {/* 문서 목록 */}
      <div className="card">
        {/* 액션 바 */}
        {selectedDocuments.length > 0 && (
          <div className="mb-4 p-3 bg-primary-50 rounded-lg border border-primary-200">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-primary-700">
                {selectedDocuments.length}개 문서 선택됨
              </span>
              <div className="flex space-x-2">
                <button className="btn btn-primary text-xs">
                  <Download className="h-3 w-3 mr-1" />
                  다운로드
                </button>
                <button className="btn btn-danger text-xs">
                  <Trash2 className="h-3 w-3 mr-1" />
                  삭제
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 테이블 헤더 */}
        <div className="grid grid-cols-12 gap-4 pb-3 border-b border-gray-200 text-sm font-medium text-gray-500">
          <div className="col-span-1">
            <input
              type="checkbox"
              checked={selectedDocuments.length === filteredDocuments.length && filteredDocuments.length > 0}
              onChange={handleSelectAll}
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
          </div>
          <div className="col-span-4">문서명</div>
          <div className="col-span-1">타입</div>
          <div className="col-span-1">크기</div>
          <div className="col-span-2">업로드일</div>
          <div className="col-span-1">업로더</div>
          <div className="col-span-1">상태</div>
          <div className="col-span-1">액션</div>
        </div>

        {/* 문서 목록 */}
        <div className="space-y-2 mt-4">
          {filteredDocuments.map((document, index) => (
            <motion.div
              key={document.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
              className="grid grid-cols-12 gap-4 items-center p-3 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="col-span-1">
                <input
                  type="checkbox"
                  checked={selectedDocuments.includes(document.id)}
                  onChange={() => handleSelectDocument(document.id)}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
              </div>
              <div className="col-span-4">
                <div className="flex items-center space-x-3">
                  {getFileIcon(document.type)}
                  <div>
                    <p className="text-sm font-medium text-gray-900">{document.name}</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {document.tags.map(tag => (
                        <span key={tag} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <div className="col-span-1">
                <span className="text-sm text-gray-500">{document.type}</span>
              </div>
              <div className="col-span-1">
                <span className="text-sm text-gray-500">{document.size}</span>
              </div>
              <div className="col-span-2">
                <div className="flex items-center space-x-1 text-sm text-gray-500">
                  <Calendar className="h-4 w-4" />
                  <span>{document.uploadDate}</span>
                </div>
              </div>
              <div className="col-span-1">
                <div className="flex items-center space-x-1 text-sm text-gray-500">
                  <User className="h-4 w-4" />
                  <span>{document.uploadedBy}</span>
                </div>
              </div>
              <div className="col-span-1">
                {getStatusBadge(document.status)}
              </div>
              <div className="col-span-1">
                <div className="flex items-center space-x-1">
                  <button className="p-1 text-gray-400 hover:text-gray-600 rounded">
                    <Eye className="h-4 w-4" />
                  </button>
                  <button className="p-1 text-gray-400 hover:text-gray-600 rounded">
                    <Download className="h-4 w-4" />
                  </button>
                  <button className="p-1 text-gray-400 hover:text-gray-600 rounded">
                    <MoreVertical className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {filteredDocuments.length === 0 && (
          <div className="text-center py-12">
            <FileText className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">문서가 없습니다</h3>
            <p className="mt-1 text-sm text-gray-500">
              {searchQuery ? '검색 조건에 맞는 문서가 없습니다.' : '첫 번째 문서를 업로드해보세요.'}
            </p>
          </div>
        )}
      </div>

      {/* 업로드 모달 (간단 버전) */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-lg p-6 w-full max-w-md"
          >
            <h3 className="text-lg font-medium text-gray-900 mb-4">문서 업로드</h3>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
              <Upload className="mx-auto h-12 w-12 text-gray-400" />
              <p className="mt-2 text-sm text-gray-600">파일을 드래그하거나 클릭하여 업로드</p>
              <input type="file" className="hidden" multiple accept=".pdf,.docx,.xlsx,.md" />
            </div>
            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => setShowUploadModal(false)}
                className="btn btn-secondary"
              >
                취소
              </button>
              <button className="btn btn-primary">업로드</button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
} 