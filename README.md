# Figure-MCP

> MCP 기반 지능형 개발 표준 자동 산출물 생성 시스템

Figure-MCP는 MCP(Model Context Protocol) 서버로, 개발 표준 문서를 관리하고 Jira 요구사항을 기반으로 맞춤형 개발 산출물을 자동 생성하는 도구입니다.

## 🚀 주요 기능

- **📋 다양한 문서 형식 지원**: Excel, Word, Markdown, PDF, 텍스트 파일
- **🔍 지능형 RAG 검색**: Vector DB 기반 개발 표준 검색 및 활용
- **🎯 Jira 연동**: 티켓 정보 자동 추출 및 요구사항 분석
- **🤖 자동 산출물 생성**: LLM 기반 코드 및 문서 자동 생성
- **🔧 개발도구 연동**: Cursor, Copilot과의 원활한 연동

## 📦 설치 및 실행

### 사전 요구사항

- Node.js 18+
- npm 9+

### 빠른 시작

1. **레포지토리 클론**
   ```bash
   git clone https://github.com/your-org/figure-mcp.git
   cd figure-mcp
   ```

2. **MCP 서버 실행**
   ```bash
   # 의존성 설치 및 실행
   npm run dev
   
   # 또는 직접 실행
   cd figure-mcp
   npm install
   npm run dev
   ```

3. **Docker 실행 (선택사항)**
   ```bash
   # Docker로 실행
   npm run docker:build
   npm run docker:up
   ```

### 환경 설정

`figure-mcp/.env` 파일에 다음 변수들을 설정하세요:

```bash
# 서버 설정
NODE_ENV=development
PORT=3000

# LLM 설정 (선택사항)
OPENAI_API_KEY=your_openai_key

# Jira 연동 (선택사항)
JIRA_BASE_URL=https://your-company.atlassian.net
JIRA_USERNAME=your_username
JIRA_API_TOKEN=your_api_token
```

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