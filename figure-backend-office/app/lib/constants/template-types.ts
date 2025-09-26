/**
 * 템플릿 타입 상수 정의
 * 백엔드와 동기화된 전체 문서 타입 목록
 */

// 템플릿 타입 매핑 (백엔드 TemplateType enum과 동일)
export const TEMPLATE_TYPES = {
  // 🎯 핵심 개발 문서 (9가지)
  'BUSINESS_FLOW': '목표업무흐름도',
  'SEQUENCE_DIAGRAM': '시퀀스다이어그램', 
  'REQUIREMENTS': '요구사항정의서',
  'PROGRAM_DESIGN_ONLINE': '프로그램설계서(온라인)',
  'PROGRAM_DESIGN_BATCH': '프로그램설계서(배치)',
  'PROGRAM_DESIGN_COMMON': '프로그램설계서(공통)',
  'IMPACT_ANALYSIS': '영향도분석서',
  'TABLE_SPECIFICATION': '테이블정의서',
  'INTERFACE_SPECIFICATION': '인터페이스정의서',
  
  'CUSTOM': '사용자 정의'
} as const;

// MCP 요청 타입 매핑 (백엔드 MCPRequestType enum과 동일) - 핵심 9가지로 간소화
export const MCP_REQUEST_TYPES = {
  // 🎯 핵심 개발 문서 (9가지)
  'business_flow': '목표업무흐름도',
  'sequence_diagram': '시퀀스다이어그램', 
  'requirements': '요구사항정의서',
  'program_design_online': '프로그램설계서(온라인)',
  'program_design_batch': '프로그램설계서(배치)',
  'program_design_common': '프로그램설계서(공통)',
  'impact_analysis': '영향도분석서',
  'table_specification': '테이블정의서',
  'interface_specification': '인터페이스정의서'
} as const;

// MCP 요청 타입 -> 템플릿 타입 매핑 (핵심 9가지)
export const MCP_TO_TEMPLATE_TYPE_MAP: { [key: string]: string } = {
  // 🎯 핵심 개발 문서 (9가지)
  'business_flow': 'BUSINESS_FLOW',
  'sequence_diagram': 'SEQUENCE_DIAGRAM', 
  'requirements': 'REQUIREMENTS',
  'program_design_online': 'PROGRAM_DESIGN_ONLINE',
  'program_design_batch': 'PROGRAM_DESIGN_BATCH',
  'program_design_common': 'PROGRAM_DESIGN_COMMON',
  'impact_analysis': 'IMPACT_ANALYSIS',
  'table_specification': 'TABLE_SPECIFICATION',
  'interface_specification': 'INTERFACE_SPECIFICATION'
};

// 단계별 그룹화 - 핵심 문서로 간소화
export const TEMPLATE_TYPES_BY_PHASE = {
  '📊 분석 단계': [
    'BUSINESS_FLOW',
    'SEQUENCE_DIAGRAM',
    'REQUIREMENTS'
  ],
  '🏗️ 설계 단계': [
    'PROGRAM_DESIGN_ONLINE',
    'PROGRAM_DESIGN_BATCH', 
    'PROGRAM_DESIGN_COMMON',
    'TABLE_SPECIFICATION',
    'INTERFACE_SPECIFICATION'
  ],
  '🔍 검토 단계': [
    'IMPACT_ANALYSIS'
  ],
  '🛠️ 사용자 정의': [
    'CUSTOM'
  ]
} as const;

// 타입 정의
export type TemplateType = keyof typeof TEMPLATE_TYPES;
export type MCPRequestType = keyof typeof MCP_REQUEST_TYPES;
export type TemplatePhase = keyof typeof TEMPLATE_TYPES_BY_PHASE;
