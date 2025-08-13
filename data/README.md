# Figure MCP 데이터 관리 시스템

## 🎯 개요

Figure MCP 프로젝트의 초기 설정 데이터를 관리하는 시스템입니다.

### 핵심 특징
- **의미있는 UUID**: 물리적으론 UUID, 논리적으론 키 역할
- **환경별 설정**: 개발/스테이징/운영 환경별 맞춤 설정  
- **제로 스키마 변경**: 기존 백엔드 시스템과 완벽 호환
- **디버깅 친화적**: UUID만 봐도 리소스 의미 즉시 파악

## 📁 폴더 구조

```
data/
├── README.md                    # 이 문서
├── package.json                 # 의존성 및 스크립트
├── base/                        # 기본 데이터 (모든 환경 공통)
│   ├── matching-rules/          # 템플릿 매칭 룰 (5개)
│   ├── samples/                 # 샘플 문서 (2개)
│   └── templates/               # 템플릿 파일 (5개)
├── environments/                # 환경별 설정
│   ├── development.json         # 개발 환경
│   ├── staging.json            # 스테이징 환경
│   └── production.json         # 운영 환경
└── scripts/                    # 초기화 스크립트
    ├── init-system.js          # 시스템 초기화
    └── seed-database.js        # 데이터베이스 시딩
```

## 🔑 의미있는 UUID 시스템

### 핵심 아이디어: 물리적 UUID + 논리적 의미

기존 스키마를 전혀 변경하지 않고, **하드코딩된 의미있는 UUID**를 사용합니다.

#### UUID 매핑 테이블

**🏢 사이트 UUID:**
```
default-site    → site-default-0000-0000-0000-000000000001
dev-site        → site-dev-site-0000-0000-0000-000000000002  
staging-site    → site-staging-0000-0000-0000-000000000003
```

**📄 템플릿 UUID:**
```
api-documentation   → tmpl-api-doc-0000-0000-0000-000000000001
deployment-guide    → tmpl-deploy-0000-0000-0000-000000000002
requirements        → tmpl-require-0000-0000-0000-000000000003
table-specification → tmpl-table-0000-0000-0000-000000000004
test-plan          → tmpl-test-0000-0000-0000-000000000005
```

### ✅ 장점

1. **제로 스키마 변경**: 기존 테이블/API/Frontend 그대로 사용
2. **의미적 명확성**: `tmpl-api-doc-...` 보면 API 문서 템플릿임을 즉시 파악
3. **환경 간 일관성**: 개발/스테이징/운영 모든 환경에서 동일한 UUID
4. **디버깅 용이성**: 로그에서 UUID만 봐도 어떤 리소스인지 바로 알 수 있음

## 🚀 사용 방법

### 1. 초기화 실행
```bash
cd data
npm install
npm run init:dev    # 개발 환경 초기화
```

### 2. 결과 확인
```bash
cat scripts/init-result-development.json
# logical_uuids 섹션에서 UUID 매핑 확인
```

### 3. 기존 시스템에서 사용
- **Backend**: 기존 코드 그대로 작동 (UUID 형식 동일)
- **Frontend**: 기존 코드 그대로 작동 (API 응답 동일)
- **Database**: 기존 스키마 그대로 사용 (테이블 구조 무변경)

## 📋 데이터 예시

### 매칭룰
```json
{
  "mcp_request_type": "api_documentation",
  "template_id": "tmpl-api-doc-0000-0000-0000-000000000001",
  "site_id": "site-default-0000-0000-0000-000000000001",
  "is_active": true
}
```

### 환경 설정
```json
{
  "environment": "development", 
  "site": {
    "id": "site-default-0000-0000-0000-000000000001",
    "name": "Figure MCP 개발 환경",
    "url": "http://localhost:3001"
  }
}
```

## 🔧 확장 방법

### 새 템플릿 추가
1. `base/templates/` 에 템플릿 파일 추가
2. `scripts/init-system.js` 의 `LOGICAL_UUIDS.TEMPLATES` 에 새 UUID 추가  
3. `base/matching-rules/` 에 매칭룰 추가

### 새 환경 추가
1. `environments/` 에 새 환경 JSON 파일 생성
2. `package.json` scripts 에 초기화 명령 추가

## ⚠️ 주의사항

- **UUID 변경 금지**: 한번 설정된 의미있는 UUID는 절대 변경 금지
- **환경 일관성**: 모든 환경에서 반드시 동일한 UUID 사용
- **백업 필수**: 운영 환경 적용 전 데이터 백업 필수

## 💡 핵심 철학

> "물리적으로는 UUID, 논리적으로는 의미있는 키"

스키마 변경 없이 논리키의 모든 장점을 확보하는 혁신적 접근법입니다! 🚀