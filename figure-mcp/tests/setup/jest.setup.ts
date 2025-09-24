// Jest 글로벌 설정 및 모킹

import { jest } from '@jest/globals';

// 환경 변수 설정 (테스트용)
process.env.NODE_ENV = 'test';
process.env.MCP_QUIET = 'true';
process.env.BACKEND_API_URL = 'http://localhost:8001/api';
process.env.JIRA_BASE_URL = 'https://test-company.atlassian.net';
process.env.JIRA_EMAIL = 'test@example.com';
process.env.JIRA_API_TOKEN = 'test-token';
process.env.DEFAULT_SITE_ID = 'test-site';
process.env.DEFAULT_SITE_NAME = 'Test Site';

// 콘솔 로그 모킹 (조용한 테스트 환경)
global.console = {
  ...console,
  error: jest.fn(), // console.error 모킹으로 로그 출력 제거
  warn: jest.fn(),
  log: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
};

// 파일 시스템 모킹을 위한 임시 디렉토리 설정
import os from 'os';
import path from 'path';

export const TEST_CACHE_DIR = path.join(os.tmpdir(), 'figure-mcp-test-cache');
process.env.CACHE_DIR = TEST_CACHE_DIR;

// 각 테스트 후 정리
afterEach(() => {
  // 모든 모킹 리셋
  jest.clearAllMocks();
  
  // 타이머 정리
  jest.clearAllTimers();
});

// 테스트 전체 완료 후 정리
afterAll(() => {
  // 캐시 디렉토리 정리
  import fs from 'fs';
  if (fs.existsSync(TEST_CACHE_DIR)) {
    fs.rmSync(TEST_CACHE_DIR, { recursive: true, force: true });
  }
});

// 커스텀 매처 추가 (선택사항)
expect.extend({
  toBeAPIResponse(received: any) {
    const pass = (
      typeof received === 'object' &&
      received !== null &&
      'success' in received &&
      'message' in received &&
      'data' in received
    );
    
    if (pass) {
      return {
        message: () => `Expected ${received} not to be a valid API response format`,
        pass: true,
      };
    } else {
      return {
        message: () => `Expected ${received} to be a valid API response format with success, message, and data fields`,
        pass: false,
      };
    }
  },
});

// TypeScript 타입 확장
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeAPIResponse(): R;
    }
  }
}
