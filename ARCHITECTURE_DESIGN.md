# Figure-MCP 시스템 아키텍처

## 🎯 시스템 목적
사용자가 생성형 AI(Cursor/Copilot)에서 MCP를 통해 사이트별 개발 표준에 맞는 요구사항 정의서 및 개발 산출물을 자동 생성하는 시스템

## 🏗️ 아키텍처 개요

### 1️⃣ 사용자 환경
- **개발자**: 실제 사용자
- **생성형 AI**: Cursor, Copilot, ChatGPT 등 LLM 도구

### 2️⃣ MCP 인터페이스 레이어
- **MCP 서버**: figure-mcp-server (이미 구현됨)
- **MCP 도구들**:
  - `create_requirements_doc`: 요구사항 정의서 작성
  - `create_deliverable`: 개발 산출물 생성
  - `get_site_standards`: 사이트별 표준 조회
  - `upload_standards`: 표준 문서 업로드

### 3️⃣ 관리 시스템 백엔드
- **API Gateway**: 모든 요청의 진입점
- **사이트 관리 서비스**: 사이트별 설정 및 표준 관리
- **문서 처리 서비스**: 표준문서 파싱 및 임베딩
- **RAG 엔진**: 벡터 검색 및 컨텍스트 생성

### 4️⃣ 데이터 저장소
- **Vector DB**: 사이트별 표준문서 임베딩
- **사이트 설정 DB**: 각 사이트별 설정 정보
- **JIRA API**: 요구사항 소스 데이터

### 5️⃣ 결과물 저장소
- **Wiki 시스템**: Confluence, Notion 등
- **클라우드 저장소**: SharePoint, Google Drive 등
- **버전 관리**: Git Repository

## 🔄 주요 워크플로우

### 워크플로우 1: 요구사항 정의서 작성
```
1. 사용자: "사이트A의 PROJ-123 티켓으로 요구사항 정의서 작성해줘"
2. LLM → MCP 서버 → create_requirements_doc(site="A", ticket="PROJ-123")
3. 백엔드: JIRA에서 티켓 정보 수집 + 사이트A 표준문서 RAG 검색
4. 반환: 표준 템플릿 + 가이드라인 + 체크리스트
5. LLM: 가이드를 기반으로 요구사항 정의서 생성
6. 결과: Wiki나 클라우드에 자동 저장
```

### 워크플로우 2: 개발 산출물 생성
```
1. 사용자: "이 코드를 사이트B 표준에 맞는 API 문서로 만들어줘"
2. LLM → MCP 서버 → create_deliverable(site="B", type="api_doc", code=...)
3. 백엔드: 사이트B API 문서 표준 + 템플릿 RAG 검색
4. 반환: 맞춤형 문서 템플릿 + 작성 가이드
5. LLM: 코드 분석 + 표준에 맞는 API 문서 생성
6. 결과: 지정된 저장소에 자동 저장
```

## 🛠️ 기술 스택

### MCP 서버 (이미 구현됨)
- **언어**: TypeScript
- **프레임워크**: MCP SDK
- **전송**: stdio

### 관리 시스템 백엔드 (구현 예정)
- **언어**: Python
- **프레임워크**: FastAPI
- **Vector DB**: ChromaDB
- **임베딩**: OpenAI Embeddings
- **데이터베이스**: PostgreSQL

### 프론트엔드 (선택사항)
- **관리 UI**: React + TypeScript
- **목적**: 표준문서 업로드 및 사이트 설정

## 📊 데이터 모델

### 사이트 설정
```json
{
  "site_id": "ecommerce",
  "name": "이커머스 사이트",
  "jira_config": {
    "base_url": "https://company.atlassian.net",
    "project_key": "ECOM"
  },
  "standards": {
    "api_doc_template": "template_id_1",
    "requirements_template": "template_id_2"
  },
  "output_config": {
    "wiki_space": "ECOM_DOCS",
    "storage_path": "/sites/ecommerce/docs"
  }
}
```

### 표준 문서
```json
{
  "doc_id": "std_doc_001",
  "site_id": "ecommerce",
  "type": "api_documentation",
  "title": "API 문서 작성 표준",
  "content": "...",
  "embedding": [...],
  "templates": ["template_1", "template_2"],
  "checklist": ["항목1", "항목2"]
}
```

## 🔐 보안 및 권한
- **사이트별 접근 제어**: 사용자는 권한이 있는 사이트만 접근 가능
- **API 키 관리**: JIRA, 클라우드 저장소 API 키 안전 관리
- **감사 로그**: 모든 문서 생성 및 수정 이력 추적

## 📈 확장성 고려사항
- **다중 사이트 지원**: 무제한 사이트 추가 가능
- **플러그인 아키텍처**: 새로운 문서 타입 쉽게 추가
- **캐싱 전략**: 자주 사용되는 표준문서 캐싱
- **비동기 처리**: 대용량 문서 처리 시 비동기 작업 