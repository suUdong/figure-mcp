# 🚀 Figure-MCP 통합 테스트 퀵 스타트 가이드

이 가이드는 **대화 세션이 끝난 후에도** 독립적으로 MCP 통합 테스트를 실행할 수 있도록 작성되었습니다.

## ⚡ 빠른 시작 (5분 설정)

### 1️⃣ 환경 설정
```powershell
# 1. 통합 테스트 디렉토리로 이동
cd figure-backend/tests/integration

# 2. 환경 변수 설정
cp env.template .env
# .env 파일을 열고 FIGURE_OPENAI_API_KEY를 실제 값으로 설정

# 3. 자동 환경 설정 실행
.\run-tests.ps1 -Setup
```

### 2️⃣ 서비스 시작
```powershell
# 프로젝트 루트에서 Docker Compose 시작
cd ../../../
docker-compose up -d

# 서비스 상태 확인
docker-compose ps
```

### 3️⃣ 테스트 실행
```powershell
# 통합 테스트 디렉토리로 돌아가기
cd figure-backend/tests/integration

# 기본 워크플로우 테스트만 실행
.\run-tests.ps1 -Scenario basic

# 또는 모든 테스트 실행
.\run-tests.ps1 -Scenario all -Verbose
```

## 📋 상세 실행 가이드

### 전제 조건 확인
- ✅ **Node.js 18.0.0+** 설치
- ✅ **Docker Desktop** 설치 및 실행 중
- ✅ **PowerShell 7+** (Windows 11 기본 제공)
- ✅ **OpenAI API 키** 보유

### 프로젝트 구조
```
figure-mcp/
├── figure-backend/
│   └── tests/integration/          ← 🎯 현재 위치
│       ├── src/                    # TypeScript 소스 코드
│       ├── dist/                   # 컴파일된 JavaScript (자동 생성)
│       ├── package.json            # 의존성 및 스크립트
│       ├── tsconfig.json           # TypeScript 설정
│       ├── env.template            # 환경 변수 템플릿
│       ├── run-tests.ps1           # 실행 스크립트
│       └── README.md               # 상세 문서
├── figure-mcp-server/              # MCP 서버
└── docker-compose.yml              # 전체 환경 설정
```

## 🧪 테스트 시나리오

### 기본 워크플로우 테스트 (`basic`)
1. **백엔드 헬스 체크** - FastAPI 서버 연결 확인
2. **MCP 서버 연결** - 4개 도구 (`list_sites`, `upload_document`, `use_design_figure`, `get_job_status`) 확인
3. **사이트 관리** - 기본 사이트 조회/생성
4. **문서 업로드** - MCP를 통한 테스트 문서 업로드
5. **RAG 쿼리** - 업로드된 문서 기반 질의응답
6. **디자인 생성** - Figma API 연동 (선택사항)
7. **정리 작업** - 테스트 데이터 삭제

### 에러 처리 테스트 (`error`)
1. **잘못된 백엔드 URL** - 연결 실패 처리
2. **빈 RAG 쿼리** - 입력 검증
3. **존재하지 않는 사이트 ID** - 데이터 무결성
4. **대용량 문서 업로드** - 크기 제한
5. **잘못된 메타데이터** - 타입 검증
6. **과도한 max_results** - 리소스 보호
7. **MCP 서버 연결 실패** - 오류 복구
8. **잘못된 job_id** - 상태 관리
9. **타임아웃 테스트** - 성능 임계값
10. **동시 요청 제한** - 부하 처리

## 💡 실행 예시

### 개발 중 빠른 테스트
```powershell
# 기본 워크플로우만 테스트 (빠름)
.\run-tests.ps1 -Scenario basic

# 상세 로그와 함께 실행
.\run-tests.ps1 -Scenario basic -Verbose
```

### 배포 전 전체 검증
```powershell
# 모든 테스트 수행 (완전한 검증)
.\run-tests.ps1 -Scenario all -Verbose

# 테스트 후 환경 정리
.\run-tests.ps1 -Cleanup
```

### 문제 해결 모드
```powershell
# 환경 설정만 다시 수행
.\run-tests.ps1 -Setup

# 에러 처리 테스트만 실행
.\run-tests.ps1 -Scenario error
```

## 🔧 문제 해결

### 자주 발생하는 문제

#### 1. "백엔드 서비스에 연결할 수 없습니다"
```powershell
# Docker 서비스 상태 확인
docker-compose ps

# 서비스 재시작
docker-compose down
docker-compose up -d

# 로그 확인
docker-compose logs figure-backend
```

#### 2. "MCP 서버 파일을 찾을 수 없습니다"
```powershell
# MCP 서버 빌드
cd ../figure-mcp-server
npm install
npm run build
cd ../figure-backend/tests/integration
```

#### 3. "OpenAI API 키가 설정되지 않았습니다"
```powershell
# .env 파일 확인
cat .env

# 환경 변수 직접 설정
$env:FIGURE_OPENAI_API_KEY = "your-api-key-here"
```

#### 4. "NPM 의존성 설치 실패"
```powershell
# 캐시 정리 후 재설치
npm cache clean --force
Remove-Item -Recurse -Force node_modules
npm install
```

### 로그 및 디버깅

#### 상세 로그 활성화
```powershell
# 모든 테스트를 상세 모드로 실행
.\run-tests.ps1 -Scenario all -Verbose
```

#### Docker 로그 확인
```powershell
# 백엔드 로그
docker-compose logs -f figure-backend

# 전체 서비스 로그
docker-compose logs -f
```

#### 네트워크 연결 테스트
```powershell
# 백엔드 헬스 체크
curl http://localhost:8000/health

# API 엔드포인트 직접 테스트
curl -X POST http://localhost:8000/api/rag/query -H "Content-Type: application/json" -d '{"query": "test", "site_ids": [], "max_results": 1}'
```

## 📊 성공 기준

### 기본 워크플로우 테스트
- ✅ 7/7 테스트 통과
- ✅ RAG 응답 생성 확인
- ✅ 문서 업로드/검색 정상 작동
- ✅ 응답 시간 < 30초

### 에러 처리 테스트
- ✅ 10/10 에러 시나리오 적절히 처리
- ✅ 시스템 복구 메커니즘 작동
- ✅ 리소스 보호 기능 정상

### 전체 시스템
- ✅ 성공률 90% 이상
- ✅ 메모리 누수 없음
- ✅ 로그 정상 출력

## 🔄 지속적인 사용

### 정기 테스트 (권장)
```powershell
# 일일 체크 (개발 중)
.\run-tests.ps1 -Scenario basic

# 주간 전체 테스트 (배포 전)
.\run-tests.ps1 -Scenario all -Verbose

# 월간 성능 검증
.\run-tests.ps1 -Scenario performance  # (향후 추가 예정)
```

### CI/CD 통합
```yaml
# GitHub Actions 예시 (향후 추가 예정)
- name: Run Integration Tests
  run: |
    cd figure-backend/tests/integration
    ./run-tests.ps1 -Scenario all
```

---

## 📞 도움이 필요하시면

1. **README.md** - 상세 아키텍처 및 구현 설명
2. **소스 코드** - `src/` 디렉토리의 주석 참고
3. **로그 분석** - 실패한 테스트의 상세 오류 메시지 확인
4. **Docker 로그** - 서비스 레벨 문제 진단

**🎯 이 가이드대로 실행하면 언제든지 MCP 통합 테스트를 독립적으로 수행할 수 있습니다!** 