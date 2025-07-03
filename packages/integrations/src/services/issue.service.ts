/**
 * Jira Issue Service
 * 이슈 관련 비즈니스 로직을 담당하는 서비스
 */

import { JiraClient } from '../jira-client';
import {
  JiraIssue,
  JiraSearchOptions,
  JiraIssueCreateOptions,
  JiraIssueUpdateOptions,
  JiraIssueStatus,
  JiraIssuePriority
} from '../types/jira.types';
import { SimplifiedJiraIssue } from '../utils/jira-formatter';

export interface IssueStatistics {
  total: number;
  byStatus: Record<string, number>;
  byPriority: Record<string, number>;
  byIssueType: Record<string, number>;
  byAssignee: Record<string, number>;
  averageResolutionTime?: number; // days
  createdThisWeek: number;
  resolvedThisWeek: number;
}

export interface IssueFilters {
  projectKey?: string;
  assignee?: string;
  status?: JiraIssueStatus;
  priority?: JiraIssuePriority;
  labels?: string[];
  dateRange?: {
    from: Date;
    to: Date;
  };
  textSearch?: string;
}

/**
 * Jira 이슈 서비스
 */
export class JiraIssueService {
  constructor(private jiraClient: JiraClient) {}

  /**
   * 이슈 검색 (고급 필터링)
   */
  async searchIssuesAdvanced(filters: IssueFilters, maxResults: number = 100): Promise<SimplifiedJiraIssue[]> {
    const searchOptions: JiraSearchOptions = {
      maxResults,
      startAt: 0
    };

    // 필터 적용
    if (filters.projectKey) {
      searchOptions.project = filters.projectKey;
    }

    if (filters.assignee) {
      searchOptions.assignee = filters.assignee;
    }

    if (filters.status) {
      searchOptions.status = filters.status;
    }

    if (filters.priority) {
      searchOptions.priority = filters.priority;
    }

    if (filters.labels && filters.labels.length > 0) {
      searchOptions.labels = filters.labels;
    }

    if (filters.dateRange) {
      searchOptions.createdAfter = filters.dateRange.from;
      searchOptions.createdBefore = filters.dateRange.to;
    }

    // 텍스트 검색을 위한 커스텀 JQL
    if (filters.textSearch) {
      const textSearchJQL = `(summary ~ "${filters.textSearch}" OR description ~ "${filters.textSearch}")`;
      searchOptions.jql = textSearchJQL;
    }

    searchOptions.orderBy = 'updated DESC';

    return await this.jiraClient.searchSimplifiedIssues(searchOptions);
  }

  /**
   * 내가 담당한 이슈 조회
   */
  async getMyIssues(status?: JiraIssueStatus): Promise<SimplifiedJiraIssue[]> {
    const currentUser = await this.jiraClient.getCurrentUser();
    
    const filters: IssueFilters = {
      assignee: currentUser.accountId
    };

    if (status) {
      filters.status = status;
    }

    return await this.searchIssuesAdvanced(filters);
  }

  /**
   * 내가 생성한 이슈 조회
   */
  async getIssuesCreatedByMe(status?: JiraIssueStatus): Promise<SimplifiedJiraIssue[]> {
    const currentUser = await this.jiraClient.getCurrentUser();
    
    const searchOptions: JiraSearchOptions = {
      reporter: currentUser.accountId,
      maxResults: 100,
      orderBy: 'created DESC'
    };

    if (status) {
      searchOptions.status = status;
    }

    return await this.jiraClient.searchSimplifiedIssues(searchOptions);
  }

  /**
   * 최근 업데이트된 이슈 조회
   */
  async getRecentlyUpdatedIssues(days: number = 7, projectKey?: string): Promise<SimplifiedJiraIssue[]> {
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - days);

    const filters: IssueFilters = {
      dateRange: {
        from: fromDate,
        to: new Date()
      }
    };

    if (projectKey) {
      filters.projectKey = projectKey;
    }

