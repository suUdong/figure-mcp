/**
 * 템플릿 요청 핵심 로직 테스트
 * MCP → Backend 템플릿 요청이 Copilot/LLM에서 정확히 작동하기 위한 테스트
 * 
 * 테스트 우선순위: ⭐⭐⭐ (최고 중요도)
 */

import { jest } from '@jest/globals';
import axios, { AxiosInstance, AxiosError } from 'axios';

// axios 모킹
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// 테스트용 MCP 서버 클래스 (템플릿 요청 로직만 포함)
class TemplateRequestTester {
  private apiClient: AxiosInstance;
  private readonly BACKEND_API_URL = 'http://localhost:8001/api';

  constructor() {
    this.apiClient = axios.create({
      baseURL: this.BACKEND_API_URL,
      timeout: 30000,
    });
  }

  // 핵심 템플릿 요청 메서드 (실제 MCP 서버 로직 재현)
  async requestTemplate(documentType: string, siteId: string): Promise<any> {
    const response = await this.apiClient.get(`/templates/guide/${documentType}`, {
      params: { site_id: siteId }
    });
    return response.data;
  }

  // 문서 타입 파싱 (자연어 → documentType)
  parseDocumentType(userInput: string): string | null {
    const documentPatterns: { [key: string]: string[] } = {
      'IMPACT_ANALYSIS': ['영향도 분석서', 'impact analysis', '영향 분석서'],
      'TABLE_SPECIFICATION': ['테이블 명세서', 'table spec', '테이블 설계서'],
      'REQUIREMENTS': ['요구사항서', 'requirements', '요구 사항서'],
      'TECHNICAL_SPECIFICATION': ['기술 명세서', 'technical spec', '기술 설계서'],
      'API_SPECIFICATION': ['api 명세서', 'api spec', '인터페이스 명세서']
    };

    const normalizedInput = userInput.toLowerCase();
    for (const [docType, patterns] of Object.entries(documentPatterns)) {
      if (patterns.some(pattern => normalizedInput.includes(pattern))) {
        return docType;
      }
    }
    return null;
  }
}

