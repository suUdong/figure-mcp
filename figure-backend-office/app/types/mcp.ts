/**
 * MCP (Model Context Protocol) 관련 타입 정의
 */

export interface MCPApiEndpoint {
  id: string;
  name: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  description: string;
  category: string;
  parameters?: MCPParameter[];
  requestBody?: any;
  responseExample?: any;
  tags: string[];
}

export interface MCPParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  required: boolean;
  description: string;
  example?: any;
}

export interface MCPApiCategory {
  id: string;
  name: string;
  description: string;
  endpoints: MCPApiEndpoint[];
}

export interface MCPTestRequest {
  endpointId: string;
  parameters: Record<string, any>;
  body?: any;
}

export interface MCPTestResponse {
  success: boolean;
  status: number;
  data: any;
  error?: string;
  duration: number;
  timestamp: string;
}

export interface MCPApiLog {
  id: string;
  endpoint: string;
  method: string;
  status: number;
  duration: number;
  timestamp: string;
  requestData?: any;
  responseData?: any;
  error?: string;
  userAgent?: string;
  ip?: string;
}

// MCP에서 주로 사용하는 API 엔드포인트 정의
export const MCP_API_ENDPOINTS: MCPApiCategory[] = [
  {
    id: 'documents',
    name: '문서 관리',
    description: 'MCP에서 문서 업로드, 검색, 관리를 위한 API',
    endpoints: [
      {
        id: 'documents-list',
        name: '문서 목록 조회',
        method: 'GET',
        path: '/api/documents/',
        description: '하이브리드 저장 시스템의 문서 목록을 조회합니다',
        category: 'documents',
        parameters: [
          { name: 'limit', type: 'number', required: false, description: '조회할 문서 수 (기본값: 50)', example: 50 },
          { name: 'offset', type: 'number', required: false, description: '시작 위치 (기본값: 0)', example: 0 },
          { name: 'site_id', type: 'string', required: false, description: '사이트 ID로 필터링', example: 'site-123' }
        ],
        tags: ['documents', 'list', 'hybrid-storage']
      },
      {
        id: 'documents-upload',
        name: '문서 업로드',
        method: 'POST',
        path: '/api/documents/upload-file',
        description: '파일을 업로드하고 벡터 데이터베이스에 저장합니다',
        category: 'documents',
        parameters: [
          { name: 'file', type: 'object', required: true, description: '업로드할 파일' },
          { name: 'site_id', type: 'string', required: false, description: '관련 사이트 ID' },
          { name: 'metadata', type: 'string', required: false, description: '추가 메타데이터 JSON' }
        ],
        tags: ['documents', 'upload', 'vector-db']
      },
      {
        id: 'documents-search',
        name: '문서 검색',
        method: 'GET',
        path: '/api/documents/search',
        description: '유사도 기반으로 관련 문서를 검색합니다',
        category: 'documents',
        parameters: [
          { name: 'query', type: 'string', required: true, description: '검색어', example: '프로젝트 문서' },
          { name: 'max_results', type: 'number', required: false, description: '최대 결과 수', example: 5 },
          { name: 'similarity_threshold', type: 'number', required: false, description: '유사도 임계값', example: 0.7 }
        ],
        tags: ['documents', 'search', 'similarity']
      }
    ]
  },
  {
    id: 'rag',
    name: 'RAG (검색증강생성)',
    description: 'MCP에서 문서 기반 질의응답을 위한 API',
    endpoints: [
      {
        id: 'rag-query',
        name: 'RAG 질의응답',
        method: 'POST',
        path: '/api/rag/query',
        description: '문서 검색 기반 질의응답을 수행합니다',
        category: 'rag',
        requestBody: {
          query: 'string (1-1000자)',
          site_ids: 'string[] (선택사항)',
          max_results: 'number (1-20, 기본값 5)',
          similarity_threshold: 'number (0.0-1.0, 기본값 0.7)'
        },
        tags: ['rag', 'query', 'ai', 'llm']
      },
      {
        id: 'rag-status',
        name: 'RAG 상태 조회',
        method: 'GET',
        path: '/api/rag/status',
        description: 'RAG 서비스의 현재 상태를 조회합니다',
        category: 'rag',
        tags: ['rag', 'status', 'health']
      }
    ]
  },
  {
    id: 'analysis',
    name: '코드 분석',
    description: 'MCP에서 코드 의존성 분석 및 데이터베이스 스키마 분석을 위한 API',
    endpoints: [
      {
        id: 'analysis-method-dependency',
        name: '메서드 의존성 분석',
        method: 'POST',
        path: '/api/analysis/method-dependency',
        description: '소스 코드를 분석하여 메서드 간 의존성 매트릭스를 생성합니다',
        category: 'analysis',
        requestBody: {
          project_path: 'string (분석할 프로젝트 경로)',
          language: 'string (프로그래밍 언어)',
          target_class: 'string (선택사항, 분석할 특정 클래스명)'
        },
        tags: ['analysis', 'code', 'dependency', 'method']
      },
      {
        id: 'analysis-table-schema',
        name: '테이블 스키마 분석',
        method: 'POST',
        path: '/api/analysis/table-schema',
        description: '데이터베이스 스키마를 분석하여 테이블 관계도를 생성합니다',
        category: 'analysis',
        requestBody: {
          database_type: 'string (데이터베이스 타입)',
          connection_string: 'string (데이터베이스 연결 문자열)'
        },
        tags: ['analysis', 'database', 'schema', 'table']
      }
    ]
  },
  {
    id: 'sites',
    name: '사이트 관리',
    description: 'MCP에서 사이트 생성, 조회, 관리를 위한 API',
    endpoints: [
      {
        id: 'sites-list',
        name: '사이트 목록 조회',
        method: 'GET',
        path: '/api/sites/',
        description: '등록된 사이트 목록을 조회합니다',
        category: 'sites',
        tags: ['sites', 'list']
      },
      {
        id: 'sites-create',
        name: '사이트 생성',
        method: 'POST',
        path: '/api/sites/',
        description: '새로운 사이트를 생성합니다',
        category: 'sites',
        requestBody: {
          name: 'string (사이트 이름)',
          url: 'string (사이트 URL)',
          description: 'string (사이트 설명)'
        },
        tags: ['sites', 'create']
      }
    ]
  },
  {
    id: 'admin',
    name: '관리자',
    description: 'MCP에서 시스템 관리 및 모니터링을 위한 API',
    endpoints: [
      {
        id: 'admin-stats',
        name: '관리자 통계',
        method: 'GET',
        path: '/api/admin/stats',
        description: '시스템 전체 통계를 조회합니다',
        category: 'admin',
        tags: ['admin', 'stats', 'system']
      },
      {
        id: 'admin-jobs',
        name: '작업 목록 조회',
        method: 'GET',
        path: '/api/admin/jobs',
        description: '시스템 작업 목록을 조회합니다',
        category: 'admin',
        parameters: [
          { name: 'status', type: 'string', required: false, description: '작업 상태로 필터링' },
          { name: 'job_type', type: 'string', required: false, description: '작업 타입으로 필터링' },
          { name: 'limit', type: 'number', required: false, description: '조회할 작업 수', example: 50 }
        ],
        tags: ['admin', 'jobs', 'monitoring']
      }
    ]
  }
];