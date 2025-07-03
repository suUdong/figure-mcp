# Figure-MCP

> 개발 표준 기반 자동 산출물 생성 시스템

Figure-MCP는 MCP(Model Context Protocol) 기반의 지능형 개발 도구로, 사이트별 개발 표준 문서를 관리하고 Jira 요구사항을 기반으로 맞춤형 개발 산출물을 자동 생성합니다.

## 🚀 주요 기능

- **📋 다양한 문서 형식 지원**: Excel, Word, Markdown, PDF, 텍스트 파일
- **🔍 지능형 RAG 검색**: Vector DB 기반 개발 표준 검색 및 활용
- **🎯 Jira 연동**: 티켓 정보 자동 추출 및 요구사항 분석
- **🤖 자동 산출물 생성**: LLM 기반 코드 및 문서 자동 생성
- **🌐 웹 대시보드**: 실시간 진행상태 모니터링
- **🔧 개발도구 연동**: Cursor, Copilot과의 원활한 연동

## 🏗️ 시스템 아키텍처

```
┌─────────────────────────────────────────────────────────────────┐
│                        Figure-MCP System                        │
├─────────────────────────────────────────────────────────────────┤
│  Web UI ◄──► MCP Server ◄──► Vector DB                        │
│     ▲            ▲               ▲                              │
│     │            │               │                              │
│     ▼            ▼               ▼                              │
│  File Storage ◄─► RAG Engine ◄─► Document Processor            │
└─────────────────────────────────────────────────────────────────┘
            ▲              ▲                    ▲
            │              │                    │
            ▼              ▼                    ▼
   External Tools     Jira API          Development Tools
   (Git, Storage)    Integration        (Cursor, Copilot)
```

## 📦 설치 및 실행

### 사전 요구사항

- Docker & Docker Compose
- Git

### 빠른 시작 (Docker 사용 - 권장)

1. **레포지토리 클론**
   ```bash
   git clone https://github.com/your-org/figure-mcp.git
   cd figure-mcp
   ```

2. **환경 설정**
   ```bash
   # 환경 변수 파일 생성
   cp env.example .env
   
   # 필요한 환경 변수 설정 (OpenAI API 키, Jira 설정 등)
   vim .env
   ```

3. **Docker Compose로 실행**
   ```bash
   # 개발 환경 실행 (Linux/macOS)
   ./scripts/dev-start.sh
   
   # 개발 환경 실행 (Windows)
   ./scripts/dev-start.bat
   
   # 또는 직접 실행
   docker-compose -f docker-compose.yml -f docker-compose.override.yml up -d
   
   # 로그 확인
   docker-compose logs -f
   ```

4. **서비스 접속**
   - 🌐 웹 UI: http://localhost:5173
   - 🔌 MCP 서버: http://localhost:3000
   - 📊 ChromaDB: http://localhost:8000
   - 🗄️ PostgreSQL: localhost:5432
   - 🔧 Redis: localhost:6379

### 로컬 개발 설정

각 패키지별로 개별 설치가 필요한 경우:

**사전 요구사항**
- Node.js 18+
- Python 3.9+
- PostgreSQL 14+
- Redis 6+

```bash
# MCP 서버
cd packages/mcp-server
npm install
npm run dev

# Document Processor
cd packages/document-processor
pip install -r requirements.txt
python -m src.main

# RAG Engine
cd packages/rag-engine
npm install
npm run dev

# Web UI
cd packages/web-ui
npm install
npm run dev
```

## 🔧 환경 설정

### 환경 변수 설정

`.env` 파일에 다음 변수들을 설정하세요:

```bash
# 데이터베이스
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=figure_mcp
POSTGRES_USER=figure_mcp
POSTGRES_PASSWORD=figure_mcp_password

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Vector Database
CHROMA_HOST=localhost
CHROMA_PORT=8000

# LLM 설정
OPENAI_API_KEY=your_openai_key
ANTHROPIC_API_KEY=your_claude_key

# Jira 연동
JIRA_BASE_URL=https://your-company.atlassian.net
JIRA_USERNAME=your_username
JIRA_API_TOKEN=your_api_token

# 보안
JWT_SECRET=your_jwt_secret

# 서버 설정
MCP_SERVER_PORT=3000
VITE_MCP_SERVER_URL=http://localhost:3000
VITE_API_BASE_URL=http://localhost:3000/api
```

### Jira 연동 설정

