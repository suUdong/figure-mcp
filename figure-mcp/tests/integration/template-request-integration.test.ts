/**
 * 템플릿 요청 통합 테스트
 * MCP → Backend 실제 HTTP 통신으로 템플릿 요청 플로우 검증
 * 
 * 이 테스트는 Copilot/LLM이 실제로 받을 템플릿의 품질을 보장합니다.
 * 
 * 실행 전 요구사항:
 * 1. docker-compose up figure-backend chroma redis
 * 2. 백엔드 API가 http://localhost:8001 에서 실행 중
 */

import axios, { AxiosError } from 'axios';
import { performance } from 'perf_hooks';

// 환경 변수 설정
const BACKEND_API_URL = process.env.BACKEND_API_URL || 'http://localhost:8001/api';
const TEST_TIMEOUT = 30000; // 30초

// 테스트용 HTTP 클라이언트
const apiClient = axios.create({
  baseURL: BACKEND_API_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  }
});

// 테스트 데이터: 실제 사이트 생성을 위한 데이터
const TEST_SITE_DATA = {
  name: 'Template Test Site',
  company: 'Test Company Ltd',
  business_type: 'Software Development',
  contact_person: 'Template Tester',
  description: 'Created for template request integration testing',
  url: 'https://template-test.example.com'
};

