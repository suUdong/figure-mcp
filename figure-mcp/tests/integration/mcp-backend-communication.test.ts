/**
 * MCP ↔ Backend 통합 테스트
 * 실제 HTTP 통신을 통한 전체 플로우 검증
 * 
 * 실행 전 요구사항:
 * 1. Docker 컨테이너 실행: docker-compose up figure-backend chroma redis
 * 2. 백엔드 API 정상 동작 확인
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

// 테스트 데이터
const TEST_SITE_DATA = {
  name: 'Integration Test Site',
  company: 'Test Company',
  business_type: 'Software Development',
  contact_person: 'Test User',
  description: 'Created by integration test',
  url: 'https://test-integration.example.com'
};

describe('MCP ↔ Backend 통합 테스트', () => {
  let testSiteId: string;
  
  // 테스트 환경 검증
  beforeAll(async () => {
    console.log(`🔍 백엔드 API 연결 확인: ${BACKEND_API_URL}`);
    
    try {
      // 백엔드 헬스체크
      const healthResponse = await apiClient.get('/health');
      expect(healthResponse.status).toBe(200);
      console.log('✅ 백엔드 API 정상 동작 확인');
    } catch (error) {
      console.error('❌ 백엔드 API 연결 실패:', error);
      throw new Error(
        '백엔드 API에 연결할 수 없습니다. ' +
        'Docker 컨테이너가 실행되고 있는지 확인하세요: ' +
        'docker-compose up figure-backend'
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

  describe('🏢 사이트 관리 API 통합 테스트', () => {
    test('사이트 생성 → 조회 → 수정 → 삭제 전체 플로우', async () => {
      // 1. 사이트 생성
      console.log('📝 사이트 생성 테스트...');
      const createResponse = await apiClient.post('/sites/', TEST_SITE_DATA);
      
      expect(createResponse.status).toBe(200);
      expect(createResponse.data).toHaveProperty('success', true);
      expect(createResponse.data.data).toHaveProperty('id');
      
      testSiteId = createResponse.data.data.id;
      console.log(`✅ 사이트 생성 성공: ${testSiteId}`);

      // 2. 사이트 목록 조회
      console.log('📋 사이트 목록 조회 테스트...');
      const listResponse = await apiClient.get('/sites/');
      
      expect(listResponse.status).toBe(200);
      expect(listResponse.data.success).toBe(true);
      expect(Array.isArray(listResponse.data.data)).toBe(true);
      
      const createdSite = listResponse.data.data.find((site: any) => site.id === testSiteId);
      expect(createdSite).toBeDefined();
      expect(createdSite.name).toBe(TEST_SITE_DATA.name);
      console.log('✅ 사이트 목록 조회 성공');

      // 3. 특정 사이트 조회
      console.log('🔍 특정 사이트 조회 테스트...');
      const getResponse = await apiClient.get(`/sites/${testSiteId}`);
      
      expect(getResponse.status).toBe(200);
      expect(getResponse.data.success).toBe(true);
      expect(getResponse.data.data.id).toBe(testSiteId);
      console.log('✅ 특정 사이트 조회 성공');

      // 4. 사이트 수정
      console.log('✏️ 사이트 수정 테스트...');
      const updateData = {
        ...TEST_SITE_DATA,
        name: 'Updated Test Site',
        description: 'Updated by integration test'
      };
      
      const updateResponse = await apiClient.put(`/sites/${testSiteId}`, updateData);
      
      expect(updateResponse.status).toBe(200);
      expect(updateResponse.data.success).toBe(true);
      expect(updateResponse.data.data.name).toBe(updateData.name);
      console.log('✅ 사이트 수정 성공');
    }, TEST_TIMEOUT);
  });

  describe('📄 템플릿 관리 API 통합 테스트', () => {
    test('템플릿 조회 및 가이드 생성 플로우', async () => {
      // 1. 템플릿 가이드 조회 (IMPACT_ANALYSIS)
      console.log('📋 템플릿 가이드 조회 테스트...');
      
      // 먼저 사이트가 있어야 함
      const siteResponse = await apiClient.get('/sites/');
      const sites = siteResponse.data.data;
      expect(sites.length).toBeGreaterThan(0);
      const firstSite = sites[0];
      
      const templateResponse = await apiClient.get('/templates/guide/IMPACT_ANALYSIS', {
        params: { site_id: firstSite.id }
      });
      
      expect(templateResponse.status).toBe(200);
      expect(templateResponse.data.success).toBe(true);
      expect(templateResponse.data.data).toHaveProperty('template');
      console.log('✅ 템플릿 가이드 조회 성공');
      
      // 2. 템플릿 사용 기록
      console.log('📝 템플릿 사용 기록 테스트...');
      const template = templateResponse.data.data;
      
      const usageResponse = await apiClient.post(`/templates/${template.id}/use`, {
        site_id: firstSite.id,
        usage_context: {
          document_type: 'IMPACT_ANALYSIS',
          feature_name: 'Integration Test Feature',
          timestamp: new Date().toISOString()
        }
      });
      
      expect(usageResponse.status).toBe(200);
      expect(usageResponse.data.success).toBe(true);
      console.log('✅ 템플릿 사용 기록 성공');
    }, TEST_TIMEOUT);
  });

  describe('🐳 시스템 상태 API 통합 테스트', () => {
    test('Docker 서비스 상태 조회', async () => {
      console.log('🐳 Docker 서비스 상태 조회 테스트...');
      
      const statusResponse = await apiClient.get('/system/docker-status');
      
      expect(statusResponse.status).toBe(200);
      expect(statusResponse.data.success).toBe(true);
      expect(statusResponse.data.data).toHaveProperty('services');
      expect(Array.isArray(statusResponse.data.data.services)).toBe(true);
      
      // figure-backend 서비스가 실행 중이어야 함
      const services = statusResponse.data.data.services;
      const backendService = services.find((service: any) => 
        service.name.includes('figure-backend')
      );
      expect(backendService).toBeDefined();
      expect(['running', 'healthy']).toContain(backendService.status);
      
      console.log('✅ Docker 서비스 상태 조회 성공');
    }, TEST_TIMEOUT);
  });

  describe('🔍 순환 의존성 분석 API 통합 테스트', () => {
    test('프로젝트 순환 의존성 분석', async () => {
      console.log('🔍 순환 의존성 분석 테스트...');
      
      const analysisData = {
        project_path: process.cwd(), // 현재 프로젝트 경로
        language: 'typescript',
        max_depth: 3
      };
      
      const analysisResponse = await apiClient.post('/analysis/circular-dependency', analysisData);
      
      expect(analysisResponse.status).toBe(200);
      expect(analysisResponse.data.success).toBe(true);
      expect(analysisResponse.data.data).toHaveProperty('totalFiles');
      expect(analysisResponse.data.data).toHaveProperty('circularDependencies');
      expect(typeof analysisResponse.data.data.totalFiles).toBe('number');
      expect(Array.isArray(analysisResponse.data.data.circularDependencies)).toBe(true);
      
      console.log(`✅ 순환 의존성 분석 성공 (분석된 파일: ${analysisResponse.data.data.totalFiles}개)`);
    }, TEST_TIMEOUT);
  });

  describe('⚡ 성능 및 안정성 테스트', () => {
    test('API 응답 시간이 기준을 만족해야 함', async () => {
      console.log('⚡ API 응답 시간 테스트...');
      
      const startTime = performance.now();
      
      // 여러 API를 동시에 호출
      const promises = [
        apiClient.get('/sites/'),
        apiClient.get('/system/docker-status'),
        apiClient.get('/health')
      ];
      
      const responses = await Promise.all(promises);
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      
      // 모든 응답이 성공해야 함
      responses.forEach((response, index) => {
        expect(response.status).toBe(200);
        expect(response.data.success).toBe(true);
      });
      
      // 전체 응답 시간이 3초 이내여야 함 (동시 호출이므로)
      expect(totalTime).toBeLessThan(3000);
      
      console.log(`✅ 성능 테스트 통과 (응답 시간: ${totalTime.toFixed(2)}ms)`);
    }, TEST_TIMEOUT);

    test('에러 상황에서 적절한 응답을 반환해야 함', async () => {
      console.log('❌ 에러 처리 테스트...');
      
      // 존재하지 않는 사이트 조회
      try {
        await apiClient.get('/sites/non-existent-site-id');
        fail('404 에러가 발생해야 함');
      } catch (error) {
        expect((error as AxiosError).response?.status).toBe(404);
        console.log('✅ 404 에러 처리 성공');
      }
      
      // 잘못된 데이터로 사이트 생성
      try {
        await apiClient.post('/sites/', { invalid: 'data' });
        fail('400 에러가 발생해야 함');
      } catch (error) {
        expect([400, 422]).toContain((error as AxiosError).response?.status);
        console.log('✅ 400/422 에러 처리 성공');
      }
    }, TEST_TIMEOUT);

    test('동시 요청 처리 안정성 테스트', async () => {
      console.log('🔄 동시 요청 처리 테스트...');
      
      // 10개의 동시 요청
      const requests = Array(10).fill(0).map(() => 
        apiClient.get('/health')
      );
      
      const startTime = performance.now();
      const responses = await Promise.allSettled(requests);
      const endTime = performance.now();
      
      // 모든 요청이 성공해야 함
      const successCount = responses.filter(
        result => result.status === 'fulfilled' && 
                 result.value.status === 200
      ).length;
      
      expect(successCount).toBe(10);
      console.log(`✅ 동시 요청 처리 성공 (${successCount}/10, 소요 시간: ${(endTime - startTime).toFixed(2)}ms)`);
    }, TEST_TIMEOUT);
  });
});

// 헬퍼 함수들
export async function waitForBackendReady(maxAttempts: number = 10, intervalMs: number = 2000): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      await apiClient.get('/health');
      console.log('✅ 백엔드 API 준비 완료');
      return;
    } catch (error) {
      console.log(`⏳ 백엔드 API 대기 중... (${i + 1}/${maxAttempts})`);
      if (i === maxAttempts - 1) {
        throw new Error('백엔드 API 준비 시간 초과');
      }
      await new Promise(resolve => setTimeout(resolve, intervalMs));
    }
  }
}

export function createTestSite(overrides: Partial<typeof TEST_SITE_DATA> = {}) {
  return {
    ...TEST_SITE_DATA,
    name: `Test Site ${Date.now()}`,
    url: `https://test-${Date.now()}.example.com`,
    ...overrides
  };
}
