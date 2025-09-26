/**
 * Guidelines Type Definitions
 * LLM 지침 관리 타입 정의
 */

export type GuidelineType = 
  | 'BUSINESS_FLOW'
  | 'SEQUENCE_DIAGRAM' 
  | 'REQUIREMENTS'
  | 'PROGRAM_DESIGN_ONLINE'
  | 'PROGRAM_DESIGN_BATCH'
  | 'PROGRAM_DESIGN_COMMON'
  | 'IMPACT_ANALYSIS'
  | 'TABLE_SPECIFICATION'
  | 'INTERFACE_SPECIFICATION'
  | 'GENERAL';

export type GuidelineScope = 'GLOBAL' | 'SITE_SPECIFIC';

export interface Guideline {
  id: string;
  title: string;
  description?: string;
  guideline_type: GuidelineType;
  scope: GuidelineScope;
  site_id?: string;
  
  // 지침 내용
  role_instruction: string;
  objective_instruction: string;
  additional_context?: string;
  
  // 우선순위 및 제약사항
  priority: number;
  constraints?: string;
  
  // 예시 및 참고사항
  examples?: string;
  references?: string;
  
  // 메타데이터
  tags: string[];
  extra_metadata: Record<string, any>;
  
  // 상태
  is_active: boolean;
  version: string;
  
  // 감사 필드
  created_by?: string;
  created_at?: string;
  updated_by?: string;
  updated_at?: string;
}

export interface GuidelineCreateRequest {
  title: string;
  description?: string;
  guideline_type: GuidelineType;
  scope: GuidelineScope;
  site_id?: string;
  
  role_instruction: string;
  objective_instruction: string;
  additional_context?: string;
  
  priority: number;
  constraints?: string;
  examples?: string;
  references?: string;
  
  tags: string[];
  is_active: boolean;
}

export interface GuidelineUpdateRequest {
  title?: string;
  description?: string;
  guideline_type?: GuidelineType;
  scope?: GuidelineScope;
  site_id?: string;
  
  role_instruction?: string;
  objective_instruction?: string;
  additional_context?: string;
  
  priority?: number;
  constraints?: string;
  examples?: string;
  references?: string;
  
  tags?: string[];
  is_active?: boolean;
}

export interface GuidelineResponse {
  guideline: Guideline;
  can_edit: boolean;
  can_delete: boolean;
}

export interface GuidelineListResponse {
  guidelines: GuidelineResponse[];
  total: number;
  page: number;
  limit: number;
}

// UI용 상수들
export const GUIDELINE_TYPES = {
  BUSINESS_FLOW: '목표업무흐름도',
  SEQUENCE_DIAGRAM: '시퀀스다이어그램',
  REQUIREMENTS: '요구사항정의서', 
  PROGRAM_DESIGN_ONLINE: '프로그램설계서(온라인)',
  PROGRAM_DESIGN_BATCH: '프로그램설계서(배치)',
  PROGRAM_DESIGN_COMMON: '프로그램설계서(공통)',
  IMPACT_ANALYSIS: '영향도분석서',
  TABLE_SPECIFICATION: '테이블정의서',
  INTERFACE_SPECIFICATION: '인터페이스정의서',
  GENERAL: '일반 지침'
} as const;

export const GUIDELINE_SCOPES = {
  GLOBAL: '전역',
  SITE_SPECIFIC: '사이트별'
} as const;

export const GUIDELINE_PRIORITIES = [
  { value: 100, label: '최고 (100)', color: 'text-red-600' },
  { value: 80, label: '높음 (80)', color: 'text-orange-600' },
  { value: 60, label: '보통 (60)', color: 'text-yellow-600' },
  { value: 40, label: '낮음 (40)', color: 'text-blue-600' },
  { value: 20, label: '최저 (20)', color: 'text-gray-600' }
] as const;
