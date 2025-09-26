# Figure-MCP

> MCP 기반 지능형 개발 표준 자동 산출물 생성 시스템

Figure-MCP는 MCP(Model Context Protocol) 서버로, 개발 표준 문서를 관리하고 Jira 요구사항을 기반으로 맞춤형 개발 산출물을 자동 생성하는 도구입니다.

## 🚀 주요 기능

- **📋 다양한 문서 형식 지원**: Excel, Word, Markdown, PDF, 텍스트 파일
- **🔍 지능형 RAG 검색**: Vector DB 기반 개발 표준 검색 및 활용
- **🎯 Jira 연동**: 티켓 정보 자동 추출 및 요구사항 분석
- **🤖 자동 산출물 생성**: LLM 기반 코드 및 문서 자동 생성
- **🔧 개발도구 연동**: Cursor, Copilot과의 원활한 연동

## 🚀 원클릭 설치 (권장)

Windows PowerShell에서:

```powershell
# 1. Just 설치 (최초 1회만)
winget install casey/just

# 2. 프로젝트 클론
git clone https://github.com/your-repo/figure-mcp.git
cd figure-mcp

# 3. 원클릭 설치 및 설정
just install

# 4. 개발 환경 시작
just local-start
```

**끝!** 🎉 이제 http://localhost:3001 에서 백오피스를 사용하세요.

---

## 🔧 수동 설치 (고급 사용자용)

### 사전 요구사항
- **Docker Desktop** - 컨테이너 실행용 ([다운로드](https://docs.docker.com/desktop/install/windows-install/))
- **Node.js 18+** - 프론트엔드 개발용 ([다운로드](https://nodejs.org/))
- **Just** - 명령어 관리용 (`winget install casey/just`)

### 수동 설치 과정

1. **레포지토리 클론**
   ```bash
   git clone https://github.com/your-repo/figure-mcp.git
   cd figure-mcp
   ```

2. **환경 설정**
   ```bash
   # 개발 환경 설정 파일 복사
   cp figure-backend/env.example figure-backend/.env
   cp data/environments/development.json .env.json
   ```

3. **Docker 실행**
   ```bash
   # Docker로 전체 환경 실행
   docker-compose up -d --build
   
   # 또는 Just 명령어 사용 (권장)
   just local-start
   ```

### 서비스 확인
- **🏢 백오피스 UI**: http://localhost:3001
- **🔌 Backend API**: http://localhost:8001  
- **🗄️ ChromaDB**: http://localhost:8000
- **📚 API 문서**: http://localhost:8001/docs

### API 키 설정 (선택사항)

`figure-backend/.env` 파일에 다음 API 키들을 설정하면 더 많은 기능을 사용할 수 있습니다:

```bash
# LLM 설정 (선택사항 - 기본값 사용 가능)
CLAUDE_API_KEY=your_claude_key
GEMINI_API_KEY=your_gemini_key

# Jira 연동 (선택사항)
JIRA_BASE_URL=https://your-company.atlassian.net
JIRA_EMAIL=your_email
JIRA_API_TOKEN=your_api_token
```

---

## 🆘 문제 해결

### 도구가 없다고 나올 때:
```powershell
# 시스템 상태 전체 점검
just health-check

# 사전 요구사항만 확인
just check-requirements

# 누락된 도구 자동 설치 시도
just install-missing
```

### Docker 문제가 있을 때:
```powershell
# Docker Desktop 실행 여부 확인
# 완전 재빌드
just rebuild-clean

# 개별 서비스 재빌드
just rebuild-backend  # 백엔드만
just rebuild-office   # 프론트엔드만
```

### 서비스가 안 뜰 때:
```powershell
# 전체 재시작
just local-stop
just local-start

# 상태 확인
just status
docker-compose ps
```

### 포트 충돌 시:
기본 포트들을 확인하고 다른 서비스와 충돌하지 않는지 확인하세요:
- 3001: 백오피스 UI
- 8001: Backend API
- 8000: ChromaDB
- 6379: Redis

## 📖 사용법

### MCP 도구 사용

이 서버는 다음 MCP 도구들을 제공합니다:

1. **use_design_figure**: 디자인 피규어 생성
   ```json
   {
     "sitename": "ecommerce",
     "ticket_id": "PROJ-123",
     "options": {
       "format": "code",
       "delivery": "file"
     }
   }
   ```

2. **get_job_status**: 작업 상태 확인
   ```json
   {
     "job_id": "job_12345"
   }
   ```

3. **list_sites**: 사이트 목록 조회
   ```json
   {}
   ```

4. **upload_document**: 문서 업로드
   ```json
   {
     "sitename": "ecommerce",
     "file_path": "/path/to/document.docx"
   }
   ```

### Cursor/Copilot 연동

Cursor나 Copilot에서 이 MCP 서버에 연결하여 개발 표준 기반 자동 산출물 생성 기능을 사용할 수 있습니다.

## 🏗️ 프로젝트 구조

```
figure-mcp/
├── figure-mcp/                # MCP 서버
│   ├── src/
│   │   └── figure-mcp-server.ts  # 메인 서버
│   ├── package.json
│   └── tsconfig.json
├── figure-backend/            # 백엔드 API 서버
├── figure-backend-office/     # 관리자 대시보드
├── docker-compose.yml         # Docker 설정
├── package.json              # 루트 패키지 설정
└── README.md                 # 이 파일
```

## 🔧 개발

### 로컬 개발

```bash
cd figure-mcp
npm install
npm run dev
```

### 빌드

```bash
npm run build
npm start
```

### Docker 빌드

```bash
docker-compose build
docker-compose up
```

## �� 라이선스

MIT License 