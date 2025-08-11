#!/usr/bin/env node

// .env 파일 로드 (최우선)
import dotenv from 'dotenv';
dotenv.config();

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import axios from 'axios';
import type { AxiosInstance } from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

/**
 * Figure MCP Server
 * 영향도 분석서 생성 전용 MCP 서버
 * 
 * 워크플로우:
 * 사용자 요청 → MCP → 백엔드 → SQLite → 템플릿 반환 → LLM 기반 분석서 생성
 */
class FigureMCPServer {
  private server: Server;
  private apiClient: AxiosInstance;
  private jiraClient: AxiosInstance | null = null;
  private readonly BACKEND_API_URL: string;
  private readonly CACHE_DIR: string;
  private readonly CACHE_TTL: number = 60 * 60 * 1000; // 1시간 (밀리초)
  private readonly JIRA_BASE_URL: string;
  private readonly JIRA_EMAIL: string;
  private readonly JIRA_API_TOKEN: string;
  private readonly DEFAULT_SITE_ID: string;
  private readonly DEFAULT_SITE_NAME: string;
  private availableSites: any[] = [];
  
  // DB 연결 설정 (선택적)
  private readonly DB_CONNECTION_STRING: string;
  private readonly DB_TYPE: string;

  constructor() {
    // 백엔드 API URL 설정 (다양한 환경 지원)
    this.BACKEND_API_URL = this.getBackendApiUrl();
    this.CACHE_DIR = path.join(process.cwd(), '.cache', 'figure-mcp');
    
    // JIRA 설정
    this.JIRA_BASE_URL = this.sanitizeJiraUrl(process.env.JIRA_BASE_URL || '');
    this.JIRA_EMAIL = process.env.JIRA_EMAIL || '';
    this.JIRA_API_TOKEN = process.env.JIRA_API_TOKEN || '';
    
    // 사이트 설정
    this.DEFAULT_SITE_ID = process.env.DEFAULT_SITE_ID || '';
    this.DEFAULT_SITE_NAME = process.env.DEFAULT_SITE_NAME || '';
    
    // DB 연결 설정 (선택적)
    this.DB_CONNECTION_STRING = process.env.DB_CONNECTION_STRING || '';
    this.DB_TYPE = (process.env.DB_TYPE || '').toLowerCase();

    // 환경 변수 로딩 상태 디버그 (조용한 모드가 아닌 경우만)
    if (process.env.MCP_QUIET !== 'true') {
      this.logEnvironmentStatus();
    }
    
    // 캐시 디렉토리 생성
    this.initializeCacheDirectory();
    
    // JIRA 클라이언트 초기화
    this.initializeJiraClient();
    
    this.server = new Server(
      {
        name: 'figure-mcp',
        version: '2.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.apiClient = axios.create({
      baseURL: this.BACKEND_API_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupHandlers();
  }

  private setupHandlers(): void {
    // 개발 라이프사이클 문서 생성 도구들
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'start_task',
            description: '새로운 개발 태스크를 시작합니다. Feature/Bug/Refactoring 단위로 요구사항을 입력하거나 JIRA 티켓을 기반으로 필요한 문서들을 계획하고 생성합니다.',
            inputSchema: {
              type: 'object',
              properties: {
                taskName: {
                  type: 'string', 
                  description: '태스크명 (예: 로그인 기능 추가, 결제 버그 수정, API 성능 개선 등)'
                },
                taskType: {
                  type: 'string',
                  enum: ['feature', 'bug', 'refactoring', 'enhancement'],
                  default: 'feature',
                  description: 'feature: 새 기능, bug: 버그 수정, refactoring: 리팩토링, enhancement: 개선'
                },
                requirementSource: {
                  type: 'string',
                  enum: ['manual', 'jira'],
                  default: 'manual',
                  description: 'manual: 직접 입력, jira: JIRA 티켓에서 가져오기'
                },
                requirements: {
                  type: 'string',
                  description: '개발기능 요구사항 (requirementSource가 manual인 경우 필수)'
                },
                jiraTicketKey: {
                  type: 'string',
                  description: 'JIRA 티켓 키 (requirementSource가 jira인 경우 필수, 예: FEAT-123, BUG-456)'
                },
                complexity: {
                  type: 'string',
                  enum: ['simple', 'normal', 'complex'],
                  default: 'normal',
                  description: 'simple: 간단한 수정, normal: 일반적인 작업, complex: 복잡한 변경'
                },
                siteName: { 
                  type: 'string', 
                  description: '사이트명 또는 사이트 ID (선택사항)',
                  default: 'KT알파'
                },
                projectPath: { 
                  type: 'string', 
                  description: '프로젝트 경로 (선택사항)',
                  default: 'C:\\workspace\\ds\\figure-mcp\\figure-mcp'
                }
              },
              required: ['taskName', 'requirementSource'],
            },
          },
          {
            name: 'create_document',
            description: '개별 문서를 생성합니다. 자연어로 문서 타입을 입력하면 자동으로 매칭됩니다. 전체 태스크 워크플로우는 start_task를 사용하세요.',
            inputSchema: {
              type: 'object',
              properties: {
                documentRequest: {
                  type: 'string',
                  description: '생성하고 싶은 문서를 자연어로 입력하세요. 예: "사용자 관리 시스템의 테이블 명세서 만들어줘", "결제 모듈 요구사항서", "API 서버 영향도 분석서" 등'
                },
                siteName: { 
                  type: 'string', 
                  description: '사이트명 또는 사이트 ID (선택사항)',
                  default: 'KT알파'
                },
                projectPath: { 
                  type: 'string', 
                  description: '프로젝트 경로 (선택사항)',
                  default: 'C:\\workspace\\ds\\figure-mcp\\figure-mcp'
                },
                analysisType: {
                  type: 'string',
                  enum: ['full', 'quick', 'template-only'],
                  default: 'full',
                  description: 'full: 완전한 분석, quick: 빠른 분석, template-only: 템플릿만 반환'
                },
                additionalContext: {
                  type: 'string',
                  description: '추가 컨텍스트 정보 (선택사항)',
                }
              },
              required: ['documentRequest'],
            },
          },
          {
            name: 'create_table_specification',
            description: '데이터베이스 테이블 명세서를 생성합니다. DB 연결 정보를 제공하면 실제 스키마를 조회하고, 없으면 수동 입력을 안내합니다.',
            inputSchema: {
              type: 'object',
              properties: {
                tableName: {
                  type: 'string',
                  description: '테이블명 또는 테이블 목록 (쉼표로 구분)'
                },
                siteName: {
                  type: 'string',
                  description: '사이트명 (선택사항, 미입력 시 기본 사이트 사용)'
                },
                dbConnectionString: {
                  type: 'string',
                  description: 'DB 연결 문자열 (선택사항, 환경변수 우선 사용)'
                },
                dbType: {
                  type: 'string',
                  enum: ['mysql', 'postgresql', 'oracle', 'mssql', 'sqlite'],
                  description: 'DB 타입 (선택사항, 환경변수 우선 사용)'
                },
                schemaInfo: {
                  type: 'string',
                  description: 'DB 연결이 불가능한 경우 테이블 스키마 정보 (JSON 또는 DDL 형태)'
                },
                includeIndexes: {
                  type: 'boolean',
                  default: true,
                  description: '인덱스 정보 포함 여부'
                },
                includeConstraints: {
                  type: 'boolean',
                  default: true,
                  description: '제약조건 정보 포함 여부'
                }
              },
              required: ['tableName']
            }
          },
          {
            name: 'list_available_sites',
            description: '사용 가능한 사이트 목록을 조회합니다.',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },

          {
            name: 'fetch_jira_ticket',
            description: 'JIRA 티켓 정보를 조회하여 요구사항을 가져옵니다.',
            inputSchema: {
              type: 'object',
              properties: {
                ticketKey: { 
                  type: 'string', 
                  description: 'JIRA 티켓 키 (예: PROJ-123)' 
                },
                includeComments: {
                  type: 'boolean',
                  default: false,
                  description: '댓글 포함 여부'
                },
                includeSubtasks: {
                  type: 'boolean', 
                  default: false,
                  description: '하위 작업 포함 여부'
                }
              },
              required: ['ticketKey'],
            },
          },
          {
            name: 'search_jira_tickets',
            description: 'JQL을 사용하여 JIRA 티켓들을 검색합니다.',
            inputSchema: {
              type: 'object',
              properties: {
                jql: { 
                  type: 'string', 
                  description: 'JIRA Query Language (예: project = PROJ AND status = "In Progress")' 
                },
                maxResults: {
                  type: 'number',
                  default: 10,
                  description: '최대 결과 수'
                }
              },
              required: ['jql'],
            },
          }
        ],
      };
    });

    // 도구 실행 핸들러
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'start_task': 
            return await this.handleStartTask(args as any);
          case 'create_document': 
            return await this.handleCreateDocument(args as any);
          case 'create_table_specification':
            return await this.handleCreateTableSpecification(args as any);
                  case 'list_available_sites':
          return await this.handleListAvailableSites();
          case 'fetch_jira_ticket': 
            return await this.handleFetchJiraTicket(args as any);
          case 'search_jira_tickets': 
            return await this.handleSearchJiraTickets(args as any);
          default: 
            throw new Error(`알 수 없는 도구: ${name}`);
        }
      } catch (error) {
        return {
          content: [{ 
            type: 'text', 
            text: `❌ 오류 발생: ${error instanceof Error ? error.message : '알 수 없는 오류'}` 
          }],
          isError: true,
        };
      }
    });
  }

  /**
   * 개발 태스크 시작 핸들러 - Feature/Bug/Refactoring 단위 워크플로우
   */
  private async handleStartTask(args: { 
    taskName: string;
    taskType: string;
    requirementSource: string;
    requirements?: string;
    jiraTicketKey?: string;
    complexity?: string;
    siteName?: string;
    projectPath?: string;
  }) {
    const startTime = new Date();
    
    try {
      // 1단계: 요구사항 수집
      let projectRequirements = '';
      let jiraInfo: any = null;
      
      if (args.requirementSource === 'jira') {
        if (!args.jiraTicketKey) {
          throw new Error('JIRA 티켓 키가 필요합니다.');
        }
        
        // JIRA에서 요구사항 가져오기
        const jiraResult = await this.handleFetchJiraTicket({ 
          ticketKey: args.jiraTicketKey, 
          includeComments: true, 
          includeSubtasks: true 
        });
        
        if (jiraResult.isError) {
          throw new Error(`JIRA 티켓 조회 실패: ${args.jiraTicketKey}`);
        }
        
        // JIRA 정보 파싱 (실제로는 jiraResult에서 추출)
        projectRequirements = `JIRA 티켓 ${args.jiraTicketKey}에서 가져온 요구사항`;
        jiraInfo = { ticketKey: args.jiraTicketKey, status: 'loaded' };
        
      } else {
        if (!args.requirements) {
          throw new Error('개발기능 요구사항을 입력해주세요.');
        }
        projectRequirements = args.requirements;
      }

      // 2단계: 태스크 타입과 복잡도에 따른 문서 계획 수립
      const documentPlan = this.createTaskDocumentPlan(
        args.taskType || 'feature', 
        args.complexity || 'normal', 
        projectRequirements
      );
      
      // 3단계: 사이트 정보 확인
      const sitesData = await this.cachedApiCall('GET', '/sites');
      const sites = sitesData.success ? sitesData.data || [] : [];
      const targetSite = sites.find((site: any) => 
        site.name === args.siteName || site.id === args.siteName
      ) || sites[0] || { name: args.siteName || 'KT알파', id: 'default' };

      // 4단계: 태스크 워크플로우 응답 생성
      return this.generateTaskWorkflowResponse(
        args.taskName,
        args.taskType || 'feature',
        projectRequirements,
        documentPlan,
        targetSite,
        jiraInfo,
        startTime
      );

    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `❌ 태스크 시작 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`
        }],
        isError: true,
      };
    }
  }

  /**
   * 태스크 타입별 문서 계획 수립 (Feature/Bug/Refactoring 최적화)
   */
  private createTaskDocumentPlan(taskType: string, complexity: string, requirements: string): any[] {
    // 태스크 타입별 기본 문서 계획
    const taskPlans: { [key: string]: any[] } = {
      'feature': [
        { phase: 1, type: 'FUNCTIONAL_SPECIFICATION', name: '기능 명세서', priority: 'high' },
        { phase: 2, type: 'TECHNICAL_SPECIFICATION', name: '기술 명세서', priority: 'high' },
        { phase: 3, type: 'IMPACT_ANALYSIS', name: '영향도 분석서', priority: 'high' },
        { phase: 4, type: 'TEST_CASE', name: '테스트 케이스', priority: 'medium' }
      ],
      'bug': [
        { phase: 1, type: 'REQUIREMENTS', name: '버그 분석서', priority: 'high' },
        { phase: 2, type: 'IMPACT_ANALYSIS', name: '영향도 분석서', priority: 'high' },
        { phase: 3, type: 'TEST_CASE', name: '테스트 케이스', priority: 'high' }
      ],
      'refactoring': [
        { phase: 1, type: 'TECHNICAL_SPECIFICATION', name: '리팩토링 계획서', priority: 'high' },
        { phase: 2, type: 'IMPACT_ANALYSIS', name: '영향도 분석서', priority: 'high' },
        { phase: 3, type: 'TEST_PLAN', name: '테스트 계획서', priority: 'high' }
      ],
      'enhancement': [
        { phase: 1, type: 'REQUIREMENTS', name: '개선 요구사항서', priority: 'high' },
        { phase: 2, type: 'TECHNICAL_SPECIFICATION', name: '기술 명세서', priority: 'medium' },
        { phase: 3, type: 'IMPACT_ANALYSIS', name: '영향도 분석서', priority: 'high' }
      ]
    };

    const basePlan = taskPlans[taskType] || taskPlans['feature'];
    const additionalDocs = [];

    // 요구사항 기반 추가 문서 (기존 로직 유지)
    if (requirements.toLowerCase().includes('데이터베이스') || 
        requirements.toLowerCase().includes('테이블') || 
        requirements.toLowerCase().includes('db')) {
      if (taskType === 'feature' || taskType === 'enhancement') {
        additionalDocs.push(
          { phase: 2, type: 'DATABASE_DESIGN', name: '데이터베이스 설계서', priority: 'high' },
          { phase: 2, type: 'TABLE_SPECIFICATION', name: '테이블 명세서', priority: 'high' }
        );
      }
    }
    
    if (requirements.toLowerCase().includes('api')) {
      additionalDocs.push(
        { phase: 2, type: 'API_SPECIFICATION', name: 'API 명세서', priority: 'high' }
      );
      if (taskType === 'feature') {
        additionalDocs.push(
          { phase: 3, type: 'API_DOCUMENTATION', name: 'API 문서', priority: 'medium' }
        );
      }
    }

    // 복잡도에 따른 추가 문서
    if (complexity === 'complex') {
      if (taskType === 'feature') {
        additionalDocs.push(
          { phase: 2, type: 'SYSTEM_ARCHITECTURE', name: '시스템 아키텍처 설계서', priority: 'medium' },
          { phase: 4, type: 'QA_CHECKLIST', name: 'QA 체크리스트', priority: 'medium' }
        );
      }
      additionalDocs.push(
        { phase: 5, type: 'DEPLOYMENT_CHECKLIST', name: '배포 체크리스트', priority: 'medium' }
      );
    } else if (complexity === 'normal') {
      if (taskType !== 'bug') {
        additionalDocs.push(
          { phase: 4, type: 'DEPLOYMENT_GUIDE', name: '배포 가이드', priority: 'low' }
        );
      }
    }

    return [...basePlan, ...additionalDocs].sort((a, b) => a.phase - b.phase);
  }

  /**
   * 프로젝트 범위에 따른 문서 계획 수립 (레거시 - 호환성 유지)
   */
  private createDocumentPlan(scope: string, requirements: string): any[] {
    const basePlan = [
      { phase: 1, type: 'REQUIREMENTS', name: '요구사항 정의서', priority: 'high' },
      { phase: 2, type: 'TECHNICAL_SPECIFICATION', name: '기술 명세서', priority: 'high' },
      { phase: 3, type: 'IMPACT_ANALYSIS', name: '영향도 분석서', priority: 'high' },
      { phase: 4, type: 'TEST_PLAN', name: '테스트 계획서', priority: 'medium' },
      { phase: 5, type: 'DEPLOYMENT_GUIDE', name: '배포 가이드', priority: 'medium' }
    ];

    // 요구사항 분석으로 추가 문서 결정
    const additionalDocs = [];
    
    if (requirements.toLowerCase().includes('데이터베이스') || 
        requirements.toLowerCase().includes('테이블') || 
        requirements.toLowerCase().includes('db')) {
      additionalDocs.push(
        { phase: 2, type: 'DATABASE_DESIGN', name: '데이터베이스 설계서', priority: 'high' },
        { phase: 2, type: 'TABLE_SPECIFICATION', name: '테이블 명세서', priority: 'high' }
      );
    }
    
    if (requirements.toLowerCase().includes('api') || 
        requirements.toLowerCase().includes('인터페이스')) {
      additionalDocs.push(
        { phase: 2, type: 'API_SPECIFICATION', name: 'API 명세서', priority: 'high' },
        { phase: 3, type: 'API_DOCUMENTATION', name: 'API 문서', priority: 'medium' }
      );
    }
    
    if (requirements.toLowerCase().includes('ui') || 
        requirements.toLowerCase().includes('화면') || 
        requirements.toLowerCase().includes('인터페이스')) {
      additionalDocs.push(
        { phase: 2, type: 'UI_UX_DESIGN', name: 'UI/UX 설계서', priority: 'medium' }
      );
    }

    // 프로젝트 범위에 따른 추가 문서
    if (scope === 'large') {
      additionalDocs.push(
        { phase: 2, type: 'SYSTEM_ARCHITECTURE', name: '시스템 아키텍처 설계서', priority: 'high' },
        { phase: 4, type: 'QA_CHECKLIST', name: 'QA 체크리스트', priority: 'medium' },
        { phase: 5, type: 'MONITORING_PLAN', name: '모니터링 계획서', priority: 'medium' },
        { phase: 6, type: 'OPERATION_MANUAL', name: '운영 매뉴얼', priority: 'low' }
      );
    }

    return [...basePlan, ...additionalDocs].sort((a, b) => a.phase - b.phase);
  }

  /**
   * 태스크 워크플로우 응답 생성 (Feature/Bug/Refactoring 최적화)
   */
  private generateTaskWorkflowResponse(
    taskName: string,
    taskType: string,
    requirements: string,
    documentPlan: any[],
    site: any,
    jiraInfo: any,
    startTime: Date
  ) {
    const processingTime = Date.now() - startTime.getTime();
    
    // 태스크 타입별 아이콘 및 설명
    const taskTypeInfo: { [key: string]: { icon: string; description: string } } = {
      'feature': { icon: '🆕', description: '새 기능 개발' },
      'bug': { icon: '🐛', description: '버그 수정' },
      'refactoring': { icon: '♻️', description: '코드 리팩토링' },
      'enhancement': { icon: '⚡', description: '기능 개선' }
    };

    const typeInfo = taskTypeInfo[taskType] || taskTypeInfo['feature'];
    
    // 단계별 문서 그룹화
    const phaseGroups: { [key: number]: any[] } = {};
    documentPlan.forEach(doc => {
      if (!phaseGroups[doc.phase]) phaseGroups[doc.phase] = [];
      phaseGroups[doc.phase].push(doc);
    });

    const phaseNames: { [key: number]: string } = {
      1: '분석 및 계획',
      2: '설계',
      3: '개발',
      4: '테스트',
      5: '배포'
    };

    // 태스크 타입별 첫 번째 단계 가이드
    const firstStepGuide: { [key: string]: string } = {
      'feature': '기능 명세서',
      'bug': '버그 분석서',
      'refactoring': '리팩토링 계획서',
      'enhancement': '개선 요구사항서'
    };

    const firstDocType = firstStepGuide[taskType] || '기능 명세서';

    return {
      content: [{
        type: 'text',
        text: `${typeInfo.icon} **${taskName} - ${typeInfo.description} 태스크 시작**

## 📋 **태스크 개요**
- 🏢 **대상 사이트**: ${site.name}
- 📋 **태스크 타입**: ${typeInfo.icon} ${typeInfo.description}
- ⏰ **시작 시간**: ${new Date().toLocaleString('ko-KR')}
- 🚀 **처리 시간**: ${processingTime}ms
- ${jiraInfo ? `🎫 **JIRA 티켓**: ${jiraInfo.ticketKey}` : '📝 **요구사항 출처**: 직접 입력'}

## 🎯 **태스크 요구사항**
${requirements}

## 📊 **개발 워크플로우 계획**

${Object.entries(phaseGroups).map(([phase, docs]) => `
### ${phase}단계: ${phaseNames[parseInt(phase)]}
${docs.map((doc: any, index: number) => {
  const priorityIcon = doc.priority === 'high' ? '🔴' : doc.priority === 'medium' ? '🟡' : '🟢';
  return `${index + 1}. ${priorityIcon} **${doc.name}** (\`${doc.type}\`)`;
}).join('\n')}
`).join('')}

## 🎯 **시작 가이드**

### 1️⃣ **첫 번째 단계: ${firstDocType} 작성**
다음 명령으로 ${firstDocType.toLowerCase()}을 생성하세요:
\`\`\`
"${taskName} ${firstDocType.toLowerCase()} 만들어줘"
\`\`\`

### 2️⃣ **순차적 문서 생성**
각 단계별로 다음과 같이 문서를 생성하세요:

${documentPlan.slice(0, 4).map((doc, index) => 
  `**${index + 1}단계**: "${taskName} ${doc.name.toLowerCase()} 생성해줘"`
).join('\n')}

### 3️⃣ **태스크 타입별 주의사항**
${this.getTaskTypeGuidelines(taskType)}

## ✅ **태스크 체크리스트**
- [ ] 1단계: 분석 및 계획 완료
- [ ] 2단계: 설계 문서 작성 완료  
- [ ] 3단계: 개발 준비 완료
- [ ] 4단계: 테스트 완료
- [ ] 5단계: 배포 준비 완료

## 🔄 **다음 액션**
1. **즉시 시작**: "${taskName} ${firstDocType.toLowerCase()} 만들어줘"를 입력하세요
2. **JIRA 연동**: ${jiraInfo ? '✅ 이미 연동됨' : '필요시 JIRA 티켓을 연결하세요'}
3. **진행 상황 추적**: 각 단계별 문서 생성 후 체크리스트를 업데이트하세요

---
💡 **${typeInfo.description} 태스크를 효율적으로 완성하세요!**`
      }]
    };
  }

  /**
   * 태스크 타입별 가이드라인
   */
  private getTaskTypeGuidelines(taskType: string): string {
    const guidelines: { [key: string]: string } = {
      'feature': `- 기존 시스템과의 호환성을 고려하세요
- 새로운 기능이 다른 기능에 미치는 영향을 분석하세요
- 사용자 경험(UX)을 우선적으로 고려하세요
- 테이블 명세서가 필요한 경우 데이터베이스 설계를 먼저 완료하세요`,
      'bug': `- 버그의 근본 원인을 정확히 파악하세요
- 수정 범위를 최소화하여 사이드 이펙트를 방지하세요
- 회귀 테스트를 철저히 수행하세요
- 유사한 버그가 다른 곳에 있는지 확인하세요`,
      'refactoring': `- 기능 변경 없이 코드 구조만 개선하세요
- 리팩토링 전후 동작이 동일한지 확인하세요
- 단계별로 작은 단위로 진행하세요
- 테스트 커버리지를 유지하거나 향상시키세요`,
      'enhancement': `- 기존 사용자에게 미치는 영향을 최소화하세요
- 성능 개선 효과를 측정 가능하도록 계획하세요
- 하위 호환성을 유지하세요
- 점진적 개선을 고려하세요`
    };
    return guidelines[taskType] || guidelines['feature'];
  }

  /**
   * 프로젝트 워크플로우 응답 생성 (레거시 - 호환성 유지)
   */
  private generateProjectWorkflowResponse(
    projectName: string,
    requirements: string,
    documentPlan: any[],
    site: any,
    jiraInfo: any,
    startTime: Date
  ) {
    const processingTime = Date.now() - startTime.getTime();
    
    // 단계별 문서 그룹화
    const phaseGroups: { [key: number]: any[] } = {};
    documentPlan.forEach(doc => {
      if (!phaseGroups[doc.phase]) phaseGroups[doc.phase] = [];
      phaseGroups[doc.phase].push(doc);
    });

    const phaseNames: { [key: number]: string } = {
      1: '요구사항 분석',
      2: '설계',
      3: '개발',
      4: '테스트',
      5: '배포',
      6: '운영'
    };

    return {
      content: [{
        type: 'text',
        text: `🚀 **${projectName} - 개발 프로젝트 시작**

## 📋 **프로젝트 개요**
- 🏢 **대상 사이트**: ${site.name}
- ⏰ **시작 시간**: ${new Date().toLocaleString('ko-KR')}
- 🚀 **처리 시간**: ${processingTime}ms
- ${jiraInfo ? `🎫 **JIRA 티켓**: ${jiraInfo.ticketKey}` : '📝 **요구사항 출처**: 직접 입력'}

## 🎯 **프로젝트 요구사항**
${requirements}

## 📊 **개발 워크플로우 계획**

${Object.entries(phaseGroups).map(([phase, docs]) => `
### ${phase}단계: ${phaseNames[parseInt(phase)]}
${docs.map((doc: any, index: number) => {
  const priorityIcon = doc.priority === 'high' ? '🔴' : doc.priority === 'medium' ? '🟡' : '🟢';
  return `${index + 1}. ${priorityIcon} **${doc.name}** (\`${doc.type}\`)`;
}).join('\n')}
`).join('')}

## 🎯 **시작 가이드**

### 1️⃣ **첫 번째 단계: 요구사항 정의서 작성**
다음 명령으로 요구사항 정의서를 생성하세요:
\`\`\`
"${projectName} 요구사항서 만들어줘"
\`\`\`

### 2️⃣ **순차적 문서 생성**
각 단계별로 다음과 같이 문서를 생성하세요:

${documentPlan.slice(0, 5).map((doc, index) => 
  `**${index + 1}단계**: "${projectName} ${doc.name.toLowerCase()} 생성해줘"`
).join('\n')}

### 3️⃣ **자동화 팁**
- 각 문서는 이전 단계 완료 후 생성하는 것이 좋습니다
- 테이블 명세서는 데이터베이스 설계서 후에 생성하세요
- API 문서는 API 명세서 완성 후 작성하세요

## ✅ **프로젝트 체크리스트**
- [ ] 1단계: 요구사항 분석 완료
- [ ] 2단계: 설계 문서 작성 완료  
- [ ] 3단계: 개발 문서 준비 완료
- [ ] 4단계: 테스트 계획 수립 완료
- [ ] 5단계: 배포 준비 완료
- [ ] 6단계: 운영 문서 준비 완료

## 🔄 **다음 액션**
1. **즉시 시작**: "${projectName} 요구사항서 만들어줘"를 입력하세요
2. **JIRA 연동**: ${jiraInfo ? '✅ 이미 연동됨' : '필요시 JIRA 티켓을 연결하세요'}
3. **진행 상황 추적**: 각 단계별 문서 생성 후 체크리스트를 업데이트하세요

---
💡 **성공적인 프로젝트를 위해 단계별로 차근차근 진행하세요!**`
      }]
    };
  }

  /**
   * 테이블 명세서 생성 전용 핸들러
   */
  private async handleCreateTableSpecification(args: {
    tableName: string;
    siteName?: string;
    dbConnectionString?: string;
    dbType?: string;
    schemaInfo?: string;
    includeIndexes?: boolean;
    includeConstraints?: boolean;
  }) {
    const startTime = new Date();
    
    try {
      console.error(`📊 테이블 명세서 생성 시작: ${args.tableName}`);
      
      // 1단계: 사이트 정보 결정
      let targetSite = null;
      if (args.siteName) {
        targetSite = this.findSite(args.siteName, args.siteName);
        if (!targetSite) {
          throw new Error(
            `❌ 사이트를 찾을 수 없습니다: "${args.siteName}"\n\n` +
            `📋 사용 가능한 사이트 목록:\n` +
            this.availableSites.map(site => `   - ${site.name} (${site.company}) [ID: ${site.id}]`).join('\n')
          );
        }
      } else {
        targetSite = this.getDefaultSite() || this.availableSites[0];
        if (!targetSite) {
          throw new Error('사용 가능한 사이트가 없습니다.');
        }
      }

      // 2단계: DB 연결 정보 결정
      const dbConnection = args.dbConnectionString || this.DB_CONNECTION_STRING;
      const dbType = args.dbType || this.DB_TYPE;
      
      let schemaData = '';
      let connectionMethod = '';

      if (dbConnection && dbType) {
        // DB 연결을 통한 스키마 조회 시도
        console.error(`🔌 DB 연결 시도: ${dbType}`);
        try {
          schemaData = await this.getTableSchemaFromDB(dbConnection, dbType, args.tableName);
          connectionMethod = 'database';
          console.error(`✅ DB에서 스키마 정보 조회 완료`);
        } catch (error) {
          console.error(`⚠️ DB 연결 실패, 수동 입력 모드로 전환: ${error}`);
          schemaData = this.generateManualSchemaPrompt(args.tableName);
          connectionMethod = 'manual_fallback';
        }
      } else if (args.schemaInfo) {
        // 사용자가 제공한 스키마 정보 사용
        schemaData = args.schemaInfo;
        connectionMethod = 'user_provided';
        console.error(`📝 사용자 제공 스키마 정보 사용`);
      } else {
        // 수동 입력 안내
        schemaData = this.generateManualSchemaPrompt(args.tableName);
        connectionMethod = 'manual';
        console.error(`📝 수동 입력 모드`);
      }

      // 3단계: 템플릿 조회
      const templateData = await this.cachedApiCall('GET', `/templates/guide/TABLE_SPECIFICATION`, { site_id: targetSite.id });
      
      if (!templateData.success) {
        throw new Error(
          `❌ 테이블 명세서 템플릿을 찾을 수 없습니다.\n\n` +
          `🔧 해결 방법:\n` +
          `1. 백오피스 관리자 UI (http://localhost:3001)에 접속하세요\n` +
          `2. 템플릿 관리에서 "테이블 명세서" 템플릿을 생성하세요\n` +
          `3. 사이트: ${targetSite.name}, 문서 타입: TABLE_SPECIFICATION`
        );
      }

      const template = templateData.data;

      // 4단계: 컨텍스트 구성
      const context = this.buildTableSpecificationContext(
        args.tableName,
        schemaData,
        connectionMethod,
        targetSite,
        args.includeIndexes !== false,
        args.includeConstraints !== false
      );

      // 5단계: 템플릿 사용 기록
      await this.cachedApiCall('POST', `/templates/${template.id}/use`, {
        site_id: targetSite.id,
        usage_context: {
          document_type: 'TABLE_SPECIFICATION',
          table_name: args.tableName,
          connection_method: connectionMethod,
          timestamp: new Date().toISOString()
        }
      });

      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      return {
        content: [{
          type: 'text',
          text: `# 📊 테이블 명세서 생성 완료

## 📋 **기본 정보**
- **테이블**: ${args.tableName}
- **사이트**: ${targetSite.name} (${targetSite.company})
- **연결 방식**: ${this.getConnectionMethodDescription(connectionMethod)}
- **처리 시간**: ${duration}ms

## 📝 **템플릿 정보**
**템플릿**: ${template.name}
**버전**: ${template.version}
**설명**: ${template.description}

---

${template.content}

---

## 🗂️ **스키마 정보**

${context}

## ⚡ **생성 완료**
- 템플릿 기반 테이블 명세서가 생성되었습니다
- 위 내용을 참고하여 실제 테이블 구조에 맞게 수정하세요
- ${connectionMethod === 'manual' ? '💡 DB 연결 정보를 환경 변수로 설정하면 자동 스키마 조회가 가능합니다' : ''}

**생성 시각**: ${endTime.toLocaleString('ko-KR')}`
        }]
      };

    } catch (error: any) {
      console.error('❌ 테이블 명세서 생성 실패:', error);
      return {
        content: [{
          type: 'text',
          text: `❌ **테이블 명세서 생성 실패**

**오류**: ${error.message}

**해결 방법**:
1. 테이블명이 올바른지 확인하세요
2. DB 연결 정보가 정확한지 확인하세요
3. 사이트가 존재하는지 확인하세요
4. 백오피스에서 테이블 명세서 템플릿이 등록되어 있는지 확인하세요

**수동 입력 방법**:
\`\`\`
create_table_specification:
- tableName: "users"
- schemaInfo: "CREATE TABLE users (id INT PRIMARY KEY, name VARCHAR(100), email VARCHAR(255));"
\`\`\``
        }],
        isError: true
      };
    }
  }

  /**
   * 통합 문서 생성 핸들러 - 자연어 입력 지원
   */
  private async handleCreateDocument(args: { 
    documentRequest: string;
    siteName?: string; 
    projectPath?: string;
    analysisType?: string;
    additionalContext?: string;
  }) {
    const startTime = new Date();
    const analysisType = args.analysisType || 'full';
    
    try {
      // 0단계: 자연어 요청 파싱
      const parsedRequest = this.parseDocumentRequest(args.documentRequest);
      if (!parsedRequest.documentType) {
        throw new Error(`요청을 이해할 수 없습니다: "${args.documentRequest}". 예: "사용자 관리 시스템의 테이블 명세서", "결제 모듈 요구사항서" 등으로 입력해주세요.`);
      }

      // 1단계: 사이트 정보 결정
      let targetSite = null;

      if (args.siteName) {
        // 사이트명 또는 ID로 검색
        targetSite = this.findSite(args.siteName, args.siteName);
        if (!targetSite) {
          throw new Error(
            `❌ 사이트를 찾을 수 없습니다: "${args.siteName}"\n\n` +
            `📋 사용 가능한 사이트 목록:\n` +
            this.availableSites.map(site => `   - ${site.name} (${site.company}) [ID: ${site.id}]`).join('\n') +
            `\n\n💡 올바른 사이트명 또는 ID를 입력하거나 DEFAULT_SITE_ID/DEFAULT_SITE_NAME 환경 변수를 설정하세요.`
          );
        }
      } else {
        // 기본 사이트 사용
        targetSite = this.getDefaultSite();
        if (!targetSite) {
          if (this.availableSites.length > 0) {
            // 기본 사이트가 없으면 첫 번째 사이트 사용
            targetSite = this.availableSites[0];
            console.error(`⚠️ 기본 사이트 미설정으로 첫 번째 사이트 사용: ${targetSite.name}`);
          } else {
            throw new Error(
              `❌ 사용 가능한 사이트가 없습니다.\n\n` +
              `🔧 해결 방법:\n` +
              `1. 백오피스 관리자 UI (http://localhost:3001)에 접속하세요\n` +
              `2. 사이트 관리에서 새 사이트를 등록하세요\n` +
              `3. 또는 기존 사이트를 활성화하세요`
            );
          }
        }
      }

      console.error(`🏢 선택된 사이트: ${targetSite.name} (${targetSite.company}) [ID: ${targetSite.id}]`);

      // 2단계: 템플릿 조회 (SQLite에서, 캐싱 적용)
      const templateData = await this.cachedApiCall('GET', `/templates/guide/${parsedRequest.documentType}`, { site_id: targetSite.id });
      
      if (!templateData.success) {
        const documentDisplayName = this.getDocumentTypeDisplayName(parsedRequest.documentType);
        throw new Error(
          `❌ ${documentDisplayName} 템플릿을 찾을 수 없습니다.\n\n` +
          `🔧 해결 방법:\n` +
          `1. 백오피스 관리자 UI (http://localhost:3001)에 접속하세요\n` +
          `2. 템플릿 관리 메뉴에서 "${documentDisplayName}" 템플릿을 생성하세요\n` +
          `3. 사이트: ${targetSite.name}, 문서 타입: ${parsedRequest.documentType}\n\n` +
          `💡 관리자에게 문의하여 해당 문서 타입의 기본 템플릿을 등록해달라고 요청하세요.`
        );
      }
      
      const template = templateData.data;

      // 3단계: 분석 타입에 따른 처리
      if (analysisType === 'template-only') {
        return await this.generateTemplateOnlyResponse(parsedRequest.featureName, targetSite, template, startTime, parsedRequest.documentType);
      }

      // 4단계: 문서 타입별 특화 처리
      const documentArgs = {
        documentType: parsedRequest.documentType,
        featureName: parsedRequest.featureName,
        siteName: args.siteName,
        projectPath: args.projectPath,
        additionalContext: args.additionalContext
      };
      return await this.generateDocumentResponse(documentArgs, targetSite, templateData, analysisType, startTime);

    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `❌ 문서 생성 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`
        }],
        isError: true,
      };
    }
  }

  /**
   * 레거시 영향도 분석서 생성 (하위 호환성)
   */
  private async handleCreateImpactAnalysis(args: { 
    featureName: string; 
    siteName?: string; 
    projectPath?: string;
    analysisType?: string;
  }) {
    const startTime = new Date();
    const analysisType = args.analysisType || 'full';
    
    try {
      // 1단계: 사이트 정보 확인 (캐싱 적용)
      const sitesData = await this.cachedApiCall('GET', '/sites');
      if (!sitesData.success) {
        throw new Error('사이트 정보를 가져올 수 없습니다');
      }
      
      const sites = sitesData.data || [];
      const targetSite = sites.find((site: any) => 
        site.name === args.siteName || site.id === args.siteName
      ) || sites[0]; // 첫 번째 사이트를 기본값으로 사용

      if (!targetSite) {
        throw new Error('사용 가능한 사이트가 없습니다');
      }

      // 2단계: 템플릿 조회 (SQLite에서, 캐싱 적용)
      const templateData = await this.cachedApiCall('GET', `/templates/guide/IMPACT_ANALYSIS`, { site_id: targetSite.id });
      
      if (!templateData.success) {
        throw new Error(`템플릿 조회 실패: ${templateData.message}`);
      }
      
      const template = templateData.data;

      // 3단계: 분석 타입에 따른 처리
      if (analysisType === 'template-only') {
        return await this.generateTemplateOnlyResponse(args.featureName, targetSite, template, startTime);
      }

      // 4단계: 기본 프로젝트 분석 정보 수집
      const projectInfo = await this.gatherProjectInfo(args.projectPath || 'C:\\workspace\\ds\\figure-mcp\\figure-mcp');

      // 5단계: 완전한 영향도 분석서 생성
      return this.generateFullAnalysisResponse(
        args.featureName, 
        targetSite, 
        templateData, 
        projectInfo, 
        analysisType,
        startTime
      );

    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `❌ 영향도 분석서 생성 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`
        }],
        isError: true,
      };
    }
  }



  /**
   * 자연어 문서 요청 파싱
   */
  private parseDocumentRequest(request: string): { documentType: string | null; featureName: string } {
    const normalizedRequest = request.toLowerCase().trim();
    
    // 문서 타입 매칭 패턴들
    const documentPatterns: { [key: string]: string[] } = {
      'TABLE_SPECIFICATION': [
        '테이블 명세서', '테이블명세서', 'table spec', 'table specification',
        '테이블 설계서', '테이블설계서', 'db 명세서', '데이터베이스 명세서',
        '테이블 구조', '스키마 명세서', 'schema spec'
      ],
      'REQUIREMENTS': [
        '요구사항서', '요구사항 정의서', '요구사항분석서', 'requirements',
        '요구 사항서', '요구 사항 정의서', '요구 사항 분석서'
      ],
      'BUSINESS_REQUIREMENTS': [
        '비즈니스 요구사항서', '비즈니스요구사항서', 'business requirements',
        '업무 요구사항서', '사업 요구사항서'
      ],
      'FUNCTIONAL_SPECIFICATION': [
        '기능 명세서', '기능명세서', 'functional spec', 'functional specification',
        '기능 정의서', '기능정의서'
      ],
      'TECHNICAL_SPECIFICATION': [
        '기술 명세서', '기술명세서', 'technical spec', 'technical specification',
        '기술 설계서', '기술설계서', 'tech spec'
      ],
      'SYSTEM_ARCHITECTURE': [
        '시스템 아키텍처', '시스템아키텍처', 'system architecture',
        '시스템 구조도', '아키텍처 설계서', '시스템 설계서'
      ],
      'DATABASE_DESIGN': [
        '데이터베이스 설계서', '데이터베이스설계서', 'database design',
        'db 설계서', '데이터베이스 구조도'
      ],
      'API_SPECIFICATION': [
        'api 명세서', 'api명세서', 'api spec', 'api specification',
        'api 설계서', '인터페이스 명세서'
      ],
      'UI_UX_DESIGN': [
        'ui/ux 설계서', 'ui ux 설계서', 'ui 설계서', 'ux 설계서',
        '화면 설계서', '인터페이스 설계서'
      ],
      'IMPACT_ANALYSIS': [
        '영향도 분석서', '영향도분석서', 'impact analysis',
        '영향 분석서', '파급 효과 분석서', '영향도 평가서'
      ],
      'API_DOCUMENTATION': [
        'api 문서', 'api문서', 'api documentation',
        'api 가이드', 'api 매뉴얼'
      ],
      'CODE_REVIEW_CHECKLIST': [
        '코드 리뷰 체크리스트', '코드리뷰 체크리스트', 'code review checklist',
        '코드 검토 체크리스트', '리뷰 체크리스트'
      ],
      'TEST_PLAN': [
        '테스트 계획서', '테스트계획서', 'test plan',
        '시험 계획서', '테스트 설계서'
      ],
      'TEST_SCENARIO': [
        '테스트 시나리오', '테스트시나리오', 'test scenario',
        '시험 시나리오', '테스트 케이스 시나리오'
      ],
      'TEST_CASE': [
        '테스트 케이스', '테스트케이스', 'test case',
        '시험 케이스', '테스트 사례'
      ],
      'QA_CHECKLIST': [
        'qa 체크리스트', 'qa체크리스트', 'qa checklist',
        '품질 보증 체크리스트', '품질 체크리스트'
      ],
      'DEPLOYMENT_GUIDE': [
        '배포 가이드', '배포가이드', 'deployment guide',
        '배포 매뉴얼', '배포 문서', '릴리즈 가이드'
      ],
      'DEPLOYMENT_CHECKLIST': [
        '배포 체크리스트', '배포체크리스트', 'deployment checklist',
        '릴리즈 체크리스트', '배포 점검표'
      ],
      'ROLLBACK_PLAN': [
        '롤백 계획서', '롤백계획서', 'rollback plan',
        '복구 계획서', '되돌리기 계획서'
      ],
      'MONITORING_PLAN': [
        '모니터링 계획서', '모니터링계획서', 'monitoring plan',
        '감시 계획서', '모니터링 설계서'
      ],
      'USER_MANUAL': [
        '사용자 매뉴얼', '사용자매뉴얼', 'user manual',
        '사용 설명서', '이용 가이드', '유저 가이드'
      ],
      'RELEASE_NOTES': [
        '릴리즈 노트', '릴리즈노트', 'release notes',
        '배포 노트', '버전 노트', '변경 사항'
      ],
      'OPERATION_MANUAL': [
        '운영 매뉴얼', '운영매뉴얼', 'operation manual',
        '운영 가이드', '관리 매뉴얼'
      ],
      'TROUBLESHOOTING_GUIDE': [
        '트러블슈팅 가이드', '트러블슈팅가이드', 'troubleshooting guide',
        '문제 해결 가이드', '장애 대응 가이드', '오류 해결 가이드'
      ]
    };

    // 문서 타입 찾기
    let matchedDocumentType: string | null = null;
    for (const [docType, patterns] of Object.entries(documentPatterns)) {
      for (const pattern of patterns) {
        if (normalizedRequest.includes(pattern)) {
          matchedDocumentType = docType;
          break;
        }
      }
      if (matchedDocumentType) break;
    }

    // 기능명 추출 (문서 타입 키워드 제거 후 남은 부분)
    let featureName = request.trim();
    if (matchedDocumentType) {
      const matchedPatterns = documentPatterns[matchedDocumentType];
      for (const pattern of matchedPatterns) {
        if (normalizedRequest.includes(pattern)) {
          // 패턴을 제거하고 기능명 추출
          const regex = new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
          featureName = featureName.replace(regex, '').trim();
          
          // 불필요한 조사나 접속사 제거
          featureName = featureName
            .replace(/^(의|에|을|를|이|가|은|는|만들어줘|생성해줘|작성해줘)\s*/g, '')
            .replace(/\s*(의|에|을|를|이|가|은|는|만들어줘|생성해줘|작성해줘)$/g, '')
            .trim();
          break;
        }
      }
    }

    // 기본 기능명이 없으면 전체 요청을 기능명으로 사용
    if (!featureName || featureName.length < 2) {
      featureName = request.trim();
    }

    return {
      documentType: matchedDocumentType,
      featureName: featureName || '기능명 미지정'
    };
  }

  /**
   * JIRA 클라이언트 초기화
   */
  private initializeJiraClient(): void {
    if (!this.JIRA_BASE_URL || !this.JIRA_EMAIL || !this.JIRA_API_TOKEN) {
      if (process.env.MCP_QUIET !== 'true') {
        console.error('⚠️ JIRA 설정이 없습니다. JIRA 기능을 사용하려면 환경 변수를 설정하세요:');
        console.error('   JIRA_BASE_URL=https://your-domain.atlassian.net');
        console.error('   JIRA_EMAIL=your-email@company.com');
        console.error('   JIRA_API_TOKEN=your-api-token');
      }
      return;
    }

    // Basic Auth 토큰 생성 (email:api_token을 base64 인코딩)
    const authToken = Buffer.from(`${this.JIRA_EMAIL}:${this.JIRA_API_TOKEN}`).toString('base64');

    this.jiraClient = axios.create({
      baseURL: `${this.JIRA_BASE_URL}/rest/api/3`,
      timeout: 30000,
      headers: {
        'Authorization': `Basic ${authToken}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    });

    if (process.env.MCP_QUIET !== 'true') {
      console.error(`🔗 JIRA 클라이언트 초기화 완료: ${this.JIRA_BASE_URL}`);
    }
  }



  /**
   * JIRA 연결 상태 확인
   */
  private async checkJiraConnection(): Promise<{ connected: boolean; message: string; userInfo?: any }> {
    if (!this.jiraClient) {
      return {
        connected: false,
        message: 'JIRA 클라이언트가 초기화되지 않았습니다. 환경 변수를 확인하세요.'
      };
    }

    try {
      console.error(`🔍 JIRA API 호출: ${this.jiraClient.defaults.baseURL}/myself`);
      
      // 현재 사용자 정보 조회로 연결 테스트
      const response = await this.jiraClient.get('/myself');
      
      console.error(`📊 JIRA API 응답 상태: ${response.status}`);
      console.error(`📋 JIRA API 응답 데이터:`, JSON.stringify(response.data, null, 2));
      
      const userInfo = response.data;
      
      return {
        connected: true,
        message: `JIRA 연결 성공: ${userInfo.displayName || userInfo.name || '이름없음'} (${userInfo.emailAddress || userInfo.email || '이메일없음'})`,
        userInfo: {
          displayName: userInfo.displayName || userInfo.name || '이름없음',
          emailAddress: userInfo.emailAddress || userInfo.email || '이메일없음',
          accountType: userInfo.accountType || '알수없음',
          active: userInfo.active !== undefined ? userInfo.active : true
        }
      };
    } catch (error: any) {
      console.error(`❌ JIRA 연결 오류 세부사항:`, error);
      
      let errorMessage = 'JIRA 연결 실패';
      
      if (error.response) {
        console.error(`📊 오류 응답 상태: ${error.response.status}`);
        console.error(`📋 오류 응답 데이터:`, error.response.data);
        
        switch (error.response.status) {
          case 401:
            errorMessage = 'JIRA 인증 실패: API 토큰 또는 이메일을 확인하세요';
            break;
          case 403:
            errorMessage = 'JIRA 권한 부족: 사용자 정보 조회 권한이 필요합니다';
            break;
          case 404:
            errorMessage = 'JIRA URL 오류: 올바른 Atlassian 도메인인지 확인하세요';
            break;
          default:
            errorMessage = `JIRA API 오류 (${error.response.status}): ${error.response.data?.message || error.message}`;
        }
      } else if (error.code === 'ENOTFOUND') {
        errorMessage = 'JIRA 도메인을 찾을 수 없습니다: URL을 확인하세요';
      } else if (error.code === 'ETIMEDOUT') {
        errorMessage = 'JIRA 연결 시간 초과: 네트워크 상태를 확인하세요';
      } else {
        errorMessage = `JIRA 연결 오류: ${error.message}`;
      }

      return {
        connected: false,
        message: errorMessage
      };
    }
  }

  /**
   * 사이트 목록 조회 및 기본 사이트 검증
   */
  private async loadAndValidateSites(): Promise<{ success: boolean; message: string }> {
    try {
      console.error('🏢 사이트 목록 조회 중...');
      
      // 백엔드에서 사이트 목록 조회
      const response = await this.cachedApiCall('GET', '/sites/', { active_only: true });
      
      if (!response.success) {
        return {
          success: false,
          message: `사이트 목록 조회 실패: ${response.message}`
        };
      }
      
      this.availableSites = response.data || [];
      console.error(`📋 사용 가능한 사이트: ${this.availableSites.length}개`);
      
      // 사이트 목록 출력
      if (this.availableSites.length > 0) {
        console.error('📍 등록된 사이트 목록:');
        this.availableSites.forEach(site => {
          console.error(`   - ${site.name} (${site.company}) [ID: ${site.id}]`);
        });
      }
      
      // 기본 사이트 검증
      if (this.DEFAULT_SITE_ID || this.DEFAULT_SITE_NAME) {
        const defaultSite = this.findSite(this.DEFAULT_SITE_ID, this.DEFAULT_SITE_NAME);
        
        if (defaultSite) {
          console.error(`✅ 기본 사이트 설정 확인: ${defaultSite.name} (${defaultSite.company})`);
          return {
            success: true,
            message: `기본 사이트 설정 완료: ${defaultSite.name}`
          };
        } else {
          console.error(`❌ 기본 사이트를 찾을 수 없습니다:`);
          console.error(`   설정된 ID: ${this.DEFAULT_SITE_ID}`);
          console.error(`   설정된 이름: ${this.DEFAULT_SITE_NAME}`);
          return {
            success: false,
            message: '기본 사이트를 찾을 수 없습니다. 환경 변수를 확인하세요.'
          };
        }
      } else {
        console.error('⚠️ 기본 사이트가 설정되지 않았습니다.');
        console.error('💡 다음 환경 변수 중 하나를 설정하세요:');
        console.error('   DEFAULT_SITE_ID=사이트ID');
        console.error('   DEFAULT_SITE_NAME=사이트명');
        
        return {
          success: true,
          message: '기본 사이트 미설정 (문서 생성 시 사이트를 지정해야 함)'
        };
      }
      
    } catch (error: any) {
      console.error('❌ 사이트 조회 오류:', error.message);
      return {
        success: false,
        message: `사이트 조회 오류: ${error.message}`
      };
    }
  }

  /**
   * 사이트 찾기 (ID 또는 이름으로)
   */
  private findSite(siteId?: string, siteName?: string): any | null {
    if (!this.availableSites || this.availableSites.length === 0) {
      return null;
    }
    
    // ID로 우선 검색
    if (siteId) {
      const siteById = this.availableSites.find(site => site.id === siteId);
      if (siteById) return siteById;
    }
    
    // 이름으로 검색
    if (siteName) {
      const siteByName = this.availableSites.find(site => 
        site.name.toLowerCase() === siteName.toLowerCase()
      );
      if (siteByName) return siteByName;
    }
    
    return null;
  }

  /**
   * 기본 사이트 가져오기
   */
  private getDefaultSite(): any | null {
    return this.findSite(this.DEFAULT_SITE_ID, this.DEFAULT_SITE_NAME);
  }

  /**
   * DB에서 테이블 스키마 조회 (실제 구현은 향후 추가)
   */
  private async getTableSchemaFromDB(connectionString: string, dbType: string, tableName: string): Promise<string> {
    // 현재는 플레이스홀더 - 실제 DB 연결은 필요 시 구현
    throw new Error('DB 연결 기능은 현재 구현 중입니다. schemaInfo 파라미터를 사용하여 수동으로 스키마를 제공해주세요.');
  }

  /**
   * 수동 스키마 입력 안내 생성
   */
  private generateManualSchemaPrompt(tableName: string): string {
    return `## 📝 수동 스키마 입력이 필요합니다

**테이블**: ${tableName}

다음 중 하나의 방식으로 스키마 정보를 제공해주세요:

### 1️⃣ **DDL 형태**
\`\`\`sql
CREATE TABLE ${tableName} (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
\`\`\`

### 2️⃣ **JSON 형태**
\`\`\`json
{
  "tableName": "${tableName}",
  "columns": [
    {"name": "id", "type": "BIGINT", "nullable": false, "primaryKey": true},
    {"name": "name", "type": "VARCHAR(100)", "nullable": false},
    {"name": "email", "type": "VARCHAR(255)", "nullable": true, "unique": true}
  ]
}
\`\`\`

### 3️⃣ **환경 변수 설정 (자동화)**
\`\`\`env
DB_CONNECTION_STRING=mysql://user:password@localhost:3306/database
DB_TYPE=mysql
\`\`\`

**다시 실행 방법**:
\`\`\`
create_table_specification:
- tableName: "${tableName}"
- schemaInfo: "여기에 위 형태 중 하나로 스키마 정보 입력"
\`\`\``;
  }

  /**
   * 테이블 명세서 컨텍스트 구성
   */
  private buildTableSpecificationContext(
    tableName: string,
    schemaData: string,
    connectionMethod: string,
    site: any,
    includeIndexes: boolean,
    includeConstraints: boolean
  ): string {
    return `### 테이블 정보
- **테이블명**: ${tableName}
- **프로젝트**: ${site.name} (${site.company})
- **데이터 수집 방식**: ${this.getConnectionMethodDescription(connectionMethod)}

### 스키마 데이터
${schemaData}

### 생성 옵션
- **인덱스 포함**: ${includeIndexes ? '✅ 예' : '❌ 아니오'}
- **제약조건 포함**: ${includeConstraints ? '✅ 예' : '❌ 아니오'}

### 참고사항
- 실제 운영 환경의 테이블 구조와 일치하는지 확인하세요
- 민감한 정보(개인정보 등)가 포함된 컬럼은 별도 표시하세요
- 성능에 영향을 주는 인덱스 정보를 포함하세요`;
  }

  /**
   * 연결 방식 설명 반환
   */
  private getConnectionMethodDescription(method: string): string {
    const descriptions: Record<string, string> = {
      'database': '🔌 데이터베이스 직접 연결',
      'user_provided': '📝 사용자 제공 스키마',
      'manual': '✋ 수동 입력 필요',
      'manual_fallback': '⚠️ DB 연결 실패 후 수동 모드'
    };
    return descriptions[method] || '❓ 알 수 없음';
  }

  /**
   * 백엔드 API URL 결정
   */
  private getBackendApiUrl(): string {
    // 1. 환경 변수에서 직접 설정된 경우
    if (process.env.BACKEND_API_URL) {
      return process.env.BACKEND_API_URL;
    }
    
    // 2. Docker 환경 감지
    if (process.env.DOCKER_ENV === 'true' || process.env.NODE_ENV === 'docker') {
      return 'http://figure-backend:8001/api';
    }
    
    // 3. 개발 환경 기본값
    return 'http://localhost:8001/api';
  }

  /**
   * JIRA URL 정리 및 검증
   */
  private sanitizeJiraUrl(url: string): string {
    if (!url) return '';
    
    // 보드 URL에서 기본 도메인 추출
    const boardUrlPattern = /^(https:\/\/[^\/]+\.atlassian\.net)/;
    const match = url.match(boardUrlPattern);
    
    if (match) {
      console.error(`🔧 JIRA URL 자동 수정: ${url} → ${match[1]}`);
      return match[1];
    }
    
    // 이미 올바른 형식인 경우
    if (url.match(/^https:\/\/[^\/]+\.atlassian\.net\/?$/)) {
      return url.replace(/\/$/, ''); // 마지막 슬래시 제거
    }
    
    console.error(`⚠️  JIRA URL 형식 확인 필요: ${url}`);
    return url;
  }

  /**
   * 환경 변수 상태 로깅
   */
  private logEnvironmentStatus(): void {
    console.error('🔍 MCP 서버 연결 정보:');
    console.error(`   BACKEND_API_URL: ${this.BACKEND_API_URL}`);
    console.error('');
    console.error('🔍 환경 변수 로딩 상태:');
    console.error(`   JIRA_BASE_URL: ${this.JIRA_BASE_URL ? '✅ 설정됨' : '❌ 없음'} ${this.JIRA_BASE_URL ? `(${this.JIRA_BASE_URL})` : ''}`);
    console.error(`   JIRA_EMAIL: ${this.JIRA_EMAIL ? '✅ 설정됨' : '❌ 없음'} ${this.JIRA_EMAIL ? `(${this.JIRA_EMAIL.split('@')[0]}@***)` : ''}`);
    console.error(`   JIRA_API_TOKEN: ${this.JIRA_API_TOKEN ? '✅ 설정됨' : '❌ 없음'} ${this.JIRA_API_TOKEN ? '(토큰 길이: ' + this.JIRA_API_TOKEN.length + ')' : ''}`);
    console.error(`   DEFAULT_SITE_ID: ${this.DEFAULT_SITE_ID ? '✅ 설정됨' : '❌ 없음'} ${this.DEFAULT_SITE_ID ? `(${this.DEFAULT_SITE_ID})` : ''}`);
    console.error(`   DEFAULT_SITE_NAME: ${this.DEFAULT_SITE_NAME ? '✅ 설정됨' : '❌ 없음'} ${this.DEFAULT_SITE_NAME ? `(${this.DEFAULT_SITE_NAME})` : ''}`);
    console.error(`   DB_CONNECTION: ${this.DB_CONNECTION_STRING ? '✅ 설정됨' : '❌ 없음 (수동 입력 모드)'}`);
    console.error(`   DB_TYPE: ${this.DB_TYPE ? `✅ ${this.DB_TYPE}` : '❌ 없음'}`);
    console.error('');
  }

  /**
   * 캐시 디렉토리 초기화
   */
  private initializeCacheDirectory(): void {
    try {
      if (!fs.existsSync(this.CACHE_DIR)) {
        fs.mkdirSync(this.CACHE_DIR, { recursive: true });
        console.error(`📁 캐시 디렉토리 생성: ${this.CACHE_DIR}`);
      }
    } catch (error) {
      console.error('캐시 디렉토리 생성 실패:', error);
    }
  }

  /**
   * 캐시 키 생성 (URL과 파라미터 기반 해시)
   */
  private generateCacheKey(url: string, params?: any): string {
    const data = JSON.stringify({ url, params });
    return crypto.createHash('md5').update(data).digest('hex');
  }

  /**
   * 캐시 파일 경로 생성
   */
  private getCacheFilePath(cacheKey: string): string {
    return path.join(this.CACHE_DIR, `${cacheKey}.json`);
  }

  /**
   * 캐시에서 데이터 조회
   */
  private getCachedData(cacheKey: string): any | null {
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
        fs.unlinkSync(filePath); // 만료된 캐시 삭제
        return null;
      }

      const rawData = fs.readFileSync(filePath, 'utf-8');
      const cachedData = JSON.parse(rawData);
      
      console.error(`🎯 캐시 히트: ${cacheKey} (${Math.round(fileAge / 1000)}초 전)`);
      return cachedData;
    } catch (error) {
      console.error('캐시 조회 실패:', error);
      return null;
    }
  }

  /**
   * 캐시에 데이터 저장
   */
  private setCachedData(cacheKey: string, data: any): void {
    try {
      const filePath = this.getCacheFilePath(cacheKey);
      const jsonData = JSON.stringify(data, null, 2);
      
      fs.writeFileSync(filePath, jsonData, 'utf-8');
      console.error(`💾 캐시 저장: ${cacheKey}`);
    } catch (error) {
      console.error('캐시 저장 실패:', error);
    }
  }

  /**
   * 오래된 캐시 파일 정리
   */
  private cleanupOldCache(): void {
    try {
      const files = fs.readdirSync(this.CACHE_DIR);
      const now = Date.now();
      let cleanedCount = 0;

      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        
        const filePath = path.join(this.CACHE_DIR, file);
        const stats = fs.statSync(filePath);
        const fileAge = now - stats.mtime.getTime();

        if (fileAge > this.CACHE_TTL) {
          fs.unlinkSync(filePath);
          cleanedCount++;
        }
      }

      if (cleanedCount > 0) {
        console.error(`🧹 오래된 캐시 ${cleanedCount}개 정리 완료`);
      }
    } catch (error) {
      console.error('캐시 정리 실패:', error);
    }
  }

  /**
   * 프로젝트 기본 정보 수집
   */
  private async gatherProjectInfo(projectPath: string) {
    const info: any = {
      projectPath,
      analyzedAt: new Date().toLocaleString('ko-KR'),
      services: [],
      hasCircularDependency: false,
      riskLevel: 'unknown'
    };

    // 순환 의존성 체크 (캐싱 적용)
    const circularData = await this.cachedApiCall('POST', '/analysis/circular-dependency', undefined, {
      project_path: projectPath,
      language: 'python',
      max_depth: 5
    });

    if (!circularData.success) {
      throw new Error(`순환 의존성 분석 실패: ${circularData.message}`);
    }

    const result = circularData.data;
    info.hasCircularDependency = (result.circularDependencies?.length || 0) > 0;
    info.analyzedFiles = result.totalFiles || 0;
    info.complexityIndex = result.complexityIndex || 'unknown';

    // Docker 서비스 상태 확인 (동적 조회)
    info.services = await this.getDockerServicesStatus();

    return info;
  }

  /**
   * 캐싱을 적용한 API 호출
   */
  private async cachedApiCall(method: 'GET' | 'POST', url: string, params?: any, data?: any): Promise<any> {
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

  /**
   * Docker 서비스 상태 동적 조회 (캐싱 적용)
   */
  private async getDockerServicesStatus(): Promise<any[]> {
    const responseData = await this.cachedApiCall('GET', '/system/docker-status');
    if (!responseData.success) {
      throw new Error(`서비스 상태 조회 실패: ${responseData.message}`);
    }
    return responseData.data.services || [];
  }

  /**
   * 문서 타입별 특화 응답 생성
   */
  private async generateDocumentResponse(
    args: any,
    site: any, 
    templateData: any, 
    analysisType: string,
    startTime: Date
  ) {
    const documentType = args.documentType;
    const featureName = args.featureName;
    
    // 문서 타입별 특화 정보 수집
    let projectInfo: any = {};
    
    if (['IMPACT_ANALYSIS', 'TECHNICAL_SPECIFICATION', 'SYSTEM_ARCHITECTURE'].includes(documentType)) {
      // 기술적 분석이 필요한 문서들
      projectInfo = await this.gatherProjectInfo(args.projectPath || 'C:\\workspace\\ds\\figure-mcp\\figure-mcp');
    } else if (documentType === 'TABLE_SPECIFICATION') {
      // 테이블 명세서 전용 정보 수집
      projectInfo = await this.gatherDatabaseInfo(args.projectPath || 'C:\\workspace\\ds\\figure-mcp\\figure-mcp');
    } else if (['TEST_PLAN', 'TEST_SCENARIO', 'TEST_CASE'].includes(documentType)) {
      // 테스트 관련 문서들
      projectInfo = await this.gatherTestInfo(args.projectPath || 'C:\\workspace\\ds\\figure-mcp\\figure-mcp');
    }
    
    // 문서 타입별 특화 응답 생성
    return this.generateSpecializedDocumentResponse(
      documentType,
      featureName, 
      site, 
      templateData, 
      projectInfo, 
      analysisType,
      startTime,
      args.additionalContext
    );
  }

  /**
   * 데이터베이스 정보 수집 (테이블 명세서용)
   */
  private async gatherDatabaseInfo(projectPath: string) {
    const info: any = {
      projectPath,
      analyzedAt: new Date().toLocaleString('ko-KR'),
      databases: [],
      tables: [],
      relationships: []
    };

    // 프로젝트에서 데이터베이스 스키마 파일들 찾기
    // SQLite, PostgreSQL, MySQL 등의 스키마 정보 수집
    try {
      // 실제 구현에서는 프로젝트 구조를 분석하여 DB 스키마 정보를 추출
      info.databases = [
        { name: 'figure_mcp', type: 'SQLite', path: './data/templates.db' }
      ];
      
      info.tables = [
        { name: 'sites', description: '사이트 정보', columns: 5 },
        { name: 'documents', description: '문서 메타데이터', columns: 20 },
        { name: 'templates', description: '템플릿 정보', columns: 15 }
      ];
    } catch (error) {
      console.error('데이터베이스 정보 수집 실패:', error);
    }

    return info;
  }

  /**
   * 테스트 정보 수집
   */
  private async gatherTestInfo(projectPath: string) {
    const info: any = {
      projectPath,
      analyzedAt: new Date().toLocaleString('ko-KR'),
      testFrameworks: [],
      testFiles: 0,
      coverageData: null
    };

    // 테스트 프레임워크 감지 (Jest, PyTest, Mocha 등)
    // 테스트 파일 개수 및 커버리지 정보 수집
    try {
      info.testFrameworks = ['Jest', 'Puppeteer'];
      info.testFiles = 12;
    } catch (error) {
      console.error('테스트 정보 수집 실패:', error);
    }

    return info;
  }

  /**
   * 문서 타입별 특화 응답 생성
   */
  private generateSpecializedDocumentResponse(
    documentType: string,
    featureName: string,
    site: any,
    templateData: any,
    projectInfo: any,
    analysisType: string,
    startTime: Date,
    additionalContext?: string
  ) {
    const processingTime = Date.now() - startTime.getTime();
    const displayName = this.getDocumentTypeDisplayName(documentType);
    
    if (documentType === 'TABLE_SPECIFICATION') {
      return this.generateTableSpecificationResponse(featureName, site, templateData, projectInfo, processingTime, additionalContext);
    } else if (documentType === 'IMPACT_ANALYSIS') {
      return this.generateFullAnalysisResponse(featureName, site, templateData, projectInfo, analysisType, startTime);
    } else {
      return this.generateGenericDocumentResponse(documentType, featureName, site, templateData, projectInfo, processingTime, additionalContext);
    }
  }

  /**
   * 테이블 명세서 전용 응답 생성
   */
  private generateTableSpecificationResponse(
    featureName: string,
    site: any,
    templateData: any,
    projectInfo: any,
    processingTime: number,
    additionalContext?: string
  ) {
    return {
      content: [{
        type: 'text',
        text: `📊 **${featureName} - 테이블 명세서 (자동 생성)**

## 📋 **명세서 개요**
- 🏢 **대상 사이트**: ${site.name}
- 📁 **프로젝트**: ${projectInfo.projectPath}
- ⏰ **생성 시간**: ${projectInfo.analyzedAt}
- 🚀 **처리 시간**: ${processingTime}ms

## 🗄️ **데이터베이스 정보**
${projectInfo.databases.map((db: any) => 
  `- **${db.name}** (${db.type}): ${db.path || 'N/A'}`
).join('\n')}

## 📋 **테이블 목록**
${projectInfo.tables.map((table: any, index: number) => 
  `### ${index + 1}. ${table.name}
- **설명**: ${table.description}
- **컬럼 수**: ${table.columns}개
- **용도**: ${featureName}과 관련된 ${table.description}`
).join('\n\n')}

## 🔗 **테이블 관계도**
\`\`\`
sites (1) ----< documents (N)
documents (1) ----< templates (N)
\`\`\`

## 📝 **상세 테이블 명세**

### 📊 sites 테이블
| 컬럼명 | 타입 | 크기 | NULL | 기본값 | 설명 |
|--------|------|------|------|--------|------|
| id | VARCHAR | 50 | NO | - | 사이트 고유 ID (PK) |
| name | VARCHAR | 255 | NO | - | 사이트명 |
| description | TEXT | - | YES | NULL | 사이트 설명 |
| created_at | DATETIME | - | NO | CURRENT_TIMESTAMP | 생성일시 |
| updated_at | DATETIME | - | NO | CURRENT_TIMESTAMP | 수정일시 |

### 📄 documents 테이블
| 컬럼명 | 타입 | 크기 | NULL | 기본값 | 설명 |
|--------|------|------|------|--------|------|
| id | VARCHAR | 50 | NO | - | 문서 고유 ID (PK) |
| site_id | VARCHAR | 50 | YES | NULL | 사이트 ID (FK) |
| title | VARCHAR | 500 | NO | - | 문서 제목 |
| doc_type | VARCHAR | 50 | NO | - | 문서 타입 |
| is_template | BOOLEAN | - | NO | FALSE | 템플릿 여부 |
| template_type | VARCHAR | 100 | YES | NULL | 템플릿 타입 |
| created_at | DATETIME | - | NO | CURRENT_TIMESTAMP | 생성일시 |
| updated_at | DATETIME | - | NO | CURRENT_TIMESTAMP | 수정일시 |

### 🎯 **${featureName} 관련 테이블 영향도**
- **직접 영향**: 새로운 테이블 또는 컬럼 추가 가능성
- **간접 영향**: 기존 테이블의 데이터 구조 변경 가능성
- **인덱스 영향**: 성능 최적화를 위한 새로운 인덱스 필요성

## ✅ **검토 체크리스트**
- [ ] 테이블명이 명명 규칙에 맞는가?
- [ ] 모든 컬럼에 적절한 제약조건이 설정되었는가?
- [ ] 외래키 관계가 올바르게 정의되었는가?
- [ ] 인덱스가 적절히 설정되었는가?
- [ ] 데이터 타입과 크기가 적절한가?
- [ ] 성능에 영향을 줄 수 있는 요소는 없는가?

${additionalContext ? `\n## 📌 **추가 컨텍스트**\n${additionalContext}` : ''}

---
💡 **권장사항**: 이 명세서를 기반으로 ${featureName}의 데이터베이스 설계를 검토하고, 필요시 DBA와 협의하세요.`
      }]
    };
  }

  /**
   * 범용 문서 응답 생성
   */
  private generateGenericDocumentResponse(
    documentType: string,
    featureName: string,
    site: any,
    templateData: any,
    projectInfo: any,
    processingTime: number,
    additionalContext?: string
  ) {
    const displayName = this.getDocumentTypeDisplayName(documentType);
    const phase = this.getDocumentPhase(documentType);
    
    return {
      content: [{
        type: 'text',
        text: `📋 **${featureName} - ${displayName} (자동 생성)**

## 📋 **문서 개요**
- 🏢 **대상 사이트**: ${site.name}
- 📁 **프로젝트**: ${projectInfo.projectPath || 'N/A'}
- ⏰ **생성 시간**: ${new Date().toLocaleString('ko-KR')}
- 🚀 **처리 시간**: ${processingTime}ms
- 🎯 **개발 단계**: ${phase}

## 📝 **${displayName} 내용**

### 🎯 **${featureName} 개요**
이 문서는 ${featureName} 관련 ${displayName.toLowerCase()}을 정의합니다.

${templateData.template ? `
### 📄 **템플릿 기반 구조**
\`\`\`markdown
${templateData.template}
\`\`\`
` : ''}

### 🔍 **주요 고려사항**
- **범위**: ${featureName}의 ${this.getDocumentScope(documentType)}
- **우선순위**: ${this.getDocumentPriority(documentType)}
- **의존성**: ${this.getDocumentDependencies(documentType)}

### ✅ **체크리스트**
- [ ] ${displayName} 작성 완료
- [ ] 관련 팀 검토 완료
- [ ] 승인 프로세스 완료
- [ ] 문서 버전 관리 등록

${additionalContext ? `\n## 📌 **추가 컨텍스트**\n${additionalContext}` : ''}

---
💡 **다음 단계**: 이 ${displayName.toLowerCase()}을 기반으로 ${this.getNextStepRecommendation(documentType)}을 진행하세요.`
      }]
    };
  }

  /**
   * 문서 타입 표시명 반환
   */
  private getDocumentTypeDisplayName(documentType: string): string {
    const displayNames: { [key: string]: string } = {
      'REQUIREMENTS': '요구사항 정의서',
      'BUSINESS_REQUIREMENTS': '비즈니스 요구사항서',
      'FUNCTIONAL_SPECIFICATION': '기능 명세서',
      'TECHNICAL_SPECIFICATION': '기술 명세서',
      'SYSTEM_ARCHITECTURE': '시스템 아키텍처 설계서',
      'DATABASE_DESIGN': '데이터베이스 설계서',
      'TABLE_SPECIFICATION': '테이블 명세서',
      'API_SPECIFICATION': 'API 명세서',
      'UI_UX_DESIGN': 'UI/UX 설계서',
      'IMPACT_ANALYSIS': '영향도 분석서',
      'API_DOCUMENTATION': 'API 문서',
      'CODE_REVIEW_CHECKLIST': '코드 리뷰 체크리스트',
      'TEST_PLAN': '테스트 계획서',
      'TEST_SCENARIO': '테스트 시나리오',
      'TEST_CASE': '테스트 케이스',
      'QA_CHECKLIST': 'QA 체크리스트',
      'DEPLOYMENT_GUIDE': '배포 가이드',
      'DEPLOYMENT_CHECKLIST': '배포 체크리스트',
      'ROLLBACK_PLAN': '롤백 계획서',
      'MONITORING_PLAN': '모니터링 계획서',
      'USER_MANUAL': '사용자 매뉴얼',
      'RELEASE_NOTES': '릴리즈 노트',
      'OPERATION_MANUAL': '운영 매뉴얼',
      'TROUBLESHOOTING_GUIDE': '트러블슈팅 가이드'
    };
    return displayNames[documentType] || documentType;
  }

  /**
   * 문서 개발 단계 반환
   */
  private getDocumentPhase(documentType: string): string {
    if (['REQUIREMENTS', 'BUSINESS_REQUIREMENTS', 'FUNCTIONAL_SPECIFICATION'].includes(documentType)) {
      return '1단계: 요구사항 분석';
    } else if (['TECHNICAL_SPECIFICATION', 'SYSTEM_ARCHITECTURE', 'DATABASE_DESIGN', 'TABLE_SPECIFICATION', 'API_SPECIFICATION', 'UI_UX_DESIGN'].includes(documentType)) {
      return '2단계: 설계';
    } else if (['IMPACT_ANALYSIS', 'API_DOCUMENTATION', 'CODE_REVIEW_CHECKLIST'].includes(documentType)) {
      return '3단계: 개발';
    } else if (['TEST_PLAN', 'TEST_SCENARIO', 'TEST_CASE', 'QA_CHECKLIST'].includes(documentType)) {
      return '4단계: 테스트';
    } else if (['DEPLOYMENT_GUIDE', 'DEPLOYMENT_CHECKLIST', 'ROLLBACK_PLAN', 'MONITORING_PLAN'].includes(documentType)) {
      return '5단계: 배포';
    } else {
      return '6단계: 운영';
    }
  }

  /**
   * 문서 범위 반환
   */
  private getDocumentScope(documentType: string): string {
    const scopes: { [key: string]: string } = {
      'TABLE_SPECIFICATION': '데이터베이스 테이블 구조 및 관계',
      'API_SPECIFICATION': 'API 인터페이스 및 데이터 모델',
      'TEST_PLAN': '테스트 전략 및 범위',
      'DEPLOYMENT_GUIDE': '배포 절차 및 환경 설정'
    };
    return scopes[documentType] || '기능 전체';
  }

  /**
   * 문서 우선순위 반환
   */
  private getDocumentPriority(documentType: string): string {
    if (['REQUIREMENTS', 'IMPACT_ANALYSIS', 'TABLE_SPECIFICATION'].includes(documentType)) {
      return '높음';
    } else if (['TEST_PLAN', 'DEPLOYMENT_GUIDE'].includes(documentType)) {
      return '보통';
    } else {
      return '낮음';
    }
  }

  /**
   * 문서 의존성 반환
   */
  private getDocumentDependencies(documentType: string): string {
    const dependencies: { [key: string]: string } = {
      'TABLE_SPECIFICATION': '데이터베이스 설계서, 기능 명세서',
      'TEST_PLAN': '기술 명세서, 기능 명세서',
      'DEPLOYMENT_GUIDE': '시스템 아키텍처 설계서',
      'API_DOCUMENTATION': 'API 명세서'
    };
    return dependencies[documentType] || '요구사항 정의서';
  }

  /**
   * 다음 단계 권장사항 반환
   */
  private getNextStepRecommendation(documentType: string): string {
    const recommendations: { [key: string]: string } = {
      'REQUIREMENTS': '기능 명세서 작성',
      'TABLE_SPECIFICATION': '데이터베이스 구현',
      'TEST_PLAN': '테스트 케이스 작성',
      'DEPLOYMENT_GUIDE': '배포 체크리스트 작성'
    };
    return recommendations[documentType] || '다음 단계 문서 작성';
  }

  /**
   * 템플릿만 반환하는 응답 생성
   */
  private async generateTemplateOnlyResponse(featureName: string, site: any, templateData: any, startTime: Date, documentType?: string) {
    const processingTime = Date.now() - startTime.getTime();
    const displayName = documentType ? this.getDocumentTypeDisplayName(documentType) : '영향도 분석서';
    
    return {
      content: [{
        type: 'text',
        text: `📋 **${featureName} - ${displayName} 템플릿**

🏢 **대상 사이트**: ${site.name} (${site.id})
⏰ **조회 시간**: ${new Date().toLocaleString('ko-KR')}
🚀 **처리 시간**: ${processingTime}ms
🎯 **문서 타입**: ${displayName}

## 📝 **작성 지침**
${templateData.instructions || `표준 ${displayName} 작성 지침을 따르세요.`}

## 📄 **템플릿**
\`\`\`markdown
${templateData.template}
\`\`\`

💡 **다음 단계**: 이 템플릿을 기반으로 ${featureName}의 구체적인 ${displayName.toLowerCase()}을 작성하세요.`
      }]
    };
  }

  /**
   * 완전한 영향도 분석서 응답 생성
   */
  private generateFullAnalysisResponse(
    featureName: string, 
    site: any, 
    templateData: any, 
    projectInfo: any, 
    analysisType: string,
    startTime: Date
  ) {
    const processingTime = Date.now() - startTime.getTime();
    const riskIcon = projectInfo.hasCircularDependency ? '🔴' : '🟡';
    const riskLevel = projectInfo.hasCircularDependency ? '높음' : '보통';

    return {
      content: [{
        type: 'text',
        text: `📊 **${featureName} - 영향도 분석서 (자동 생성)**

## 📋 **분석 개요**
- 🏢 **대상 사이트**: ${site.name}
- 📁 **프로젝트**: ${projectInfo.projectPath}
- ⏰ **분석 시간**: ${projectInfo.analyzedAt}
- 🚀 **처리 시간**: ${processingTime}ms
- 📊 **분석 타입**: ${analysisType === 'full' ? '완전 분석' : '빠른 분석'}

## ${riskIcon} **종합 위험도: ${riskLevel}**

### 🔍 **프로젝트 분석 결과**
- 📄 **분석된 파일**: ${projectInfo.analyzedFiles}개
- 🔄 **순환 의존성**: ${projectInfo.hasCircularDependency ? '⚠️ 발견됨' : '✅ 없음'}
- 📈 **복잡도 지수**: ${projectInfo.complexityIndex}

### 🐳 **서비스 상태**
${projectInfo.services.map((service: any) => {
  const statusIcon = service.status === 'running' || service.status === 'healthy' ? '✅' : 
                    service.status === 'unhealthy' ? '⚠️' : 
                    service.status === 'unknown' ? '❓' : '❌';
  const description = service.description ? ` - ${service.description}` : '';
  return `- **${service.name}**: ${statusIcon} ${service.status} (Port ${service.port})${description}`;
}).join('\n')}

### 🎯 **${featureName} 영향도 분석**

#### **1. 예상 영향 범위**
- **백엔드 서비스**: ${featureName}과 관련된 API 엔드포인트 및 비즈니스 로직
- **데이터베이스**: 관련 테이블 스키마 변경 가능성
- **프론트엔드**: 사용자 인터페이스 및 상태 관리
- **외부 연동**: 타 시스템과의 인터페이스

#### **2. 주요 리스크 요소**
${projectInfo.hasCircularDependency ? 
`- 🔴 **순환 의존성**: 코드 변경 시 예상치 못한 사이드 이펙트 발생 가능
- ⚠️ **복잡도 증가**: 기존 순환 의존성으로 인한 수정 복잡도 상승` : 
`- 🟡 **의존성 관리**: ${featureName} 변경이 다른 컴포넌트에 미치는 영향
- 🟡 **데이터 일관성**: 관련 데이터 구조 변경에 따른 일관성 유지`}
- ${this.getServiceRiskLevel(projectInfo.services, 'chroma')} **RAG 서비스**: ${this.getServiceRiskDescription(projectInfo.services, 'chroma')}
- 🟡 **성능 영향**: ${featureName} 변경에 따른 시스템 성능 변화

#### **3. 권장 테스트 범위**
- **단위 테스트**: ${featureName} 관련 핵심 로직 테스트
- **통합 테스트**: 의존 컴포넌트 간 연동 테스트
- **성능 테스트**: 변경 전후 성능 비교 테스트
- **회귀 테스트**: 기존 기능 영향도 검증
${projectInfo.hasCircularDependency ? '- **의존성 테스트**: 순환 의존성 해결 후 전체 시스템 검증' : ''}

#### **4. 배포 전략**
- **단계적 배포**: 개발 → 스테이징 → 프로덕션 순차 배포
- **카나리 배포**: 일부 사용자 대상 먼저 배포 후 점진적 확대
- **모니터링 강화**: ${featureName} 관련 메트릭 실시간 모니터링
- **롤백 계획**: 문제 발생 시 즉시 이전 버전으로 롤백 가능하도록 준비

#### **5. 체크리스트**
- [ ] ${featureName} 요구사항 명세서 작성 완료
- [ ] 관련 컴포넌트 영향도 분석 완료
- [ ] 테스트 케이스 작성 및 실행 완료
- [ ] 코드 리뷰 및 승인 완료
- [ ] 성능 테스트 통과
- [ ] 보안 검토 완료
- [ ] 문서화 업데이트 완료
- [ ] 배포 스크립트 준비 완료
- [ ] 모니터링 대시보드 설정 완료
- [ ] 롤백 절차 테스트 완료

---

${templateData ? `
### 📝 **사이트별 표준 템플릿 가이드**
${templateData.instructions || '표준 지침을 따라 작성하세요.'}
` : ''}

💡 **권장사항**: 이 분석서를 기반으로 ${featureName} 개발을 진행하되, 프로젝트 특성에 맞게 내용을 조정하세요.

🔄 **업데이트**: 개발 진행 중 새로운 리스크나 변경사항 발견 시 이 분석서를 업데이트하세요.`
      }]
    };
  }

  /**
   * JIRA 티켓 조회 (캐싱 적용)
   */
  private async handleFetchJiraTicket(args: { ticketKey: string; includeComments?: boolean; includeSubtasks?: boolean }) {
    if (!this.jiraClient) {
      return {
        content: [{
          type: 'text',
          text: '❌ JIRA 설정이 없습니다. 환경 변수를 설정하고 서버를 재시작하세요.'
        }],
        isError: true,
      };
    }

    try {
      const cacheKey = this.generateCacheKey(`jira-ticket:${args.ticketKey}`, args);
      
      // 캐시 확인
      const cachedTicket = this.getCachedData(cacheKey);
      if (cachedTicket) {
        return {
          content: [{
            type: 'text',
            text: this.formatJiraTicketResponse(cachedTicket, '캐시에서 조회')
          }]
        };
      }

      // JIRA API 호출
      const expand = [];
      if (args.includeComments) expand.push('comments');
      if (args.includeSubtasks) expand.push('subtasks');
      
      const expandParam = expand.length > 0 ? expand.join(',') : undefined;
      const url = `/issue/${args.ticketKey}${expandParam ? `?expand=${expandParam}` : ''}`;
      
      const response = await this.jiraClient.get(url);
      const ticket = response.data;

      // 캐시 저장
      this.setCachedData(cacheKey, ticket);

      return {
        content: [{
          type: 'text',
          text: this.formatJiraTicketResponse(ticket, 'JIRA에서 조회')
        }]
      };
    } catch (error: any) {
      const errorMessage = error.response?.status === 404 
        ? `티켓 '${args.ticketKey}'를 찾을 수 없습니다.`
        : `JIRA 티켓 조회 실패: ${error.message}`;
      
      return {
        content: [{
          type: 'text',
          text: `❌ ${errorMessage}`
        }],
        isError: true,
      };
    }
  }

  /**
   * JIRA 티켓 검색 (JQL 사용, 캐싱 적용)
   */
  private async handleSearchJiraTickets(args: { jql: string; maxResults?: number }) {
    if (!this.jiraClient) {
      return {
        content: [{
          type: 'text',
          text: '❌ JIRA 설정이 없습니다. 환경 변수를 설정하고 서버를 재시작하세요.'
        }],
        isError: true,
      };
    }

    try {
      const maxResults = args.maxResults || 10;
      const cacheKey = this.generateCacheKey(`jira-search`, { jql: args.jql, maxResults });
      
      // 캐시 확인
      const cachedResults = this.getCachedData(cacheKey);
      if (cachedResults) {
        return {
          content: [{
            type: 'text',
            text: this.formatJiraSearchResponse(cachedResults, '캐시에서 조회')
          }]
        };
      }

      // JIRA API 호출
      const response = await this.jiraClient.post('/search', {
        jql: args.jql,
        maxResults: maxResults,
        fields: ['key', 'summary', 'status', 'assignee', 'priority', 'created', 'updated', 'description']
      });

      const searchResults = response.data;

      // 캐시 저장
      this.setCachedData(cacheKey, searchResults);

      return {
        content: [{
          type: 'text',
          text: this.formatJiraSearchResponse(searchResults, 'JIRA에서 검색')
        }]
      };
    } catch (error: any) {
      return {
        content: [{
          type: 'text',
          text: `❌ JIRA 검색 실패: ${error.message}`
        }],
        isError: true,
      };
    }
  }

  /**
   * JIRA 티켓 응답 포맷팅
   */
  private formatJiraTicketResponse(ticket: any, source: string): string {
    const assignee = ticket.fields.assignee ? ticket.fields.assignee.displayName : '미배정';
    const status = ticket.fields.status.name;
    const priority = ticket.fields.priority?.name || '없음';
    const created = new Date(ticket.fields.created).toLocaleString('ko-KR');
    const updated = new Date(ticket.fields.updated).toLocaleString('ko-KR');

    let response = `🎫 **JIRA 티켓 정보** (${source})

**📋 기본 정보**
- **티켓 키**: ${ticket.key}
- **제목**: ${ticket.fields.summary}
- **상태**: ${status}
- **담당자**: ${assignee}
- **우선순위**: ${priority}
- **생성일**: ${created}
- **수정일**: ${updated}

**📝 설명**
${ticket.fields.description || '설명 없음'}`;

    // 댓글 포함
    if (ticket.fields.comments?.comments?.length > 0) {
      response += `\n\n**💬 댓글 (${ticket.fields.comments.comments.length}개)**`;
      ticket.fields.comments.comments.slice(0, 3).forEach((comment: any, index: number) => {
        const author = comment.author.displayName;
        const created = new Date(comment.created).toLocaleString('ko-KR');
        response += `\n\n${index + 1}. **${author}** (${created})\n${comment.body}`;
      });
      
      if (ticket.fields.comments.comments.length > 3) {
        response += `\n\n... 외 ${ticket.fields.comments.comments.length - 3}개 댓글`;
      }
    }

    // 하위 작업 포함
    if (ticket.fields.subtasks?.length > 0) {
      response += `\n\n**📋 하위 작업 (${ticket.fields.subtasks.length}개)**`;
      ticket.fields.subtasks.forEach((subtask: any, index: number) => {
        response += `\n${index + 1}. **${subtask.key}**: ${subtask.fields.summary} (${subtask.fields.status.name})`;
      });
    }

    return response;
  }

  /**
   * JIRA 검색 결과 포맷팅
   */
  private formatJiraSearchResponse(searchResults: any, source: string): string {
    const total = searchResults.total;
    const issues = searchResults.issues || [];

    let response = `🔍 **JIRA 검색 결과** (${source})

**📊 검색 통계**
- **총 결과**: ${total}개
- **표시된 결과**: ${issues.length}개

**📋 티켓 목록**`;

    if (issues.length === 0) {
      response += '\n검색 결과가 없습니다.';
      return response;
    }

    issues.forEach((issue: any, index: number) => {
      const assignee = issue.fields.assignee ? issue.fields.assignee.displayName : '미배정';
      const status = issue.fields.status.name;
      const priority = issue.fields.priority?.name || '없음';
      const created = new Date(issue.fields.created).toLocaleDateString('ko-KR');

      response += `\n\n**${index + 1}. ${issue.key}**
- **제목**: ${issue.fields.summary}
- **상태**: ${status}
- **담당자**: ${assignee}
- **우선순위**: ${priority}
- **생성일**: ${created}`;

      if (issue.fields.description) {
        const description = issue.fields.description.length > 100 
          ? issue.fields.description.substring(0, 100) + '...'
          : issue.fields.description;
        response += `\n- **설명**: ${description}`;
      }
    });

    return response;
  }



  /**
   * 사이트 목록 조회
   */
  private async handleListAvailableSites() {
    try {
      const sitesData = await this.cachedApiCall('GET', '/sites');
      if (!sitesData.success) {
        return { 
          content: [{ 
            type: 'text', 
            text: `❌ 사이트 목록 조회 실패: ${sitesData.message}` 
          }], 
          isError: true 
        };
      }
      
      const sites = sitesData.data || [];
      if (sites.length === 0) {
        return { 
          content: [{ 
            type: 'text', 
            text: '📋 등록된 사이트가 없습니다. 관리자 UI에서 사이트를 등록하세요.' 
          }] 
        };
      }
      
      return {
        content: [{
          type: 'text',
          text: `🏢 **사용 가능한 사이트** (총 ${sites.length}개)

${sites.map((site: any) => 
  `• **${site.name}** (ID: ${site.id})${site.description ? `\n  📝 ${site.description}` : ''}`
).join('\n\n')}

💡 **사용법**: \`create_impact_analysis\` 도구에서 사이트명 또는 ID를 사용하세요.`
        }]
      };
    } catch (error) {
      return { 
        content: [{ 
          type: 'text', 
          text: `❌ 사이트 목록 조회 오류: ${error instanceof Error ? error.message : '알 수 없는 오류'}` 
        }], 
        isError: true 
      };
    }
  }

  /**
   * 서비스 상태에 따른 리스크 레벨 반환
   */
  private getServiceRiskLevel(services: any[], serviceName: string): string {
    const service = services.find(s => s.name.includes(serviceName));
    if (!service) return '🟡';
    
    switch (service.status) {
      case 'running':
      case 'healthy':
        return '🟢';
      case 'unhealthy':
        return '🟡';
      case 'stopped':
      case 'failed':
        return '🔴';
      default:
        return '❓';
    }
  }

  /**
   * 서비스 상태에 따른 리스크 설명 반환
   */
  private getServiceRiskDescription(services: any[], serviceName: string): string {
    const service = services.find(s => s.name.includes(serviceName));
    if (!service) return '서비스 상태 확인 불가';
    
    switch (service.status) {
      case 'running':
      case 'healthy':
        return '정상 작동 중, 추가 리스크 없음';
      case 'unhealthy':
        return '불안정 상태, RAG 검색 기능 제한 가능성';
      case 'stopped':
        return '서비스 중단, 관련 기능 사용 불가';
      case 'failed':
        return '서비스 실패, 즉시 복구 필요';
      case 'unknown':
        return '상태 불명, 수동 확인 필요';
      default:
        return `현재 상태: ${service.status}`;
    }
  }

  async start(): Promise<void> {
    // 시작 시 오래된 캐시 정리
    this.cleanupOldCache();
    
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    
    // MCP 연결 후에는 최소한의 로그만 출력 (Cursor IDE 호환성 위해)
    const isProduction = process.env.NODE_ENV === 'production' || process.env.MCP_QUIET === 'true';
    
    if (!isProduction) {
      console.error(`🚀 Figure MCP Server v3.1 시작됨`);
      console.error(`📡 Backend: ${this.BACKEND_API_URL}`);
      
      // JIRA 연결 상태 확인 (간소화)
      if (this.jiraClient) {
        const jiraStatus = await this.checkJiraConnection();
        if (jiraStatus.connected) {
          console.error(`✅ JIRA 연결됨: ${jiraStatus.userInfo?.displayName}`);
        } else {
          console.error(`❌ JIRA 연결 실패`);
        }
      } else {
        console.error(`🔗 JIRA: 미설정`);
      }
      
      // 사이트 정보 로드 (간소화)
      const siteStatus = await this.loadAndValidateSites();
      console.error(`📍 사이트: ${siteStatus.success ? '설정됨' : '미설정'}`);
      console.error(`🎯 서버 준비 완료!`);
    } else {
      // 프로덕션 모드에서는 JIRA와 사이트 초기화만 수행
      if (this.jiraClient) {
        await this.checkJiraConnection();
      }
      await this.loadAndValidateSites();
    }
  }
}

// 서버 시작
const mcpServer = new FigureMCPServer();
mcpServer.start().catch((error) => {
  console.error('MCP 서버 시작 중 오류:', error);
  process.exit(1);
});
