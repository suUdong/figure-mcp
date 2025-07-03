/**
 * Jira Data Formatting Utilities
 * Jira API 응답 데이터 포맷팅과 변환 유틸리티
 */

import { 
  JiraIssue, 
  JiraIssueCreateOptions, 
  JiraIssueUpdateOptions,
  JiraSearchOptions,
  JiraIssueFields,
  JiraUpdateIssueRequest,
  JiraCreateIssueRequest
} from '../types/jira.types';

/**
 * JQL 쿼리 빌더
 */
export class JQLBuilder {
  private conditions: string[] = [];

  project(key: string): this {
    this.conditions.push(`project = "${key}"`);
    return this;
  }

  issueType(type: string): this {
    this.conditions.push(`issuetype = "${type}"`);
    return this;
  }

  status(status: string): this {
    this.conditions.push(`status = "${status}"`);
    return this;
  }

  assignee(accountId: string): this {
    if (accountId === 'unassigned') {
      this.conditions.push('assignee is EMPTY');
    } else {
      this.conditions.push(`assignee = "${accountId}"`);
    }
    return this;
  }

  reporter(accountId: string): this {
    this.conditions.push(`reporter = "${accountId}"`);
    return this;
  }

  priority(priority: string): this {
    this.conditions.push(`priority = "${priority}"`);
    return this;
  }

  labels(labels: string[]): this {
    const labelConditions = labels.map(label => `labels = "${label}"`);
    this.conditions.push(`(${labelConditions.join(' OR ')})`);
    return this;
  }

  createdAfter(date: Date): this {
    this.conditions.push(`created >= "${formatJiraDate(date)}"`);
    return this;
  }

  createdBefore(date: Date): this {
    this.conditions.push(`created <= "${formatJiraDate(date)}"`);
    return this;
  }

  updatedAfter(date: Date): this {
    this.conditions.push(`updated >= "${formatJiraDate(date)}"`);
    return this;
  }

  updatedBefore(date: Date): this {
    this.conditions.push(`updated <= "${formatJiraDate(date)}"`);
    return this;
  }

  text(searchText: string): this {
    this.conditions.push(`text ~ "${escapeJQLString(searchText)}"`);
    return this;
  }

  summary(searchText: string): this {
    this.conditions.push(`summary ~ "${escapeJQLString(searchText)}"`);
    return this;
  }

  description(searchText: string): this {
    this.conditions.push(`description ~ "${escapeJQLString(searchText)}"`);
    return this;
  }

  orderBy(field: string, direction: 'ASC' | 'DESC' = 'ASC'): this {
    this.conditions.push(`ORDER BY ${field} ${direction}`);
    return this;
  }

  and(): this {
    return this;
  }

  or(): this {
    if (this.conditions.length > 0) {
      const lastCondition = this.conditions.pop()!;
      this.conditions.push(`OR ${lastCondition}`);
    }
    return this;
  }

  build(): string {
    return this.conditions.join(' AND ');
  }

  static fromOptions(options: JiraSearchOptions): string {
    const builder = new JQLBuilder();

    if (options.project) builder.project(options.project);
    if (options.issueType) builder.issueType(options.issueType);
    if (options.status) builder.status(options.status);
    if (options.assignee) builder.assignee(options.assignee);
    if (options.reporter) builder.reporter(options.reporter);
    if (options.priority) builder.priority(options.priority);
    if (options.labels && options.labels.length > 0) builder.labels(options.labels);
    if (options.createdAfter) builder.createdAfter(options.createdAfter);
    if (options.createdBefore) builder.createdBefore(options.createdBefore);
    if (options.updatedAfter) builder.updatedAfter(options.updatedAfter);
    if (options.updatedBefore) builder.updatedBefore(options.updatedBefore);

    if (options.orderBy) {
      const [field, direction] = options.orderBy.split(' ');
      builder.orderBy(field, (direction?.toUpperCase() as 'ASC' | 'DESC') || 'ASC');
    }

    let jql = builder.build();
    
    // 커스텀 JQL이 있으면 AND로 결합
    if (options.jql) {
      jql = jql ? `(${jql}) AND (${options.jql})` : options.jql;
    }

    return jql;
  }
}

