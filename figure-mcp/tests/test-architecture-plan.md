# MCP ↔ Backend 통신 테스트 아키텍처

## 🎯 테스트 전략 개요

### 1. Unit Tests (단위 테스트) - Jest + Mock
**목적**: MCP 서버 내부 로직과 API 호출 인터페이스 검증

#### 테스트 대상
- `cachedApiCall` 메서드
- 각 MCP 도구 함수들 (start_task, create_document 등)
- 캐싱 로직 (getCachedData, setCachedData)
- 에러 핸들링 로직

#### 모킹 전략
```typescript
// axios 모킹으로 백엔드 호출 시뮬레이션
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// 성공 응답 모킹
mockedAxios.create.mockReturnValue({
  get: jest.fn().mockResolvedValue({
    data: { success: true, data: mockData }
  }),
  post: jest.fn().mockResolvedValue({
    data: { success: true, data: mockData }
  })
});
```

#### 주요 테스트 케이스
1. **정상 응답 처리**
2. **HTTP 에러 응답 처리** (404, 500, 503)
3. **네트워크 오류 처리** (ECONNREFUSED, ETIMEDOUT)
4. **캐시 히트/미스 시나리오**
5. **입력 검증 및 변환**

### 2. Integration Tests (통합 테스트) - Jest + Real HTTP
**목적**: MCP 서버와 실제 백엔드 간 통신 검증

#### 테스트 환경 구성
```typescript
// 테스트용 백엔드 서버 URL
const TEST_BACKEND_URL = 'http://localhost:8001/api';

// 테스트 전용 MCP 서버 인스턴스
const testMCPServer = new FigureMCPServer({
  BACKEND_API_URL: TEST_BACKEND_URL,
  MCP_QUIET: 'true'  // 로그 출력 최소화
});
```

#### 주요 테스트 시나리오
1. **사이트 목록 조회** (`list_available_sites`)
2. **문서 생성 플로우** (`create_document`)
3. **테이블 명세서 생성** (`create_table_specification`)
4. **JIRA 연동** (`fetch_jira_ticket`)
5. **Docker 상태 조회** (`getDockerServicesStatus`)

#### 테스트 데이터베이스 관리
```typescript
// 각 테스트 전에 DB 초기화
beforeEach(async () => {
  await resetTestDatabase();
  await seedTestData();
});
```

### 3. Contract Tests (계약 테스트) - Pact
**목적**: MCP와 Backend 간 API 계약 검증

#### Consumer(MCP) 테스트
```typescript
// MCP가 기대하는 백엔드 응답 형식 정의
const expectedSitesResponse = {
  success: true,
  message: string,
  data: arrayLike([
    { id: string, name: string, company: string }
  ])
};
```

#### Provider(Backend) 검증
```python
# 백엔드가 약속된 응답 형식을 준수하는지 검증
@pytest.mark.pact
def test_sites_api_contract():
    response = client.get("/api/sites")
    assert response.status_code == 200
    assert "success" in response.json()
    assert "data" in response.json()
```

### 4. E2E Tests (종단간 테스트) - Playwright/Puppeteer
**목적**: 실제 사용자 시나리오 전체 플로우 검증

#### 테스트 시나리오
1. **Cursor IDE에서 MCP 도구 사용**
2. **문서 생성 → 백엔드 저장 → 결과 반환** 전체 플로우
3. **에러 상황에서의 사용자 경험**

## 🔧 구현 우선순위

### Phase 1: 기본 단위 테스트 (1-2주)
- [ ] `cachedApiCall` 메서드 테스트
- [ ] 주요 MCP 도구 함수 테스트
- [ ] 캐싱 로직 테스트

### Phase 2: 통합 테스트 (2-3주)
- [ ] 실제 백엔드와의 HTTP 통신 테스트
- [ ] 에러 시나리오 테스트
- [ ] 성능 및 타임아웃 테스트

### Phase 3: E2E 테스트 (2-3주)
- [ ] Cursor IDE 시뮬레이션
- [ ] 실제 사용자 시나리오 테스트
- [ ] 로드 테스트

## 🎯 성공 기준

### 코드 커버리지 목표
- **Unit Tests**: 85% 이상
- **Integration Tests**: 주요 API 엔드포인트 100% 커버
- **E2E Tests**: 핵심 사용자 시나리오 100% 커버

### 성능 기준
- **API 응답 시간**: 평균 < 500ms
- **캐시 히트율**: > 70%
- **에러 복구 시간**: < 3초

### 안정성 기준
- **테스트 성공률**: > 95%
- **플레이키 테스트**: < 5%
- **CI/CD 통과율**: > 98%
