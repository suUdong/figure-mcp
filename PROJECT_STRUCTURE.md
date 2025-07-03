# Figure-MCP 프로젝트 구조

## 전체 프로젝트 디렉토리 구조

```
figure-mcp/
├── docs/                           # 문서
│   ├── ARCHITECTURE.md            # 아키텍처 문서
│   ├── API.md                     # API 명세서
│   ├── DEPLOYMENT.md              # 배포 가이드
│   └── USER_GUIDE.md              # 사용자 가이드
├── packages/                       # 모노레포 구조
│   ├── mcp-server/                # MCP 서버 (Node.js/TypeScript)
│   │   ├── src/
│   │   │   ├── server.ts          # MCP 서버 진입점
│   │   │   ├── handlers/          # MCP 명령어 핸들러
│   │   │   ├── services/          # 비즈니스 로직 서비스
│   │   │   ├── models/            # 데이터 모델
│   │   │   └── utils/             # 유틸리티 함수
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── document-processor/         # 문서 처리 서비스 (Python)
│   │   ├── src/
│   │   │   ├── __init__.py
│   │   │   ├── processors/        # 파일 형식별 처리기
│   │   │   ├── embeddings/        # 임베딩 생성
│   │   │   ├── chunking/          # 텍스트 청킹
│   │   │   └── metadata/          # 메타데이터 추출
│   │   ├── requirements.txt
│   │   └── setup.py
│   ├── rag-engine/                # RAG 엔진 (Python)
│   │   ├── src/
│   │   │   ├── __init__.py
│   │   │   ├── retrieval/         # 검색 로직
│   │   │   ├── generation/        # 생성 로직
│   │   │   ├── prompts/           # 프롬프트 템플릿
│   │   │   └── llm/               # LLM 인터페이스
│   │   ├── requirements.txt
│   │   └── setup.py
│   ├── web-ui/                    # 웹 대시보드 (React)
│   │   ├── src/
│   │   │   ├── components/        # React 컴포넌트
│   │   │   ├── pages/             # 페이지 컴포넌트
│   │   │   ├── services/          # API 서비스
│   │   │   ├── hooks/             # 커스텀 훅
│   │   │   ├── store/             # 상태 관리
│   │   │   └── utils/             # 유틸리티
│   │   ├── public/
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── integrations/              # 외부 연동 모듈
│       ├── jira/                  # Jira 연동
│       ├── git/                   # Git 연동
│       └── storage/               # 스토리지 연동
├── infrastructure/                 # 인프라 설정
│   ├── docker/                    # Docker 설정
│   │   ├── docker-compose.yml
│   │   ├── mcp-server.Dockerfile
│   │   ├── document-processor.Dockerfile
│   │   ├── rag-engine.Dockerfile
│   │   └── web-ui.Dockerfile
│   ├── k8s/                       # Kubernetes 매니페스트
│   └── terraform/                 # 인프라 as Code
├── scripts/                       # 스크립트
│   ├── setup.sh                   # 개발 환경 설정
│   ├── build.sh                   # 빌드 스크립트
│   └── deploy.sh                  # 배포 스크립트
├── tests/                         # 테스트
│   ├── unit/                      # 단위 테스트
│   ├── integration/               # 통합 테스트
│   └── e2e/                       # End-to-End 테스트
├── .github/                       # GitHub 설정
│   └── workflows/                 # CI/CD 워크플로우
├── .gitignore
├── README.md
├── package.json                   # 루트 패키지 설정
└── lerna.json                     # 모노레포 설정
```

## 핵심 모듈 상세 구조

### 1. MCP Server (packages/mcp-server)