/**
 * 이슈 생성 옵션을 Jira API 요청으로 변환
 */
export function formatCreateIssueRequest(options: JiraIssueCreateOptions): JiraCreateIssueRequest {
  const fields: JiraIssueFields = {
    summary: options.summary,
    project: { key: options.projectKey },
    issuetype: { id: options.issueTypeId }
  };

  if (options.description) {
    fields.description = options.description;
  }

  if (options.assigneeAccountId) {
    fields.assignee = { accountId: options.assigneeAccountId };
  }

  if (options.reporterAccountId) {
    fields.reporter = { accountId: options.reporterAccountId };
  }

  if (options.priorityId) {
    fields.priority = { id: options.priorityId };
  }

  if (options.labels && options.labels.length > 0) {
    fields.labels = options.labels;
  }

  if (options.componentIds && options.componentIds.length > 0) {
    fields.components = options.componentIds.map(id => ({ id }));
  }

  if (options.fixVersionIds && options.fixVersionIds.length > 0) {
    fields.fixVersions = options.fixVersionIds.map(id => ({ id }));
  }

  if (options.affectedVersionIds && options.affectedVersionIds.length > 0) {
    fields.versions = options.affectedVersionIds.map(id => ({ id }));
  }

  if (options.dueDate) {
    fields.duedate = formatJiraDate(options.dueDate);
  }

  if (options.parentKey) {
    fields.parent = { key: options.parentKey };
  }

  if (options.epicLinkKey) {
    fields.customfield_10000 = options.epicLinkKey; // Epic Link 필드
  }

  // 커스텀 필드 추가
  if (options.customFields) {
    Object.assign(fields, options.customFields);
  }

  return { fields };
}

/**
 * 이슈 업데이트 옵션을 Jira API 요청으로 변환
 */
export function formatUpdateIssueRequest(options: JiraIssueUpdateOptions): JiraUpdateIssueRequest {
  const fields: Partial<JiraIssueFields> = {};

  if (options.summary !== undefined) {
    fields.summary = options.summary;
  }

  if (options.description !== undefined) {
    fields.description = options.description;
  }

  if (options.assigneeAccountId !== undefined) {
    fields.assignee = options.assigneeAccountId ? { accountId: options.assigneeAccountId } : undefined;
  }

  if (options.priorityId !== undefined) {
    fields.priority = { id: options.priorityId };
  }

  if (options.labels !== undefined) {
    fields.labels = options.labels;
  }

  if (options.componentIds !== undefined) {
    fields.components = options.componentIds.map(id => ({ id }));
  }

  if (options.fixVersionIds !== undefined) {
    fields.fixVersions = options.fixVersionIds.map(id => ({ id }));
  }

  if (options.affectedVersionIds !== undefined) {
    fields.versions = options.affectedVersionIds.map(id => ({ id }));
  }

  if (options.dueDate !== undefined) {
    fields.duedate = options.dueDate ? formatJiraDate(options.dueDate) : undefined;
  }

  // 커스텀 필드 추가
  if (options.customFields) {
    Object.assign(fields, options.customFields);
  }

  return { fields };
}

/**
 * Jira 이슈를 간소화된 형태로 변환
 */
export interface SimplifiedJiraIssue {
  key: string;
  summary: string;
  description?: string;
  status: string;
  priority: string;
  issueType: string;
  project: string;
  assignee?: string;
  reporter: string;
  created: string;
  updated: string;
  labels: string[];
  url: string;
}

