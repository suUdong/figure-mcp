# 테스트 계획서 템플릿

## 프로젝트 정보
- **프로젝트명**: {project_name}
- **테스트 대상**: {test_target}
- **버전**: {version}
- **작성일**: {date}
- **작성자**: {author}
- **검토자**: {reviewer}

## 1. 테스트 개요
### 1.1 목적
{test_purpose}

### 1.2 범위
- **포함 범위**: {included_scope}
- **제외 범위**: {excluded_scope}

### 1.3 테스트 접근 방법
- **테스트 레벨**: {test_levels}
- **테스트 타입**: {test_types}
- **테스트 기법**: {test_techniques}

## 2. 테스트 환경
### 2.1 하드웨어 환경
- **서버**: {server_spec}
- **클라이언트**: {client_spec}
- **네트워크**: {network_spec}

### 2.2 소프트웨어 환경
- **OS**: {operating_system}
- **DB**: {database}
- **미들웨어**: {middleware}
- **브라우저**: {browser_support}

### 2.3 테스트 데이터
- **테스트 데이터 유형**: {test_data_type}
- **데이터 준비 방법**: {data_preparation}
- **데이터 정리 방법**: {data_cleanup}

## 3. 테스트 일정
| 단계 | 시작일 | 종료일 | 담당자 | 비고 |
|------|--------|--------|--------|------|
| {phase_1} | {start_date_1} | {end_date_1} | {assignee_1} | {note_1} |
| {phase_2} | {start_date_2} | {end_date_2} | {assignee_2} | {note_2} |
| {phase_3} | {start_date_3} | {end_date_3} | {assignee_3} | {note_3} |

## 4. 테스트 케이스

### 4.1 {test_category_1}
| TC ID | 테스트 케이스명 | 우선순위 | 전제조건 | 테스트 단계 | 예상결과 |
|-------|----------------|----------|----------|-------------|----------|
| {tc_id_1} | {tc_name_1} | {priority_1} | {precondition_1} | {test_steps_1} | {expected_result_1} |
| {tc_id_2} | {tc_name_2} | {priority_2} | {precondition_2} | {test_steps_2} | {expected_result_2} |

### 4.2 {test_category_2}
| TC ID | 테스트 케이스명 | 우선순위 | 전제조건 | 테스트 단계 | 예상결과 |
|-------|----------------|----------|----------|-------------|----------|
| {tc_id_3} | {tc_name_3} | {priority_3} | {precondition_3} | {test_steps_3} | {expected_result_3} |
| {tc_id_4} | {tc_name_4} | {priority_4} | {precondition_4} | {test_steps_4} | {expected_result_4} |

## 5. 테스트 실행 결과

### 5.1 테스트 실행 요약
- **총 테스트 케이스**: {total_test_cases}개
- **실행 완료**: {executed_cases}개
- **통과**: {passed_cases}개
- **실패**: {failed_cases}개
- **보류**: {pending_cases}개

### 5.2 결함 현황
| 결함 ID | 심각도 | 상태 | 발견일 | 수정일 | 설명 |
|---------|--------|------|--------|--------|------|
| {defect_id_1} | {severity_1} | {status_1} | {found_date_1} | {fixed_date_1} | {defect_description_1} |
| {defect_id_2} | {severity_2} | {status_2} | {found_date_2} | {fixed_date_2} | {defect_description_2} |

## 6. 성능 테스트

### 6.1 성능 목표
- **응답시간**: {response_time_target}
- **처리량**: {throughput_target}
- **동시 사용자**: {concurrent_users_target}

### 6.2 성능 테스트 결과
| 시나리오 | 목표값 | 측정값 | 결과 |
|----------|--------|--------|------|
| {scenario_1} | {target_1} | {measured_1} | {result_1} |
| {scenario_2} | {target_2} | {measured_2} | {result_2} |

## 7. 보안 테스트
- **인증 테스트**: {auth_test_result}
- **권한 테스트**: {authorization_test_result}
- **입력 검증 테스트**: {input_validation_test_result}
- **세션 관리 테스트**: {session_management_test_result}

## 8. 자동화 테스트
### 8.1 자동화 도구
- **도구명**: {automation_tool}
- **스크립트 언어**: {script_language}
- **실행 환경**: {execution_environment}

### 8.2 자동화 커버리지
- **자동화된 테스트 케이스**: {automated_cases}개
- **자동화 비율**: {automation_ratio}%

## 9. 테스트 완료 기준
- [ ] {completion_criteria_1}
- [ ] {completion_criteria_2}
- [ ] {completion_criteria_3}
- [ ] {completion_criteria_4}

## 10. 위험 요소 및 대응방안
| 위험 요소 | 확률 | 영향도 | 대응방안 |
|-----------|------|--------|----------|
| {risk_1} | {probability_1} | {impact_1} | {mitigation_1} |
| {risk_2} | {probability_2} | {impact_2} | {mitigation_2} |

## 11. 결론 및 권고사항
### 11.1 테스트 결과 요약
{test_summary}

### 11.2 권고사항
- {recommendation_1}
- {recommendation_2}
- {recommendation_3}

### 11.3 향후 계획
{future_plan}
