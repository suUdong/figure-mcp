/**
 * 템플릿 타입 상수 정의
 * 백엔드와 동기화된 전체 문서 타입 목록
 */

// 템플릿 타입 매핑 (백엔드 TemplateType enum과 동일)
export const TEMPLATE_TYPES = {
  // 1단계: 요구사항 분석
  'REQUIREMENTS': '요구사항 정의서',
  'BUSINESS_REQUIREMENTS': '비즈니스 요구사항서',
  'FUNCTIONAL_SPECIFICATION': '기능 명세서',
  
  // 2단계: 설계
  'TECHNICAL_SPECIFICATION': '기술 명세서',
  'SYSTEM_ARCHITECTURE': '시스템 아키텍처 설계서',
  'DATABASE_DESIGN': '데이터베이스 설계서',
  'TABLE_SPECIFICATION': '테이블 명세서',
  'API_SPECIFICATION': 'API 명세서',
  'UI_UX_DESIGN': 'UI/UX 설계서',
  
  // 3단계: 개발
  'IMPACT_ANALYSIS': '영향도 분석서',
  'API_DOCUMENTATION': 'API 문서',
  'CODE_REVIEW_CHECKLIST': '코드 리뷰 체크리스트',
  
  // 4단계: 테스트
  'TEST_PLAN': '테스트 계획서',
  'TEST_SCENARIO': '테스트 시나리오',
  'TEST_CASE': '테스트 케이스',
  'QA_CHECKLIST': 'QA 체크리스트',
  
  // 5단계: 배포
  'DEPLOYMENT_GUIDE': '배포 가이드',
  'DEPLOYMENT_CHECKLIST': '배포 체크리스트',
  'ROLLBACK_PLAN': '롤백 계획서',
  'MONITORING_PLAN': '모니터링 계획서',
  
  // 6단계: 운영
  'USER_MANUAL': '사용자 매뉴얼',
  'RELEASE_NOTES': '릴리즈 노트',
  'OPERATION_MANUAL': '운영 매뉴얼',
  'TROUBLESHOOTING_GUIDE': '트러블슈팅 가이드',
  
  'CUSTOM': '사용자 정의'
} as const;

// MCP 요청 타입 매핑 (백엔드 MCPRequestType enum과 동일)
export const MCP_REQUEST_TYPES = {
  // 1단계: 요구사항 분석
  'requirements_doc': '요구사항 정의서',
  'business_requirements': '비즈니스 요구사항서',
  'functional_specification': '기능 명세서',
  
  // 2단계: 설계
  'technical_spec': '기술 명세서',
  'system_architecture': '시스템 아키텍처 설계서',
  'database_design': '데이터베이스 설계서',
  'table_specification': '테이블 명세서',
  'api_specification': 'API 명세서',
  'ui_ux_design': 'UI/UX 설계서',
  
  // 3단계: 개발
  'impact_analysis': '영향도 분석서',
  'api_documentation': 'API 문서',
  'code_review_checklist': '코드 리뷰 체크리스트',
  
  // 4단계: 테스트
  'test_plan': '테스트 계획서',
  'test_scenario': '테스트 시나리오',
  'test_case': '테스트 케이스',
  'qa_checklist': 'QA 체크리스트',
  
  // 5단계: 배포
  'deployment_guide': '배포 가이드',
  'deployment_checklist': '배포 체크리스트',
  'rollback_plan': '롤백 계획서',
  'monitoring_plan': '모니터링 계획서',
  
  // 6단계: 운영
  'user_manual': '사용자 매뉴얼',
  'release_notes': '릴리즈 노트',
  'operation_manual': '운영 매뉴얼',
  'troubleshooting_guide': '트러블슈팅 가이드'
} as const;

// MCP 요청 타입 -> 템플릿 타입 매핑
export const MCP_TO_TEMPLATE_TYPE_MAP: { [key: string]: string } = {
  // 1단계: 요구사항 분석
  'requirements_doc': 'REQUIREMENTS',
  'business_requirements': 'BUSINESS_REQUIREMENTS',
  'functional_specification': 'FUNCTIONAL_SPECIFICATION',
  
  // 2단계: 설계
  'technical_spec': 'TECHNICAL_SPECIFICATION',
  'system_architecture': 'SYSTEM_ARCHITECTURE',
  'database_design': 'DATABASE_DESIGN',
  'table_specification': 'TABLE_SPECIFICATION',
  'api_specification': 'API_SPECIFICATION',
  'ui_ux_design': 'UI_UX_DESIGN',
  
  // 3단계: 개발
  'impact_analysis': 'IMPACT_ANALYSIS',
  'api_documentation': 'API_DOCUMENTATION',
  'code_review_checklist': 'CODE_REVIEW_CHECKLIST',
  
  // 4단계: 테스트
  'test_plan': 'TEST_PLAN',
  'test_scenario': 'TEST_SCENARIO',
  'test_case': 'TEST_CASE',
  'qa_checklist': 'QA_CHECKLIST',
  
  // 5단계: 배포
  'deployment_guide': 'DEPLOYMENT_GUIDE',
  'deployment_checklist': 'DEPLOYMENT_CHECKLIST',
  'rollback_plan': 'ROLLBACK_PLAN',
  'monitoring_plan': 'MONITORING_PLAN',
  
  // 6단계: 운영
  'user_manual': 'USER_MANUAL',
  'release_notes': 'RELEASE_NOTES',
  'operation_manual': 'OPERATION_MANUAL',
  'troubleshooting_guide': 'TROUBLESHOOTING_GUIDE'
};

// 단계별 그룹화
export const TEMPLATE_TYPES_BY_PHASE = {
  '1단계: 요구사항 분석': [
    'REQUIREMENTS',
    'BUSINESS_REQUIREMENTS', 
    'FUNCTIONAL_SPECIFICATION'
  ],
  '2단계: 설계': [
    'TECHNICAL_SPECIFICATION',
    'SYSTEM_ARCHITECTURE',
    'DATABASE_DESIGN',
    'TABLE_SPECIFICATION',
    'API_SPECIFICATION',
    'UI_UX_DESIGN'
  ],
  '3단계: 개발': [
    'IMPACT_ANALYSIS',
    'API_DOCUMENTATION',
    'CODE_REVIEW_CHECKLIST'
  ],
  '4단계: 테스트': [
    'TEST_PLAN',
    'TEST_SCENARIO',
    'TEST_CASE',
    'QA_CHECKLIST'
  ],
  '5단계: 배포': [
    'DEPLOYMENT_GUIDE',
    'DEPLOYMENT_CHECKLIST',
    'ROLLBACK_PLAN',
    'MONITORING_PLAN'
  ],
  '6단계: 운영': [
    'USER_MANUAL',
    'RELEASE_NOTES',
    'OPERATION_MANUAL',
    'TROUBLESHOOTING_GUIDE'
  ]
} as const;

// 타입 정의
export type TemplateType = keyof typeof TEMPLATE_TYPES;
export type MCPRequestType = keyof typeof MCP_REQUEST_TYPES;
export type TemplatePhase = keyof typeof TEMPLATE_TYPES_BY_PHASE;
