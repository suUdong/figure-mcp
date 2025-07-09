# Figure Backend API

Figure 디자인 도구를 위한 RAG (Retrieval-Augmented Generation) 기반 백엔드 API입니다.

## 🌟 주요 기능

- **RAG 기반 질의응답**: ChromaDB + OpenAI를 활용한 지능형 문서 검색 및 답변 생성
- **벡터 검색**: 의미 기반 문서 검색 및 유사도 매칭
- **문서 관리**: 다양한 형식의 문서 업로드, 저장, 관리
- **사이트 관리**: 문서 소스 사이트 등록 및 관리
- **RESTful API**: FastAPI 기반의 현대적이고 직관적인 API

## 🏗️ 기술 스택

- **Framework**: FastAPI 0.115.13
- **Vector Database**: ChromaDB 0.5.23
- **LLM**: OpenAI GPT-4o-mini
- **Embeddings**: OpenAI text-embedding-3-small
- **RAG Framework**: LangChain 0.3.12
- **Validation**: Pydantic 2.10.6
- **Server**: Uvicorn

## 🚀 빠른 시작

### 1. 환경 설정

```bash
# 저장소 클론
git clone <repository-url>
cd figure-backend

# 가상환경 생성 및 활성화
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 의존성 설치
pip install -r requirements.txt
```

### 2. 환경 변수 설정

```bash
# 환경 변수 파일 복사
cp env.example .env

# .env 파일 편집 (필수: OpenAI API 키 설정)
# FIGURE_OPENAI_API_KEY="your-actual-api-key"
```

### 3. 서버 실행

```bash
# 개발 서버 실행
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8001

# 또는 직접 실행
python app/main.py
```

### 4. API 확인

- **API 문서**: http://localhost:8001/docs
- **상태 확인**: http://localhost:8001/health
- **시스템 정보**: http://localhost:8001/status

## 🐳 Docker 실행

```bash
# Docker 이미지 빌드
docker build -t figure-backend .

# 컨테이너 실행
docker run -d \
  --name figure-backend \
  -p 8001:8001 \
  -e FIGURE_OPENAI_API_KEY="your-api-key" \
  figure-backend
```

## 📚 API 엔드포인트

### RAG (질의응답)
- `POST /api/rag/query` - 질의응답 처리
- `GET /api/rag/status` - RAG 서비스 상태
- `POST /api/rag/health` - RAG 헬스체크

### 문서 관리
- `POST /api/documents/upload` - 문서 업로드
- `DELETE /api/documents/{id}` - 문서 삭제
- `GET /api/documents/search` - 문서 검색
- `GET /api/documents/stats` - 문서 통계

### 사이트 관리
- `POST /api/sites/` - 사이트 생성
- `GET /api/sites/` - 사이트 목록
- `GET /api/sites/{id}` - 사이트 상세
- `PUT /api/sites/{id}` - 사이트 수정
- `DELETE /api/sites/{id}` - 사이트 삭제

### 시스템
- `GET /` - 루트 정보
- `GET /health` - 전체 헬스체크
- `GET /status` - 시스템 상태

## 💾 데이터 구조

### 문서 타입
- `website` - 웹사이트 콘텐츠
- `pdf` - PDF 문서
- `text` - 텍스트 파일
- `confluence` - Confluence 페이지
- `jira` - JIRA 이슈

### 요청/응답 예시

**질의응답 요청**:
```json
{
  "query": "Figure에서 컴포넌트를 어떻게 만드나요?",
  "max_results": 5,
  "similarity_threshold": 0.7,
  "site_ids": ["site-uuid-1", "site-uuid-2"]
}
```

**문서 업로드 요청**:
```json
{
  "title": "Figure 컴포넌트 가이드",
  "content": "컴포넌트 생성 방법...",
  "doc_type": "website",
  "source_url": "https://help.figma.com/components",
  "site_id": "site-uuid",
  "metadata": {"category": "tutorial"}
}
```

## 🔧 설정 옵션

주요 환경 변수:

| 변수명 | 기본값 | 설명 |
|--------|--------|------|
| `FIGURE_OPENAI_API_KEY` | - | OpenAI API 키 (필수) |
| `FIGURE_OPENAI_MODEL` | gpt-4o-mini | 사용할 LLM 모델 |
| `FIGURE_EMBEDDING_MODEL` | text-embedding-3-small | 임베딩 모델 |
| `FIGURE_DEBUG` | false | 디버그 모드 활성화 |
| `FIGURE_PORT` | 8001 | 서버 포트 |
| `FIGURE_CHROMA_PERSIST_DIRECTORY` | ./data/chroma | ChromaDB 데이터 경로 |

## 🧪 테스트

```bash
# 의존성 설치 (개발용)
pip install pytest pytest-asyncio httpx

# 테스트 실행
pytest

# 커버리지 포함 테스트
pytest --cov=app
```

## 📝 로그

로그는 다음 위치에서 확인할 수 있습니다:
- 콘솔 출력: 실시간 로그
- 파일 로그: `logs/` 디렉토리 (설정 시)

로그 레벨:
- `DEBUG`: 상세한 디버그 정보
- `INFO`: 일반적인 정보 (기본값)
- `WARNING`: 경고 메시지
- `ERROR`: 오류 정보

## 🚨 문제 해결

### 일반적인 문제들

**1. OpenAI API 키 오류**
```
ValueError: FIGURE_OPENAI_API_KEY 환경 변수가 설정되어야 합니다.
```
→ `.env` 파일에 올바른 OpenAI API 키를 설정하세요.

**2. ChromaDB 초기화 실패**
```
chromadb.errors.ChromaError: ...
```
→ 데이터 디렉토리 권한을 확인하고 `./data/chroma` 경로가 쓰기 가능한지 확인하세요.

**3. 포트 충돌**
```
OSError: [Errno 48] Address already in use
```
→ 다른 포트를 사용하거나 기존 프로세스를 종료하세요.

### 로그 확인
```bash
# 실시간 로그 확인
docker logs -f figure-backend

# 서비스 상태 확인
curl http://localhost:8001/health
```

## 🤝 기여하기

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 라이선스

MIT License - 자세한 내용은 LICENSE 파일을 참조하세요.

## 🔗 관련 링크

- [FastAPI 문서](https://fastapi.tiangolo.com/)
- [ChromaDB 문서](https://docs.trychroma.com/)
- [LangChain 문서](https://python.langchain.com/)
- [OpenAI API 문서](https://platform.openai.com/docs) 