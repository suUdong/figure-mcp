/**
 * Jira Integration Types
 * Jira API 응답과 요청에 대한 타입 정의
 */

export interface JiraConfig {
  baseUrl: string;
  username: string;
  apiToken: string;
  timeout?: number;
  maxRetries?: number;
}

export interface JiraUser {
  accountId: string;
  accountType: string;
  displayName: string;
  emailAddress?: string;
  avatarUrls: {
    '16x16': string;
    '24x24': string;
    '32x32': string;
    '48x48': string;
  };
  active: boolean;
  timeZone?: string;
  locale?: string;
}

export interface JiraProject {
  id: string;
  key: string;
  name: string;
  description?: string;
  lead?: JiraUser;
  projectTypeKey: string;
  avatarUrls: {
    '16x16': string;
    '24x24': string;
    '32x32': string;
    '48x48': string;
  };
  isPrivate: boolean;
  issueTypes?: JiraIssueType[];
}

export interface JiraIssueType {
  id: string;
  name: string;
  description: string;
  iconUrl: string;
  subtask: boolean;
  statuses?: JiraStatus[];
}

export interface JiraStatus {
  id: string;
  name: string;
  description: string;
  iconUrl: string;
  statusCategory: {
    id: number;
    key: string;
    colorName: string;
    name: string;
  };
}

export interface JiraPriority {
  id: string;
  name: string;
  description: string;
  iconUrl: string;
}

export interface JiraIssueFields {
  summary: string;
  description?: string;
  issuetype: {
    id: string;
  };
  project: {
    key: string;
  };
  reporter?: {
    accountId: string;
  };
  assignee?: {
    accountId: string;
  };
  priority?: {
    id: string;
  };
  labels?: string[];
  components?: Array<{ id: string }>;
  fixVersions?: Array<{ id: string }>;
  versions?: Array<{ id: string }>;
  duedate?: string;
  parent?: {
    key: string;
  };
  customfield_10000?: string; // Epic Link
  [key: string]: any; // 커스텀 필드들을 위한 인덱스 시그니처
}

export interface JiraIssue {
  id: string;
  key: string;
  self: string;
  fields: JiraIssueFields & {
    created: string;
    updated: string;
    status: JiraStatus;
    creator: JiraUser;
    reporter: JiraUser;
    assignee?: JiraUser;
    priority: JiraPriority;
    issuetype: JiraIssueType;
    project: JiraProject;
    resolution?: {
      id: string;
      name: string;
      description: string;
    };
    resolutiondate?: string;
    watches: {
      watchCount: number;
      isWatching: boolean;
    };
    votes: {
      votes: number;
      hasVoted: boolean;
    };
    comment: {
      total: number;
      comments: JiraComment[];
    };
    attachment: JiraAttachment[];
    subtasks: JiraIssue[];
    issuelinks: JiraIssueLink[];
    worklog: {
      total: number;
      worklogs: JiraWorklog[];
    };
  };
}

export interface JiraComment {
  id: string;
  author: JiraUser;
  body: string;
  updateAuthor: JiraUser;
  created: string;
  updated: string;
  visibility?: {
    type: string;
    value: string;
  };
}

export interface JiraAttachment {
  id: string;
  filename: string;
  author: JiraUser;
  created: string;
  size: number;
  mimeType: string;
  content: string;
  thumbnail?: string;
}

export interface JiraIssueLink {
  id: string;
  type: {
    id: string;
    name: string;
    inward: string;
    outward: string;
  };
  inwardIssue?: JiraIssue;
  outwardIssue?: JiraIssue;
}

export interface JiraWorklog {
  id: string;
  author: JiraUser;
  updateAuthor: JiraUser;
  comment?: string;
  created: string;
  updated: string;
  started: string;
  timeSpent: string;
  timeSpentSeconds: number;
  visibility?: {
    type: string;
    value: string;
  };
}

export interface JiraTransition {
  id: string;
  name: string;
  to: {
    id: string;
    name: string;
    statusCategory: {
      id: number;
      key: string;
      colorName: string;
      name: string;
    };
  };
  hasScreen: boolean;
  isGlobal: boolean;
  isInitial: boolean;
  isAvailable: boolean;
  isConditional: boolean;
  fields?: {
    [fieldId: string]: {
      required: boolean;
      schema: {
        type: string;
        system?: string;
        items?: string;
        custom?: string;
        customId?: number;
      };
      name: string;
      key: string;
      hasDefaultValue: boolean;
      operations: string[];
      allowedValues?: any[];
    };
  };
}

