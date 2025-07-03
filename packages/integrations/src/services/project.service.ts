/**
 * Jira Project Service
 * 프로젝트 관련 비즈니스 로직을 담당하는 서비스
 */

import { JiraClient } from '../jira-client';
import { JiraProject, JiraIssueType, JiraUser } from '../types/jira.types';

export interface ProjectSummary {
  key: string;
  name: string;
  description?: string;
  lead?: string;
  issueCount: number;
  openIssueCount: number;
  closedIssueCount: number;
  lastUpdated: string;
  issueTypes: string[];
  teamMembers: number;
}

export interface ProjectStatistics {
  totalIssues: number;
  openIssues: number;
  inProgressIssues: number;
  doneIssues: number;
  issuesByType: Record<string, number>;
  issuesByPriority: Record<string, number>;
  averageTimeToClose?: number; // days
  burndownData?: Array<{
    date: string;
    remaining: number;
    completed: number;
  }>;
}

/**
 * Jira 프로젝트 서비스
 */
export class JiraProjectService {
  constructor(private jiraClient: JiraClient) {}

  /**
   * 모든 프로젝트 목록 조회
   */
  async getAllProjects(): Promise<JiraProject[]> {
    return await this.jiraClient.getProjects();
  }

  /**
   * 프로젝트 요약 정보 조회
   */
  async getProjectSummaries(): Promise<ProjectSummary[]> {
    const projects = await this.jiraClient.getProjects();
    const summaries: ProjectSummary[] = [];

    for (const project of projects) {
      try {
        const summary = await this.getProjectSummary(project.key);
        summaries.push(summary);
      } catch (error) {
        // 접근 권한이 없는 프로젝트는 기본 정보만 포함
        summaries.push({
          key: project.key,
          name: project.name,
          description: project.description,
          lead: project.lead?.displayName,
          issueCount: 0,
          openIssueCount: 0,
          closedIssueCount: 0,
          lastUpdated: new Date().toISOString(),
          issueTypes: project.issueTypes?.map(type => type.name) || [],
          teamMembers: 0
        });
      }
    }

    return summaries;
  }

  /**
   * 특정 프로젝트 요약 정보 조회
   */
  async getProjectSummary(projectKey: string): Promise<ProjectSummary> {
    const project = await this.jiraClient.getProject(projectKey);

    // 프로젝트의 모든 이슈 통계 조회
    const allIssuesResponse = await this.jiraClient.searchIssues({
      jql: `project = "${projectKey}"`,
      maxResults: 0, // 개수만 필요
      fields: []
    });

    const openIssuesResponse = await this.jiraClient.searchIssues({
      jql: `project = "${projectKey}" AND resolution is EMPTY`,
      maxResults: 0,
      fields: []
    });

    const closedIssuesResponse = await this.jiraClient.searchIssues({
      jql: `project = "${projectKey}" AND resolution is not EMPTY`,
      maxResults: 0,
      fields: []
    });

    // 최근 업데이트된 이슈의 날짜 조회
    const recentIssueResponse = await this.jiraClient.searchIssues({
      jql: `project = "${projectKey}" ORDER BY updated DESC`,
      maxResults: 1,
      fields: ['updated']
    });

    // 프로젝트 팀 멤버 수 추정 (최근 활동한 사용자 수)
    const activeUsersResponse = await this.jiraClient.searchIssues({
      jql: `project = "${projectKey}" AND updated >= -30d`,
      maxResults: 1000,
      fields: ['assignee', 'reporter']
    });

    const uniqueUsers = new Set<string>();
    for (const issue of activeUsersResponse.issues) {
      if (issue.fields.assignee) {
        uniqueUsers.add(issue.fields.assignee.accountId);
      }
      if (issue.fields.reporter) {
        uniqueUsers.add(issue.fields.reporter.accountId);
      }
    }

    return {
      key: project.key,
      name: project.name,
      description: project.description,
      lead: project.lead?.displayName,
      issueCount: allIssuesResponse.total,
      openIssueCount: openIssuesResponse.total,
      closedIssueCount: closedIssuesResponse.total,
      lastUpdated: recentIssueResponse.issues[0]?.fields.updated || new Date().toISOString(),
      issueTypes: project.issueTypes?.map(type => type.name) || [],
      teamMembers: uniqueUsers.size
    };
  }