    return await this.searchIssuesAdvanced(filters, 50);
  }

  /**
   * 긴급/높은 우선순위 이슈 조회
   */
  async getHighPriorityIssues(projectKey?: string): Promise<SimplifiedJiraIssue[]> {
    const filters: IssueFilters = {
      priority: 'High'
    };

    if (projectKey) {
      filters.projectKey = projectKey;
    }

    // High와 Highest 우선순위 이슈 모두 조회
    const highIssues = await this.searchIssuesAdvanced(filters, 50);
    
    filters.priority = 'Highest';
    const highestIssues = await this.searchIssuesAdvanced(filters, 50);

    return [...highestIssues, ...highIssues];
  }

  /**
   * 지연된 이슈 조회 (due date가 지난 이슈)
   */
  async getOverdueIssues(projectKey?: string): Promise<SimplifiedJiraIssue[]> {
    const today = new Date().toISOString().split('T')[0];
    
    let jql = `duedate < "${today}" AND resolution is EMPTY`;
    if (projectKey) {
      jql = `project = "${projectKey}" AND ${jql}`;
    }

    const searchOptions: JiraSearchOptions = {
      jql,
      maxResults: 100,
      orderBy: 'duedate ASC'
    };

    return await this.jiraClient.searchSimplifiedIssues(searchOptions);
  }

  /**
   * 미할당 이슈 조회
   */
  async getUnassignedIssues(projectKey?: string): Promise<SimplifiedJiraIssue[]> {
    const filters: IssueFilters = {
      assignee: 'unassigned'
    };

    if (projectKey) {
      filters.projectKey = projectKey;
    }

    return await this.searchIssuesAdvanced(filters);
  }

  /**
   * 이슈 통계 조회
   */
  async getIssueStatistics(projectKey?: string, days: number = 30): Promise<IssueStatistics> {
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - days);

    const filters: IssueFilters = {
      dateRange: {
        from: fromDate,
        to: new Date()
      }
    };

    if (projectKey) {
      filters.projectKey = projectKey;
    }

    const issues = await this.searchIssuesAdvanced(filters, 1000);

    // 통계 계산
    const stats: IssueStatistics = {
      total: issues.length,
      byStatus: {},
      byPriority: {},
      byIssueType: {},
      byAssignee: {},
      createdThisWeek: 0,
      resolvedThisWeek: 0
    };

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    let totalResolutionTime = 0;
    let resolvedIssuesCount = 0;

    issues.forEach(issue => {
      // 상태별 통계
      stats.byStatus[issue.status] = (stats.byStatus[issue.status] || 0) + 1;
      
      // 우선순위별 통계
      stats.byPriority[issue.priority] = (stats.byPriority[issue.priority] || 0) + 1;
      
      // 이슈 타입별 통계
      stats.byIssueType[issue.issueType] = (stats.byIssueType[issue.issueType] || 0) + 1;
      
      // 담당자별 통계
      const assignee = issue.assignee || '미할당';
      stats.byAssignee[assignee] = (stats.byAssignee[assignee] || 0) + 1;

      // 이번 주 생성된 이슈
      const createdDate = new Date(issue.created);
      if (createdDate >= oneWeekAgo) {
        stats.createdThisWeek++;
      }

      // 이번 주 해결된 이슈 및 해결 시간 계산
      if (issue.status.toLowerCase().includes('done') || issue.status.toLowerCase().includes('resolved')) {
        const updatedDate = new Date(issue.updated);
        if (updatedDate >= oneWeekAgo) {
          stats.resolvedThisWeek++;
        }

        // 해결 시간 계산 (생성일부터 업데이트일까지)
        const resolutionTime = (updatedDate.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24);
        totalResolutionTime += resolutionTime;
        resolvedIssuesCount++;
      }
    });

    // 평균 해결 시간 계산
    if (resolvedIssuesCount > 0) {
      stats.averageResolutionTime = Math.round(totalResolutionTime / resolvedIssuesCount * 100) / 100;
    }

    return stats;
  }

  /**
   * 빠른 이슈 생성
   */
  async createQuickIssue(
    projectKey: string,
    summary: string,
    issueType: 'Bug' | 'Task' | 'Story' = 'Task',
    assigneeAccountId?: string
  ): Promise<{ key: string; url: string }> {
    // 프로젝트 정보 조회
    const project = await this.jiraClient.getProject(projectKey);
    
    // 이슈 타입 ID 찾기
    const issueTypeObj = project.issueTypes?.find(
      type => type.name.toLowerCase() === issueType.toLowerCase()
    );
    
    if (!issueTypeObj) {
      throw new Error(`Issue type '${issueType}' not found in project ${projectKey}`);
    }

    const createOptions: JiraIssueCreateOptions = {
      summary,
      projectKey,
      issueTypeId: issueTypeObj.id,
      assigneeAccountId
    };

    const result = await this.jiraClient.createIssueFromOptions(createOptions);
    
    return {
      key: result.key,
      url: `${this.jiraClient.getBaseUrl().replace('/rest/api/3', '').replace('/rest/api/2', '')}/browse/${result.key}`
    };
  }

  /**
   * 이슈 상태 일괄 변경
   */
  async bulkChangeStatus(issueKeys: string[], newStatus: string): Promise<{ success: string[]; failed: Array<{ key: string; error: string }> }> {
    const results = {
      success: [] as string[],
      failed: [] as Array<{ key: string; error: string }>
    };

    for (const issueKey of issueKeys) {
      try {
        await this.jiraClient.changeIssueStatus(issueKey, newStatus);
        results.success.push(issueKey);
      } catch (error) {
        results.failed.push({
          key: issueKey,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return results;
  }

  /**
   * 이슈 일괄 할당
   */
  async bulkAssignIssues(issueKeys: string[], assigneeAccountId: string): Promise<{ success: string[]; failed: Array<{ key: string; error: string }> }> {
    const results = {
      success: [] as string[],
      failed: [] as Array<{ key: string; error: string }>
    };

    for (const issueKey of issueKeys) {
      try {
        await this.jiraClient.updateIssueFromOptions(issueKey, {
          assigneeAccountId
        });
        results.success.push(issueKey);
      } catch (error) {
        results.failed.push({
          key: issueKey,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return results;
  }

  /**
   * 이슈 복제
   */
  async cloneIssue(originalIssueKey: string, newSummary?: string): Promise<{ key: string; url: string }> {
    const originalIssue = await this.jiraClient.getIssue(originalIssueKey);
    
    const createOptions: JiraIssueCreateOptions = {
      summary: newSummary || `[CLONE] ${originalIssue.fields.summary}`,
      description: originalIssue.fields.description,
      projectKey: originalIssue.fields.project.key,
      issueTypeId: originalIssue.fields.issuetype.id,
      assigneeAccountId: originalIssue.fields.assignee?.accountId,
      priorityId: originalIssue.fields.priority.id,
      labels: originalIssue.fields.labels || []
    };

    const result = await this.jiraClient.createIssueFromOptions(createOptions);
    
    return {
      key: result.key,
      url: `${this.jiraClient.getBaseUrl().replace('/rest/api/3', '').replace('/rest/api/2', '')}/browse/${result.key}`
    };
  }
} 