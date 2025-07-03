/**
 * Jira API Client
 * Jira REST API와의 통신을 담당하는 메인 클라이언트
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import {
  JiraConfig,
  JiraIssue,
  JiraProject,
  JiraUser,
  JiraSearchRequest,
  JiraSearchResponse,
  JiraCreateIssueRequest,
  JiraCreateIssueResponse,
  JiraUpdateIssueRequest,
  JiraTransition,
  JiraTransitionRequest,
  JiraComment,
  JiraAttachment,
  JiraErrorResponse,
  JiraSearchOptions,
  JiraIssueCreateOptions,
  JiraIssueUpdateOptions
} from './types/jira.types';

import {
  createJiraRequestHeaders,
  createFileUploadHeaders,
  normalizeJiraUrl,
  validateJiraConfig,
  testJiraAuthentication
} from './utils/jira-auth';

import {
  JQLBuilder,
  formatCreateIssueRequest,
  formatUpdateIssueRequest,
  simplifyJiraIssue,
  SimplifiedJiraIssue
} from './utils/jira-formatter';

/**
 * Jira API 클라이언트 메인 클래스
 */
export class JiraClient {
  private config: JiraConfig;
  private axios: AxiosInstance;
  private baseUrl: string;

  constructor(config: JiraConfig) {
    const validation = validateJiraConfig(config);
    if (!validation.valid) {
      throw new Error(`Invalid Jira configuration: ${validation.errors.join(', ')}`);
    }

    this.config = { ...config };
    this.baseUrl = normalizeJiraUrl(config.baseUrl);
    
    // Axios 인스턴스 생성
    this.axios = axios.create({
      baseURL: this.baseUrl,
      timeout: config.timeout || 30000,
      headers: createJiraRequestHeaders(config),
      maxRedirects: 5,
      validateStatus: (status) => status < 500 // 5xx 에러만 reject
    });

    // 요청 인터셉터 - 재시도 로직
    this.setupRetryInterceptor();
  }

  /**
   * 재시도 로직 설정
   */
  private setupRetryInterceptor(): void {
    this.axios.interceptors.response.use(
      (response) => response,
      async (error) => {
        const config = error.config;
        
        if (!config || config._retryCount >= (this.config.maxRetries || 3)) {
          return Promise.reject(error);
        }

        config._retryCount = config._retryCount || 0;
        
        // 재시도 가능한 에러인지 확인
        if (this.shouldRetry(error)) {
          config._retryCount++;
          
          // 지수 백오프로 대기
          const delay = Math.pow(2, config._retryCount) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
          
          return this.axios(config);
        }
        
        return Promise.reject(error);
      }
    );
  }

  /**
   * 재시도 가능한 에러인지 판단
   */
  private shouldRetry(error: any): boolean {
    if (!error.response) return true; // 네트워크 에러
    
    const status = error.response.status;
    return status === 429 || status >= 500; // Rate limit 또는 서버 에러
  }

  /**
   * API 응답 처리
   */
  private async handleResponse<T>(response: AxiosResponse): Promise<T> {
    if (response.status >= 400) {
      const errorData: JiraErrorResponse = response.data;
      const errorMessage = errorData.errorMessages?.join(', ') || 
                          Object.values(errorData.errors || {}).join(', ') ||
                          `HTTP ${response.status}: ${response.statusText}`;
      throw new Error(errorMessage);
    }
    
    return response.data;
  }

  /**
   * 인증 테스트
   */
  async testConnection(): Promise<{ success: boolean; error?: string; user?: JiraUser }> {
    return await testJiraAuthentication(this.config);
  }

  /**
   * 현재 사용자 정보 조회
   */
  async getCurrentUser(): Promise<JiraUser> {
    const response = await this.axios.get('/myself');
    return this.handleResponse<JiraUser>(response);
  }

  // === 프로젝트 관련 메서드 ===

  /**
   * 모든 프로젝트 조회
   */
  async getProjects(): Promise<JiraProject[]> {
    const response = await this.axios.get('/project');
    return this.handleResponse<JiraProject[]>(response);
  }

  /**
   * 특정 프로젝트 조회
   */
  async getProject(projectKeyOrId: string): Promise<JiraProject> {
    const response = await this.axios.get(`/project/${projectKeyOrId}`);
    return this.handleResponse<JiraProject>(response);
  }

