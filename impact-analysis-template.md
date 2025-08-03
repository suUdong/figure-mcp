# {{document_number}} - {{module_name}} 영향도 분석서

## 1. 개요
- **변경 대상**: {{module_name}}
- **변경 유형**: {{change_type}}
- **담당자**: {{developer}}
- **작성일**: {{current_date}}
- **JIRA 티켓**: {{jira_ticket_id}}

## 2. 변경 내용 요약
{{change_summary}}

## 3. 의존성 분석
### 3.1 메서드 의존성 행렬
{{method_dependency_matrix}}

### 3.2 모듈 간 호출 관계
{{module_relationships}}

## 4. 데이터베이스 영향도
### 4.1 관련 테이블 스키마
{{table_schema}}

### 4.2 데이터 마이그레이션 필요성
{{migration_requirements}}

## 5. 영향도 평가
| 영역 | 영향도 | 상세 내용 | 완화 방안 |
|------|--------|-----------|-----------|
| **기능** | {{functional_impact}} | {{functional_details}} | {{functional_mitigation}} |
| **데이터** | {{data_impact}} | {{data_details}} | {{data_mitigation}} |
| **보안** | {{security_impact}} | {{security_details}} | {{security_mitigation}} |
| **성능** | {{performance_impact}} | {{performance_details}} | {{performance_mitigation}} |
| **UI/UX** | {{ui_impact}} | {{ui_details}} | {{ui_mitigation}} |
| **테스트** | {{test_impact}} | {{test_details}} | {{test_mitigation}} |

## 6. 리스크 분석
### 6.1 주요 리스크
| 리스크 | 가능성 | 영향도 | 리스크 레벨 | 완화 방안 |
|--------|--------|--------|-------------|-----------|
| {{risk_1}} | {{probability_1}} | {{severity_1}} | {{risk_level_1}} | {{mitigation_1}} |
| {{risk_2}} | {{probability_2}} | {{severity_2}} | {{risk_level_2}} | {{mitigation_2}} |
| {{risk_3}} | {{probability_3}} | {{severity_3}} | {{risk_level_3}} | {{mitigation_3}} |

### 6.2 전체 리스크 레벨
**종합 리스크**: {{overall_risk_level}}  
**권장 조치**: {{recommended_action}}

## 7. 영향 받는 시스템/서비스
{{affected_systems}}

## 8. 테스트 계획
### 8.1 단위 테스트
{{unit_test_plan}}

### 8.2 통합 테스트  
{{integration_test_plan}}

### 8.3 사용자 테스트
{{user_test_plan}}

### 8.4 성능 테스트
{{performance_test_plan}}

## 9. 배포 계획
### 9.1 배포 전략
{{deployment_strategy}}

### 9.2 롤백 계획
{{rollback_plan}}

### 9.3 모니터링 계획
{{monitoring_plan}}

## 10. 일정 및 리소스
- **개발 시작일**: {{development_start_date}}
- **개발 완료일**: {{development_end_date}}
- **테스트 기간**: {{test_period}}
- **배포 예정일**: {{deployment_date}}
- **투입 인력**: {{required_resources}}

## 11. 체크리스트
### 개발 단계
- [ ] 코드 구현 완료
- [ ] 코드 리뷰 완료
- [ ] 단위 테스트 작성 및 통과
- [ ] 정적 분석 도구 검증 통과

### 테스트 단계  
- [ ] 통합 테스트 완료
- [ ] 성능 테스트 완료
- [ ] 보안 테스트 완료
- [ ] 사용자 수용 테스트 완료

### 배포 단계
- [ ] 배포 스크립트 준비
- [ ] 모니터링 도구 설정
- [ ] 롤백 절차 확인
- [ ] 이해관계자 배포 승인

## 12. 승인
- **작성자**: {{author}}
- **기술 검토자**: {{technical_reviewer}}
- **비즈니스 승인자**: {{business_approver}}
- **최종 승인자**: {{final_approver}}

---
**문서 버전**: 1.0  
**최종 수정일**: {{last_modified}}  
**다음 검토일**: {{next_review_date}}