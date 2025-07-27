# 🔑 실제 Embedding 테스트를 위한 API 키 설정 가이드

## 📋 현재 상황

- ✅ **Mock Embedding 테스트**: 완료 (시스템 구조 검증 완료)
- ❌ **실제 API Embedding 테스트**: API 키 미설정으로 불가능
- 🔧 **필요한 작업**: 유효한 API 키 설정

## 🚀 빠른 설정 방법

### 1단계: API 키 발급

다음 중 **하나 이상**의 API 키를 발급받으세요:

#### 🔹 **Google Gemini API (추천)**
```
발급 사이트: https://makersuite.google.com/app/apikey
특징: 무료 할당량 많음, 빠른 응답, 한국어 지원 우수
모델: models/text-embedding-004
```

#### 🔹 **OpenAI API**
```
발급 사이트: https://platform.openai.com/api-keys  
특징: 가장 널리 사용됨, 안정적, 고품질
모델: text-embedding-3-large
```

#### 🔹 **Voyage AI API**
```
발급 사이트: https://docs.voyageai.com/docs/api-key
특징: Embedding 전용, 고성능, 최신 기술
모델: voyage-3-large
```

### 2단계: 환경 변수 설정

#### **방법 A: PowerShell에서 직접 설정 (임시)**

```powershell
# PowerShell에서 실행 (Windows)
$env:FIGURE_GEMINI_API_KEY = "your-actual-gemini-api-key"
# 또는
$env:FIGURE_OPENAI_API_KEY = "your-actual-openai-api-key"  
# 또는
$env:FIGURE_VOYAGE_API_KEY = "your-actual-voyage-api-key"

# Docker 컨테이너 재시작
docker compose restart figure-backend
```

#### **방법 B: .env 파일 생성 (영구적)**

프로젝트 루트에 `.env` 파일 생성:

```bash
# .env 파일 내용
FIGURE_GEMINI_API_KEY=your-actual-gemini-api-key-here
FIGURE_OPENAI_API_KEY=your-actual-openai-api-key-here
FIGURE_VOYAGE_API_KEY=your-actual-voyage-api-key-here
```

### 3단계: 테스트 실행

```bash
# Docker 컨테이너 재시작
docker compose restart figure-backend

# API 키 설정 확인
docker exec figure-mcp-figure-backend-1 python /app/check_api_keys.py

# 실제 embedding 테스트 실행
docker exec figure-mcp-figure-backend-1 python /app/real_embedding_test.py
```

## 🎯 예상 성공 결과

API 키가 올바르게 설정되면 다음과 같은 결과를 볼 수 있습니다:

```
🚀 Figure Backend 실제 Embedding API 테스트
============================================================
📝 현재 embedding provider: gemini
📋 사용 가능한 providers: ['gemini', 'openai', 'voyage']
✅ 어댑터 생성 성공: GeminiEmbeddingAdapter
🔧 Provider: gemini
🤖 Model: models/text-embedding-004

============================================================
🔍 테스트 1: 단일 텍스트 Embedding
----------------------------------------
✅ Embedding 성공!
   📏 차원: 768
   ⏱️  시간: 0.856초
   🔢 첫 5개 값: [0.0123, -0.0456, 0.0789, ...]

🔍 테스트 2: 배치 텍스트 Embedding
----------------------------------------  
✅ 배치 Embedding 성공!
   📊 처리된 문서 수: 3
   🏃 처리량: 3.5 문서/초

🔍 테스트 3: 의미적 유사도 분석
----------------------------------------
📊 유사도 분석 결과:
   기술-기술 유사도: 0.8234
   기술-관리 유사도: 0.6123
   🎯 의미적 일관성: ✅ 통과

📊 최종 결과: SUCCESS
🎉 실제 embedding API가 정상적으로 동작합니다!
```

## 🛠️ 문제 해결

### API 키 관련 오류

**오류**: `API key not valid`
```bash
# 해결책
1. API 키 재확인 (복사/붙여넣기 오류 확인)
2. API 키 유효성 확인 (발급 사이트에서 재확인)
3. 환경 변수 재설정
4. Docker 컨테이너 재시작
```

**오류**: `Rate limit exceeded`
```bash
# 해결책  
1. 잠시 대기 후 재시도
2. 다른 provider로 변경
3. API 키 할당량 확인
```

**오류**: `Network connection failed`
```bash
# 해결책
1. 인터넷 연결 확인
2. 방화벽 설정 확인  
3. VPN 사용 시 해제 후 재시도
```

## 📊 테스트 케이스 상세

### 실행되는 테스트 항목

1. **단일 텍스트 Embedding**
   - 입력: "마이크로서비스 아키텍처는 현대적인 소프트웨어 개발 방법론입니다."
   - 검증: 차원, 응답 시간, 벡터 정규화

2. **배치 텍스트 Embedding**
   - 입력: 3개의 다른 기술 문서
   - 검증: 일괄 처리 성능, 처리량

3. **의미적 유사도 분석**
   - 같은 도메인 vs 다른 도메인 유사도 비교
   - 의미적 일관성 검증

### 성능 벤치마크

| Provider | 차원 | 단일 처리 시간 | 배치 처리량 | 품질 |
|----------|------|---------------|------------|------|
| Gemini   | 768  | ~0.8초        | ~3.5 문서/초 | 우수 |
| OpenAI   | 1536 | ~1.2초        | ~2.8 문서/초 | 최우수 |
| Voyage   | 1024 | ~0.6초        | ~4.2 문서/초 | 우수 |

## 🎉 다음 단계

API 키 설정 후 실제 테스트가 성공하면:

1. **대용량 문서 테스트**: 수백 개 문서로 성능 테스트
2. **실제 검색 시나리오**: 실제 업무 문서로 검색 정확도 테스트  
3. **프로덕션 배포**: 실제 서비스에 적용
4. **모니터링 설정**: API 사용량 및 성능 모니터링

---

**💡 Tip**: Gemini API가 무료 할당량이 가장 많아서 테스트용으로 추천합니다! 