```
src/
├── server.ts                      # MCP 서버 메인
├── handlers/
│   ├── index.ts                   # 핸들러 등록
│   ├── design-figure.handler.ts   # 'use design figure' 명령어 처리
│   └── admin.handler.ts           # 관리 명령어 처리
├── services/
│   ├── project.service.ts         # 프로젝트/사이트 관리
│   ├── jira.service.ts           # Jira 연동 서비스
│   ├── rag.service.ts            # RAG 엔진 연동
│   ├── document.service.ts       # 문서 관리 서비스
│   └── output.service.ts         # 산출물 생성/전달
├── models/
│   ├── project.model.ts          # 프로젝트 모델
│   ├── document.model.ts         # 문서 모델
│   ├── requirement.model.ts      # 요구사항 모델
│   └── output.model.ts           # 산출물 모델
├── types/
│   ├── mcp.types.ts              # MCP 관련 타입
│   ├── jira.types.ts             # Jira 관련 타입
│   └── common.types.ts           # 공통 타입
├── config/
│   ├── database.config.ts        # DB 설정
│   ├── llm.config.ts             # LLM 설정
│   └── integrations.config.ts    # 외부 연동 설정
└── utils/
    ├── logger.ts                 # 로깅 유틸리티
    ├── validator.ts              # 입력 검증
    └── error-handler.ts          # 에러 처리
```

### 2. Document Processor (packages/document-processor)

```
src/
├── __init__.py
├── processors/
│   ├── __init__.py
│   ├── base.py                   # 기본 프로세서 인터페이스
│   ├── excel_processor.py       # Excel 파일 처리
│   ├── word_processor.py        # Word 파일 처리
│   ├── markdown_processor.py    # Markdown 파일 처리
│   ├── pdf_processor.py         # PDF 파일 처리
│   └── text_processor.py        # 텍스트 파일 처리
├── embeddings/
│   ├── __init__.py
│   ├── openai_embeddings.py     # OpenAI 임베딩
│   ├── local_embeddings.py      # 로컬 임베딩 모델
│   └── embedding_manager.py     # 임베딩 관리
├── chunking/
│   ├── __init__.py
│   ├── semantic_chunker.py      # 의미 기반 청킹
│   ├── fixed_chunker.py         # 고정 크기 청킹
│   └── smart_chunker.py         # 스마트 청킹
├── metadata/
│   ├── __init__.py
│   ├── extractor.py             # 메타데이터 추출
│   └── validator.py             # 메타데이터 검증
├── storage/
│   ├── __init__.py
│   ├── vector_store.py          # 벡터 DB 인터페이스
│   └── file_store.py            # 파일 저장소 인터페이스
└── utils/
    ├── __init__.py
    ├── file_utils.py            # 파일 유틸리티
    └── text_utils.py            # 텍스트 처리 유틸리티
```

### 3. RAG Engine (packages/rag-engine)

```
src/
├── __init__.py
├── retrieval/
│   ├── __init__.py
│   ├── vector_retriever.py      # 벡터 검색
│   ├── keyword_retriever.py     # 키워드 검색
│   ├── hybrid_retriever.py      # 하이브리드 검색
│   └── reranker.py              # 재순위화
├── generation/
│   ├── __init__.py
│   ├── prompt_builder.py        # 프롬프트 구성
│   ├── llm_manager.py          # LLM 관리
│   ├── output_formatter.py     # 출력 포맷팅
│   └── quality_checker.py      # 품질 검증
├── prompts/
│   ├── __init__.py
│   ├── templates/              # 프롬프트 템플릿
│   │   ├── code_generation.txt
│   │   ├── documentation.txt
│   │   └── architecture.txt
│   └── prompt_manager.py       # 프롬프트 관리
├── llm/
│   ├── __init__.py
│   ├── openai_client.py        # OpenAI 클라이언트
│   ├── claude_client.py        # Claude 클라이언트
│   ├── local_client.py         # 로컬 LLM 클라이언트
│   └── llm_interface.py        # LLM 인터페이스
└── pipeline/
    ├── __init__.py
    ├── rag_pipeline.py         # RAG 파이프라인
    └── evaluation.py           # 성능 평가
```