  /**
   * 프로젝트 상세 통계 조회
   */
  async getProjectStatistics(projectKey: string, days: number = 30): Promise<ProjectStatistics> {
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - days);
    const fromDateStr = fromDate.toISOString().split('T')[0];

    // 전체 이슈 통계
    const allIssuesResponse = await this.jiraClient.searchIssues({
      jql: `project = "${projectKey}" AND created >= "${fromDateStr}"`,
      maxResults: 1000,
      fields: ['status', 'issuetype', 'priority', 'created', 'updated', 'resolution', 'resolutiondate']
    });

    const stats: ProjectStatistics = {
      totalIssues: allIssuesResponse.total,
      openIssues: 0,
      inProgressIssues: 0,
      doneIssues: 0,
      issuesByType: {},
      issuesByPriority: {},
      burndownData: []
    };

    let totalResolutionTime = 0;
    let resolvedIssuesCount = 0;

    // 일별 번다운 데이터 생성
    const burndownMap = new Map<string, { remaining: number; completed: number }>();
    for (let i = 0; i <= days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      burndownMap.set(dateStr, { remaining: 0, completed: 0 });
    }

    // 이슈 분석
    for (const issue of allIssuesResponse.issues) {
      const status = issue.fields.status;
      const statusCategory = status.statusCategory.key;

      // 상태별 분류
      switch (statusCategory) {
        case 'new':
          stats.openIssues++;
          break;
        case 'indeterminate':
          stats.inProgressIssues++;
          break;
        case 'done':
          stats.doneIssues++;
          break;
      }

      // 이슈 타입별 통계
      const issueType = issue.fields.issuetype.name;
      stats.issuesByType[issueType] = (stats.issuesByType[issueType] || 0) + 1;

      // 우선순위별 통계
      const priority = issue.fields.priority.name;
      stats.issuesByPriority[priority] = (stats.issuesByPriority[priority] || 0) + 1;

      // 해결 시간 계산
      if (issue.fields.resolution && issue.fields.resolutiondate) {
        const createdDate = new Date(issue.fields.created);
        const resolvedDate = new Date(issue.fields.resolutiondate);
        const resolutionTime = (resolvedDate.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24);
        totalResolutionTime += resolutionTime;
        resolvedIssuesCount++;
      }

      // 번다운 데이터 업데이트
      const createdDate = issue.fields.created.split('T')[0];
      if (burndownMap.has(createdDate)) {
        const data = burndownMap.get(createdDate)!;
        if (statusCategory === 'done') {
          data.completed++;
        } else {
          data.remaining++;
        }
      }
    }

    // 평균 해결 시간 계산
    if (resolvedIssuesCount > 0) {
      stats.averageTimeToClose = Math.round(totalResolutionTime / resolvedIssuesCount * 100) / 100;
    }