// API 요청/응답 인터페이스
export interface JiraSearchRequest {
  jql: string;
  startAt?: number;
  maxResults?: number;
  fields?: string[];
  expand?: string[];
  validateQuery?: boolean;
  fieldsByKeys?: boolean;
  properties?: string[];
}

export interface JiraSearchResponse {
  expand: string;
  startAt: number;
  maxResults: number;
  total: number;
  issues: JiraIssue[];
  warningMessages?: string[];
  names?: { [key: string]: string };
  schema?: { [key: string]: any };
}

export interface JiraCreateIssueRequest {
  fields: JiraIssueFields;
  update?: {
    [fieldId: string]: Array<{
      add?: any;
      set?: any;
      remove?: any;
    }>;
  };
  historyMetadata?: {
    type: string;
    description: string;
    descriptionKey: string;
    activityDescription: string;
    activityDescriptionKey: string;
    actor: {
      id: string;
      displayName: string;
      type: string;
      avatarUrl?: string;
      url?: string;
    };
    generator: {
      id: string;
      type: string;
    };
    cause: {
      id: string;
      type: string;
    };
    extraData: {
      [key: string]: string;
    };
  };
  properties?: Array<{
    key: string;
    value: any;
  }>;
}

export interface JiraCreateIssueResponse {
  id: string;
  key: string;
  self: string;
  transition?: {
    status: number;
    errorCollection: {
      errorMessages: string[];
      errors: { [key: string]: string };
    };
  };
}

export interface JiraUpdateIssueRequest {
  fields?: Partial<JiraIssueFields>;
  update?: {
    [fieldId: string]: Array<{
      add?: any;
      set?: any;
      remove?: any;
      edit?: any;
    }>;
  };
  historyMetadata?: any;
  properties?: Array<{
    key: string;
    value: any;
  }>;
}

export interface JiraTransitionRequest {
  transition: {
    id: string;
  };
  fields?: Partial<JiraIssueFields>;
  update?: {
    [fieldId: string]: Array<{
      add?: any;
      set?: any;
      remove?: any;
    }>;
  };
  historyMetadata?: any;
  properties?: Array<{
    key: string;
    value: any;
  }>;
}

export interface JiraErrorResponse {
  errorMessages: string[];
  errors: { [key: string]: string };
  status?: number;
}

// 이벤트 타입
export interface JiraWebhookEvent {
  timestamp: number;
  webhookEvent: string;
  user: JiraUser;
  issue?: JiraIssue;
  changelog?: {
    id: string;
    items: Array<{
      field: string;
      fieldtype: string;
      fieldId?: string;
      from?: string;
      fromString?: string;
      to?: string;
      toString?: string;
    }>;
  };
  comment?: JiraComment;
  worklog?: JiraWorklog;
}

// 클라이언트 옵션
export interface JiraClientOptions {
  retryDelay?: number;
  retryCount?: number;
  requestHeaders?: { [key: string]: string };
  agentOptions?: any;
}

// 필터 및 검색 옵션
export interface JiraSearchOptions {
  jql?: string;
  project?: string;
  issueType?: string;
  status?: string;
  assignee?: string;
  reporter?: string;
  priority?: string;
  labels?: string[];
  createdAfter?: Date;
  createdBefore?: Date;
  updatedAfter?: Date;
  updatedBefore?: Date;
  maxResults?: number;
  startAt?: number;
  orderBy?: string;
}

export interface JiraIssueCreateOptions {
  summary: string;
  description?: string;
  projectKey: string;
  issueTypeId: string;
  assigneeAccountId?: string;
  reporterAccountId?: string;
  priorityId?: string;
  labels?: string[];
  componentIds?: string[];
  fixVersionIds?: string[];
  affectedVersionIds?: string[];
  dueDate?: Date;
  parentKey?: string;
  epicLinkKey?: string;
  customFields?: { [key: string]: any };
}

export interface JiraIssueUpdateOptions {
  summary?: string;
  description?: string;
  assigneeAccountId?: string;
  priorityId?: string;
  labels?: string[];
  componentIds?: string[];
  fixVersionIds?: string[];
  affectedVersionIds?: string[];
  dueDate?: Date;
  customFields?: { [key: string]: any };
}

export type JiraIssueStatus = 'To Do' | 'In Progress' | 'Done' | 'Blocked' | 'In Review' | string;
export type JiraIssuePriority = 'Highest' | 'High' | 'Medium' | 'Low' | 'Lowest' | string;
export type JiraIssueTypeName = 'Bug' | 'Task' | 'Story' | 'Epic' | 'Subtask' | string; 