  // === 이슈 검색 및 조회 ===

  /**
   * JQL을 사용한 이슈 검색
   */
  async searchIssues(request: JiraSearchRequest): Promise<JiraSearchResponse> {
    const response = await this.axios.post('/search', request);
    return this.handleResponse<JiraSearchResponse>(response);
  }

  /**
   * 옵션을 사용한 이슈 검색
   */
  async searchIssuesByOptions(options: JiraSearchOptions): Promise<JiraSearchResponse> {
    const jql = JQLBuilder.fromOptions(options);
    
    const request: JiraSearchRequest = {
      jql,
      startAt: options.startAt || 0,
      maxResults: options.maxResults || 50,
      fields: ['*all'],
      expand: ['changelog', 'attachment', 'comment']
    };

    return this.searchIssues(request);
  }

  /**
   * 간소화된 이슈 검색
   */
  async searchSimplifiedIssues(options: JiraSearchOptions): Promise<SimplifiedJiraIssue[]> {
    const searchResult = await this.searchIssuesByOptions(options);
    return searchResult.issues.map(issue => simplifyJiraIssue(issue, this.baseUrl));
  }

  /**
   * 특정 이슈 조회
   */
  async getIssue(issueKeyOrId: string, expand?: string[]): Promise<JiraIssue> {
    const params: any = {};
    if (expand && expand.length > 0) {
      params.expand = expand.join(',');
    }

    const response = await this.axios.get(`/issue/${issueKeyOrId}`, { params });
    return this.handleResponse<JiraIssue>(response);
  }

  // === 이슈 생성 및 수정 ===

  /**
   * 이슈 생성
   */
  async createIssue(request: JiraCreateIssueRequest): Promise<JiraCreateIssueResponse> {
    const response = await this.axios.post('/issue', request);
    return this.handleResponse<JiraCreateIssueResponse>(response);
  }

  /**
   * 옵션을 사용한 이슈 생성
   */
  async createIssueFromOptions(options: JiraIssueCreateOptions): Promise<JiraCreateIssueResponse> {
    const request = formatCreateIssueRequest(options);
    return this.createIssue(request);
  }

  /**
   * 이슈 업데이트
   */
  async updateIssue(issueKeyOrId: string, request: JiraUpdateIssueRequest): Promise<void> {
    const response = await this.axios.put(`/issue/${issueKeyOrId}`, request);
    await this.handleResponse<void>(response);
  }

  /**
   * 옵션을 사용한 이슈 업데이트
   */
  async updateIssueFromOptions(issueKeyOrId: string, options: JiraIssueUpdateOptions): Promise<void> {
    const request = formatUpdateIssueRequest(options);
    return this.updateIssue(issueKeyOrId, request);
  }

  /**
   * 이슈 삭제
   */
  async deleteIssue(issueKeyOrId: string): Promise<void> {
    const response = await this.axios.delete(`/issue/${issueKeyOrId}`);
    await this.handleResponse<void>(response);
  }

  // === 이슈 전환 (Transition) ===

  /**
   * 이슈 가능한 전환 조회
   */
  async getIssueTransitions(issueKeyOrId: string): Promise<JiraTransition[]> {
    const response = await this.axios.get(`/issue/${issueKeyOrId}/transitions`);
    const data = await this.handleResponse<{ transitions: JiraTransition[] }>(response);
    return data.transitions;
  }

  /**
   * 이슈 전환 실행
   */
  async transitionIssue(issueKeyOrId: string, request: JiraTransitionRequest): Promise<void> {
    const response = await this.axios.post(`/issue/${issueKeyOrId}/transitions`, request);
    await this.handleResponse<void>(response);
  }

  /**
   * 이슈 상태 변경 (간편 메서드)
   */
  async changeIssueStatus(issueKeyOrId: string, statusName: string): Promise<void> {
    const transitions = await this.getIssueTransitions(issueKeyOrId);
    const transition = transitions.find(t => 
      t.to.name.toLowerCase() === statusName.toLowerCase()
    );
    
    if (!transition) {
      throw new Error(`Transition to status '${statusName}' not available for issue ${issueKeyOrId}`);
    }

    await this.transitionIssue(issueKeyOrId, {
      transition: { id: transition.id }
    });
  }

