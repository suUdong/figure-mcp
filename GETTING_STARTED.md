# Figure MCP 프로젝트 시작 가이드

Figure 디자인 도구를 위한 MCP (Model Context Protocol) 서버와 RAG 백엔드 시스템의 완전한 설정 및 실행 가이드입니다.

## 🎯 프로젝트 개요

**Figure MCP**는 다음 두 가지 주요 구성 요소로 이루어져 있습니다:

1. **figure-mcp-server**: TypeScript/Node.js 기반 MCP 서버
2. **figure-backend**: Python/FastAPI 기반 RAG 백엔드 API

## 🚀 빠른 시작 (Docker Compose 권장)

### 1️⃣ 사전 요구 사항

- **Docker** 및 **Docker Compose** 설치
- **OpenAI API 키** (필수)

### 2️⃣ 환경 설정

```bash
# 저장소 클론
git clone <repository-url>
cd figure-mcp

# 환경 변수 파일 생성
cp env.example .env

# .env 파일 편집 (필수 설정)
# OPENAI_API_KEY=your-actual-openai-api-key
```

### 3️⃣ 전체 시스템 실행

```bash
# 모든 서비스 시작
docker-compose up -d

# 로그 확인
docker-compose logs -f
```

### 4️⃣ 서비스 확인

시작 후 다음 URL에서 각 서비스를 확인할 수 있습니다:

| 서비스 | URL | 설명 |
|--------|-----|------|
| **Figure Backend API** | http://localhost:8001/docs | FastAPI Swagger 문서 |
| **Backend Health** | http://localhost:8001/health | 시스템 헬스체크 |
| **ChromaDB** | http://localhost:8000 | 벡터 데이터베이스 |
| **MCP Server** | http://localhost:3000 | MCP 서버 상태 |

## 🛠️ 개별 서비스 개발 모드

### figure-backend (Python/FastAPI)

```bash
cd figure-backend

# 가상환경 생성
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 의존성 설치
pip install -r requirements.txt

# 환경 변수 설정
cp env.example .env
# FIGURE_OPENAI_API_KEY 설정 필수

# 개발 서버 실행
python -m uvicorn app.main:app --reload --port 8001
```

### figure-mcp-server (TypeScript/Node.js)

```bash
cd figure-mcp-server

# 의존성 설치
npm install

# 개발 서버 실행
npm run dev
```

## 📋 기본 사용 방법

### 1. 사이트 등록

```bash
curl -X POST "http://localhost:8001/api/sites/" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Figma Help Center",
    "url": "https://help.figma.com",
    "description": "Figma 공식 도움말 센터"
  }'
```

### 2. 문서 업로드

```bash
curl -X POST "http://localhost:8001/api/documents/upload" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "컴포넌트 생성 방법",
    "content": "Figma에서 컴포넌트를 생성하는 방법은...",
    "doc_type": "website",
    "source_url": "https://help.figma.com/components"
  }'
```

### 3. RAG 질의응답

```bash
curl -X POST "http://localhost:8001/api/rag/query" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Figma에서 컴포넌트를 어떻게 만드나요?",
    "max_results": 5
  }'
```

## 🧪 테스트 시나리오

### 시나리오 1: 전체 시스템 테스트

```bash
# 1. 시스템 상태 확인
curl http://localhost:8001/health

# 2. 테스트 사이트 생성
curl -X POST "http://localhost:8001/api/sites/" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Site",
    "url": "https://example.com",
    "description": "테스트용 사이트"
  }'

# 3. 샘플 문서 업로드
curl -X POST "http://localhost:8001/api/documents/upload" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "샘플 문서",
    "content": "이것은 테스트용 문서입니다. Figure 디자인 도구에 대한 정보가 포함되어 있습니다.",
    "doc_type": "text"
  }'

# 4. 질의응답 테스트
curl -X POST "http://localhost:8001/api/rag/query" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Figure 디자인 도구에 대해 알려주세요",
    "max_results": 3
  }'
```

### 시나리오 2: MCP 서버 연동 테스트

```bash
# MCP 서버 상태 확인
curl http://localhost:3000/health

# MCP 도구 테스트 (각 도구를 순차적으로 테스트)
# 실제 MCP 클라이언트를 통해 테스트하거나
# 구현된 엔드포인트를 직접 호출
```

## 🔧 문제 해결

### 일반적인 문제들

**1. OpenAI API 키 설정 오류**
```bash
# 환경 변수 확인
echo $OPENAI_API_KEY

# Docker 환경에서 확인
docker-compose exec figure-backend env | grep OPENAI
```

**2. 포트 충돌**
```bash
# 사용 중인 포트 확인
netstat -tulpn | grep :8001
netstat -tulpn | grep :3000

# 프로세스 종료 후 재시작
docker-compose down
docker-compose up -d
```

**3. ChromaDB 연결 실패**
```bash
# ChromaDB 상태 확인
curl http://localhost:8000/api/v1/heartbeat

# 데이터 디렉토리 권한 확인
ls -la figure-backend/data/
```

**4. 메모리 부족**
```bash
# Docker 메모리 사용량 확인
docker stats

# 불필요한 컨테이너 정리
docker system prune
```

### 로그 확인

```bash
# 전체 서비스 로그
docker-compose logs

# 특정 서비스 로그
docker-compose logs figure-backend
docker-compose logs figure-mcp-server
docker-compose logs chroma

# 실시간 로그 추적
docker-compose logs -f figure-backend
```

## 📈 성능 모니터링

### 헬스체크 엔드포인트

```bash
# Backend 헬스체크
curl http://localhost:8001/health

# 상세 시스템 상태
curl http://localhost:8001/status

# RAG 서비스 상태
curl http://localhost:8001/api/rag/status

# 문서 통계
curl http://localhost:8001/api/documents/stats
```

### 벤치마크 테스트

```bash
# 동시 요청 테스트 (Apache Bench)
ab -n 100 -c 10 http://localhost:8001/health

# 질의응답 성능 테스트
time curl -X POST "http://localhost:8001/api/rag/query" \
  -H "Content-Type: application/json" \
  -d '{"query": "테스트 질문", "max_results": 5}'
```

## 🛡️ 보안 고려사항

### 개발 환경
- CORS가 모든 오리진에 대해 열려있음 (`allow_origins=["*"]`)
- 디버그 모드가 활성화되어 상세한 오류 정보 노출

### 프로덕션 배포 시 변경 필요사항
1. **CORS 설정 제한**
2. **디버그 모드 비활성화**
3. **API 키 보안 관리**
4. **HTTPS 설정**
5. **레이트 리미팅 구현**

## 📝 다음 단계

1. **실제 데이터 수집**: Figma 공식 문서, 튜토리얼 등을 시스템에 업로드
2. **MCP 클라이언트 연동**: Cursor나 다른 IDE에서 MCP 서버 사용
3. **사용자 인터페이스**: 웹 기반 관리 패널 개발
4. **모니터링**: Prometheus, Grafana 등을 통한 시스템 모니터링 구축
5. **CI/CD**: GitHub Actions 등을 통한 자동 배포 파이프라인 구축

---

문제가 발생하거나 추가 도움이 필요하면 로그를 확인하고 이 가이드의 문제 해결 섹션을 참조하세요. 🚀 