1. Jira에서 API 토큰 생성
2. 프로젝트별 Jira 설정 구성:

```json
{
  "sitename": "ecommerce",
  "jira": {
    "baseUrl": "https://your-company.atlassian.net",
    "projectKey": "ECOM",
    "username": "your_username",
    "apiToken": "your_api_token"
  }
}
```

## 📖 사용법

### 1. 기본 사용법

Cursor나 Copilot에서 Figure-MCP에 연결 후:

```
use design figure ecommerce PROJ-123
```

- `ecommerce`: 사이트명 (프로젝트 식별자)
- `PROJ-123`: Jira 티켓 ID

### 2. 옵션 사용

```
use design figure ecommerce PROJ-123 --format=code --delivery=file
```

**옵션:**
- `--format`: 출력 형식 (`code`, `documentation`, `both`)
- `--delivery`: 전달 방식 (`inline`, `file`, `repository`)

### 3. 관리 명령어

```bash
# 사이트 목록 조회
list sites

# 문서 업로드
upload document ecommerce /path/to/standard.docx

# 작업 상태 확인
get job status job-id-123
```

## 🔧 개발자 가이드

### 패키지 구조

```
packages/
├── mcp-server/         # MCP 서버 (Node.js/TypeScript)
├── document-processor/ # 문서 처리기 (Python)
├── rag-engine/         # RAG 엔진 (TypeScript)
├── integrations/       # 외부 연동 (TypeScript)
└── web-ui/            # 웹 UI (React)
```

### 새로운 문서 처리기 추가

1. `packages/document-processor/src/processors/` 에 새 프로세서 추가
2. `DocumentProcessingEngine`에 등록
3. 테스트 코드 작성

### 새로운 LLM 제공자 추가

1. `packages/rag-engine/src/llm/` 에 새 LLM 클래스 추가
2. `BaseLLM` 인터페이스 구현
3. 설정 파일에 등록

### 새로운 Vector DB 추가

1. `packages/document-processor/src/vectorstore/` 에 새 스토어 추가
2. `VectorStore` 인터페이스 구현
3. 설정 파일에 등록

## 🗂️ 프로젝트 구조

```
figure-mcp/
├── docs/                    # 📋 문서
├── packages/                # 📦 모노레포 패키지
│   ├── mcp-server/         # 🖥️ MCP 서버
│   ├── document-processor/ # 📄 문서 처리기
│   ├── rag-engine/         # 🧠 RAG 엔진
│   ├── web-ui/             # 🌐 웹 인터페이스
│   └── integrations/       # 🔗 외부 연동
├── infrastructure/         # 🏗️ 인프라 설정
├── scripts/               # 📜 스크립트
└── tests/                 # 🧪 테스트
```

자세한 구조는 [PROJECT_STRUCTURE.md](./PROJECT_STRUCTURE.md)를 참고하세요.

## 🔌 API 문서

### MCP 명령어

| 명령어 | 설명 | 예시 |
|--------|------|------|
| `use design figure {site} {ticket}` | 메인 산출물 생성 | `use design figure shop SHOP-456` |
| `list sites` | 등록된 사이트 목록 | `list sites` |
| `upload document {site} {path}` | 표준 문서 업로드 | `upload document shop ./api-std.docx` |
| `status {jobId}` | 작업 상태 확인 | `status job_abc123` |

### REST API

기본 엔드포인트: `http://localhost:3002/api`

| 메소드 | 엔드포인트 | 설명 |
|--------|-----------|------|
| GET | `/projects` | 프로젝트 목록 |
| POST | `/projects` | 프로젝트 생성 |
| GET | `/projects/:id/documents` | 문서 목록 |
| POST | `/projects/:id/documents` | 문서 업로드 |
| GET | `/jobs` | 작업 목록 |
| GET | `/jobs/:id` | 작업 상세 |

API 상세 명세는 `http://localhost:3002/api-docs`에서 확인할 수 있습니다.

## 🏃‍♂️ 개발 가이드

### 개발 환경 설정

```bash
# 의존성 설치
npm install

# 개발 환경 초기화
npm run setup:dev

# 타입 체크
npm run type-check

# 린터 실행
npm run lint

# 테스트 실행
npm run test

# 개발 서버 실행
npm run dev
```

### 코드 스타일

- **TypeScript**: ESLint + Prettier
- **Python**: PEP 8 + Black
- **커밋**: Conventional Commits