  // === 댓글 관리 ===

  /**
   * 이슈 댓글 조회
   */
  async getIssueComments(issueKeyOrId: string): Promise<JiraComment[]> {
    const response = await this.axios.get(`/issue/${issueKeyOrId}/comment`);
    const data = await this.handleResponse<{ comments: JiraComment[] }>(response);
    return data.comments;
  }

  /**
   * 댓글 추가
   */
  async addComment(issueKeyOrId: string, body: string, visibility?: { type: string; value: string }): Promise<JiraComment> {
    const request: any = { body };
    if (visibility) {
      request.visibility = visibility;
    }

    const response = await this.axios.post(`/issue/${issueKeyOrId}/comment`, request);
    return this.handleResponse<JiraComment>(response);
  }

  /**
   * 댓글 업데이트
   */
  async updateComment(issueKeyOrId: string, commentId: string, body: string): Promise<JiraComment> {
    const response = await this.axios.put(`/issue/${issueKeyOrId}/comment/${commentId}`, { body });
    return this.handleResponse<JiraComment>(response);
  }

  /**
   * 댓글 삭제
   */
  async deleteComment(issueKeyOrId: string, commentId: string): Promise<void> {
    const response = await this.axios.delete(`/issue/${issueKeyOrId}/comment/${commentId}`);
    await this.handleResponse<void>(response);
  }

  // === 첨부파일 관리 ===

  /**
   * 이슈 첨부파일 조회
   */
  async getIssueAttachments(issueKeyOrId: string): Promise<JiraAttachment[]> {
    const issue = await this.getIssue(issueKeyOrId, ['attachment']);
    return issue.fields.attachment || [];
  }

  /**
   * 파일 첨부
   */
  async attachFile(issueKeyOrId: string, file: Buffer | string, filename: string): Promise<JiraAttachment[]> {
    const FormData = require('form-data');
    const form = new FormData();
    form.append('file', file, filename);

    const headers = {
      ...createFileUploadHeaders(this.config),
      ...form.getHeaders()
    };

    const response = await this.axios.post(`/issue/${issueKeyOrId}/attachments`, form, { headers });
    return this.handleResponse<JiraAttachment[]>(response);
  }

  /**
   * 첨부파일 삭제
   */
  async deleteAttachment(attachmentId: string): Promise<void> {
    const response = await this.axios.delete(`/attachment/${attachmentId}`);
    await this.handleResponse<void>(response);
  }

  // === 사용자 관리 ===

  /**
   * 사용자 검색
   */
  async searchUsers(query: string, maxResults: number = 50): Promise<JiraUser[]> {
    const response = await this.axios.get('/user/search', {
      params: { query, maxResults }
    });
    return this.handleResponse<JiraUser[]>(response);
  }

  /**
   * 사용자 정보 조회
   */
  async getUser(accountId: string): Promise<JiraUser> {
    const response = await this.axios.get('/user', { params: { accountId } });
    return this.handleResponse<JiraUser>(response);
  }

  // === 유틸리티 메서드 ===

  /**
   * 설정 업데이트
   */
  updateConfig(newConfig: Partial<JiraConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.baseUrl = normalizeJiraUrl(this.config.baseUrl);
    
    // 새로운 헤더로 axios 인스턴스 업데이트
    this.axios.defaults.headers = createJiraRequestHeaders(this.config);
    this.axios.defaults.baseURL = this.baseUrl;
    this.axios.defaults.timeout = this.config.timeout || 30000;
  }

  /**
   * 현재 설정 조회 (토큰은 마스킹)
   */
  getConfig(): Omit<JiraConfig, 'apiToken'> & { apiToken: string } {
    const { maskApiToken } = require('./utils/jira-auth');
    return {
      ...this.config,
      apiToken: maskApiToken(this.config.apiToken)
    };
  }

  /**
   * Base URL 조회
   */
  getBaseUrl(): string {
    return this.baseUrl;
  }

  /**
   * 연결 상태 확인
   */
  async isConnected(): Promise<boolean> {
    try {
      await this.getCurrentUser();
      return true;
    } catch {
      return false;
    }
  }
} 