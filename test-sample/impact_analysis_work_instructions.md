# 영향도 분석서 작성 작업 지침

본 지침서는 소스 코드·DB 변경에 따른 **영향도 분석서(Impact Analysis Report)** 를 작성하는 절차를 정의합니다.

---

## 1. 준비 단계
1. **대상 식별**  
   ‑ 변경이 필요한 클래스·모듈·SQL 등을 명확히 지정합니다. 예) `UserController`
2. **변경 범위 초안 작성**  
   ‑ 기능, 데이터, UI, 보안 등 어떤 영역이 영향을 받는지 구분만 적어 둡니다.

## 2. 필요 데이터 수집
영향도 분석서는 다음 데이터가 필요합니다. MCP 서버의 각 도구를 호출해 수집하세요.

| 데이터 항목 | 도구 이름 | 설명 |
|-------------|-----------|------|
| 메서드 의존성 행렬 | `method_dependency_matrix` | 대상 모듈 ↔ 다른 모듈 간 호출 관계 그래프 |
| DB 테이블 스키마 | `table_schema` | 관련 테이블 구조 및 제약조건 |
| (선택) 성능 지표 | `perf_metric` (추후) | TPS, 평균 응답시간 등 |

### 2.1 메서드 의존성 행렬 생성
```json
{
  "module": "UserController",
  "language": "java"
}
```
를 입력하여 호출하면 다음과 같은 JSON 결과를 얻습니다.
```json
{
  "matrix": "...Markdown table or Mermaid graph..."
}
```

### 2.2 테이블 스키마 조회
- 예) `DB2/KDW.USER`, `ORACLE/KSHOP.TB_USER`
```json
{
  "tables": [
    {"db_type": "DB2", "table_name": "KDW.USER"},
    {"db_type": "ORACLE", "table_name": "KSHOP.TB_USER_ROLE"}
  ]
}
```

## 3. 템플릿 채우기
`impact_analysis_spec` 도구를 호출하여 템플릿과 문서 번호를 확보합니다.

```json
{
  "template": "...Markdown...",
  "document_number": "IMP_KDI_BI_023",
  "required": [
    "method_dependency_matrix",
    "table_schema"
  ]
}
```

이후 위 2단계에서 수집한 정보를 **템플릿의 플레이스홀더**(`{{method_dependency_matrix}}`, `{{db_schema}}` 등)에 삽입합니다.

## 4. 영향도 평가 작성 요령
| 영역 | 질문 | 예시 |
|------|------|------|
| 기능 | 기능 동작 변경 여부? 기존 로직 유지? | "로그인 정책 변경으로 리다이렉트 URL 수정" |
| 성능 | TPS, 쿼리 비용 증가? | "인덱스 추가로 조회 속도 30% 개선" |
| 데이터 | 스키마 변경, 마이그레이션 필요? | "`age` 컬럼 int->smallint 축소" |
| 보안 | 권한, 암호화 영향? | "JWT 서명 알고리즘 변경" |
| 테스트 | 단위/통합 테스트 영향? | "Mock 객체 수정 필요" |

## 5. 리스크 및 완화
- **가능성 (Probability)**: 높음/중간/낮음
- **영향도 (Severity)**: 높음/중간/낮음
- **완화 방안**: 롤백 전략, A/B 배포, 추가 코드 리뷰 등

## 6. 산출물 저장
- 파일명: `IMP_KDI_BI_{번호}_{대상모듈}.md`
- 경로: `D:\KDI\docs\영향도 분석서\`
- 순번 관리: 기존 IMP_KDI_BI_XXX 파일 확인 후 +1

## 7. 완료 보고
문서 작성 후:
1. 지정된 경로에 저장
2. Slack #dev-docs 채널에 링크 공유
3. JIRA 티켓에 문서 첨부 및 레뷰어 지정 