describe('🎯 MCP → Backend 템플릿 요청 핵심 로직', () => {
  let templateTester: TemplateRequestTester;
  let mockAxiosInstance: jest.Mocked<AxiosInstance>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockAxiosInstance = {
      get: jest.fn(),
      post: jest.fn(),
    } as any;
    
    mockedAxios.create.mockReturnValue(mockAxiosInstance);
    templateTester = new TemplateRequestTester();
  });

  describe('✅ 정상적인 템플릿 요청 플로우', () => {
    test('영향도 분석서 템플릿 요청이 성공해야 함', async () => {
      // Arrange - LLM이 실제로 받을 템플릿 데이터
      const expectedTemplateResponse = {
        success: true,
        message: "템플릿 가이드 조회 완료",
        data: {
          template: `# 영향도 분석서

## 📋 분석 개요
- **기능명**: {{FEATURE_NAME}}
- **분석자**: {{ANALYST}}
- **분석일**: {{ANALYSIS_DATE}}

## 🎯 영향 범위
### 1. 시스템 영향도
- **백엔드**: {{BACKEND_IMPACT}}
- **프론트엔드**: {{FRONTEND_IMPACT}}
- **데이터베이스**: {{DATABASE_IMPACT}}

## ⚠️ 위험 요소
{{RISK_FACTORS}}

## 📊 테스트 범위
{{TEST_SCOPE}}`,
          variables: ['FEATURE_NAME', 'ANALYST', 'ANALYSIS_DATE', 'BACKEND_IMPACT', 'FRONTEND_IMPACT', 'DATABASE_IMPACT', 'RISK_FACTORS', 'TEST_SCOPE'],
          instructions: "이 템플릿을 사용하여 구체적인 기능명과 분석 내용을 기입하여 완성된 영향도 분석서를 작성하세요. 각 변수를 실제 값으로 치환하고, 분석 결과를 상세히 기술하세요.",
          usage_count: 42
        }
      };

      mockAxiosInstance.get.mockResolvedValue({
        data: expectedTemplateResponse
      });

      // Act
      const result = await templateTester.requestTemplate('IMPACT_ANALYSIS', 'test-site-id');

      // Assert - LLM이 받을 데이터 형식 검증
      expect(result).toEqual(expectedTemplateResponse);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/templates/guide/IMPACT_ANALYSIS', {
        params: { site_id: 'test-site-id' }
      });

      // 🎯 핵심: LLM이 사용할 템플릿 내용 검증
      expect(result.data.template).toContain('# 영향도 분석서');
      expect(result.data.template).toContain('{{FEATURE_NAME}}');
      expect(result.data.variables).toContain('FEATURE_NAME');
      expect(result.data.instructions).toContain('템플릿을 사용하여');
      expect(typeof result.data.usage_count).toBe('number');
    });

    test('테이블 명세서 템플릿 요청이 올바른 구조로 반환되어야 함', async () => {
      // Arrange - 테이블 명세서 전용 템플릿
      const tableSpecTemplate = {
        success: true,
        message: "템플릿 가이드 조회 완료",
        data: {
          template: `# 테이블 명세서

## 📊 테이블 정보
- **테이블명**: {{TABLE_NAME}}
- **설명**: {{TABLE_DESCRIPTION}}
- **생성일**: {{CREATED_DATE}}

## 📋 컬럼 정보
| 컬럼명 | 타입 | 크기 | NULL | 기본값 | 설명 |
|-------|------|------|------|--------|------|
{{COLUMN_DEFINITIONS}}

## 🔗 관계 정의
{{RELATIONSHIPS}}

## 📝 인덱스 정보
{{INDEXES}}`,
          variables: ['TABLE_NAME', 'TABLE_DESCRIPTION', 'CREATED_DATE', 'COLUMN_DEFINITIONS', 'RELATIONSHIPS', 'INDEXES'],
          instructions: "데이터베이스 스키마 정보를 바탕으로 각 변수를 실제 테이블 정보로 치환하세요. COLUMN_DEFINITIONS는 테이블 형식으로, RELATIONSHIPS는 외래키 관계를, INDEXES는 성능 최적화 인덱스를 포함하세요.",
          usage_count: 28
        }
      };

      mockAxiosInstance.get.mockResolvedValue({
        data: tableSpecTemplate
      });

      // Act
      const result = await templateTester.requestTemplate('TABLE_SPECIFICATION', 'test-site-id');

      // Assert - 테이블 명세서 전용 구조 검증
      expect(result.data.template).toContain('# 테이블 명세서');
      expect(result.data.template).toContain('{{TABLE_NAME}}');
      expect(result.data.template).toContain('| 컬럼명 | 타입 |'); // 테이블 형식
      expect(result.data.variables).toContain('COLUMN_DEFINITIONS');
      expect(result.data.instructions).toContain('데이터베이스 스키마');
    });

    test('API 명세서 템플릿이 Copilot에서 사용 가능한 형식으로 반환되어야 함', async () => {
      // Arrange - API 문서 생성용 템플릿
      const apiSpecTemplate = {
        success: true,
        message: "템플릿 가이드 조회 완료",
        data: {
          template: `# API 명세서

## 🔗 엔드포인트 정보
- **URL**: {{API_ENDPOINT}}
- **Method**: {{HTTP_METHOD}}
- **인증**: {{AUTHENTICATION}}

## 📥 요청 파라미터
\`\`\`json
{{REQUEST_PARAMETERS}}
\`\`\`

## 📤 응답 형식
\`\`\`json
{{RESPONSE_FORMAT}}
\`\`\`

## 📝 사용 예시
\`\`\`bash
curl -X {{HTTP_METHOD}} "{{API_ENDPOINT}}" \\
  -H "Authorization: Bearer {{TOKEN}}" \\
  -d '{{EXAMPLE_REQUEST}}'
\`\`\`

## ⚠️ 에러 코드
{{ERROR_CODES}}`,
          variables: ['API_ENDPOINT', 'HTTP_METHOD', 'AUTHENTICATION', 'REQUEST_PARAMETERS', 'RESPONSE_FORMAT', 'TOKEN', 'EXAMPLE_REQUEST', 'ERROR_CODES'],
          instructions: "실제 API 엔드포인트 정보를 기반으로 각 변수를 구체적인 값으로 치환하세요. JSON 형식은 올바른 구문을 유지하고, curl 예시는 실행 가능하도록 작성하세요.",
          usage_count: 67
        }
      };

      mockAxiosInstance.get.mockResolvedValue({
        data: apiSpecTemplate
      });

      // Act
      const result = await templateTester.requestTemplate('API_SPECIFICATION', 'test-site-id');

      // Assert - API 명세서 구조 검증
      expect(result.data.template).toContain('# API 명세서');
      expect(result.data.template).toContain('```json');
      expect(result.data.template).toContain('curl -X');
      expect(result.data.variables).toContain('API_ENDPOINT');
      expect(result.data.variables).toContain('HTTP_METHOD');
      expect(result.data.instructions).toContain('실제 API 엔드포인트');
    });
  });

  describe('❌ 에러 상황 처리', () => {
    test('존재하지 않는 템플릿 타입 요청 시 404 에러 처리', async () => {
      // Arrange
      const axiosError = new Error('Request failed with status code 404') as AxiosError;
      axiosError.response = {
        status: 404,
        statusText: 'Not Found',
        data: { 
          success: false,
          message: "UNKNOWN_TYPE 유형의 기본 템플릿을 찾을 수 없습니다.",
          data: null
        },
        headers: {},
        config: {} as any
      };
      mockAxiosInstance.get.mockRejectedValue(axiosError);

      // Act & Assert
      await expect(
        templateTester.requestTemplate('UNKNOWN_TYPE', 'test-site-id')
      ).rejects.toThrow('Request failed with status code 404');

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/templates/guide/UNKNOWN_TYPE', {
        params: { site_id: 'test-site-id' }
      });
    });

    test('잘못된 사이트 ID로 요청 시 적절한 에러 처리', async () => {
      // Arrange
      const axiosError = new Error('Request failed with status code 400') as AxiosError;
      axiosError.response = {
        status: 400,
        statusText: 'Bad Request',
        data: { 
          success: false,
          message: "유효하지 않은 사이트 ID입니다.",
          data: null
        },
        headers: {},
        config: {} as any
      };
      mockAxiosInstance.get.mockRejectedValue(axiosError);

      // Act & Assert
      await expect(
        templateTester.requestTemplate('IMPACT_ANALYSIS', 'invalid-site-id')
      ).rejects.toThrow('Request failed with status code 400');
    });

    test('백엔드 서버 오류 시 500 에러 처리', async () => {
      // Arrange
      const axiosError = new Error('Request failed with status code 500') as AxiosError;
      axiosError.response = {
        status: 500,
        statusText: 'Internal Server Error',
        data: { 
          success: false,
          message: "템플릿 가이드 조회 중 오류가 발생했습니다.",
          data: null
        },
        headers: {},
        config: {} as any
      };
      mockAxiosInstance.get.mockRejectedValue(axiosError);

      // Act & Assert
      await expect(
        templateTester.requestTemplate('IMPACT_ANALYSIS', 'test-site-id')
      ).rejects.toThrow('Request failed with status code 500');
    });
  });

  describe('🧠 자연어 → DocumentType 변환 테스트', () => {
    test('사용자 자연어 입력을 올바른 DocumentType으로 변환해야 함', () => {
      // 영향도 분석서 패턴
      expect(templateTester.parseDocumentType('사용자 관리 시스템 영향도 분석서 만들어줘')).toBe('IMPACT_ANALYSIS');
      expect(templateTester.parseDocumentType('결제 모듈 impact analysis 생성')).toBe('IMPACT_ANALYSIS');
      expect(templateTester.parseDocumentType('로그인 기능 영향 분석서')).toBe('IMPACT_ANALYSIS');

      // 테이블 명세서 패턴
      expect(templateTester.parseDocumentType('users 테이블 명세서 작성해줘')).toBe('TABLE_SPECIFICATION');
      expect(templateTester.parseDocumentType('데이터베이스 table spec 만들기')).toBe('TABLE_SPECIFICATION');
      expect(templateTester.parseDocumentType('주문 테이블 설계서')).toBe('TABLE_SPECIFICATION');

      // API 명세서 패턴
      expect(templateTester.parseDocumentType('REST API 명세서 생성')).toBe('API_SPECIFICATION');
      expect(templateTester.parseDocumentType('회원가입 api spec 작성')).toBe('API_SPECIFICATION');
      expect(templateTester.parseDocumentType('인터페이스 명세서')).toBe('API_SPECIFICATION');

      // 매칭되지 않는 입력
      expect(templateTester.parseDocumentType('알 수 없는 문서 타입')).toBe(null);
      expect(templateTester.parseDocumentType('')).toBe(null);
    });

    test('복합 키워드가 있는 자연어 입력 처리', () => {
      // 여러 문서 타입이 언급되었을 때 첫 번째 매칭을 반환
      expect(templateTester.parseDocumentType('영향도 분석서와 api 명세서 중에서 영향도 분석서부터')).toBe('IMPACT_ANALYSIS');
      
      // 부분 매칭 확인
      expect(templateTester.parseDocumentType('결제시스템의 API명세서를 만들어주세요')).toBe('API_SPECIFICATION');
    });
  });

  describe('⚡ 템플릿 품질 검증 (LLM 사용성)', () => {
    test('템플릿에 필수 변수가 포함되어야 함', async () => {
      // Arrange
      const templateWithVariables = {
        success: true,
        message: "템플릿 가이드 조회 완료",
        data: {
          template: "# {{TITLE}}\n기능: {{FEATURE_NAME}}\n작성자: {{AUTHOR}}",
          variables: ['TITLE', 'FEATURE_NAME', 'AUTHOR'],
          instructions: "모든 변수를 실제 값으로 치환하세요",
          usage_count: 1
        }
      };

      mockAxiosInstance.get.mockResolvedValue({
        data: templateWithVariables
      });

      // Act
      const result = await templateTester.requestTemplate('IMPACT_ANALYSIS', 'test-site-id');

      // Assert - LLM이 치환해야 할 변수들이 정확히 매칭되는지 확인
      const templateContent = result.data.template;
      const declaredVariables = result.data.variables;

      // 템플릿에서 실제 사용된 변수 추출
      const usedVariables = (templateContent.match(/\{\{([^}]+)\}\}/g) || [])
        .map((match: string) => match.replace(/[{}]/g, ''));

      // 선언된 변수와 실제 사용된 변수가 일치해야 함
      expect(usedVariables.sort()).toEqual(declaredVariables.sort());
      
      // 모든 변수가 템플릿에 존재해야 함
      declaredVariables.forEach((variable: string) => {
        expect(templateContent).toContain(`{{${variable}}}`);
      });
    });

    test('지침(instructions)이 LLM에게 명확해야 함', async () => {
      // Arrange
      const templateWithGoodInstructions = {
        success: true,
        message: "템플릿 가이드 조회 완료",
        data: {
          template: "# {{FEATURE_NAME}} 분석\n결과: {{ANALYSIS_RESULT}}",
          variables: ['FEATURE_NAME', 'ANALYSIS_RESULT'],
          instructions: "FEATURE_NAME에는 구체적인 기능명을 입력하고, ANALYSIS_RESULT에는 상세한 분석 결과를 3-5개 문장으로 작성하세요. 기술적 위험도와 비즈니스 영향도를 모두 포함해야 합니다.",
          usage_count: 5
        }
      };

      mockAxiosInstance.get.mockResolvedValue({
        data: templateWithGoodInstructions
      });

      // Act
      const result = await templateTester.requestTemplate('IMPACT_ANALYSIS', 'test-site-id');

      // Assert - LLM이 이해할 수 있는 명확한 지침 확인
      const instructions = result.data.instructions;
      expect(instructions.length).toBeGreaterThan(30); // 충분히 상세한 설명
      expect(instructions).toContain('입력'); // 구체적 행동 지시
      expect(instructions).toContain('작성'); // 명확한 작업 정의
      
      // 변수별 설명이 포함되어야 함
      result.data.variables.forEach((variable: string) => {
        expect(instructions.toUpperCase()).toContain(variable);
      });
    });

    test('템플릿 형식이 마크다운 표준을 준수해야 함', async () => {
      // Arrange
      const wellFormattedTemplate = {
        success: true,
        message: "템플릿 가이드 조회 완료",
        data: {
          template: `# {{TITLE}}

## 개요
{{OVERVIEW}}

### 상세 내용
- **항목1**: {{ITEM1}}
- **항목2**: {{ITEM2}}

## 결론
{{CONCLUSION}}`,
          variables: ['TITLE', 'OVERVIEW', 'ITEM1', 'ITEM2', 'CONCLUSION'],
          instructions: "마크다운 형식을 유지하며 각 변수를 채워주세요",
          usage_count: 12
        }
      };

      mockAxiosInstance.get.mockResolvedValue({
        data: wellFormattedTemplate
      });

      // Act
      const result = await templateTester.requestTemplate('IMPACT_ANALYSIS', 'test-site-id');

      // Assert - 마크다운 형식 검증
      const template = result.data.template;
      expect(template).toMatch(/^#\s/); // 제목이 # 로 시작
      expect(template).toContain('## '); // 2차 제목 존재
      expect(template).toContain('### '); // 3차 제목 존재
      expect(template).toContain('- **'); // 목록 형식
      expect(template).toContain('{{'); // 변수 표시
      expect(template).toContain('}}'); // 변수 표시
    });
  });

  describe('🔄 실제 Copilot/LLM 워크플로우 시뮬레이션', () => {
    test('템플릿 → 변수 치환 → 최종 문서 생성 플로우', async () => {
      // Arrange - 실제 템플릿 응답
      const realTemplate = {
        success: true,
        message: "템플릿 가이드 조회 완료",
        data: {
          template: `# {{FEATURE_NAME}} 영향도 분석서

## 분석 개요
- 기능명: {{FEATURE_NAME}}
- 분석자: {{ANALYST}}
- 분석일: {{ANALYSIS_DATE}}

## 영향 범위
{{IMPACT_SCOPE}}

## 위험도 평가
- 전체 위험도: {{RISK_LEVEL}}
- 주요 위험 요소: {{RISK_FACTORS}}`,
          variables: ['FEATURE_NAME', 'ANALYST', 'ANALYSIS_DATE', 'IMPACT_SCOPE', 'RISK_LEVEL', 'RISK_FACTORS'],
          instructions: "실제 프로젝트 정보를 바탕으로 각 변수를 구체적인 값으로 치환하세요.",
          usage_count: 15
        }
      };

      mockAxiosInstance.get.mockResolvedValue({
        data: realTemplate
      });

      // Act - 1단계: MCP에서 템플릿 요청
      const templateResponse = await templateTester.requestTemplate('IMPACT_ANALYSIS', 'test-site-id');

      // Act - 2단계: LLM이 수행할 변수 치환 시뮬레이션
      let finalDocument = templateResponse.data.template;
      const variableValues = {
        'FEATURE_NAME': '사용자 인증 시스템',
        'ANALYST': '개발팀 김철수',
        'ANALYSIS_DATE': '2024-01-15',
        'IMPACT_SCOPE': '- 백엔드: 인증 서비스 전체\n- 프론트엔드: 로그인/회원가입 페이지\n- 데이터베이스: users, sessions 테이블',
        'RISK_LEVEL': '중간',
        'RISK_FACTORS': '기존 세션 데이터 호환성, 비밀번호 정책 변경'
      };

      // LLM의 변수 치환 과정 시뮬레이션
      Object.entries(variableValues).forEach(([variable, value]) => {
        finalDocument = finalDocument.replace(new RegExp(`{{${variable}}}`, 'g'), value);
      });

      // Assert - 최종 생성된 문서 검증
      expect(finalDocument).not.toContain('{{'); // 모든 변수가 치환되었는지 확인
      expect(finalDocument).not.toContain('}}'); // 모든 변수가 치환되었는지 확인
      expect(finalDocument).toContain('사용자 인증 시스템'); // 실제 값 포함
      expect(finalDocument).toContain('개발팀 김철수'); // 실제 값 포함
      expect(finalDocument).toContain('2024-01-15'); // 실제 값 포함
      expect(finalDocument).toContain('백엔드: 인증 서비스'); // 복잡한 값도 포함

      // 마크다운 구조 유지 확인
      expect(finalDocument).toMatch(/^# 사용자 인증 시스템 영향도 분석서/);
      expect(finalDocument).toContain('## 분석 개요');
      expect(finalDocument).toContain('## 영향 범위');
    });
  });
});

// 헬퍼 함수: 실제 템플릿 응답 데이터 생성기
export function createMockTemplateResponse(
  documentType: string, 
  templateContent: string, 
  variables: string[] = [],
  instructions: string = '기본 지침',
  usageCount: number = 1
) {
  return {
    success: true,
    message: "템플릿 가이드 조회 완료",
    data: {
      template: templateContent,
      variables,
      instructions,
      usage_count: usageCount
    }
  };
}

// 헬퍼 함수: LLM 변수 치환 시뮬레이터
export function simulateLLMVariableSubstitution(
  template: string, 
  variables: Record<string, string>
): string {
  let result = template;
  Object.entries(variables).forEach(([key, value]) => {
    result = result.replace(new RegExp(`{{${key}}}`, 'g'), value);
  });
  return result;
}