    // 번다운 데이터 정렬
    stats.burndownData = Array.from(burndownMap.entries())
      .map(([date, data]) => ({
        date,
        remaining: data.remaining,
        completed: data.completed
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return stats;
  }

  /**
   * 프로젝트의 이슈 타입 조회
   */
  async getProjectIssueTypes(projectKey: string): Promise<JiraIssueType[]> {
    const project = await this.jiraClient.getProject(projectKey);
    return project.issueTypes || [];
  }

  /**
   * 프로젝트 팀 멤버 조회
   */
  async getProjectTeamMembers(projectKey: string, days: number = 30): Promise<JiraUser[]> {
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - days);
    const fromDateStr = fromDate.toISOString().split('T')[0];

    // 최근 활동한 사용자들의 이슈 조회
    const issuesResponse = await this.jiraClient.searchIssues({
      jql: `project = "${projectKey}" AND updated >= "${fromDateStr}"`,
      maxResults: 1000,
      fields: ['assignee', 'reporter']
    });

    const userAccountIds = new Set<string>();
    
    for (const issue of issuesResponse.issues) {
      if (issue.fields.assignee) {
        userAccountIds.add(issue.fields.assignee.accountId);
      }
      if (issue.fields.reporter) {
        userAccountIds.add(issue.fields.reporter.accountId);
      }
    }

    // 사용자 정보 조회
    const teamMembers: JiraUser[] = [];
    for (const accountId of userAccountIds) {
      try {
        const user = await this.jiraClient.getUser(accountId);
        teamMembers.push(user);
      } catch (error) {
        // 사용자 정보 조회 실패시 스킵
        console.warn(`Failed to fetch user info for ${accountId}:`, error);
      }
    }

    return teamMembers.sort((a, b) => a.displayName.localeCompare(b.displayName));
  }

  /**
   * 내가 참여 중인 프로젝트 조회
   */
  async getMyProjects(): Promise<ProjectSummary[]> {
    const currentUser = await this.jiraClient.getCurrentUser();
    const allProjects = await this.getProjectSummaries();
    
    // 내가 참여한 프로젝트 필터링 (최근 30일간 활동 기준)
    const myProjects: ProjectSummary[] = [];
    
    for (const project of allProjects) {
      try {
        const myIssuesResponse = await this.jiraClient.searchIssues({
          jql: `project = "${project.key}" AND (assignee = "${currentUser.accountId}" OR reporter = "${currentUser.accountId}") AND updated >= -30d`,
          maxResults: 1,
          fields: []
        });
        
        if (myIssuesResponse.total > 0) {
          myProjects.push(project);
        }
      } catch (error) {
        // 접근 권한이 없는 프로젝트는 스킵
        continue;
      }
    }
    
    return myProjects;
  }

  /**
   * 프로젝트별 성과 리포트 생성
   */
  async generateProjectReport(projectKey: string, days: number = 30): Promise<string> {
    const project = await this.jiraClient.getProject(projectKey);
    const summary = await this.getProjectSummary(projectKey);
    const statistics = await this.getProjectStatistics(projectKey, days);
    const teamMembers = await this.getProjectTeamMembers(projectKey, days);

    const report = `# ${project.name} 프로젝트 리포트

## 📊 프로젝트 개요
- **프로젝트 키**: ${project.key}
- **리더**: ${summary.lead || '미정'}
- **팀 멤버**: ${teamMembers.length}명
- **전체 이슈**: ${summary.issueCount}개

## 📈 최근 ${days}일 통계
- **신규 이슈**: ${statistics.totalIssues}개
- **진행 중**: ${statistics.inProgressIssues}개
- **완료**: ${statistics.doneIssues}개
- **미해결**: ${statistics.openIssues}개

${statistics.averageTimeToClose ? `- **평균 해결 시간**: ${statistics.averageTimeToClose}일` : ''}

## 🎯 이슈 타입별 분포
${Object.entries(statistics.issuesByType)
  .map(([type, count]) => `- **${type}**: ${count}개`)
  .join('\n')}

## ⚡ 우선순위별 분포
${Object.entries(statistics.issuesByPriority)
  .map(([priority, count]) => `- **${priority}**: ${count}개`)
  .join('\n')}

## 👥 팀 멤버
${teamMembers.map(member => `- ${member.displayName} (${member.emailAddress})`).join('\n')}

## 📅 번다운 차트 데이터
${statistics.burndownData?.slice(-7).map(data => 
  `- ${data.date}: 완료 ${data.completed}개, 남은 작업 ${data.remaining}개`
).join('\n') || '데이터 없음'}

---
*리포트 생성일: ${new Date().toLocaleDateString('ko-KR')}*
`;

    return report;
  }
} 