# figure-backend 시스템 설계

## 🎯 목적
figure-mcp 서버의 요청을 받아 RAG 처리된 개발 표준 가이드를 제공하는 백엔드 시스템

## 🏗️ 시스템 구조

### API 엔드포인트 설계

#### 1. 요구사항 정의서 RAG
```
POST /api/rag/requirements
{
  "site_id": "ecommerce",
  "ticket_id": "PROJ-123", 
  "type": "requirements_doc",
  "additional_context": "선택적 추가 정보"
}
```

#### 2. 개발 산출물 RAG  
```
POST /api/rag/deliverable
{
  "site_id": "ecommerce",
  "deliverable_type": "api_doc",
  "source_code": "실제 코드 내용",
  "context": "추가 컨텍스트"
}
```

#### 3. 사이트 표준 조회
```
GET /api/sites/{site_id}/standards
GET /api/sites/{site_id}/templates/{type}
```

#### 4. 표준 문서 관리
```
POST /api/documents/upload
PUT /api/documents/{doc_id}
DELETE /api/documents/{doc_id}
```

## 🔧 RAG 처리 파이프라인

### 1단계: 요청 분석
```python
async def analyze_request(request_data):
    site_id = request_data["site_id"]
    ticket_id = request_data.get("ticket_id")
    
    # JIRA 정보 수집 (필요한 경우)
    jira_info = await get_jira_info(ticket_id) if ticket_id else None
    
    # 사이트 설정 로드
    site_config = await get_site_config(site_id)
    
    return {
        "site_config": site_config,
        "jira_info": jira_info,
        "request_type": request_data["type"]
    }
```

### 2단계: 벡터 검색
```python
async def vector_search(site_id, query_context, top_k=10):
    # 쿼리 임베딩 생성
    query_embedding = await create_embedding(query_context)
    
    # ChromaDB에서 유사도 검색
    results = chroma_client.query(
        collection_name=f"site_{site_id}_standards",
        query_embeddings=[query_embedding],
        n_results=top_k,
        include=["documents", "metadatas", "distances"]
    )
    
    return results
```

### 3단계: 컨텍스트 생성
```python
async def create_context(search_results, jira_info, site_config):
    # 검색 결과를 관련도 순으로 정렬
    relevant_docs = rank_by_relevance(search_results)
    
    # 템플릿 선택
    template = select_template(site_config, request_type)
    
    # 가이드라인 추출
    guidelines = extract_guidelines(relevant_docs)
    
    # 체크리스트 생성
    checklist = generate_checklist(relevant_docs, jira_info)
    
    return {
        "template": template,
        "guidelines": guidelines,
        "checklist": checklist,
        "context": merge_context(relevant_docs),
        "jira_info": jira_info
    }
```

## 📊 데이터 모델

### 사이트 설정
```python
class SiteConfig(BaseModel):
    site_id: str
    name: str
    jira_config: Optional[JiraConfig]
    standards_config: StandardsConfig
    output_config: OutputConfig
    
class JiraConfig(BaseModel):
    base_url: str
    project_key: str
    username: str
    api_token: str
    
class StandardsConfig(BaseModel):
    templates: Dict[str, str]  # 문서 타입별 템플릿
    guidelines: List[str]      # 기본 가이드라인
    required_sections: List[str]  # 필수 섹션
```

### 표준 문서
```python
class StandardDocument(BaseModel):
    doc_id: str
    site_id: str
    title: str
    doc_type: str  # "api_guide", "requirements_template", etc.
    content: str
    embedding: List[float]
    metadata: Dict
    tags: List[str]
    version: str
    created_at: datetime
    updated_at: datetime
```

## 🚀 기술 스택

### 백엔드 프레임워크
- **FastAPI**: 고성능 API 서버
- **Pydantic**: 데이터 검증 및 시리얼라이제이션
- **SQLAlchemy**: ORM (PostgreSQL)

### RAG 시스템
- **ChromaDB**: 벡터 데이터베이스
- **OpenAI Embeddings**: 텍스트 임베딩
- **LangChain**: RAG 파이프라인 (선택사항)

### 외부 연동
- **JIRA API**: 티켓 정보 수집
- **Redis**: 캐싱 및 세션 관리

## 🔄 배포 구조

### Docker Compose 업데이트
```yaml
version: '3.8'

services:
  figure-mcp:
    build: ./figure-mcp-server
    ports:
      - "3000:3000"
    environment:
      - BACKEND_URL=http://figure-backend:8000
    depends_on:
      - figure-backend

  figure-backend:
    build: ./figure-backend
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=postgresql://user:pass@postgres:5432/figuredb
      - CHROMA_HOST=chromadb
      - REDIS_URL=redis://redis:6379
    depends_on:
      - postgres
      - chromadb
      - redis

  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: figuredb
      POSTGRES_USER: user
      POSTGRES_PASSWORD: pass
    volumes:
      - postgres_data:/var/lib/postgresql/data

  chromadb:
    image: chromadb/chroma:latest
    ports:
      - "8001:8000"
    volumes:
      - chroma_data:/chroma/chroma

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

volumes:
  postgres_data:
  chroma_data:
```

## 📈 성능 최적화

### 캐싱 전략
- **Redis**: 자주 조회되는 사이트 설정 캐싱
- **임베딩 캐시**: 동일한 문서의 재임베딩 방지
- **검색 결과 캐시**: 유사한 쿼리 결과 캐싱

### 비동기 처리
- **문서 업로드**: 백그라운드에서 임베딩 처리
- **대용량 검색**: 스트리밍 응답
- **배치 처리**: 여러 문서 동시 처리 