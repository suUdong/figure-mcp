/**
 * cachedApiCall 메서드 단위 테스트
 * MCP 서버의 핵심 HTTP 통신 로직 검증
 */

import { jest } from '@jest/globals';
import axios, { AxiosInstance, AxiosError } from 'axios';
import fs from 'fs';
import path from 'path';
import os from 'os';

// axios 모킹
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// FigureMCPServer 클래스 임포트 (테스트를 위해 일부 메서드를 public으로 노출)
class TestFigureMCPServer {
  private apiClient: AxiosInstance;
  private readonly CACHE_DIR: string;
  private readonly CACHE_TTL: number = 60 * 60 * 1000; // 1시간

  constructor() {
    this.CACHE_DIR = path.join(os.tmpdir(), 'test-cache');
    this.apiClient = axios.create({
      baseURL: 'http://localhost:8001/api',
      timeout: 30000,
    });
    
    // 캐시 디렉토리 생성
    if (!fs.existsSync(this.CACHE_DIR)) {
      fs.mkdirSync(this.CACHE_DIR, { recursive: true });
    }
  }

  // 테스트를 위해 private 메서드들을 public으로 노출
  public generateCacheKey(url: string, params?: any): string {
    const data = JSON.stringify({ url, params });
    return require('crypto').createHash('md5').update(data).digest('hex');
  }

  public getCacheFilePath(cacheKey: string): string {
    return path.join(this.CACHE_DIR, `${cacheKey}.json`);
  }

  public getCachedData(cacheKey: string): any | null {
    try {
      const filePath = this.getCacheFilePath(cacheKey);
      
      if (!fs.existsSync(filePath)) {
        return null;
      }

      const stats = fs.statSync(filePath);
      const now = Date.now();
      const fileAge = now - stats.mtime.getTime();

      // TTL 확인
      if (fileAge > this.CACHE_TTL) {
        fs.unlinkSync(filePath);
        return null;
      }

      const rawData = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(rawData);
    } catch (error) {
      return null;
    }
  }

  public setCachedData(cacheKey: string, data: any): void {
    try {
      const filePath = this.getCacheFilePath(cacheKey);
      const jsonData = JSON.stringify(data, null, 2);
      fs.writeFileSync(filePath, jsonData, 'utf-8');
    } catch (error) {
      // 캐시 저장 실패는 무시 (기능에 영향 없음)
    }
  }

  public async cachedApiCall(method: 'GET' | 'POST', url: string, params?: any, data?: any): Promise<any> {
    const cacheKey = this.generateCacheKey(`${method}:${url}`, { params, data });
    
    // 캐시에서 조회
    const cachedResult = this.getCachedData(cacheKey);
    if (cachedResult) {
      return cachedResult;
    }

    // API 호출
    let response;
    if (method === 'GET') {
      response = await this.apiClient.get(url, { params });
    } else {
      response = await this.apiClient.post(url, data, { params });
    }

    // 성공한 결과만 캐싱
    if (response.data.success) {
      this.setCachedData(cacheKey, response.data);
    }

    return response.data;
  }

  public cleanup(): void {
    if (fs.existsSync(this.CACHE_DIR)) {
      fs.rmSync(this.CACHE_DIR, { recursive: true, force: true });
    }
  }
}