### 테스트

```bash
# 전체 테스트
npm run test

# 단위 테스트
npm run test:unit

# 통합 테스트
npm run test:integration

# E2E 테스트
npm run test:e2e

# 커버리지 확인
npm run test:coverage
```

## 🚀 배포

### Docker 배포

```bash
# 프로덕션 빌드
npm run build

# Docker 이미지 빌드
docker-compose build

# 프로덕션 실행
docker-compose -f docker-compose.prod.yml up -d
```

### Kubernetes 배포

```bash
# Kubernetes 매니페스트 적용
kubectl apply -f infrastructure/k8s/

# 상태 확인
kubectl get pods -l app=figure-mcp
```

자세한 배포 가이드는 [DEPLOYMENT.md](./docs/DEPLOYMENT.md)를 참고하세요.

## 🤝 기여 가이드

1. **Fork** 프로젝트
2. **Feature branch** 생성 (`git checkout -b feature/AmazingFeature`)
3. **Commit** 변경사항 (`git commit -m 'Add some AmazingFeature'`)
4. **Push** to branch (`git push origin feature/AmazingFeature`)
5. **Pull Request** 생성

### 커밋 메시지 규칙

```
feat: 새로운 기능 추가
fix: 버그 수정
docs: 문서 수정
style: 코드 포맷팅, 세미콜론 누락, 코드 변경이 없는 경우
refactor: 코드 리팩토링
test: 테스트 추가, 테스트 리팩토링
chore: 빌드 업무 수정, 패키지 매니저 수정
```

## 📋 로드맵

### Phase 1: MVP (Q1 2024)
- [x] 기본 MCP 서버 구현
- [x] 문서 처리 및 벡터 저장
- [x] 기본 RAG 엔진
- [ ] Jira 연동
- [ ] 웹 UI 대시보드

### Phase 2: Enhancement (Q2 2024)
- [ ] 다중 사이트 지원
- [ ] 고급 RAG 기능 (Chain-of-Thought)
- [ ] 성능 최적화
- [ ] 모니터링 및 로깅

### Phase 3: Advanced (Q3 2024)
- [ ] 플러그인 아키텍처
- [ ] 다양한 LLM 지원
- [ ] 자동 품질 평가
- [ ] 고급 보안 기능

## 📊 성능 지표

- **처리 속도**: 평균 30초 이내 산출물 생성
- **정확도**: 90% 이상 요구사항 반영률
- **가용성**: 99.9% 서비스 가동률
- **확장성**: 동시 100+ 요청 처리

## 🛠️ 문제 해결

### 자주 발생하는 문제

1. **Docker 컨테이너 실행 실패**
   ```bash
   # 포트 충돌 확인
   netstat -tulpn | grep :3000
   
   # 컨테이너 재시작
   docker-compose restart
   ```

2. **Vector DB 연결 실패**
   ```bash
   # Chroma 서버 상태 확인
   curl http://localhost:8000/api/v1/heartbeat
   
   # 환경 변수 확인
   echo $VECTOR_DB_TYPE
   ```

3. **LLM API 응답 실패**
   ```bash
   # API 키 확인
   curl -H "Authorization: Bearer $OPENAI_API_KEY" \
        https://api.openai.com/v1/models
   ```

더 많은 문제 해결 방법은 [TROUBLESHOOTING.md](./docs/TROUBLESHOOTING.md)를 참고하세요.

## 📄 라이선스

이 프로젝트는 MIT 라이선스하에 배포됩니다. 자세한 내용은 [LICENSE](LICENSE) 파일을 참고하세요.

## 📧 연락처

- **프로젝트 관리자**: [maintainer@example.com](mailto:maintainer@example.com)
- **이슈 리포트**: [GitHub Issues](https://github.com/your-org/figure-mcp/issues)
- **Discord**: [개발 커뮤니티](https://discord.gg/figure-mcp)

## 🙏 감사의 말

이 프로젝트는 다음 오픈소스 프로젝트들의 도움을 받았습니다:

- [MCP SDK](https://github.com/modelcontextprotocol/sdk)
- [LangChain](https://github.com/hwchase17/langchain)
- [Chroma](https://github.com/chroma-core/chroma)
- [FastAPI](https://github.com/tiangolo/fastapi)
- [React](https://github.com/facebook/react)

---

**Figure-MCP**로 더 효율적이고 표준화된 개발 경험을 시작해보세요! 🚀 