### 4. Web UI (packages/web-ui)

```
src/
├── components/
│   ├── common/                 # 공통 컴포넌트
│   │   ├── Header.tsx
│   │   ├── Sidebar.tsx
│   │   ├── Loading.tsx
│   │   └── ErrorBoundary.tsx
│   ├── dashboard/              # 대시보드 컴포넌트
│   │   ├── StatusCard.tsx
│   │   ├── ProcessingQueue.tsx
│   │   └── Statistics.tsx
│   ├── documents/              # 문서 관리 컴포넌트
│   │   ├── DocumentUpload.tsx
│   │   ├── DocumentList.tsx
│   │   └── DocumentViewer.tsx
│   └── projects/               # 프로젝트 관리 컴포넌트
│       ├── ProjectList.tsx
│       ├── ProjectForm.tsx
│       └── ProjectSettings.tsx
├── pages/
│   ├── Dashboard.tsx           # 대시보드 페이지
│   ├── Documents.tsx           # 문서 관리 페이지
│   ├── Projects.tsx            # 프로젝트 관리 페이지
│   ├── Settings.tsx            # 설정 페이지
│   └── Login.tsx               # 로그인 페이지
├── services/
│   ├── api.ts                  # API 클라이언트
│   ├── websocket.ts            # WebSocket 연결
│   └── auth.ts                 # 인증 서비스
├── hooks/
│   ├── useApi.ts               # API 훅
│   ├── useWebSocket.ts         # WebSocket 훅
│   └── useAuth.ts              # 인증 훅
├── store/
│   ├── index.ts                # 스토어 설정
│   ├── authSlice.ts            # 인증 상태
│   ├── documentsSlice.ts       # 문서 상태
│   └── projectsSlice.ts        # 프로젝트 상태
├── utils/
│   ├── api.utils.ts            # API 유틸리티
│   ├── format.utils.ts         # 포맷팅 유틸리티
│   └── validation.utils.ts     # 검증 유틸리티
├── types/
│   ├── api.types.ts            # API 타입
│   ├── ui.types.ts             # UI 타입
│   └── common.types.ts         # 공통 타입
└── styles/
    ├── globals.css             # 전역 스타일
    ├── components.css          # 컴포넌트 스타일
    └── themes.css              # 테마 스타일
```

## 데이터베이스 스키마

### 1. Vector Database (Chroma/Pinecone)

```python
# 문서 메타데이터 스키마
{
    "id": "doc_uuid",
    "site_name": "ecommerce",
    "document_type": "standard",
    "file_name": "api_design_standard.docx",
    "version": "1.0",
    "upload_date": "2024-01-01T00:00:00Z",
    "chunk_index": 0,
    "total_chunks": 10,
    "embedding": [0.1, 0.2, ...],  # 임베딩 벡터
    "content": "API 설계 표준...",
    "tags": ["api", "design", "rest"]
}
```

### 2. 관계형 Database (PostgreSQL)

```sql
-- 프로젝트/사이트 정보
CREATE TABLE projects (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    site_name VARCHAR(100) UNIQUE NOT NULL,
    jira_config JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 문서 정보
CREATE TABLE documents (
    id UUID PRIMARY KEY,
    project_id UUID REFERENCES projects(id),
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_type VARCHAR(50) NOT NULL,
    file_size BIGINT,
    version VARCHAR(50),
    status VARCHAR(50) DEFAULT 'processing',
    upload_date TIMESTAMP DEFAULT NOW(),
    processed_at TIMESTAMP,
    vector_ids TEXT[]  -- Vector DB의 문서 ID 목록
);

-- 작업 이력
CREATE TABLE job_history (
    id UUID PRIMARY KEY,
    project_id UUID REFERENCES projects(id),
    jira_ticket_id VARCHAR(100),
    command TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    input_data JSONB,
    output_data JSONB,
    error_message TEXT,
    started_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP
);

-- 사용자 정보
CREATE TABLE users (
    id UUID PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    role VARCHAR(50) DEFAULT 'user',
    created_at TIMESTAMP DEFAULT NOW()
);
```