export function simplifyJiraIssue(issue: JiraIssue, baseUrl: string): SimplifiedJiraIssue {
  return {
    key: issue.key,
    summary: issue.fields.summary,
    description: issue.fields.description,
    status: issue.fields.status.name,
    priority: issue.fields.priority.name,
    issueType: issue.fields.issuetype.name,
    project: issue.fields.project.name,
    assignee: issue.fields.assignee?.displayName,
    reporter: issue.fields.reporter.displayName,
    created: issue.fields.created,
    updated: issue.fields.updated,
    labels: issue.fields.labels || [],
    url: `${baseUrl.replace('/rest/api/3', '').replace('/rest/api/2', '')}/browse/${issue.key}`
  };
}

/**
 * Jira 날짜 형식으로 변환
 */
export function formatJiraDate(date: Date): string {
  return date.toISOString().split('T')[0]; // YYYY-MM-DD 형식
}

/**
 * Jira 날짜시간 형식으로 변환
 */
export function formatJiraDateTime(date: Date): string {
  return date.toISOString(); // ISO 8601 형식
}

/**
 * Jira 날짜를 JavaScript Date로 변환
 */
export function parseJiraDate(dateString: string): Date {
  return new Date(dateString);
}

/**
 * JQL 문자열 이스케이프
 */
export function escapeJQLString(text: string): string {
  return text
    .replace(/\\/g, '\\\\') // 백슬래시
    .replace(/"/g, '\\"')   // 따옴표
    .replace(/'/g, "\\'")   // 단일 따옴표
    .replace(/\n/g, '\\n')  // 줄바꿈
    .replace(/\r/g, '\\r')  // 캐리지 리턴
    .replace(/\t/g, '\\t'); // 탭
}

/**
 * 시간 범위를 JQL 형식으로 변환
 */
export function formatTimeRange(amount: number, unit: 'minutes' | 'hours' | 'days' | 'weeks' | 'months'): string {
  const unitMap = {
    minutes: 'm',
    hours: 'h', 
    days: 'd',
    weeks: 'w',
    months: 'M'
  };
  
  return `${amount}${unitMap[unit]}`;
}

/**
 * 이슈 상태를 색상 코드로 매핑
 */
export function getStatusColor(statusCategory: string): string {
  const colorMap: Record<string, string> = {
    'new': '#42526E',        // 블루-그레이
    'indeterminate': '#0052CC', // 블루
    'done': '#00875A'        // 그린
  };
  
  return colorMap[statusCategory.toLowerCase()] || '#42526E';
}

/**
 * 우선순위를 아이콘으로 매핑
 */
export function getPriorityIcon(priority: string): string {
  const iconMap: Record<string, string> = {
    'highest': '🔴',
    'high': '🟠', 
    'medium': '🟡',
    'low': '🔵',
    'lowest': '⚪'
  };
  
  return iconMap[priority.toLowerCase()] || '⚪';
}

/**
 * 이슈 타입을 아이콘으로 매핑
 */
export function getIssueTypeIcon(issueType: string): string {
  const iconMap: Record<string, string> = {
    'bug': '🐛',
    'task': '📋',
    'story': '📖',
    'epic': '🎯',
    'subtask': '📝',
    'improvement': '✨',
    'new feature': '🆕'
  };
  
  return iconMap[issueType.toLowerCase()] || '📋';
}

/**
 * 마크다운 형식으로 이슈 요약 생성
 */
export function formatIssueAsMarkdown(issue: SimplifiedJiraIssue): string {
  const priorityIcon = getPriorityIcon(issue.priority);
  const typeIcon = getIssueTypeIcon(issue.issueType);
  
  return `## ${typeIcon} [${issue.key}](${issue.url}) ${issue.summary}

**상태:** ${issue.status}  
**우선순위:** ${priorityIcon} ${issue.priority}  
**담당자:** ${issue.assignee || '미할당'}  
**프로젝트:** ${issue.project}  
**생성일:** ${new Date(issue.created).toLocaleDateString('ko-KR')}  
**업데이트:** ${new Date(issue.updated).toLocaleDateString('ko-KR')}  

${issue.description ? `**설명:**\n${issue.description}\n` : ''}

${issue.labels.length > 0 ? `**라벨:** ${issue.labels.map(l => `\`${l}\``).join(', ')}\n` : ''}
`;
} 