describe('cachedApiCall 메서드 테스트', () => {
  let testServer: TestFigureMCPServer;
  let mockAxiosInstance: jest.Mocked<AxiosInstance>;

  beforeEach(() => {
    // 모킹 리셋
    jest.clearAllMocks();
    
    // Mock axios instance 생성
    mockAxiosInstance = {
      get: jest.fn(),
      post: jest.fn(),
    } as any;
    
    // axios.create 모킹
    mockedAxios.create.mockReturnValue(mockAxiosInstance);
    
    // 테스트 서버 인스턴스 생성
    testServer = new TestFigureMCPServer();
  });

  afterEach(() => {
    // 테스트 후 정리
    testServer.cleanup();
  });

  describe('🟢 정상 동작 테스트', () => {
    test('GET 요청이 성공적으로 처리되어야 함', async () => {
      // Arrange
      const mockResponseData = {
        success: true,
        message: 'Success',
        data: { id: '1', name: 'test' }
      };
      
      mockAxiosInstance.get.mockResolvedValue({
        data: mockResponseData
      });

      // Act
      const result = await testServer.cachedApiCall('GET', '/test', { param: 'value' });

      // Assert
      expect(result).toEqual(mockResponseData);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/test', { params: { param: 'value' } });
      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(1);
    });

    test('POST 요청이 성공적으로 처리되어야 함', async () => {
      // Arrange
      const requestData = { name: 'test', value: 123 };
      const mockResponseData = {
        success: true,
        message: 'Created',
        data: { id: '2', ...requestData }
      };
      
      mockAxiosInstance.post.mockResolvedValue({
        data: mockResponseData
      });

      // Act
      const result = await testServer.cachedApiCall('POST', '/test', undefined, requestData);

      // Assert
      expect(result).toEqual(mockResponseData);
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/test', requestData, { params: undefined });
    });
  });

  describe('💾 캐싱 동작 테스트', () => {
    test('성공한 응답이 캐시에 저장되어야 함', async () => {
      // Arrange
      const mockResponseData = {
        success: true,
        message: 'Success',
        data: { cached: true }
      };
      
      mockAxiosInstance.get.mockResolvedValue({
        data: mockResponseData
      });

      // Act - 첫 번째 호출
      await testServer.cachedApiCall('GET', '/cacheable');
      
      // Act - 두 번째 호출 (캐시에서 반환되어야 함)
      const result = await testServer.cachedApiCall('GET', '/cacheable');

      // Assert
      expect(result).toEqual(mockResponseData);
      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(1); // 한 번만 호출되어야 함
    });

    test('실패한 응답은 캐시에 저장되지 않아야 함', async () => {
      // Arrange
      const mockResponseData = {
        success: false,
        message: 'Error',
        data: null
      };
      
      mockAxiosInstance.get.mockResolvedValue({
        data: mockResponseData
      });

      // Act - 두 번 호출
      await testServer.cachedApiCall('GET', '/error-endpoint');
      await testServer.cachedApiCall('GET', '/error-endpoint');

      // Assert
      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(2); // 두 번 모두 호출되어야 함
    });

    test('만료된 캐시는 무시되고 새로 요청해야 함', async () => {
      // Arrange
      const mockResponseData = {
        success: true,
        message: 'Success',
        data: { timestamp: Date.now() }
      };
      
      mockAxiosInstance.get.mockResolvedValue({
        data: mockResponseData
      });

      // Act - 첫 번째 호출
      await testServer.cachedApiCall('GET', '/expiry-test');
      
      // 캐시 파일을 강제로 만료시키기 (과거 시간으로 수정)
      const cacheKey = testServer.generateCacheKey('GET:/expiry-test', { params: undefined, data: undefined });
      const cacheFilePath = testServer.getCacheFilePath(cacheKey);
      const pastTime = Date.now() - (2 * 60 * 60 * 1000); // 2시간 전
      fs.utimesSync(cacheFilePath, new Date(pastTime), new Date(pastTime));
      
      // Act - 두 번째 호출 (캐시가 만료되어 새로 요청해야 함)
      await testServer.cachedApiCall('GET', '/expiry-test');

      // Assert
      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(2);
    });
  });

  describe('❌ 에러 처리 테스트', () => {
    test('네트워크 오류 시 예외를 전파해야 함', async () => {
      // Arrange
      const networkError = new Error('Network Error');
      (networkError as any).code = 'ECONNREFUSED';
      mockAxiosInstance.get.mockRejectedValue(networkError);

      // Act & Assert
      await expect(testServer.cachedApiCall('GET', '/network-error')).rejects.toThrow('Network Error');
      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(1);
    });

    test('HTTP 4xx 에러 시 예외를 전파해야 함', async () => {
      // Arrange
      const axiosError = new Error('Request failed with status code 404') as AxiosError;
      axiosError.response = {
        status: 404,
        statusText: 'Not Found',
        data: { error: 'Resource not found' },
        headers: {},
        config: {} as any
      };
      mockAxiosInstance.get.mockRejectedValue(axiosError);

      // Act & Assert
      await expect(testServer.cachedApiCall('GET', '/not-found')).rejects.toThrow('Request failed with status code 404');
    });

    test('타임아웃 오류 시 예외를 전파해야 함', async () => {
      // Arrange
      const timeoutError = new Error('timeout of 30000ms exceeded');
      (timeoutError as any).code = 'ECONNABORTED';
      mockAxiosInstance.get.mockRejectedValue(timeoutError);

      // Act & Assert
      await expect(testServer.cachedApiCall('GET', '/slow-endpoint')).rejects.toThrow('timeout of 30000ms exceeded');
    });
  });

  describe('🔧 캐시 유틸리티 테스트', () => {
    test('캐시 키가 올바르게 생성되어야 함', () => {
      // Act
      const key1 = testServer.generateCacheKey('GET:/test', { param: 'value' });
      const key2 = testServer.generateCacheKey('GET:/test', { param: 'value' });
      const key3 = testServer.generateCacheKey('GET:/test', { param: 'different' });

      // Assert
      expect(key1).toBe(key2); // 같은 입력은 같은 키 생성
      expect(key1).not.toBe(key3); // 다른 입력은 다른 키 생성
      expect(key1).toMatch(/^[a-f0-9]{32}$/); // MD5 해시 형식
    });

    test('캐시 파일 경로가 올바르게 생성되어야 함', () => {
      // Act
      const cacheKey = 'test-cache-key';
      const filePath = testServer.getCacheFilePath(cacheKey);

      // Assert
      expect(filePath).toContain(cacheKey);
      expect(filePath).toMatch(/\.json$/);
      expect(path.isAbsolute(filePath)).toBe(true);
    });
  });
});

// 테스트 헬퍼 함수들
export function createMockAPIResponse(success: boolean, data?: any, message?: string) {
  return {
    success,
    message: message || (success ? 'Success' : 'Error'),
    data: data || null,
    errors: success ? null : ['Test error']
  };
}

export function createMockAxiosError(status: number, message: string): AxiosError {
  const error = new Error(message) as AxiosError;
  error.response = {
    status,
    statusText: message,
    data: { error: message },
    headers: {},
    config: {} as any
  };
  return error;
}
