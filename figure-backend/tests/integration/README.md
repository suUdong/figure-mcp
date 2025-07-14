# 🧪 MCP 통합 테스트 시나리오

이 문서는 Figure-MCP 프로젝트의 전체 워크플로우를 테스트하는 방법을 설명합니다.

## 📋 테스트 시나리오 개요

### 1. 전체 아키텍처
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   MCP Client    │───▶│  MCP Server     │───▶│  Figure Backend │
│  (Test Script)  │    │ (figure-mcp-    │    │   (FastAPI)     │
│                 │    │  server)        │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │                         │
                              ▼                         ▼
                       ┌─────────────────┐    ┌─────────────────┐
                       │   Figma API     │    │   ChromaDB +    │
                       │   (External)    │    │   OpenAI API    │
                       └─────────────────┘    └─────────────────┘
```

### 2. 주요 테스트 시나리오

#### 시나리오 A: 기본 워크플로우
1. **환경 설정**: Docker Compose로 전체 환경 시작
2. **사이트 관리**: `list_sites` - 기본 사이트 확인
3. **문서 업로드**: `upload_document` - 테스트 문서 업로드
4. **RAG 쿼리**: 백엔드 API로 업로드된 문서 기반 질의응답
5. **디자인 생성**: `use_design_figure` - RAG 결과 기반 디자인 생성
6. **작업 상태 확인**: `get_job_status` - 디자인 생성 상태 모니터링

#### 시나리오 B: 에러 처리 및 경계 조건
1. **잘못된 문서 업로드**: 지원하지 않는 형식 테스트
2. **존재하지 않는 사이트**: 잘못된 site_id로 쿼리
3. **빈 쿼리**: 빈 내용으로 RAG 쿼리
4. **API 한계 테스트**: 대용량 문서, 긴 쿼리 등

#### 시나리오 C: 성능 및 확장성
1. **동시 요청**: 여러 MCP 클라이언트 동시 실행
2. **대용량 처리**: 큰 문서 업로드 및 처리
3. **메모리 사용량**: 장시간 실행 시 메모리 누수 확인

## 🚀 실행 방법

### 전제 조건
- Docker & Docker Compose
- Node.js 18+ (MCP 서버용)
- Python 3.11+ (선택사항, 직접 실행 시)
- OpenAI API 키
- Figma API 토큰 (선택사항, 디자인 생성 시)

### 1. 환경 변수 설정
```bash
# .env 파일 생성
cp env.example .env

# 필수 환경 변수 설정
FIGURE_OPENAI_API_KEY=your_openai_api_key
FIGMA_ACCESS_TOKEN=your_figma_token  # 선택사항
```

### 2. 전체 환경 시작
```bash
# Docker Compose로 전체 스택 시작
docker-compose up -d

# 서비스 상태 확인
docker-compose ps
docker-compose logs figure-backend
```

### 3. 통합 테스트 실행
```bash
# 기본 워크플로우 테스트
cd tests/integration
npm install              # MCP 클라이언트 의존성 설치
npm run test:basic       # 기본 시나리오 실행

# 전체 테스트 스위트 실행
npm run test:all

# 특정 시나리오만 실행
npm run test:scenario -- --scenario=upload
npm run test:scenario -- --scenario=rag
npm run test:scenario -- --scenario=design
```

### 4. 수동 테스트 (개발/디버깅용)
```bash
# MCP 서버 직접 실행 (개발 모드)
cd ../figure-mcp-server
npm run dev

# 백엔드 직접 실행
cd figure-backend
python -m uvicorn app.main:app --reload --port 8000

# 개별 API 테스트
curl -X POST http://localhost:8000/api/rag/query \
  -H "Content-Type: application/json" \
  -d '{"query": "RAG에 대해 설명해주세요", "site_ids": [], "max_results": 5}'
```

## 📊 테스트 결과 분석

### 성공 기준
- ✅ 모든 MCP 도구 정상 작동
- ✅ 문서 업로드 → RAG 쿼리 → 응답 생성 플로우 완료
- ✅ 에러 처리 적절히 작동
- ✅ 성능 기준 충족 (응답 시간 < 30초)

### 로그 및 모니터링
```bash
# 실시간 로그 확인
docker-compose logs -f figure-backend
docker-compose logs -f figure-mcp-server

# 메트릭 확인 (Prometheus/Grafana 설정 시)
curl http://localhost:8000/metrics
```

### 문제 해결
- **MCP 서버 연결 실패**: Docker 네트워크 설정 확인
- **OpenAI API 오류**: API 키 및 할당량 확인  
- **ChromaDB 오류**: 데이터 볼륨 권한 확인
- **메모리 부족**: Docker 리소스 할당 증가

## 📋 체크리스트

### 배포 전 검증
- [ ] 기본 워크플로우 테스트 통과
- [ ] 에러 처리 시나리오 통과  
- [ ] 성능 기준 충족
- [ ] 로그 정상 출력
- [ ] 리소스 사용량 적정 수준
- [ ] 문서화 업데이트

### 정기 검증 (CI/CD)
- [ ] 일일 통합 테스트 실행
- [ ] 주간 성능 벤치마크
- [ ] 월간 보안 스캔
- [ ] 분기별 부하 테스트

---
**📝 Note**: 이 테스트는 실제 외부 API (OpenAI, Figma)를 사용하므로 비용이 발생할 수 있습니다. 개발 환경에서는 모킹을 권장합니다. 