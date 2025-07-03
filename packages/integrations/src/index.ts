/**
 * Jira Integration Module
 * Figure-MCP 시스템의 Jira 연동 모듈
 * 
 * @example
 * ```typescript
 * import { JiraClient, JiraIssueService } from '@figure-mcp/integrations';
 * 
 * const client = new JiraClient({
 *   baseUrl: 'https://your-domain.atlassian.net',
 *   username: 'your-email@company.com',
 *   apiToken: 'your-api-token'
 * });
 * 
 * const issueService = new JiraIssueService(client);
 * const myIssues = await issueService.getMyIssues();
 * ```
 */

// 메인 클라이언트
export { JiraClient } from './jira-client';

// 서비스 클래스들
export { JiraIssueService } from './services/issue.service';
export { JiraProjectService } from './services/project.service';

// 타입 정의들
export * from './types/jira.types';

// 유틸리티 함수들
export {
  createBasicAuthHeader,
  createJiraRequestHeaders,
  createFileUploadHeaders,
  validateJiraConfig,
  normalizeJiraUrl,
  maskApiToken,
  testJiraAuthentication,
  extractUsernameFromAccountId,
  validateRequiredPermissions
} from './utils/jira-auth';

export {
  JQLBuilder,
  formatCreateIssueRequest,
  formatUpdateIssueRequest,
  simplifyJiraIssue,
  formatJiraDate,
  formatJiraDateTime,
  parseJiraDate,
  escapeJQLString,
  formatTimeRange,
  getStatusColor,
  getPriorityIcon,
  getIssueTypeIcon,
  formatIssueAsMarkdown
} from './utils/jira-formatter';

// 서비스 관련 타입들
export type {
  IssueStatistics,
  IssueFilters,
  ProjectSummary,
  ProjectStatistics
} from './services/issue.service';

// 헬퍼 클래스 - 간편한 사용을 위한 통합 클래스
export class JiraIntegration {
  public client: JiraClient;
  public issues: JiraIssueService;
  public projects: JiraProjectService;

  constructor(config: import('./types/jira.types').JiraConfig) {
    this.client = new JiraClient(config);
    this.issues = new JiraIssueService(this.client);
    this.projects = new JiraProjectService(this.client);
  }

  /**
   * 연결 테스트
   */
  async testConnection() {
    return await this.client.testConnection();
  }

  /**
   * 현재 사용자 정보
   */
  async getCurrentUser() {
    return await this.client.getCurrentUser();
  }

  /**
   * 빠른 대시보드 데이터 조회
   */
  async getDashboardData(projectKey?: string) {
    const [
      myIssues,
      highPriorityIssues,
      recentIssues,
      overdueIssues,
      projectSummary
    ] = await Promise.all([
      this.issues.getMyIssues(),
      this.issues.getHighPriorityIssues(projectKey),
      this.issues.getRecentlyUpdatedIssues(7, projectKey),
      this.issues.getOverdueIssues(projectKey),
      projectKey ? this.projects.getProjectSummary(projectKey) : null
    ]);

    return {
      myIssues: myIssues.slice(0, 10), // 상위 10개만
      highPriorityIssues: highPriorityIssues.slice(0, 5),
      recentIssues: recentIssues.slice(0, 10),
      overdueIssues: overdueIssues.slice(0, 5),
      projectSummary
    };
  }

  /**
   * 프로젝트 리포트 생성
   */
  async generateProjectReport(projectKey: string, days: number = 30) {
    return await this.projects.generateProjectReport(projectKey, days);
  }

  /**
   * 설정 업데이트
   */
  updateConfig(newConfig: Partial<import('./types/jira.types').JiraConfig>) {
    this.client.updateConfig(newConfig);
  }
}

// 기본 export
export default JiraIntegration; 