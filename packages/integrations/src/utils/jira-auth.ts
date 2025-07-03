/**
 * Jira Authentication Utilities
 * Jira API 인증과 관련된 유틸리티 함수들
 */

import { JiraConfig } from '../types/jira.types';

/**
 * Basic Auth 헤더 생성
 */
export function createBasicAuthHeader(username: string, apiToken: string): string {
  const credentials = Buffer.from(`${username}:${apiToken}`).toString('base64');
  return `Basic ${credentials}`;
}

/**
 * Jira API 요청 헤더 생성
 */
export function createJiraRequestHeaders(config: JiraConfig): Record<string, string> {
  return {
    'Authorization': createBasicAuthHeader(config.username, config.apiToken),
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'User-Agent': 'Figure-MCP-Jira-Integration/1.0.0'
  };
}

/**
 * 파일 업로드용 헤더 생성 (multipart/form-data)
 */
export function createFileUploadHeaders(config: JiraConfig): Record<string, string> {
  return {
    'Authorization': createBasicAuthHeader(config.username, config.apiToken),
    'Accept': 'application/json',
    'X-Atlassian-Token': 'no-check', // XSRF 방지
    'User-Agent': 'Figure-MCP-Jira-Integration/1.0.0'
  };
}

/**
 * Jira 설정 유효성 검증
 */
export function validateJiraConfig(config: JiraConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!config.baseUrl) {
    errors.push('Base URL is required');
  } else if (!isValidUrl(config.baseUrl)) {
    errors.push('Base URL must be a valid URL');
  }

  if (!config.username) {
    errors.push('Username is required');
  }

  if (!config.apiToken) {
    errors.push('API Token is required');
  }

  if (config.timeout && (config.timeout < 1000 || config.timeout > 300000)) {
    errors.push('Timeout must be between 1000ms and 300000ms');
  }

  if (config.maxRetries && (config.maxRetries < 0 || config.maxRetries > 10)) {
    errors.push('Max retries must be between 0 and 10');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * URL 유효성 검증
 */
function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Jira Cloud URL 정규화
 */
export function normalizeJiraUrl(baseUrl: string): string {
  let normalized = baseUrl.trim();
  
  // 프로토콜 추가
  if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
    normalized = `https://${normalized}`;
  }
  
  // 후행 슬래시 제거
  normalized = normalized.replace(/\/+$/, '');
  
  // Jira Cloud API 경로 확인
  if (!normalized.includes('/rest/api/')) {
    if (normalized.endsWith('.atlassian.net')) {
      normalized = `${normalized}/rest/api/3`;
    } else {
      // 온프레미스 Jira인 경우
      normalized = `${normalized}/rest/api/2`;
    }
  }

  return normalized;
}

/**
 * API 토큰 마스킹 (로깅용)
 */
export function maskApiToken(token: string): string {
  if (!token || token.length < 8) {
    return '***';
  }
  
  return `${token.substring(0, 4)}***${token.substring(token.length - 4)}`;
}

/**
 * 인증 테스트를 위한 간단한 API 호출
 */
export async function testJiraAuthentication(config: JiraConfig): Promise<{ success: boolean; error?: string; user?: any }> {
  try {
    const headers = createJiraRequestHeaders(config);
    const url = `${normalizeJiraUrl(config.baseUrl)}/myself`;
    
    const response = await axios.get(url, {
      headers,
      timeout: config.timeout || 10000
    });
    
    return {
      success: true,
      user: response.data
    };
  } catch (error: any) {
    let errorMessage = 'Authentication failed';
    
    if (error.response) {
      switch (error.response.status) {
        case 401:
          errorMessage = 'Invalid credentials (username or API token)';
          break;
        case 403:
          errorMessage = 'Access denied - check permissions';
          break;
        case 404:
          errorMessage = 'Jira instance not found - check base URL';
          break;
        default:
          errorMessage = `HTTP ${error.response.status}: ${error.response.statusText}`;
      }
    } else if (error.code === 'ENOTFOUND') {
      errorMessage = 'Cannot reach Jira instance - check network connection and base URL';
    } else if (error.code === 'ETIMEDOUT') {
      errorMessage = 'Connection timeout - Jira instance may be slow or unreachable';
    } else {
      errorMessage = error.message || 'Unknown authentication error';
    }
    
    return {
      success: false,
      error: errorMessage
    };
  }
}

/**
 * 사용자 계정 ID에서 사용자명 추출 (레거시 지원)
 */
export function extractUsernameFromAccountId(accountId: string): string | null {
  // Jira Cloud의 새로운 계정 ID 형식: 5b10ac8d82e05b22cc7d4ef5
  if (/^[a-f0-9]{24}$/.test(accountId)) {
    return null; // 새로운 형식에서는 사용자명을 추출할 수 없음
  }
  
  // 레거시 형식에서는 계정 ID가 사용자명과 같을 수 있음
  return accountId;
}

/**
 * 권한 체크를 위한 스코프 검증
 */
export interface JiraPermission {
  project?: string;
  permission: string;
}

export function validateRequiredPermissions(permissions: JiraPermission[]): boolean {
  const requiredPermissions = [
    'BROWSE_PROJECTS',
    'CREATE_ISSUES',
    'EDIT_ISSUES',
    'ADD_COMMENTS',
    'ATTACH_FILES'
  ];
  
  return requiredPermissions.every(required => 
    permissions.some(p => p.permission === required)
  );
} 