describe('🎯 템플릿 요청 통합 테스트 (MCP → Backend)', () => {
  let testSiteId: string;
  
  // 테스트 환경 검증
  beforeAll(async () => {
    console.log(`🔍 백엔드 API 연결 확인: ${BACKEND_API_URL}`);
    
    try {
      // 백엔드 헬스체크
      const healthResponse = await apiClient.get('/health');
      expect(healthResponse.status).toBe(200);
      console.log('✅ 백엔드 API 정상 동작 확인');

      // 테스트용 사이트 생성
      const siteResponse = await apiClient.post('/sites/', TEST_SITE_DATA);
      testSiteId = siteResponse.data.data.id;
      console.log(`✅ 테스트 사이트 생성: ${testSiteId}`);
      
    } catch (error) {
      console.error('❌ 백엔드 API 연결 실패:', error);
      throw new Error(
        '백엔드 API에 연결할 수 없습니다. ' +
        'Docker 컨테이너가 실행되고 있는지 확인하세요: ' +
        'docker-compose up figure-backend chroma redis'
      );
    }
  }, TEST_TIMEOUT);

  // 테스트 후 정리
  afterAll(async () => {
    // 테스트로 생성된 사이트 삭제
    if (testSiteId) {
      try {
        await apiClient.delete(`/sites/${testSiteId}`);
        console.log(`🧹 테스트 사이트 삭제: ${testSiteId}`);
      } catch (error) {
        console.warn('테스트 사이트 삭제 실패:', error);
      }
    }
  });

  describe('✅ 핵심 템플릿 타입별 요청 테스트', () => {
    test('영향도 분석서 템플릿 요청 - 실제 LLM 사용 가능 형식 검증', async () => {
      console.log('📊 영향도 분석서 템플릿 요청 테스트...');
      
      const startTime = performance.now();
      
      // Act - 실제 백엔드에 템플릿 요청
      const response = await apiClient.get('/templates/guide/IMPACT_ANALYSIS', {
        params: { site_id: testSiteId }
      });
      
      const endTime = performance.now();
      const responseTime = endTime - startTime;
      
      // Assert - 기본 응답 구조 검증
      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(response.data.data).toBeDefined();
      
      const templateData = response.data.data;
      
      // 🎯 핵심: LLM이 사용할 템플릿 구조 검증
      expect(templateData).toHaveProperty('template');
      expect(templateData).toHaveProperty('variables');
      expect(templateData).toHaveProperty('instructions');
      expect(templateData).toHaveProperty('usage_count');
      
      // 템플릿 내용 품질 검증
      expect(templateData.template).toContain('#'); // 마크다운 제목 포함
      expect(templateData.template.length).toBeGreaterThan(100); // 충분한 길이
      expect(Array.isArray(templateData.variables)).toBe(true); // 변수 배열
      expect(templateData.instructions.length).toBeGreaterThan(30); // 충분한 지침
      expect(typeof templateData.usage_count).toBe('number'); // 사용 횟수
      
      // 성능 검증 (3초 이내)
      expect(responseTime).toBeLessThan(3000);
      
      console.log(`✅ 영향도 분석서 템플릿 요청 성공 (응답 시간: ${responseTime.toFixed(2)}ms)`);
      console.log(`📝 템플릿 길이: ${templateData.template.length}자`);
      console.log(`🔧 변수 개수: ${templateData.variables.length}개`);
    });

    test('테이블 명세서 템플릿 요청 - DB 스키마 문서화 형식 검증', async () => {
      console.log('📊 테이블 명세서 템플릿 요청 테스트...');
      
      const response = await apiClient.get('/templates/guide/TABLE_SPECIFICATION', {
        params: { site_id: testSiteId }
      });
      
      expect(response.status).toBe(200);
      const templateData = response.data.data;
      
      // 테이블 명세서 특화 검증
      expect(templateData.template).toContain('테이블'); // 테이블 관련 내용
      expect(templateData.template).toMatch(/\|.*\|/); // 테이블 형식 포함 가능성
      
      // 데이터베이스 관련 변수 포함 확인
      const dbRelatedTerms = ['TABLE', 'COLUMN', 'SCHEMA', 'DATABASE', 'INDEX'];
      const hasDbTerms = dbRelatedTerms.some(term => 
        templateData.variables.some((variable: string) => variable.includes(term)) ||
        templateData.template.toUpperCase().includes(term)
      );
      expect(hasDbTerms).toBe(true);
      
      console.log('✅ 테이블 명세서 템플릿 검증 완료');
    });

    test('API 명세서 템플릿 요청 - REST API 문서화 형식 검증', async () => {
      console.log('🔗 API 명세서 템플릿 요청 테스트...');
      
      const response = await apiClient.get('/templates/guide/API_SPECIFICATION', {
        params: { site_id: testSiteId }
      });
      
      expect(response.status).toBe(200);
      const templateData = response.data.data;
      
      // API 명세서 특화 검증
      const apiTerms = ['API', 'ENDPOINT', 'METHOD', 'REQUEST', 'RESPONSE', 'HTTP'];
      const hasApiTerms = apiTerms.some(term => 
        templateData.variables.some((variable: string) => variable.includes(term)) ||
        templateData.template.toUpperCase().includes(term)
      );
      expect(hasApiTerms).toBe(true);
      
      // JSON/코드 블록 형식 포함 확인
      const hasCodeBlocks = templateData.template.includes('```') || 
                           templateData.template.includes('json') ||
                           templateData.template.includes('curl');
      expect(hasCodeBlocks).toBe(true);
      
      console.log('✅ API 명세서 템플릿 검증 완료');
    });

    test('요구사항서 템플릿 요청 - 비즈니스 요구사항 형식 검증', async () => {
      console.log('📋 요구사항서 템플릿 요청 테스트...');
      
      const response = await apiClient.get('/templates/guide/REQUIREMENTS', {
        params: { site_id: testSiteId }
      });
      
      expect(response.status).toBe(200);
      const templateData = response.data.data;
      
      // 요구사항서 특화 검증
      const requirementTerms = ['요구사항', '기능', 'REQUIREMENT', 'FUNCTION', 'BUSINESS'];
      const hasReqTerms = requirementTerms.some(term => 
        templateData.template.includes(term) || 
        templateData.template.toUpperCase().includes(term)
      );
      expect(hasReqTerms).toBe(true);
      
      console.log('✅ 요구사항서 템플릿 검증 완료');
    });
  });

  describe('🔄 템플릿 캐싱 동작 검증', () => {
    test('동일한 템플릿 연속 요청 시 일관된 응답', async () => {
      console.log('🔄 템플릿 캐싱 동작 테스트...');
      
      // 첫 번째 요청
      const firstResponse = await apiClient.get('/templates/guide/IMPACT_ANALYSIS', {
        params: { site_id: testSiteId }
      });
      
      // 두 번째 요청 (즉시)
      const secondResponse = await apiClient.get('/templates/guide/IMPACT_ANALYSIS', {
        params: { site_id: testSiteId }
      });
      
      // 응답 일관성 검증
      expect(firstResponse.data.data.template).toBe(secondResponse.data.data.template);
      expect(firstResponse.data.data.variables).toEqual(secondResponse.data.data.variables);
      expect(firstResponse.data.data.instructions).toBe(secondResponse.data.data.instructions);
      
      // 사용 횟수는 증가할 수 있음 (정상 동작)
      expect(typeof firstResponse.data.data.usage_count).toBe('number');
      expect(typeof secondResponse.data.data.usage_count).toBe('number');
      
      console.log('✅ 템플릿 응답 일관성 확인');
    });

    test('다른 사이트에 대한 동일 템플릿 요청 - 사이트별 차별화 확인', async () => {
      console.log('🏢 사이트별 템플릿 차별화 테스트...');
      
      // 기본 사이트로 요청 (사이트 ID 없이)
      const defaultSiteResponse = await apiClient.get('/templates/guide/IMPACT_ANALYSIS');
      
      // 테스트 사이트로 요청
      const testSiteResponse = await apiClient.get('/templates/guide/IMPACT_ANALYSIS', {
        params: { site_id: testSiteId }
      });
      
      // 두 응답 모두 유효해야 함
      expect(defaultSiteResponse.status).toBe(200);
      expect(testSiteResponse.status).toBe(200);
      expect(defaultSiteResponse.data.success).toBe(true);
      expect(testSiteResponse.data.success).toBe(true);
      
      // 템플릿 구조는 동일해야 하지만 내용은 다를 수 있음
      expect(defaultSiteResponse.data.data).toHaveProperty('template');
      expect(testSiteResponse.data.data).toHaveProperty('template');
      
      console.log('✅ 사이트별 템플릿 요청 확인');
    });
  });

  describe('❌ 에러 상황 처리 검증', () => {
    test('존재하지 않는 템플릿 타입 요청', async () => {
      console.log('❌ 존재하지 않는 템플릿 타입 요청 테스트...');
      
      try {
        await apiClient.get('/templates/guide/NONEXISTENT_TYPE', {
          params: { site_id: testSiteId }
        });
        fail('404 에러가 발생해야 함');
      } catch (error) {
        const axiosError = error as AxiosError;
        expect(axiosError.response?.status).toBe(404);
        expect(axiosError.response?.data).toHaveProperty('success', false);
        
        console.log('✅ 존재하지 않는 템플릿 타입 에러 처리 확인');
      }
    });

    test('잘못된 사이트 ID로 템플릿 요청', async () => {
      console.log('❌ 잘못된 사이트 ID 요청 테스트...');
      
      try {
        const response = await apiClient.get('/templates/guide/IMPACT_ANALYSIS', {
          params: { site_id: 'nonexistent-site-id' }
        });
        
        // 요청은 성공하지만 기본 템플릿 반환 가능
        expect(response.status).toBe(200);
        expect(response.data.success).toBe(true);
        
        console.log('✅ 잘못된 사이트 ID 처리 확인 (기본 템플릿 반환)');
      } catch (error) {
        // 또는 에러 반환도 정상적인 동작
        const axiosError = error as AxiosError;
        expect([400, 404]).toContain(axiosError.response?.status);
        console.log('✅ 잘못된 사이트 ID 에러 처리 확인');
      }
    });
  });

  describe('⚡ 템플릿 품질 및 성능 검증', () => {
    test('모든 주요 템플릿 타입의 응답 시간 성능 테스트', async () => {
      console.log('⚡ 템플릿 응답 성능 테스트...');
      
      const templateTypes = [
        'IMPACT_ANALYSIS',
        'TABLE_SPECIFICATION',
        'API_SPECIFICATION',
        'REQUIREMENTS',
        'TECHNICAL_SPECIFICATION'
      ];
      
      const performanceResults: Array<{type: string, time: number, success: boolean}> = [];
      
      for (const templateType of templateTypes) {
        const startTime = performance.now();
        
        try {
          const response = await apiClient.get(`/templates/guide/${templateType}`, {
            params: { site_id: testSiteId }
          });
          
          const endTime = performance.now();
          const responseTime = endTime - startTime;
          
          performanceResults.push({
            type: templateType,
            time: responseTime,
            success: response.status === 200
          });
          
          // 개별 성능 기준 (2초 이내)
          expect(responseTime).toBeLessThan(2000);
          
        } catch (error) {
          const endTime = performance.now();
          performanceResults.push({
            type: templateType,
            time: endTime - startTime,
            success: false
          });
        }
      }
      
      // 전체 성능 통계
      const successfulRequests = performanceResults.filter(r => r.success);
      const averageTime = successfulRequests.reduce((sum, r) => sum + r.time, 0) / successfulRequests.length;
      
      expect(successfulRequests.length).toBeGreaterThan(0);
      expect(averageTime).toBeLessThan(1500); // 평균 1.5초 이내
      
      console.log(`✅ 성능 테스트 완료 - 성공: ${successfulRequests.length}/${templateTypes.length}, 평균 응답 시간: ${averageTime.toFixed(2)}ms`);
    });

    test('템플릿 내용의 LLM 사용성 검증', async () => {
      console.log('🤖 LLM 사용성 검증 테스트...');
      
      const response = await apiClient.get('/templates/guide/IMPACT_ANALYSIS', {
        params: { site_id: testSiteId }
      });
      
      const templateData = response.data.data;
      
      // 마크다운 형식 검증
      expect(templateData.template).toMatch(/^#/); // 제목으로 시작
      expect(templateData.template).toContain('##'); // 섹션 구분
      
      // 변수 형식 검증 ({{VARIABLE}} 패턴)
      const variablePattern = /\{\{[A-Z_]+\}\}/g;
      const templateVariables = templateData.template.match(variablePattern) || [];
      const uniqueVariables = [...new Set(templateVariables.map(v => v.replace(/[{}]/g, '')))];
      
      // 선언된 변수와 실제 사용된 변수 일치 확인
      expect(uniqueVariables.sort()).toEqual(templateData.variables.sort());
      
      // 지침의 구체성 검증
      const instructions = templateData.instructions;
      expect(instructions).toMatch(/(작성|입력|치환|생성)/); // 구체적인 행동 지시어 포함
      expect(instructions.length).toBeGreaterThan(50); // 충분한 상세도
      
      // 템플릿 구조 검증 (비어있지 않은 섹션들)
      const sections = templateData.template.split('##').filter(section => section.trim().length > 0);
      expect(sections.length).toBeGreaterThan(2); // 최소 3개 섹션
      
      console.log(`✅ LLM 사용성 검증 완료 - 섹션: ${sections.length}개, 변수: ${templateData.variables.length}개`);
    });

    test('동시 다중 템플릿 요청 처리 안정성', async () => {
      console.log('🔄 동시 다중 요청 안정성 테스트...');
      
      // 5개의 동시 요청
      const requests = Array(5).fill(0).map(() => 
        apiClient.get('/templates/guide/IMPACT_ANALYSIS', {
          params: { site_id: testSiteId }
        })
      );
      
      const startTime = performance.now();
      const responses = await Promise.allSettled(requests);
      const endTime = performance.now();
      
      // 모든 요청이 성공해야 함
      const successCount = responses.filter(
        result => result.status === 'fulfilled' && 
                 result.value.status === 200
      ).length;
      
      expect(successCount).toBe(5);
      
      // 동시 요청임에도 응답 일관성 확인
      const successfulResponses = responses.filter(r => r.status === 'fulfilled') as Array<{value: any}>;
      const firstTemplate = successfulResponses[0].value.data.data.template;
      
      successfulResponses.forEach(response => {
        expect(response.value.data.data.template).toBe(firstTemplate);
      });
      
      console.log(`✅ 동시 다중 요청 처리 성공 (${successCount}/5, 소요 시간: ${(endTime - startTime).toFixed(2)}ms)`);
    });
  });

  describe('🎯 실제 Copilot/LLM 워크플로우 검증', () => {
    test('템플릿 요청 → 변수 추출 → 예상 결과 생성 시나리오', async () => {
      console.log('🤖 실제 LLM 워크플로우 시뮬레이션...');
      
      // 1단계: 템플릿 요청 (MCP가 수행)
      const templateResponse = await apiClient.get('/templates/guide/IMPACT_ANALYSIS', {
        params: { site_id: testSiteId }
      });
      
      const templateData = templateResponse.data.data;
      
      // 2단계: LLM이 수행할 변수 추출 및 분석
      const requiredVariables = templateData.variables;
      const templateContent = templateData.template;
      const instructions = templateData.instructions;
      
      // 3단계: 샘플 변수 값으로 최종 문서 시뮬레이션
      const sampleValues: Record<string, string> = {};
      requiredVariables.forEach((variable: string) => {
        switch (variable) {
          case 'FEATURE_NAME':
            sampleValues[variable] = '결제 시스템 개선';
            break;
          case 'ANALYST':
            sampleValues[variable] = '시스템 분석가 김개발';
            break;
          case 'ANALYSIS_DATE':
            sampleValues[variable] = new Date().toLocaleDateString('ko-KR');
            break;
          default:
            sampleValues[variable] = `[${variable} 값]`;
        }
      });
      
      // 4단계: 변수 치환 수행 (LLM이 수행할 작업)
      let finalDocument = templateContent;
      Object.entries(sampleValues).forEach(([variable, value]) => {
        finalDocument = finalDocument.replace(new RegExp(`{{${variable}}}`, 'g'), value);
      });
      
      // 5단계: 최종 결과 검증
      expect(finalDocument).not.toContain('{{'); // 모든 변수 치환 완료
      expect(finalDocument).not.toContain('}}'); // 모든 변수 치환 완료
      expect(finalDocument).toContain('결제 시스템 개선'); // 실제 값 포함
      expect(finalDocument.length).toBeGreaterThan(templateContent.length); // 내용이 확장됨
      
      // 마크다운 구조 유지 확인
      expect(finalDocument).toMatch(/^#[^#]/); // 제목 구조 유지
      expect(finalDocument).toContain('##'); // 섹션 구조 유지
      
      console.log('✅ LLM 워크플로우 시뮬레이션 성공');
      console.log(`📝 최종 문서 길이: ${finalDocument.length}자 (원본: ${templateContent.length}자)`);
      console.log(`🔧 처리된 변수: ${Object.keys(sampleValues).length}개`);
    });
  });
});

// 헬퍼 함수: 템플릿 품질 검증
export function validateTemplateQuality(templateData: any): boolean {
  // 필수 필드 존재 확인
  if (!templateData.template || !templateData.variables || !templateData.instructions) {
    return false;
  }
  
  // 템플릿 최소 길이 확인
  if (templateData.template.length < 50) {
    return false;
  }
  
  // 변수 형식 확인
  const variablePattern = /\{\{([A-Z_]+)\}\}/g;
  const templateVariables = [];
  let match;
  while ((match = variablePattern.exec(templateData.template)) !== null) {
    templateVariables.push(match[1]);
  }
  
  // 선언된 변수와 실제 사용된 변수 일치 확인
  const uniqueTemplateVariables = [...new Set(templateVariables)];
  return uniqueTemplateVariables.sort().join(',') === templateData.variables.sort().join(',');
}

// 헬퍼 함수: LLM 변수 치환 시뮬레이터
export function simulateVariableSubstitution(
  template: string, 
  variables: Record<string, string>
): { result: string; substituted: number } {
  let result = template;
  let substituted = 0;
  
  Object.entries(variables).forEach(([key, value]) => {
    const regex = new RegExp(`{{${key}}}`, 'g');
    const matches = template.match(regex);
    if (matches) {
      substituted += matches.length;
      result = result.replace(regex, value);
    }
  });
  
  return { result, substituted };
}
