# 🏗️ 헥사고날 아키텍처 (완전 구현)

## 📋 **아키텍처 개요**

이 프로젝트는 **헥사고날 아키텍처 (Ports and Adapters Pattern)**와 **Domain-Driven Design (DDD)** 원칙을 완전히 준수하여 구현되었습니다.

## 📁 **완전한 디렉토리 구조**

```
app/
├── 🏛️ domain/                          # Domain Layer
│   ├── repositories/                   # 포트 (인터페이스)
│   │   ├── embedding_repository.py     # 임베딩 포트
│   │   └── __init__.py
│   └── entities/                       # 도메인 엔티티
│       ├── schemas.py                  # 비즈니스 모델
│       └── __init__.py
│
├── 🚀 application/                      # Application Layer
│   └── services/                       # 애플리케이션 서비스
│       ├── job_service.py              # 작업 서비스
│       ├── rag_service.py              # RAG 서비스
│       ├── vector_store.py             # 벡터 스토어 서비스
│       ├── usage/                      # 사용량 추적
│       │   ├── tracker.py
│       │   └── __init__.py
│       └── __init__.py
│
├── 🔧 infrastructure/                   # Infrastructure Layer
│   ├── adapters/                       # 어댑터 구현체
│   │   └── embeddings/                 # 임베딩 어댑터들
│   │       ├── factory.py              # 팩토리 패턴
│   │       ├── gemini_adapter.py       # Gemini 어댑터
│   │       ├── openai_adapter.py       # OpenAI 어댑터
│   │       ├── voyage_adapter.py       # Voyage AI 어댑터
│   │       ├── langchain_wrapper.py    # LangChain 래퍼
│   │       └── __init__.py
│   ├── persistence/                    # 영속성 계층
│   │   ├── connection.py               # DB 연결
│   │   ├── models.py                   # DB 모델
│   │   └── __init__.py
│   └── __init__.py
│
├── 🌐 interfaces/                       # Interfaces Layer
│   └── api/                            # REST API 인터페이스
│       ├── admin.py                    # 관리자 API
│       ├── documents.py                # 문서 API
│       ├── rag.py                      # RAG API
│       ├── sites.py                    # 사이트 API
│       ├── usage.py                    # 사용량 API
│       └── __init__.py
│
├── 🛠️ utils/                           # 공통 유틸리티
│   ├── logger.py                       # 로깅 유틸
│   └── __init__.py
│
├── config.py                           # 설정
├── main.py                             # 애플리케이션 진입점
└── __init__.py
```

## 🔄 **의존성 방향**

```
Interfaces → Application → Domain ← Infrastructure
```

- **Interfaces**: 외부 요청을 Application으로 전달
- **Application**: 비즈니스 유스케이스 조율
- **Domain**: 핵심 비즈니스 로직과 포트 정의
- **Infrastructure**: 외부 시스템 구현체 (어댑터)

## 🎯 **핵심 원칙 준수**

### **1. 의존성 역전 (Dependency Inversion)**

```python
# Domain에서 포트 정의
class EmbeddingRepository(ABC):
    @abstractmethod
    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        pass

# Infrastructure에서 구현
class VoyageEmbeddingAdapter(EmbeddingRepository):
    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        # Voyage AI 구체적 구현
        pass
```

### **2. 포트와 어댑터 패턴**

- **포트**: `domain/repositories/` (인터페이스)
- **어댑터**: `infrastructure/adapters/` (구현체)

### **3. 팩토리 패턴**

```python
# Infrastructure에서 어댑터 생성
factory = EmbeddingAdapterFactory()
adapter = factory.create_adapter(settings)
```

### **4. 레이어별 책임**

#### 🏛️ **Domain Layer**

- 핵심 비즈니스 로직
- 포트 인터페이스 정의
- 도메인 엔티티

#### 🚀 **Application Layer**

- 유스케이스 조율
- 비즈니스 워크플로우
- 도메인 서비스 호출

#### 🔧 **Infrastructure Layer**

- 외부 시스템 어댑터
- 데이터베이스 영속성
- 써드파티 API 연동

#### 🌐 **Interfaces Layer**

- REST API 엔드포인트
- HTTP 요청/응답 처리
- 외부 통신 프로토콜

## 🧪 **아키텍처 검증**

```bash
# 헥사고날 아키텍처 구조 테스트
python simple_final_test.py

# 결과:
# ✅ Domain Layer: 포트와 엔티티 ✅
# ✅ Infrastructure Layer: 어댑터 팩토리 ✅
# ✅ 헥사고날 패턴 준수 ✅
```

## 🎉 **구현 완료 사항**

### **✅ 완전히 이동된 컴포넌트들**

1. **services/ → application/services/**

   - `job_service.py` ✅
   - `rag_service.py` ✅
   - `vector_store.py` ✅
   - `usage/tracker.py` ✅

2. **models/ → domain/entities/**

   - `schemas.py` ✅

3. **database/ → infrastructure/persistence/**

   - `connection.py` ✅
   - `models.py` ✅

4. **api/ → interfaces/api/**
   - `admin.py` ✅
   - `documents.py` ✅
   - `rag.py` ✅
   - `sites.py` ✅
   - `usage.py` ✅

### **✅ 수정된 Import 경로들**

- `app.models.schemas` → `app.domain.entities.schemas`
- `app.services.*` → `app.application.services.*`
- `app.database.*` → `app.infrastructure.persistence.*`
- `app.api.*` → `app.interfaces.api.*`

## 🏆 **최종 결과**

**완전한 헥사고날 아키텍처**가 성공적으로 구축되었으며, 모든 컴포넌트가 올바른 레이어에 배치되고, 의존성 방향이 정확하게 구현되었습니다.

이제 Figure-MCP 백엔드는 **확장 가능하고**, **테스트하기 쉬우며**, **유지보수가 용이한** 견고한 아키텍처를 갖추었습니다! 🎯✨