## API 명세

### MCP 프로토콜 명령어

```typescript
// 메인 명령어
interface DesignFigureCommand {
  command: "use design figure";
  sitename: string;
  jiraTicketId: string;
  options?: {
    outputFormat?: "code" | "documentation" | "both";
    deliveryMethod?: "inline" | "file" | "repository";
  };
}

// 관리 명령어
interface AdminCommands {
  "list sites": {};
  "upload document": {
    sitename: string;
    filePath: string;
  };
  "status": {
    jobId?: string;
  };
}
```

### REST API 엔드포인트

```typescript
// 프로젝트 관리
GET    /api/projects              // 프로젝트 목록
POST   /api/projects              // 프로젝트 생성
GET    /api/projects/:id          // 프로젝트 상세
PUT    /api/projects/:id          // 프로젝트 수정
DELETE /api/projects/:id          // 프로젝트 삭제

// 문서 관리
GET    /api/projects/:id/documents    // 문서 목록
POST   /api/projects/:id/documents    // 문서 업로드
DELETE /api/documents/:id             // 문서 삭제

// 작업 관리
GET    /api/jobs                      // 작업 목록
GET    /api/jobs/:id                  // 작업 상세
POST   /api/jobs/:id/cancel           // 작업 취소

// Jira 연동
GET    /api/jira/tickets/:id          // 티켓 정보 조회
POST   /api/jira/test-connection      // 연결 테스트
```

## 개발 가이드라인

### 1. 코딩 컨벤션

- **TypeScript**: ESLint + Prettier 사용
- **Python**: PEP 8 + Black 포맷터 사용
- **커밋 메시지**: Conventional Commits 규칙 준수
- **브랜치 전략**: Git Flow 사용

### 2. 테스트 전략

- **단위 테스트**: 각 모듈별 90% 이상 커버리지
- **통합 테스트**: API 및 서비스 간 연동 테스트
- **E2E 테스트**: 주요 사용자 시나리오 테스트

### 3. 문서화

- **API 문서**: OpenAPI/Swagger 자동 생성
- **코드 문서**: JSDoc/Sphinx 사용
- **아키텍처 문서**: 정기적 업데이트

### 4. 보안

- **환경 변수**: .env 파일로 민감 정보 관리
- **인증/인가**: JWT 토큰 기반
- **입력 검증**: 모든 입력에 대한 검증 로직
- **의존성 관리**: 정기적 보안 업데이트

## 배포 전략

### 1. 개발 환경

```bash
# 로컬 개발 환경 설정
npm install
npm run setup:dev
docker-compose -f docker-compose.dev.yml up
```

### 2. 스테이징 환경

- Kubernetes 클러스터 배포
- CI/CD 파이프라인을 통한 자동 배포
- 통합 테스트 및 성능 테스트

### 3. 프로덕션 환경

- Blue-Green 배포 전략
- 로드 밸런서를 통한 무중단 배포
- 모니터링 및 알림 시스템

## 성능 최적화

### 1. 캐싱 전략

- **Redis**: API 응답 캐싱
- **브라우저 캐시**: 정적 리소스 캐싱
- **CDN**: 글로벌 콘텐츠 배포

### 2. 비동기 처리

- **작업 큐**: Bull/Celery를 통한 백그라운드 작업
- **스트리밍**: 대용량 파일 처리시 스트리밍
- **병렬 처리**: 문서 처리 및 임베딩 생성 병렬화

### 3. 데이터베이스 최적화

- **인덱싱**: 쿼리 성능 최적화
- **파티셔닝**: 대용량 데이터 분산
- **연결 풀링**: 데이터베이스 연결 관리 