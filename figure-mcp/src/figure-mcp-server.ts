#!/usr/bin/env node

// .env 파일 로드 (최우선)
import dotenv from 'dotenv';
dotenv.config();

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import axios from 'axios';
import type { AxiosInstance } from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as os from 'os';

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
  
  // 🆕 지침 캐싱 관련
  private guidelinesCache: Map<string, any> = new Map();
  private guidelinesLastUpdate: Map<string, number> = new Map();
  private readonly GUIDELINES_CACHE_TTL: number = 30 * 60 * 1000; // 30분 (밀리초)
  
  // 🤖 대화형 워크플로우 상태 관리
  private workflowStates: Map<string, any> = new Map();
  private readonly WORKFLOW_STATE_TTL: number = 60 * 60 * 1000; // 1시간 (밀리초)
  
  // DB 연결 설정 (선택적)
  private readonly DB_CONNECTION_STRING: string;
  private readonly DB_TYPE: string;

  constructor() {
    // 백엔드 API URL 설정 (다양한 환경 지원)
    this.BACKEND_API_URL = this.getBackendApiUrl();
    
    // 🔧 Windows에서 안전한 캐시 디렉토리 설정 (사용자 홈 디렉토리 사용)
    const userHome = os.homedir(); // C:\Users\username
    this.CACHE_DIR = path.join(userHome, '.cache', 'figure-mcp');
    console.error(`📁 캐시 디렉토리 설정: ${this.CACHE_DIR}`);
    
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
      timeout: 60000, // 60초 타임아웃 (대용량 데이터 처리 고려)
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate, br' // 🆕 압축 지원
      },
      // 🆕 자동 압축 해제 설정
      decompress: true,
      maxContentLength: 50 * 1024 * 1024, // 50MB 제한
      maxBodyLength: 50 * 1024 * 1024
    });

    this.setupHandlers();
  }

  private setupHandlers(): void {
    // 🤖 SDK 하이브리드 기능 설정
    this.setupPrompts();
    this.setupTools();
  }

  // 🎯 ===== Prompts 설정 (재사용 가능한 워크플로우 템플릿) =====
  
  private setupPrompts(): void {
    this.server.setRequestHandler(ListPromptsRequestSchema, async () => {
      return {
        prompts: [
          {
            name: 'impact_analysis_workflow',
            description: '영향도분석서 생성 워크플로우 (Elicitation + Sampling 통합)',
            arguments: [
              {
                name: 'feature_name',
                description: '분석할 기능명',
                required: true
              },
              {
                name: 'site_name', 
                description: '대상 사이트명',
                required: false
              },
              {
                name: 'analysis_depth',
                description: '분석 깊이 (quick/standard/deep)',
                required: false
              }
            ]
          },
          {
            name: 'requirements_workflow',
            description: '요구사항정의서 생성 워크플로우 (코드베이스 기반)',
            arguments: [
              {
                name: 'feature_name',
                description: '요구사항을 정의할 기능명',
                required: true
              },
              {
                name: 'business_context',
                description: '비즈니스 컨텍스트',
                required: false
              }
            ]
          },
          {
            name: 'table_spec_workflow',
            description: '테이블명세서 생성 워크플로우 (DB 연동)',
            arguments: [
              {
                name: 'table_scope',
                description: '분석할 테이블 범위',
                required: true
              },
              {
                name: 'db_connection',
                description: '데이터베이스 연결 정보',
                required: false
              }
            ]
          }
        ]
      };
    });

    this.server.setRequestHandler(GetPromptRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      
      switch (name) {
        case 'impact_analysis_workflow':
          return await this.getImpactAnalysisPrompt(args);
        case 'requirements_workflow':
          return await this.getRequirementsPrompt(args);
        case 'table_spec_workflow':
          return await this.getTableSpecPrompt(args);
        default:
          throw new Error(`알 수 없는 프롬프트: ${name}`);
      }
    });
  }

  // 🛠️ ===== Tools 설정 =====
  
  private setupTools(): void {
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
            description: '🎯 핵심 개발 문서 생성 (9가지 타입 지원). 자연어로 입력하면 자동으로 타입 매칭합니다.',
            inputSchema: {
              type: 'object',
              properties: {
                documentRequest: {
                  type: 'string',
                  description: `📝 생성할 문서를 자연어로 입력하세요:

🎯 지원 문서 타입 (9가지):
📊 분석: "업무흐름도", "시퀀스다이어그램", "요구사항서" 
🏗️ 설계: "온라인 프로그램 설계서", "배치 프로그램 설계서", "공통 프로그램 설계서", "테이블 명세서", "인터페이스 명세서"
🔍 검토: "영향도 분석서"

💡 입력 예시:
• "사용자 관리 시스템의 테이블 명세서 만들어줘"
• "결제 프로세스 요구사항서" 
• "주문 관리 온라인 프로그램 설계서"
• "데이터 동기화 영향도 분석서"`
                },
                siteName: { 
                  type: 'string', 
                  description: `🏢 사이트명/ID (선택사항 - 환경변수 DEFAULT_SITE_NAME 사용)
미입력시 .env 파일의 기본 사이트 설정을 사용합니다.
백오피스(http://localhost:3001)에서 사이트 확인 가능합니다.`
                },
                projectPath: { 
                  type: 'string', 
                  description: '📁 프로젝트 경로 (선택사항 - 코드 분석용)'
                },
                analysisType: {
                  type: 'string',
                  enum: ['full', 'quick', 'template-only'],
                  default: 'full',
                  description: '⚡ 분석 수준: full(완전분석), quick(빠른분석), template-only(템플릿만)'
                },
                additionalContext: {
                  type: 'string',
                  description: '📋 추가 컨텍스트 정보 (선택사항)'
                }
              },
              required: ['documentRequest'],
            },
          },
          {
            name: 'create_table_specification',
            description: '🗄️ 데이터베이스 테이블 명세서 생성. DB 연결시 실제 스키마 조회, 미연결시 수동 입력 모드로 동작합니다.',
            inputSchema: {
              type: 'object',
              properties: {
                tableName: {
                  type: 'string',
                  description: '테이블명 또는 테이블 목록 (쉼표로 구분)'
                },
                siteName: {
                  type: 'string',
                  description: `🏢 사이트명/ID (선택사항 - 환경변수 DEFAULT_SITE_NAME 사용)
미입력시 .env 파일의 기본 사이트 설정을 사용합니다.`
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

          // 🆕 지식 검색 (Cursor 직접 처리용)
          {
            name: 'search_knowledge',
            description: '지식베이스에서 관련 문서를 검색하여 원본 문서 내용을 반환합니다. Cursor/Claude가 직접 분석하여 답변을 생성할 수 있습니다.',
            inputSchema: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: '검색할 질문이나 키워드 (예: "a 업무", "결제 프로세스", "사용자 인증")'
                },
                max_results: {
                  type: 'number',
                  description: '반환할 최대 문서 수 (기본값: 5, 최대: 20)',
                  default: 5
                },
                similarity_threshold: {
                  type: 'number',
                  description: '유사도 임계값 (0.0-1.0, 기본값: 0.3)',
                  default: 0.3
                },
                site_name: {
                  type: 'string',
                  description: `🏢 특정 사이트의 문서만 검색 (선택사항 - 환경변수 DEFAULT_SITE_NAME 사용)
미입력시 .env 파일의 기본 사이트 설정을 사용합니다.`
                },
                include_metadata: {
                  type: 'boolean',
                  description: '문서 메타데이터 포함 여부 (기본값: true)',
                  default: true
                },
                enable_chunking: {
                  type: 'boolean',
                  description: '큰 결과를 여러 번에 나누어 반환 (기본값: false)',
                  default: false
                },
                chunk_size: {
                  type: 'number',
                  description: '청킹 사용 시 청크당 문서 수 (기본값: 3)',
                  default: 3
                }
              },
              required: ['query']
            }
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
          },

          // 🤖 SDK 하이브리드 워크플로우 도구 (Prompts + Elicitation + Sampling)
          {
            name: 'hybrid_document_generator',
            description: 'MCP SDK의 Prompts, Elicitation, Sampling을 모두 활용한 강력한 대화형 문서 생성 도구입니다.',
            inputSchema: {
              type: 'object',
              properties: {
                document_type: {
                  type: 'string',
                  enum: ['BUSINESS_FLOW', 'SEQUENCE_DIAGRAM', 'REQUIREMENTS', 'PROGRAM_DESIGN_ONLINE', 'PROGRAM_DESIGN_BATCH', 'PROGRAM_DESIGN_COMMON', 'IMPACT_ANALYSIS', 'TABLE_SPECIFICATION', 'INTERFACE_SPECIFICATION'],
                  description: '생성할 문서 타입'
                },
                feature_name: {
                  type: 'string',
                  description: '분석/설계할 기능명'
                },
                site_name: {
                  type: 'string',
                  description: '대상 사이트명 (선택적)',
                  default: ''
                },
                workflow_mode: {
                  type: 'string',
                  enum: ['interactive', 'guided', 'auto'],
                  default: 'interactive',
                  description: 'interactive: 단계별 상호작용, guided: 가이드 모드, auto: 자동 모드'
                }
              },
              required: ['document_type', 'feature_name']
            }
          },
          
          // 기존 단순 도구들 (하위 호환성)
          {
            name: 'execute_workflow',
            description: '(레거시) 기존 워크플로우 실행 도구',
            inputSchema: {
              type: 'object',
              properties: {
                workflow_id: { type: 'string' },
                codebase_findings: { type: 'object' },
                additional_analysis: { type: 'string' }
              },
              required: ['workflow_id', 'codebase_findings']
            }
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
          case 'search_knowledge':
            return await this.handleSearchKnowledge(args as any);
          case 'fetch_jira_ticket': 
            return await this.handleFetchJiraTicket(args as any);
          case 'search_jira_tickets': 
            return await this.handleSearchJiraTickets(args as any);
          
          // 🤖 SDK 하이브리드 워크플로우 핸들러
          case 'hybrid_document_generator':
            return await this.handleHybridDocumentGenerator(args as any);
          case 'execute_workflow':
            return await this.handleExecuteWorkflow(args as any);
          
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
          // 사이트를 찾을 수 없을 때 실시간으로 최신 사이트 목록 재조회 후 다시 검색
          targetSite = await this.findSiteWithRefresh(args.siteName);
          if (!targetSite) {
            const errorMessage = await this.generateSiteNotFoundError(args.siteName);
            throw new Error(errorMessage);
          }
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
          // 사이트를 찾을 수 없을 때 실시간으로 최신 사이트 목록 재조회 후 다시 검색
          targetSite = await this.findSiteWithRefresh(args.siteName);
          if (!targetSite) {
            const errorMessage = await this.generateSiteNotFoundError(args.siteName);
            throw new Error(errorMessage);
          }
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
      
      console.error(`🔍 백엔드 템플릿 API 응답 구조 확인:`);
      console.error(`   ✅ 성공 여부: ${templateData.success}`);
      console.error(`   📋 응답 키: [${Object.keys(templateData).join(', ')}]`);
      if (templateData.data) {
        console.error(`   🎯 데이터 키: [${Object.keys(templateData.data).join(', ')}]`);
        console.error(`   📄 템플릿 존재: ${templateData.data.template ? '✅ YES' : '❌ NO'}`);
        console.error(`   📏 템플릿 길이: ${templateData.data.template?.length || 0} 문자`);
        console.error(`   🔧 변수 개수: ${Object.keys(templateData.data.variables || {}).length}개`);
        console.error(`   🎯 지침 존재: ${templateData.data.guidelines ? '✅ YES' : '❌ NO'}`);
      }
      
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
      return await this.generateDocumentResponse(documentArgs, targetSite, template, analysisType, startTime);

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
      // 1단계: 사이트 정보 결정
      let targetSite = null;
      
      if (args.siteName) {
        // 사이트명 또는 ID로 검색
        targetSite = this.findSite(args.siteName, args.siteName);
      if (!targetSite) {
          // 사이트를 찾을 수 없을 때 실시간으로 최신 사이트 목록 재조회 후 다시 검색
          targetSite = await this.findSiteWithRefresh(args.siteName);
          if (!targetSite) {
            const errorMessage = await this.generateSiteNotFoundError(args.siteName);
            throw new Error(errorMessage);
          }
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
            throw new Error('사용 가능한 사이트가 없습니다.');
          }
        }
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
    
    // 🎯 핵심 개발 문서 타입 매칭 패턴들 (새로운 9가지 타입)
    const documentPatterns: { [key: string]: string[] } = {
      // 📊 분석 단계
      'business_flow': [
        '목표업무흐름도', '목표 업무 흐름도', '업무흐름도', '업무 흐름도',
        'business flow', '비즈니스 플로우', '업무 프로세스', '업무프로세스',
        '프로세스 흐름도', '워크플로우', 'workflow', '업무 플로우차트'
      ],
      'sequence_diagram': [
        '시퀀스다이어그램', '시퀀스 다이어그램', 'sequence diagram',
        '순서도', '시퀀스도', '상호작용 다이어그램', '시퀀스 차트',
        '호출 흐름도', '메시지 시퀀스', 'interaction diagram'
      ],
      'requirements': [
        '요구사항서', '요구사항정의서', '요구사항 정의서', '요구사항분석서',
        'requirements', '요구 사항서', '요구 사항 정의서', '요구 사항 분석서',
        '기능요구사항', '비기능요구사항', '요구명세서'
      ],
      
      // 🏗️ 설계 단계
      'program_design_online': [
        '프로그램설계서(온라인)', '프로그램 설계서 온라인', 'program design online',
        '온라인 프로그램 설계서', '웹 프로그램 설계서', '온라인시스템 설계서',
        '온라인 어플리케이션 설계서', '웹어플리케이션 설계서', 'web application design'
      ],
      'program_design_batch': [
        '프로그램설계서(배치)', '프로그램 설계서 배치', 'program design batch',
        '배치 프로그램 설계서', '배치시스템 설계서', '스케줄러 설계서',
        '배치작업 설계서', 'batch job design', '배치 처리 설계서'
      ],
      'program_design_common': [
        '프로그램설계서(공통)', '프로그램 설계서 공통', 'program design common',
        '공통 프로그램 설계서', '공통모듈 설계서', '공통컴포넌트 설계서',
        '공유모듈 설계서', 'common module design', '유틸리티 설계서'
      ],
      'table_specification': [
        '테이블명세서', '테이블정의서', '테이블 명세서', '테이블 정의서', 
        'table spec', 'table specification', '테이블 설계서', '테이블설계서', 
        'db 명세서', '데이터베이스 명세서', '테이블 구조', '스키마 명세서', 'schema spec'
      ],
      'interface_specification': [
        '인터페이스명세서', '인터페이스정의서', '인터페이스 명세서', '인터페이스 정의서',
        'interface spec', 'interface specification', 'api 명세서', 'api명세서',
        'api spec', 'api specification', 'api 설계서', '연동규격서', '연동 명세서'
      ],
      
      // 🔍 검토 단계  
      'impact_analysis': [
        '영향도분석서', '영향도 분석서', 'impact analysis',
        '영향 분석서', '파급 효과 분석서', '영향도 평가서',
        '변경영향도', '변경 영향도', '의존성 분석서'
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
   * 문자열 유사도 계산 (Levenshtein distance 기반)
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const len1 = str1.length;
    const len2 = str2.length;
    const matrix = Array.from({ length: len1 + 1 }, () => Array(len2 + 1).fill(0));

    for (let i = 0; i <= len1; i++) matrix[i][0] = i;
    for (let j = 0; j <= len2; j++) matrix[0][j] = j;

    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = str1[i - 1].toLowerCase() === str2[j - 1].toLowerCase() ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost
        );
      }
    }

    const maxLen = Math.max(len1, len2);
    return maxLen === 0 ? 1 : (maxLen - matrix[len1][len2]) / maxLen;
  }

  /**
   * 유사한 사이트명 찾기
   */
  private findSimilarSites(inputSiteName: string, threshold: number = 0.5): string[] {
    if (!this.availableSites || this.availableSites.length === 0) {
      return [];
    }

    return this.availableSites
      .map(site => ({
        name: site.name,
        similarity: this.calculateSimilarity(inputSiteName, site.name)
      }))
      .filter(item => item.similarity >= threshold)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 3)
      .map(item => item.name);
  }

  /**
   * 사이트 재조회 후 검색
   */
  private async findSiteWithRefresh(inputSiteName: string): Promise<any | null> {
    console.error(`🔍 사이트 "${inputSiteName}"를 찾을 수 없어서 최신 목록을 재조회합니다...`);

    try {
      // 실시간으로 최신 사이트 목록 재조회 (캐시 무시)
      const response = await this.apiClient.get('/sites/', { 
        params: { active_only: true },
        headers: { 'Cache-Control': 'no-cache' }
      });
      
      if (response.data?.success && response.data?.data) {
        this.availableSites = response.data.data;
        console.error(`📋 최신 사이트 목록 재조회 완료: ${this.availableSites.length}개`);
        
        // 재조회 후 다시 한번 검색 시도
        const retryTargetSite = this.findSite(inputSiteName, inputSiteName);
        if (retryTargetSite) {
          console.error(`✅ 재조회 후 사이트 발견: ${retryTargetSite.name}`);
          return retryTargetSite;
        }
      }
    } catch (error) {
      console.error(`❌ 사이트 목록 재조회 실패: ${error}`);
    }

    return null;
  }

  /**
   * 사이트를 찾을 수 없을 때 친화적인 에러 메시지 생성
   */
  private async generateSiteNotFoundError(inputSiteName: string): Promise<string> {
    // 유사한 사이트명 찾기
    const similarSites = this.findSimilarSites(inputSiteName);
    
    let errorMessage = `❌ 사이트를 찾을 수 없습니다: "${inputSiteName}"\n\n`;
    
    // 유사한 사이트명이 있으면 추천
    if (similarSites.length > 0) {
      errorMessage += `🤔 혹시 이런 사이트명을 찾고 계신가요?\n`;
      similarSites.forEach(siteName => {
        errorMessage += `   💡 "${siteName}"\n`;
      });
      errorMessage += `\n`;
    }
    
    // 전체 사이트 목록 표시
    errorMessage += `📋 현재 사용 가능한 모든 사이트 목록:\n`;
    if (this.availableSites.length > 0) {
      this.availableSites.forEach(site => {
        errorMessage += `   - ${site.name} (${site.company})\n`;
      });
    } else {
      errorMessage += `   (등록된 사이트가 없습니다)\n`;
    }
    
    errorMessage += `\n🔧 해결 방법:\n`;
    errorMessage += `1. 위 목록에서 정확한 사이트명을 복사하여 사용하세요\n`;
    errorMessage += `2. 새 사이트가 필요하면 백오피스 관리자 UI (http://localhost:3001)에서 등록하세요\n`;
    errorMessage += `3. 또는 DEFAULT_SITE_NAME 환경 변수를 설정하세요`;
    
    return errorMessage;
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
   * 캐시 디렉토리 초기화 (향상된 오류 처리 포함)
   */
  private initializeCacheDirectory(): void {
    try {
      console.error(`🔍 캐시 디렉토리 초기화 시작: ${this.CACHE_DIR}`);
      
      // 디렉토리 존재 확인
      if (fs.existsSync(this.CACHE_DIR)) {
        const stats = fs.statSync(this.CACHE_DIR);
        if (stats.isDirectory()) {
          console.error(`📁 캐시 디렉토리 이미 존재: ${this.CACHE_DIR}`);
          
          // 쓰기 권한 확인
          try {
            fs.accessSync(this.CACHE_DIR, fs.constants.W_OK);
            console.error(`✅ 캐시 디렉토리 쓰기 권한 확인됨`);
          } catch (accessError) {
            console.error(`⚠️ 캐시 디렉토리 쓰기 권한 없음 - 캐시 기능 제한됨`);
          }
          return;
        } else {
          console.error(`⚠️ 캐시 경로가 파일입니다. 디렉토리로 변경 시도...`);
        }
      }
      
      // 디렉토리 생성
      console.error(`📁 캐시 디렉토리 생성 중: ${this.CACHE_DIR}`);
        fs.mkdirSync(this.CACHE_DIR, { recursive: true });
      console.error(`✅ 캐시 디렉토리 생성 성공: ${this.CACHE_DIR}`);
      
      // 생성 후 권한 확인
      try {
        fs.accessSync(this.CACHE_DIR, fs.constants.W_OK);
        console.error(`✅ 캐시 디렉토리 쓰기 권한 확인됨`);
      } catch (accessError) {
        console.error(`⚠️ 생성된 캐시 디렉토리 쓰기 권한 없음`);
      }
      
    } catch (error) {
      console.error(`❌ 캐시 디렉토리 초기화 실패: ${error instanceof Error ? error.message : 'Unknown'}`);
      console.error(`   📁 대상 경로: ${this.CACHE_DIR}`);
      
      if (error instanceof Error) {
        console.error(`   🔥 오류 코드: ${(error as any).code || 'N/A'}`);
        
        if ((error as any).code === 'EPERM') {
          console.error(`   💡 권한 문제: 관리자 권한이 필요하거나 다른 위치를 사용하세요.`);
          console.error(`   💡 대안: 환경 변수로 캐시 경로 변경 가능`);
        } else if ((error as any).code === 'EEXIST') {
          console.error(`   💡 파일 존재: 같은 이름의 파일이 있습니다.`);
        }
      }
      
      // 🔄 대체 캐시 디렉토리 시도 (임시 디렉토리)
      try {
        const tempDir = os.tmpdir();
        const altCacheDir = path.join(tempDir, 'figure-mcp-cache');
        console.error(`🔄 대체 캐시 디렉토리 시도: ${altCacheDir}`);
        
        if (!fs.existsSync(altCacheDir)) {
          fs.mkdirSync(altCacheDir, { recursive: true });
          console.error(`✅ 대체 캐시 디렉토리 생성 성공: ${altCacheDir}`);
          
          // CACHE_DIR을 임시로 변경 (readonly이므로 불가능하지만 로그로 안내)
          console.error(`   ⚠️ 주의: 임시 디렉토리 사용 중 - 재시작 시 캐시 손실 가능`);
        }
      } catch (altError) {
        console.error(`❌ 대체 캐시 디렉토리도 실패: ${altError instanceof Error ? altError.message : 'Unknown'}`);
        console.error(`   ⚠️ 캐시 기능 비활성화 - 성능 저하 가능`);
      }
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
   * 캐시에서 데이터 조회 (상세 로깅 포함)
   */
  private getCachedData(cacheKey: string): any | null {
    const startTime = Date.now();
    
    try {
      const filePath = this.getCacheFilePath(cacheKey);
      
      console.error(`🔍 캐시 파일 조회 시작: ${cacheKey}`);
      console.error(`   📂 파일 경로: ${filePath}`);
      
      if (!fs.existsSync(filePath)) {
        console.error(`❌ 캐시 파일 없음: ${cacheKey}`);
        return null;
      }

      const stats = fs.statSync(filePath);
      const now = Date.now();
      const fileAge = now - stats.mtime.getTime();
      const fileSizeBytes = stats.size;
      const fileSizeKB = Math.round(fileSizeBytes / 1024 * 100) / 100;

      console.error(`📊 캐시 파일 정보:`);
      console.error(`   📅 생성 시간: ${stats.mtime.toISOString()}`);
      console.error(`   📏 파일 크기: ${fileSizeKB}KB (${fileSizeBytes} bytes)`);
      console.error(`   ⏰ 파일 나이: ${Math.round(fileAge / 1000)}초`);
      console.error(`   ⏳ TTL 한계: ${Math.round(this.CACHE_TTL / 1000)}초`);
      console.error(`   ✅ 유효 여부: ${fileAge <= this.CACHE_TTL ? '🟢 VALID' : '🔴 EXPIRED'}`);

      // TTL 확인
      if (fileAge > this.CACHE_TTL) {
        console.error(`🗑️ 만료된 캐시 삭제: ${cacheKey} (${Math.round(fileAge / 1000)}초 초과)`);
        fs.unlinkSync(filePath); // 만료된 캐시 삭제
        console.error(`✅ 캐시 파일 삭제 완료: ${filePath}`);
        return null;
      }

      const rawData = fs.readFileSync(filePath, 'utf-8');
      const cachedData = JSON.parse(rawData);
      const readTime = Date.now() - startTime;
      
      // 데이터 구조 분석
      const dataSize = rawData.length;
      const dataKeys = typeof cachedData === 'object' && cachedData !== null 
        ? Object.keys(cachedData) 
        : [];
      
      console.error(`🎯 캐시 HIT 성공:`);
      console.error(`   🔑 캐시 키: ${cacheKey}`);
      console.error(`   📊 데이터 크기: ${dataSize} 문자 (${fileSizeKB}KB)`);
      console.error(`   🔑 데이터 키: [${dataKeys.join(', ')}]`);
      console.error(`   ⏰ 파일 나이: ${Math.round(fileAge / 1000)}초`);
      console.error(`   ⏱️ 남은 TTL: ${Math.round((this.CACHE_TTL - fileAge) / 1000)}초`);
      console.error(`   🚀 읽기 시간: ${readTime}ms`);
      
      // 특정 데이터 타입별 상세 정보
      if (cachedData.success !== undefined) {
        console.error(`   ✅ API 응답 상태: ${cachedData.success ? '성공' : '실패'}`);
      }
      if (cachedData.data && typeof cachedData.data === 'object') {
        const innerKeys = Object.keys(cachedData.data);
        console.error(`   🎯 내부 데이터 키: [${innerKeys.join(', ')}]`);
      }
      
      return cachedData;
    } catch (error) {
      const readTime = Date.now() - startTime;
      console.error(`❌ 캐시 조회 실패 (${readTime}ms): ${cacheKey}`);
      console.error(`   🔥 오류 유형: ${error instanceof Error ? error.constructor.name : typeof error}`);
      console.error(`   📄 오류 메시지: ${error instanceof Error ? error.message : JSON.stringify(error)}`);
      
      if (error instanceof Error && error.stack) {
        console.error(`   📚 스택 트레이스: ${error.stack.split('\n').slice(0, 3).join('\n')}`);
      }
      
      return null;
    }
  }

  /**
   * 캐시에 데이터 저장 (상세 로깅 포함)
   */
  private setCachedData(cacheKey: string, data: any): void {
    const startTime = Date.now();
    
    try {
      const filePath = this.getCacheFilePath(cacheKey);
      const jsonData = JSON.stringify(data, null, 2);
      const dataSize = jsonData.length;
      const dataSizeKB = Math.round(dataSize / 1024 * 100) / 100;
      
      console.error(`💾 캐시 저장 시작: ${cacheKey}`);
      console.error(`   📂 파일 경로: ${filePath}`);
      console.error(`   📊 데이터 크기: ${dataSizeKB}KB (${dataSize} 문자)`);
      
      // 데이터 구조 분석
      const dataKeys = typeof data === 'object' && data !== null 
        ? Object.keys(data) 
        : [];
      
      console.error(`   🔑 데이터 키: [${dataKeys.join(', ')}]`);
      
      // 특정 데이터 타입별 상세 정보
      if (data.success !== undefined) {
        console.error(`   ✅ API 응답 상태: ${data.success ? '성공' : '실패'}`);
      }
      if (data.data && typeof data.data === 'object') {
        const innerKeys = Object.keys(data.data);
        console.error(`   🎯 내부 데이터 키: [${innerKeys.join(', ')}]`);
        
        // 템플릿 관련 상세 정보
        if (data.data.template) {
          console.error(`   📋 템플릿 길이: ${data.data.template.length} 문자`);
        }
        if (data.data.variables) {
          console.error(`   🔧 변수 개수: ${Object.keys(data.data.variables).length}개`);
        }
        if (data.data.guidelines) {
          console.error(`   🎯 지침 포함: ✅ YES`);
          if (data.data.guidelines.guidelines) {
            console.error(`   📚 개별 지침: ${data.data.guidelines.guidelines.length}개`);
          }
        }
      }
      
      // 🔧 디렉토리 존재 확인 및 생성
      const dirPath = path.dirname(filePath);
      if (!fs.existsSync(dirPath)) {
        console.error(`📁 캐시 디렉토리 생성: ${dirPath}`);
        fs.mkdirSync(dirPath, { recursive: true });
      }
      
      // 파일 쓰기 시작
      console.error(`📝 파일 쓰기 시작...`);
      fs.writeFileSync(filePath, jsonData, 'utf-8');
      
      // 저장 후 검증
      const stats = fs.statSync(filePath);
      const writeTime = Date.now() - startTime;
      
      console.error(`✅ 캐시 저장 완료:`);
      console.error(`   🔑 캐시 키: ${cacheKey}`);
      console.error(`   📂 파일 경로: ${filePath}`);
      console.error(`   📏 저장된 크기: ${Math.round(stats.size / 1024 * 100) / 100}KB`);
      console.error(`   ⏰ 생성 시간: ${stats.mtime.toISOString()}`);
      console.error(`   ⏳ TTL: ${Math.round(this.CACHE_TTL / 1000)}초`);
      console.error(`   🚀 저장 시간: ${writeTime}ms`);
      console.error(`   📅 만료 예정: ${new Date(Date.now() + this.CACHE_TTL).toISOString()}`);
      
    } catch (error) {
      const writeTime = Date.now() - startTime;
      console.error(`❌ 캐시 저장 실패 (${writeTime}ms): ${cacheKey}`);
      console.error(`   🔥 오류 유형: ${error instanceof Error ? error.constructor.name : typeof error}`);
      console.error(`   📄 오류 메시지: ${error instanceof Error ? error.message : JSON.stringify(error)}`);
      console.error(`   📂 대상 경로: ${this.getCacheFilePath(cacheKey)}`);
      console.error(`   📊 시도한 데이터 크기: ${JSON.stringify(data).length} 문자`);
      
      if (error instanceof Error && error.stack) {
        console.error(`   📚 스택 트레이스: ${error.stack.split('\n').slice(0, 3).join('\n')}`);
      }
      
      // 🔍 디렉토리 상태 상세 확인
      const filePath = this.getCacheFilePath(cacheKey);
      const dirPath = path.dirname(filePath);
      
      console.error(`   🔍 디렉토리 상태 확인:`);
      console.error(`   📂 파일 경로: ${filePath}`);
      console.error(`   📁 디렉토리 경로: ${dirPath}`);
      console.error(`   🏠 기본 캐시 디렉토리: ${this.CACHE_DIR}`);
      
      try {
        // 기본 캐시 디렉토리 확인
        if (fs.existsSync(this.CACHE_DIR)) {
          const stats = fs.statSync(this.CACHE_DIR);
          console.error(`   📁 기본 캐시 디렉토리: ✅ 존재 (${stats.isDirectory() ? '디렉토리' : '파일'})`);
        } else {
          console.error(`   📁 기본 캐시 디렉토리: ❌ 없음`);
        }
        
        // 실제 대상 디렉토리 확인
        if (fs.existsSync(dirPath)) {
          const dirStats = fs.statSync(dirPath);
          console.error(`   📂 대상 디렉토리: ✅ 존재 (${dirStats.isDirectory() ? '디렉토리' : '파일'})`);
        } else {
          console.error(`   📂 대상 디렉토리: ❌ 없음`);
        }
        
        // 권한 확인 시도
        try {
          fs.accessSync(path.dirname(dirPath), fs.constants.W_OK);
          console.error(`   🔐 부모 디렉토리 쓰기 권한: ✅ 있음`);
        } catch (permError) {
          console.error(`   🔐 부모 디렉토리 쓰기 권한: ❌ 없음`);
        }
        
      } catch (checkError) {
        console.error(`   🔥 디렉토리 확인 중 오류: ${checkError instanceof Error ? checkError.message : 'Unknown'}`);
      }
    }
  }

  /**
   * 캐시 나이 조회 (상세 로깅 포함)
   */
  private getCacheAge(cacheKey: string): number {
    try {
      const filePath = this.getCacheFilePath(cacheKey);
      
      if (!fs.existsSync(filePath)) {
        console.error(`⏰ 캐시 나이 조회 실패: 파일 없음 (${cacheKey})`);
        return Infinity;
      }

      const stats = fs.statSync(filePath);
      const now = Date.now();
      const fileAge = now - stats.mtime.getTime();
      
      console.error(`⏰ 캐시 나이 조회:`);
      console.error(`   🔑 캐시 키: ${cacheKey}`);
      console.error(`   📅 생성 시간: ${stats.mtime.toISOString()}`);
      console.error(`   ⏰ 현재 나이: ${Math.round(fileAge / 1000)}초`);
      console.error(`   ⏳ TTL 기준: ${Math.round(this.CACHE_TTL / 1000)}초`);
      console.error(`   ✅ 유효 여부: ${fileAge <= this.CACHE_TTL ? '🟢 VALID' : '🔴 EXPIRED'}`);
      
      return fileAge;
    } catch (error) {
      console.error(`❌ 캐시 나이 조회 오류 (${cacheKey}): ${error instanceof Error ? error.message : 'Unknown'}`);
      return Infinity;
    }
  }

  /**
   * 오래된 캐시 파일 정리 (안전한 디렉토리 확인 포함)
   */
  private cleanupOldCache(): void {
    try {
      // 🔍 캐시 디렉토리 존재 여부 확인
      if (!fs.existsSync(this.CACHE_DIR)) {
        console.error(`🧹 캐시 정리 스킵: 디렉토리 없음 (${this.CACHE_DIR})`);
        return;
      }

      // 디렉토리인지 확인
      const stats = fs.statSync(this.CACHE_DIR);
      if (!stats.isDirectory()) {
        console.error(`🧹 캐시 정리 스킵: 디렉토리가 아님 (${this.CACHE_DIR})`);
        return;
      }

      const files = fs.readdirSync(this.CACHE_DIR);
      const now = Date.now();
      let cleanedCount = 0;
      let totalFiles = 0;

      console.error(`🧹 캐시 정리 시작: ${files.length}개 파일 확인`);

      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        totalFiles++;
        
        const filePath = path.join(this.CACHE_DIR, file);
        
        try {
          const fileStats = fs.statSync(filePath);
          const fileAge = now - fileStats.mtime.getTime();

        if (fileAge > this.CACHE_TTL) {
          fs.unlinkSync(filePath);
          cleanedCount++;
            console.error(`   🗑️ 삭제됨: ${file} (나이: ${Math.round(fileAge / 1000)}초)`);
          }
        } catch (fileError) {
          console.error(`   ⚠️ 파일 처리 실패: ${file} - ${fileError instanceof Error ? fileError.message : 'Unknown'}`);
        }
      }

      if (cleanedCount > 0) {
        console.error(`✅ 캐시 정리 완료: ${cleanedCount}/${totalFiles}개 파일 정리`);
      } else if (totalFiles > 0) {
        console.error(`✅ 캐시 정리 완료: 정리할 파일 없음 (${totalFiles}개 파일 모두 유효)`);
      } else {
        console.error(`✅ 캐시 정리 완료: 캐시 파일 없음`);
      }
      
    } catch (error) {
      console.error(`❌ 캐시 정리 실패: ${error instanceof Error ? error.message : 'Unknown'}`);
      console.error(`   📁 대상 디렉토리: ${this.CACHE_DIR}`);
      
      if (error instanceof Error && (error as any).code === 'ENOENT') {
        console.error(`   💡 해결방안: 캐시 디렉토리가 존재하지 않습니다. 다음 실행 시 자동 생성됩니다.`);
      } else if (error instanceof Error && (error as any).code === 'EPERM') {
        console.error(`   💡 해결방안: 캐시 디렉토리 권한을 확인하세요.`);
      }
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
   * 캐싱을 적용한 API 호출 (상세 로깅 포함)
   */
  private async cachedApiCall(method: 'GET' | 'POST', url: string, params?: any, data?: any): Promise<any> {
    const startTime = Date.now();
    const cacheKey = this.generateCacheKey(`${method}:${url}`, { params, data });
    
    // 🔍 캐시 확인 로그
    console.error(`🔍 캐시 확인 중: ${method} ${url}`);
    if (params) {
      console.error(`   📋 파라미터: ${JSON.stringify(params, null, 2)}`);
    }
    if (data) {
      console.error(`   📦 요청 데이터: ${JSON.stringify(data, null, 2)}`);
    }
    
    // 캐시에서 조회
    const cachedResult = this.getCachedData(cacheKey);
    if (cachedResult) {
      const cacheAge = this.getCacheAge(cacheKey);
      const responseTime = Date.now() - startTime;
      console.error(`🚀 캐시 HIT: ${method} ${url} (나이: ${Math.round(cacheAge/1000)}초, 응답시간: ${responseTime}ms)`);
      console.error(`   📊 캐시된 데이터 크기: ${JSON.stringify(cachedResult).length} bytes`);
      return cachedResult;
    }

    console.error(`🌐 캐시 MISS - API 호출 시작: ${method} ${url}`);

    try {
    // API 호출
    let response;
    if (method === 'GET') {
      response = await this.apiClient.get(url, { params });
    } else {
      response = await this.apiClient.post(url, data, { params });
    }

      const responseTime = Date.now() - startTime;
      const responseSize = JSON.stringify(response.data).length;

      // 🎯 성공 로그
      console.error(`✅ API 응답 성공: ${method} ${url} (${responseTime}ms, ${responseSize} bytes)`);
      console.error(`   📊 응답 상태: ${response.data.success ? '✅ SUCCESS' : '❌ FAIL'}`);
      
      if (response.data.message) {
        console.error(`   💬 메시지: ${response.data.message}`);
      }

      // 📈 응답 데이터 분석
      if (response.data.data) {
        const dataKeys = Object.keys(response.data.data);
        console.error(`   🔑 데이터 키: [${dataKeys.join(', ')}]`);
        
        // 템플릿 관련 정보 로깅
        if (response.data.data.template) {
          console.error(`   📋 템플릿 길이: ${response.data.data.template.length} 문자`);
        }
        if (response.data.data.variables) {
          console.error(`   🔧 변수 개수: ${Object.keys(response.data.data.variables).length}개`);
        }
        if (response.data.data.guidelines) {
          console.error(`   🎯 지침 개수: ${response.data.data.guidelines.guidelines?.length || 0}개`);
          console.error(`   📊 통합 지침 개수: ${response.data.data.guidelines.combined_instructions?.count || 0}개`);
        }
    }

    // 성공한 결과만 캐싱
    if (response.data.success) {
      this.setCachedData(cacheKey, response.data);
        console.error(`🗄️ 캐시 저장 완료: ${cacheKey.substring(0, 60)}... (TTL: ${this.CACHE_TTL}ms)`);
        console.error(`   📦 저장된 데이터 크기: ${responseSize} bytes`);
      } else {
        console.error(`⚠️ 실패한 응답은 캐시하지 않음: ${response.data.message}`);
    }

    return response.data;
    } catch (error) {
      const responseTime = Date.now() - startTime;
      console.error(`❌ API 호출 실패: ${method} ${url} (${responseTime}ms)`);
      console.error(`   🔥 오류 유형: ${error instanceof Error ? error.constructor.name : typeof error}`);
      console.error(`   📄 오류 메시지: ${error instanceof Error ? error.message : JSON.stringify(error)}`);
      
      if (error instanceof Error && 'response' in error) {
        const axiosError = error as any;
        if (axiosError.response) {
          console.error(`   🚨 HTTP 상태: ${axiosError.response.status} ${axiosError.response.statusText}`);
          console.error(`   📄 응답 헤더: ${JSON.stringify(axiosError.response.headers, null, 2)}`);
          if (axiosError.response.data) {
            console.error(`   📋 응답 데이터: ${JSON.stringify(axiosError.response.data, null, 2)}`);
          }
        }
        if (axiosError.config) {
          console.error(`   🔧 요청 설정: ${JSON.stringify({
            method: axiosError.config.method,
            url: axiosError.config.url,
            baseURL: axiosError.config.baseURL
          })}`);
        }
      }
      
      throw error;
    }
  }

  /**
   * 🆕 지침 캐싱을 적용한 조회 (상세 로깅 포함)
   */
  private async getGuidelinesWithCache(documentType: string, siteId?: string): Promise<any> {
    const startTime = Date.now();
    const cacheKey = this.generateGuidelinesCacheKey(documentType, siteId);
    const now = Date.now();
    
    console.error(`🎯 지침 조회 시작: ${documentType} (사이트: ${siteId || 'global'})`);
    console.error(`   🔑 캐시 키: ${cacheKey}`);
    
    // 캐시 확인
    const cachedGuidelines = this.guidelinesCache.get(cacheKey);
    const lastUpdate = this.guidelinesLastUpdate.get(cacheKey) || 0;
    const cacheAge = now - lastUpdate;
    
    console.error(`🔍 지침 캐시 상태 확인:`);
    console.error(`   📦 캐시 존재: ${cachedGuidelines ? '✅ YES' : '❌ NO'}`);
    console.error(`   ⏰ 마지막 업데이트: ${lastUpdate ? new Date(lastUpdate).toISOString() : 'NEVER'}`);
    console.error(`   📅 캐시 나이: ${Math.round(cacheAge / 1000)}초`);
    console.error(`   ⏳ TTL: ${this.GUIDELINES_CACHE_TTL / 1000}초`);
    console.error(`   ✅ 유효 여부: ${cachedGuidelines && cacheAge < this.GUIDELINES_CACHE_TTL ? '🟢 VALID' : '🔴 INVALID'}`);
    
    if (cachedGuidelines && cacheAge < this.GUIDELINES_CACHE_TTL) {
      const responseTime = Date.now() - startTime;
      const cacheSize = JSON.stringify(cachedGuidelines).length;
      const guidelineCount = cachedGuidelines.guidelines?.length || 0;
      const combinedCount = cachedGuidelines.combined_instructions?.count || 0;
      
      console.error(`🚀 지침 캐시 HIT: ${documentType} (${responseTime}ms)`);
      console.error(`   📊 캐시 데이터 크기: ${cacheSize} bytes`);
      console.error(`   📋 개별 지침 수: ${guidelineCount}개`);
      console.error(`   🎯 통합 지침 수: ${combinedCount}개`);
      console.error(`   ⏱️ 캐시 만료까지: ${Math.round((this.GUIDELINES_CACHE_TTL - cacheAge) / 1000)}초 남음`);
      
      return cachedGuidelines;
    }
    
    console.error(`🌐 지침 캐시 MISS - 백엔드에서 조회 시작`);
    
    try {
      // 백엔드에서 지침 조회 (템플릿 가이드 API에 포함됨)
      console.error(`📡 템플릿 가이드 API 호출: /templates/guide/${documentType}`);
      const templateResponse = await this.cachedApiCall('GET', `/templates/guide/${documentType}`, { site_id: siteId });
      
      console.error(`📨 템플릿 응답 분석:`);
      console.error(`   ✅ 성공 여부: ${templateResponse.success ? '🟢 SUCCESS' : '🔴 FAIL'}`);
      console.error(`   📄 메시지: ${templateResponse.message || 'N/A'}`);
      
      if (templateResponse.success && templateResponse.data) {
        console.error(`   🔑 응답 데이터 키: [${Object.keys(templateResponse.data).join(', ')}]`);
        
        if (templateResponse.data.guidelines) {
          const guidelines = templateResponse.data.guidelines;
          const guidelineCount = guidelines.guidelines?.length || 0;
          const combinedCount = guidelines.combined_instructions?.count || 0;
          const totalPriority = guidelines.combined_instructions?.total_priority || 0;
          
          console.error(`🎯 지침 데이터 상세:`);
          console.error(`   📋 개별 지침: ${guidelineCount}개`);
          console.error(`   🎯 통합 지침: ${combinedCount}개`);
          console.error(`   ⚖️ 총 우선순위: ${totalPriority}`);
          console.error(`   📏 역할 지침 길이: ${guidelines.combined_instructions?.role?.length || 0} 문자`);
          console.error(`   📏 목표 지침 길이: ${guidelines.combined_instructions?.objective?.length || 0} 문자`);
          
          // 개별 지침 분석
          if (guidelines.guidelines && guidelines.guidelines.length > 0) {
            console.error(`   📚 개별 지침 목록:`);
            guidelines.guidelines.forEach((g: any, index: number) => {
              console.error(`      ${index + 1}. "${g.title}" (우선순위: ${g.priority}, 범위: ${g.scope})`);
            });
          }
          
          // 캐시 저장
          this.guidelinesCache.set(cacheKey, guidelines);
          this.guidelinesLastUpdate.set(cacheKey, now);
          
          const cacheSize = JSON.stringify(guidelines).length;
          const responseTime = Date.now() - startTime;
          
          console.error(`🗄️ 지침 캐시 저장 완료:`);
          console.error(`   🔑 캐시 키: ${cacheKey}`);
          console.error(`   📦 저장 크기: ${cacheSize} bytes`);
          console.error(`   ⏳ TTL: ${this.GUIDELINES_CACHE_TTL / 1000}초`);
          console.error(`   ⏱️ 총 처리시간: ${responseTime}ms`);
          
          return guidelines;
        } else {
          console.error(`⚠️ 응답에 지침 데이터 없음`);
          console.error(`   📄 응답 구조: ${JSON.stringify(Object.keys(templateResponse.data))}`);
        }
      }
    } catch (error) {
      const responseTime = Date.now() - startTime;
      console.error(`❌ 지침 조회 실패 (${responseTime}ms):`);
      console.error(`   🔥 오류 유형: ${error instanceof Error ? error.constructor.name : typeof error}`);
      console.error(`   📄 오류 메시지: ${error instanceof Error ? error.message : JSON.stringify(error)}`);
      console.error(`   🎯 요청 정보: ${documentType} (사이트: ${siteId || 'global'})`);
      
      if (error instanceof Error && error.stack) {
        console.error(`   📚 스택 트레이스: ${error.stack.split('\n').slice(0, 3).join('\n')}`);
      }
    }
    
    // 실패 시 빈 지침 반환
    const fallbackResponse = { guidelines: [], combined_instructions: {} };
    const responseTime = Date.now() - startTime;
    
    console.error(`🔄 지침 조회 실패 - 빈 응답 반환 (${responseTime}ms)`);
    console.error(`   📦 반환 데이터: 빈 지침 객체`);
    console.error(`   🎯 문서 타입: ${documentType}`);
    console.error(`   🏠 사이트: ${siteId || 'global'}`);
    
    return fallbackResponse;
  }

  /**
   * 🆕 지침 캐시 키 생성
   */
  private generateGuidelinesCacheKey(documentType: string, siteId?: string): string {
    return `guidelines:${documentType}:${siteId || 'global'}`;
  }

  /**
   * 🆕 지침 캐시 무효화
   */
  private invalidateGuidelinesCache(documentType?: string, siteId?: string): void {
    if (documentType && siteId) {
      // 특정 지침 캐시 무효화
      const cacheKey = this.generateGuidelinesCacheKey(documentType, siteId);
      this.guidelinesCache.delete(cacheKey);
      this.guidelinesLastUpdate.delete(cacheKey);
      console.error(`🗑️ 지침 캐시 무효화: ${documentType}, site: ${siteId}`);
    } else {
      // 전체 지침 캐시 무효화
      this.guidelinesCache.clear();
      this.guidelinesLastUpdate.clear();
      console.error(`🗑️ 전체 지침 캐시 무효화`);
    }
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
  private async generateSpecializedDocumentResponse(
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
    
    // 🤖 모든 문서 타입을 단순 협업 모드로 통합
    console.error(`📄 문서 타입 "${documentType}" → 단순 협업 모드로 처리`);
    return await this.generateGenericDocumentResponse(documentType, featureName, site, templateData, projectInfo, processingTime, additionalContext);
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
  private async generateGenericDocumentResponse(
    documentType: string,
    featureName: string,
    site: any,
    templateData: any,
    projectInfo: any,
    processingTime: number,
    additionalContext?: string
  ) {
    const responseStartTime = Date.now();
    const displayName = this.getDocumentTypeDisplayName(documentType);
    const phase = this.getDocumentPhase(documentType);
    
    console.error(`📝 문서 응답 생성 시작:`);
    console.error(`   📋 문서 타입: ${documentType} → ${displayName}`);
    console.error(`   🎯 기능명: ${featureName}`);
    console.error(`   🏠 사이트: ${site.name} (ID: ${site.id})`);
    console.error(`   🚀 개발 단계: ${phase}`);
    console.error(`   ⏱️ 현재까지 처리시간: ${processingTime}ms`);
    console.error(`   📦 추가 컨텍스트: ${additionalContext ? '✅ 있음' : '❌ 없음'}`);
    
    // 템플릿 데이터 분석
    console.error(`📄 템플릿 데이터 분석:`);
    if (templateData) {
      const templateKeys = Object.keys(templateData);
      console.error(`   🔑 템플릿 키: [${templateKeys.join(', ')}]`);
      
      if (templateData.template) {
        console.error(`   📋 템플릿 내용: ${templateData.template.length} 문자`);
        console.error(`   📐 템플릿 라인 수: ${templateData.template.split('\n').length}줄`);
        
        // 🆕 템플릿 전체 내용 출력 (구분선으로 명확히 표시)
        console.error(`   📄 템플릿 전체 내용:`);
        console.error(`   ╔═══════════════ 백엔드 템플릿 내용 시작 ═══════════════╗`);
        const templateLines = templateData.template.split('\n');
        templateLines.forEach((line: string, index: number) => {
          console.error(`   ║ ${String(index + 1).padStart(3, ' ')} │ ${line}`);
        });
        console.error(`   ╚═══════════════ 백엔드 템플릿 내용 끝 ═══════════════╝`);
        
        // 🤖 단순 협업: 코드에이전트에게 모든 정보를 전달하고 직접 처리 요청
        console.error(`🤖 단순 협업 모드: 코드에이전트가 직접 코드베이스 탐색 + 문서 생성`);
        
        // 지침을 먼저 가져오기
        const guidelines = await this.getGuidelinesWithCache(documentType, site.id);
      }
      
      if (templateData.variables) {
        const varCount = Object.keys(templateData.variables).length;
        console.error(`   🔧 변수 개수: ${varCount}개`);
        if (varCount > 0) {
          console.error(`   🎯 변수 목록: [${Object.keys(templateData.variables).join(', ')}]`);
        }
      }
      
      if (templateData.instructions) {
        console.error(`   📋 지침 길이: ${templateData.instructions.length} 문자`);
      }
      
      if (templateData.usage_count !== undefined) {
        console.error(`   📊 템플릿 사용 횟수: ${templateData.usage_count}회`);
      }
    } else {
      console.error(`   ⚠️ 템플릿 데이터 없음`);
    }
    
    // 프로젝트 정보 분석
    console.error(`📁 프로젝트 정보 분석:`);
    if (projectInfo) {
      const projectKeys = Object.keys(projectInfo);
      console.error(`   🔑 프로젝트 키: [${projectKeys.join(', ')}]`);
      console.error(`   📂 프로젝트 경로: ${projectInfo.projectPath || 'N/A'}`);
    } else {
      console.error(`   ⚠️ 프로젝트 정보 없음`);
    }
    
    // 🆕 지침 조회 및 적용
    console.error(`🎯 지침 조회 및 적용 시작...`);
    const guidelines = await this.getGuidelinesWithCache(documentType, site.id);
    const hasGuidelines = guidelines.combined_instructions?.count > 0;
    
    console.error(`🎯 지침 정보 확인 완료:`);
    console.error(`   ✅ 지침 존재: ${hasGuidelines ? '🟢 YES' : '🔴 NO'}`);
    console.error(`   📚 개별 지침: ${guidelines.guidelines?.length || 0}개`);
    console.error(`   🎯 통합 지침: ${guidelines.combined_instructions?.count || 0}개`);
    
    if (hasGuidelines) {
      console.error(`   📏 역할 지침 길이: ${guidelines.combined_instructions.role?.length || 0} 문자`);
      console.error(`   📏 목표 지침 길이: ${guidelines.combined_instructions.objective?.length || 0} 문자`);
      console.error(`   ⚖️ 총 우선순위 점수: ${guidelines.combined_instructions.total_priority || 0}`);
    }
    
    let guidelinesSection = '';
    if (hasGuidelines) {
      guidelinesSection = `
## 🎯 **LLM 작성 지침**

### 📋 **역할 지침**
${guidelines.combined_instructions.role || '기본 역할을 수행하세요.'}

### 🎯 **목표 지침**  
${guidelines.combined_instructions.objective || '문서의 목적을 달성하세요.'}

### 📌 **적용된 지침 (${guidelines.combined_instructions.count}개)**
${guidelines.guidelines.map((g: any, index: number) => 
  `${index + 1}. **${g.title}** (우선순위: ${g.priority})
   - 범위: ${g.scope}
   ${g.constraints ? `- 제약사항: ${g.constraints}` : ''}
   ${g.examples ? `- 예시: ${g.examples}` : ''}`
).join('\n\n')}
`;
    }
    
    // 지침 섹션 생성 로깅
    console.error(`📋 지침 섹션 생성:`);
    if (hasGuidelines) {
      const sectionLength = guidelinesSection.length;
      console.error(`   ✅ 지침 섹션 생성됨: ${sectionLength} 문자`);
      console.error(`   📊 포함된 개별 지침 수: ${guidelines.guidelines?.length || 0}개`);
    } else {
      console.error(`   ⚠️ 지침 없음 - 기본 섹션 사용`);
    }

    // 최종 문서 내용 구성
    console.error(`📃 최종 문서 구성 중...`);
    const documentScope = this.getDocumentScope(documentType);
    const documentPriority = this.getDocumentPriority(documentType);
    const documentDependencies = this.getDocumentDependencies(documentType);
    const nextStepRecommendation = this.getNextStepRecommendation(documentType);
    
    console.error(`   🎯 문서 범위: ${documentScope}`);
    console.error(`   ⚖️ 우선순위: ${documentPriority}`);
    console.error(`   🔗 의존성: ${documentDependencies}`);
    console.error(`   👉 다음 단계: ${nextStepRecommendation}`);

    // 🤖 대화형 워크플로우: 1차 응답 - 워크플로우 설계 요청
    const workflowId = `workflow_${documentType}_${Date.now()}`;
    
    // 워크플로우 상태 저장
    this.saveWorkflowState(workflowId, {
      documentType,
      featureName,
      site,
      templateData,
      guidelines,
      projectInfo,
      processingTime,
      additionalContext,
      phase,
      created_at: new Date().toISOString()
    });

    const finalDocumentText = `🤖 **대화형 워크플로우 1단계: ${featureName} - ${displayName}**

## 📋 **백엔드 데이터 수집 완료** ✅

### 🏢 **프로젝트 정보**
- **대상 사이트**: ${site.name} (ID: ${site.id})
- **프로젝트 경로**: ${projectInfo.projectPath || '.'} (현재 Cursor 프로젝트)
- **문서 타입**: ${documentType} → ${displayName}
- **개발 단계**: ${phase}
- **MCP 처리 시간**: ${processingTime}ms

### 📄 **백엔드 템플릿 정보**
**크기**: ${templateData.template?.length || 0} 문자 (${templateData.template?.split('\n').length || 0}줄)
**변수**: ${Object.keys(templateData.variables || {}).length}개
**사용 횟수**: ${templateData.usage_count || 0}회

\`\`\`markdown
${templateData.template || '템플릿 없음'}
\`\`\`

### 🎯 **템플릿 변수 분석**
${Object.keys(templateData.variables || {}).length > 0 ? `
**채워야 할 변수들**:
${Object.entries(templateData.variables || {}).map(([key, value]) => 
  `- \`{{${key}}}\`: ${typeof value === 'string' ? value : JSON.stringify(value)}`
).join('\n')}
` : '**변수 없음**: 기본 템플릿 구조 사용'}

### 🎯 **LLM 작성 지침**
**지침 존재**: ${hasGuidelines ? '✅ 있음' : '❌ 없음'}
**개별 지침**: ${guidelines.guidelines?.length || 0}개
**총 우선순위**: ${guidelines.combined_instructions?.total_priority || 0}

${hasGuidelines ? `
**역할 지침**:
${guidelines.combined_instructions.role || '없음'}

**목표 지침**:
${guidelines.combined_instructions.objective || '없음'}
` : '**기본 지침**: 문서의 목적에 맞게 작성하세요.'}

---

## 🤖 **2단계: 코드에이전트 워크플로우 설계 요청**

**당신의 역할**: 위의 템플릿과 지침을 분석하여 **구체적인 코드베이스 탐색 워크플로우**를 설계하세요.

### 🎯 **분석해야 할 내용**
1. **템플릿 변수 분석**: 각 \`{{변수}}\`가 어떤 코드베이스 정보를 필요로 하는가?
2. **기능 키워드 추출**: "${featureName}"에서 핵심 검색 키워드는?
3. **탐색 우선순위**: 어떤 정보를 먼저 찾아야 하는가?
4. **검색 전략**: 각 정보를 어떻게 찾을 것인가?

### 📋 **설계해야 할 워크플로우**
아래 형식으로 탐색 계획을 세우세요:

1. **핵심 키워드 목록**: [예: "로그인", "인증", "사용자"]
2. **우선순위별 탐색 작업**:
   - 작업 1: "로그인 함수 찾기" (검색어: "login, signin, authenticate")
   - 작업 2: "API 엔드포인트 찾기" (검색어: "/auth, /login, /user")  
   - 작업 3: "사용자 모델 찾기" (검색어: "User, userModel, userSchema")

### 🛠️ **다음 단계 실행 방법**
워크플로우 설계 완료 후 다음과 같이 실행하세요:

\`\`\`
execute_workflow({
  workflow_id: "${workflowId}",
  search_plan: [
    {
      task: "로그인 관련 함수 찾기",
      search_query: "login, signin, authenticate", 
      target_type: "functions",
      priority: 10
    },
    // ... 추가 작업들
  ],
  codebase_findings: {
    // 당신이 직접 탐색한 코드베이스 결과
  },
  additional_analysis: "코드베이스 분석을 통한 추가 인사이트"
})
\`\`\`

### 💡 **워크플로우 ID**: \`${workflowId}\`

---

💡 **지금 해주세요**: 위의 템플릿과 요구사항을 분석하여 **구체적인 탐색 워크플로우**를 설계하고, 코드베이스를 탐색한 후 \`execute_workflow\`를 호출해주세요!`;

    // 최종 응답 통계
    const totalResponseTime = Date.now() - responseStartTime;
    const documentLength = finalDocumentText.length;
    const documentWords = finalDocumentText.split(/\s+/).length;
    const documentLines = finalDocumentText.split('\n').length;

    console.error(`✅ 코드에이전트 협업 요청 준비 완료:`);
    console.error(`   📋 문서 타입: ${displayName}`);
    console.error(`   🎯 기능명: ${featureName}`);
    console.error(`   📏 요청 문서 길이: ${documentLength} 문자`);
    console.error(`   📖 단어 수: ${documentWords}개`);
    console.error(`   📄 라인 수: ${documentLines}줄`);
    console.error(`   ⏱️ MCP 처리 시간: ${totalResponseTime}ms`);
    console.error(`   📊 전체 처리 시간: ${processingTime + totalResponseTime}ms`);
    console.error(`   ✅ 지침 포함: ${hasGuidelines ? '🟢 포함됨' : '🔴 미포함'}`);
    console.error(`   📋 템플릿 포함: ${templateData?.template ? '🟢 포함됨' : '🔴 미포함'}`);
    console.error(`   🤖 협업 모드: 코드에이전트가 직접 코드베이스 탐색 수행`);

    const response = {
      content: [{
        type: 'text',
        text: finalDocumentText
      }]
    };

    // 응답 객체 검증
    const responseSize = JSON.stringify(response).length;
    console.error(`📤 응답 객체 최종 검증:`);
    console.error(`   📦 JSON 크기: ${responseSize} bytes (${Math.round(responseSize/1024*100)/100}KB)`);
    console.error(`   🔑 응답 구조: content[0].type = ${response.content[0].type}`);
    console.error(`   📄 텍스트 길이: ${response.content[0].text.length} 문자`);

    return response;
  }

  /**
   * 문서 타입 표시명 반환
   */
  private getDocumentTypeDisplayName(documentType: string): string {
    const displayNames: { [key: string]: string } = {
      // 🎯 핵심 개발 문서 (9가지)
      'BUSINESS_FLOW': '목표업무흐름도',
      'SEQUENCE_DIAGRAM': '시퀀스다이어그램', 
      'REQUIREMENTS': '요구사항정의서',
      'PROGRAM_DESIGN_ONLINE': '프로그램설계서(온라인)',
      'PROGRAM_DESIGN_BATCH': '프로그램설계서(배치)',
      'PROGRAM_DESIGN_COMMON': '프로그램설계서(공통)',
      'IMPACT_ANALYSIS': '영향도분석서',
      'TABLE_SPECIFICATION': '테이블정의서',
      'INTERFACE_SPECIFICATION': '인터페이스정의서'
    };
    return displayNames[documentType] || documentType;
  }

  /**
   * 문서 개발 단계 반환
   */
  private getDocumentPhase(documentType: string): string {
    // 🎯 핵심 개발 문서 단계 매핑 (9가지)
    if (['BUSINESS_FLOW', 'SEQUENCE_DIAGRAM', 'REQUIREMENTS'].includes(documentType)) {
      return '📊 분석 단계';
    } else if (['PROGRAM_DESIGN_ONLINE', 'PROGRAM_DESIGN_BATCH', 'PROGRAM_DESIGN_COMMON', 'TABLE_SPECIFICATION', 'INTERFACE_SPECIFICATION'].includes(documentType)) {
      return '🏗️ 설계 단계';
    } else if (['IMPACT_ANALYSIS'].includes(documentType)) {
      return '🔍 검토 단계';
    } else {
      return '🛠️ 사용자 정의';
    }
  }

  /**
   * 문서 범위 반환
   */
  private getDocumentScope(documentType: string): string {
    // 🎯 핵심 개발 문서 범위 매핑 (9가지)
    const scopes: { [key: string]: string } = {
      'BUSINESS_FLOW': '목표 업무 흐름과 프로세스',
      'SEQUENCE_DIAGRAM': '시스템 간 상호작용 및 시퀀스',
      'REQUIREMENTS': '기능 요구사항 및 비기능 요구사항',
      'PROGRAM_DESIGN_ONLINE': '온라인 프로그램 구조 및 로직',
      'PROGRAM_DESIGN_BATCH': '배치 프로그램 구조 및 스케줄',
      'PROGRAM_DESIGN_COMMON': '공통 모듈 및 유틸리티',
      'IMPACT_ANALYSIS': '변경 영향도 및 의존성 분석',
      'TABLE_SPECIFICATION': '데이터베이스 테이블 구조 및 관계',
      'INTERFACE_SPECIFICATION': 'API 인터페이스 및 데이터 모델'
    };
    return scopes[documentType] || '기능 전체';
  }

  /**
   * 문서 우선순위 반환
   */
  private getDocumentPriority(documentType: string): string {
    // 🎯 핵심 개발 문서 우선순위 매핑 (9가지)
    if (['REQUIREMENTS', 'IMPACT_ANALYSIS', 'TABLE_SPECIFICATION'].includes(documentType)) {
      return '높음';
    } else if (['BUSINESS_FLOW', 'PROGRAM_DESIGN_ONLINE', 'PROGRAM_DESIGN_BATCH', 'INTERFACE_SPECIFICATION'].includes(documentType)) {
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
   * 지식 검색 핸들러 - Cursor가 직접 RAG 처리할 수 있도록 원본 문서 반환
   */
  private async handleSearchKnowledge(args: {
    query: string;
    max_results?: number;
    similarity_threshold?: number;
    site_name?: string;
    include_metadata?: boolean;
    enable_chunking?: boolean;
    chunk_size?: number;
  }) {
    try {
      const startTime = new Date();
      console.error(`🔍 지식 검색 시작: "${args.query}"`);

      // 파라미터 검증 및 기본값 설정
      const maxResults = Math.min(args.max_results || 5, 20); // 최대 20개로 제한
      const similarityThreshold = args.similarity_threshold || 0.3;
      const includeMetadata = args.include_metadata !== false;
      
      // 데이터 크기 최적화 설정
      const MAX_CONTENT_LENGTH = 3000; // 문서당 최대 3KB 텍스트
      const CONTENT_PREVIEW_LENGTH = 500; // 미리보기 길이
      const enableChunking = args.enable_chunking || false;
      const chunkSize = Math.min(args.chunk_size || 3, 5); // 최대 5개씩 청킹

      // 사이트 필터링을 위한 site_ids 준비
      let siteIds: string[] | undefined = undefined;
      if (args.site_name) {
        const targetSite = this.findSite(args.site_name, args.site_name);
        if (!targetSite) {
          // 사이트를 찾을 수 없을 때 실시간 재조회
          const refreshedSite = await this.findSiteWithRefresh(args.site_name);
          if (!refreshedSite) {
            const errorMessage = await this.generateSiteNotFoundError(args.site_name);
            return {
              content: [{ type: 'text', text: errorMessage }],
              isError: true
            };
          }
          siteIds = [refreshedSite.id];
        } else {
          siteIds = [targetSite.id];
        }
      }

      // 백엔드 벡터 검색 API 호출 (RAG 서비스 대신 raw search)
      const searchParams: any = {
        query: args.query,
        max_results: maxResults,
        similarity_threshold: similarityThreshold
      };

      if (siteIds) {
        searchParams.site_ids = siteIds.join(',');
      }

      console.error(`🔍 검색 파라미터:`, searchParams);

      // 백엔드에서 원본 검색 결과만 가져오기 (LLM 처리 없이)
      const searchResults = await this.cachedApiCall('GET', '/documents/search-raw', searchParams, false);
      
      if (!searchResults.success) {
        return {
          content: [{
            type: 'text',
            text: `❌ 검색 실패: ${searchResults.message || '알 수 없는 오류'}`
          }],
          isError: true
        };
      }

      const documents = searchResults.data || [];
      const searchTime = new Date().getTime() - startTime.getTime();

      if (documents.length === 0) {
        return {
          content: [{
            type: 'text',
            text: `🔍 **검색 결과 없음**

**질의**: ${args.query}
**검색 시간**: ${searchTime}ms
**유사도 임계값**: ${similarityThreshold}

관련 문서를 찾을 수 없습니다. 다른 키워드로 검색해보시거나 유사도 임계값을 낮춰보세요.`
          }]
        };
      }

      // 🆕 청킹 처리 로직
      if (enableChunking && documents.length > chunkSize) {
        return await this.handleChunkedKnowledgeSearch(args, documents, searchTime);
      }

      // Cursor/Claude가 처리할 수 있도록 구조화된 검색 결과 반환
      let responseText = `🔍 **지식베이스 검색 결과**

**질의**: ${args.query}
**검색 결과**: ${documents.length}개 문서
**검색 시간**: ${searchTime}ms
**유사도 임계값**: ${similarityThreshold}

---

**📚 관련 문서 내용**

`;

      let totalPayloadSize = 0;
      const processedDocs: any[] = [];
      let truncated = false;

      // forEach 대신 for 루프 사용 (break 지원을 위해)
      for (let index = 0; index < documents.length; index++) {
        const doc = documents[index];
        
        // 문서 내용 최적화
        const optimizedContent = this.optimizeDocumentContent(doc.content, MAX_CONTENT_LENGTH);
        const preview = optimizedContent.length > CONTENT_PREVIEW_LENGTH 
          ? optimizedContent.substring(0, CONTENT_PREVIEW_LENGTH) + '...'
          : optimizedContent;

        // 페이로드 크기 추정
        const docSize = JSON.stringify({
          content: optimizedContent,
          metadata: doc.metadata,
          similarity: doc.similarity
        }).length;
        
        // 페이로드 크기 제한 체크 (1MB 제한)
        if (totalPayloadSize + docSize > 1024 * 1024) {
          console.error(`⚠️ 페이로드 크기 제한 도달, ${index + 1}번째 문서부터 생략`);
          truncated = true;
          break;
        }

        totalPayloadSize += docSize;
        processedDocs.push({
          ...doc,
          content: optimizedContent,
          preview: preview,
          originalSize: doc.content?.length || 0,
          optimizedSize: optimizedContent.length
        });

        responseText += `### ${index + 1}. 문서 ${index + 1} (유사도: ${(doc.similarity * 100).toFixed(1)}%)

**내용** ${optimizedContent.length < (doc.content?.length || 0) ? `(${doc.content?.length || 0} → ${optimizedContent.length} chars 최적화됨)` : ''}:
${optimizedContent}

`;

        if (includeMetadata && doc.metadata) {
          responseText += `**메타데이터**:
`;
          Object.entries(doc.metadata).forEach(([key, value]) => {
            if (value && key !== 'id') {
              responseText += `- ${key}: ${value}
`;
            }
          });
          responseText += `
`;
        }

        responseText += `---

`;
      }

      // 생략된 문서가 있을 때 안내 메시지 추가
      if (truncated) {
        responseText += `⚠️ **페이로드 크기 제한으로 인해 ${documents.length - processedDocs.length}개의 추가 문서가 생략되었습니다**

💡 **해결 방법:**
1. max_results를 줄여서 검색하세요 (현재: ${documents.length}개)
2. similarity_threshold를 높여서 더 관련성 높은 결과만 가져오세요
3. enable_chunking=true로 청킹 모드를 사용하세요

`;
      }

      // 압축률 통계 계산
      const originalTotalSize = processedDocs.reduce((sum, doc) => sum + doc.originalSize, 0);
      const optimizedTotalSize = processedDocs.reduce((sum, doc) => sum + doc.optimizedSize, 0);
      const compressionRatio = originalTotalSize > 0 ? ((originalTotalSize - optimizedTotalSize) / originalTotalSize * 100).toFixed(1) : '0';

      responseText += `📊 **데이터 최적화 정보**
- 총 페이로드 크기: ${(totalPayloadSize / 1024).toFixed(1)}KB
- 압축률: ${compressionRatio}% 절약 (${(originalTotalSize / 1024).toFixed(1)}KB → ${(optimizedTotalSize / 1024).toFixed(1)}KB)
- 처리된 문서: ${processedDocs.length}/${documents.length}개

💡 **사용법**: 위 문서들을 바탕으로 "${args.query}"에 대한 답변을 생성해주세요. 각 문서의 내용을 종합하여 정확하고 유용한 답변을 만들어주세요.`;

      console.error(`✅ 지식 검색 완료: ${processedDocs.length}/${documents.length}개 문서 반환 (${searchTime}ms)`);
      console.error(`📊 최적화 결과: ${(totalPayloadSize / 1024).toFixed(1)}KB, 압축률: ${compressionRatio}%`);

      return {
        content: [{
          type: 'text',
          text: responseText
        }]
      };

    } catch (error) {
      console.error(`❌ 지식 검색 오류:`, error);
      return {
        content: [{
          type: 'text',
          text: `❌ 지식 검색 중 오류가 발생했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`
        }],
        isError: true
      };
    }
  }

  /**
   * 청킹된 지식 검색 처리 - 대용량 결과를 관리 가능한 크기로 분할
   */
  private async handleChunkedKnowledgeSearch(args: any, documents: any[], searchTime: number): Promise<any> {
    const chunkSize = Math.min(args.chunk_size || 3, 5);
    const chunks = [];
    
    // 문서들을 청크로 분할
    for (let i = 0; i < documents.length; i += chunkSize) {
      chunks.push(documents.slice(i, i + chunkSize));
    }

    // 각 청크의 요약 정보 생성
    let responseText = `🔍 **대용량 검색 결과 - 청킹 모드**

**질의**: ${args.query}
**총 문서 수**: ${documents.length}개
**청크 수**: ${chunks.length}개 (각 청크당 최대 ${chunkSize}개 문서)
**검색 시간**: ${searchTime}ms

**📋 청크별 미리보기:**

`;

    chunks.forEach((chunk, index) => {
      const avgSimilarity = (chunk.reduce((sum: number, doc: any) => sum + doc.similarity, 0) / chunk.length * 100).toFixed(1);
      const topTopics = chunk.slice(0, 2).map((doc: any) => {
        const title = doc.metadata?.title || `문서 ${index * chunkSize + chunk.indexOf(doc) + 1}`;
        return title.length > 30 ? title.substring(0, 30) + '...' : title;
      });

      responseText += `**청크 ${index + 1}** (${chunk.length}개 문서, 평균 유사도: ${avgSimilarity}%)
- 주요 문서: ${topTopics.join(', ')}
- 예상 크기: ~${(chunk.length * 2).toFixed(1)}KB

`;
    });

    responseText += `
**💡 사용법:**
1. 특정 청크를 자세히 보려면: "search_knowledge로 '${args.query}'를 검색하는데, max_results를 ${chunkSize}로 하고 similarity_threshold를 높여서 상위 결과만 보여주세요"
2. 전체 결과를 보려면: enable_chunking을 false로 설정하세요 (단, 응답 크기가 클 수 있습니다)
3. 청크 크기를 조정하려면: chunk_size 파라미터를 변경하세요

**🎯 추천:**
- 첫 번째 청크(청크 1)가 가장 관련성이 높은 결과입니다
- 특정 주제에 집중하려면 similarity_threshold를 높여보세요 (현재: ${args.similarity_threshold || 0.3})
`;

    return {
      content: [{
        type: 'text',
        text: responseText
      }]
    };
  }

  /**
   * 문서 내용 최적화 - 크기 감소 및 품질 유지
   */
  private optimizeDocumentContent(content: string, maxLength: number): string {
    if (!content || content.length <= maxLength) {
      return content || '';
    }

    // 1단계: 기본 텍스트 정리
    let optimized = content
      // HTML 태그 제거
      .replace(/<[^>]*>/g, '')
      // 여러 공백을 하나로
      .replace(/\s+/g, ' ')
      // 여러 줄바꿈을 최대 2개로
      .replace(/\n{3,}/g, '\n\n')
      // 앞뒤 공백 제거
      .trim();

    // 2단계: 중복 문장 제거 (단순한 버전)
    const sentences = optimized.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const uniqueSentences = [];
    const seenSentences = new Set();

    for (const sentence of sentences) {
      const normalized = sentence.trim().toLowerCase();
      if (normalized.length > 10 && !seenSentences.has(normalized)) {
        seenSentences.add(normalized);
        uniqueSentences.push(sentence.trim());
      }
    }

    optimized = uniqueSentences.join('. ');

    // 3단계: 길이 제한 적용 (중요한 부분 우선 보존)
    if (optimized.length > maxLength) {
      // 앞부분과 뒷부분을 보존하는 스마트 트렁케이션
      const frontPortion = Math.floor(maxLength * 0.7); // 앞부분 70%
      const backPortion = maxLength - frontPortion - 20; // 뒷부분, "..." 여유 공간

      const front = optimized.substring(0, frontPortion);
      const back = optimized.substring(optimized.length - backPortion);
      
      optimized = front + '\n\n[... 중간 내용 생략 ...]\n\n' + back;
    }

    // 4단계: 최종 정리
    return optimized
      .replace(/\s+/g, ' ')
      .trim();
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

  // 🤖 ===== SDK 하이브리드 워크플로우 핵심 로직 =====

  /**
   * 하이브리드 문서 생성기 (Prompts + Elicitation + Sampling 통합)
   */
  private async handleHybridDocumentGenerator(args: any) {
    const startTime = Date.now();
    const { document_type, feature_name, site_name, workflow_mode = 'interactive' } = args;

    console.error(`🤖 하이브리드 문서 생성기 시작:`);
    console.error(`   📋 문서 타입: ${document_type}`);
    console.error(`   🎯 기능명: ${feature_name}`);
    console.error(`   🏠 사이트: ${site_name || 'default'}`);
    console.error(`   🔄 워크플로우 모드: ${workflow_mode}`);

    try {
      // 1️⃣ 백엔드 데이터 수집 (템플릿 + 지침)
      const targetSite = await this.validateAndGetSite(site_name || '');
      const templateData = await this.cachedApiCall('GET', `/templates/guide/${document_type}`, { site_id: targetSite.id });
      const guidelines = await this.getGuidelinesWithCache(document_type, targetSite.id);

      if (!templateData.success) {
        throw new Error(`템플릿을 찾을 수 없습니다: ${document_type}`);
      }

      console.error(`✅ 백엔드 데이터 수집 완료:`);
      console.error(`   📄 템플릿: ${templateData.data.template?.length || 0} 문자`);
      console.error(`   🎯 지침: ${guidelines.guidelines?.length || 0}개`);

      // 2️⃣ Elicitation: 사용자에게 프로젝트 컨텍스트 수집
      const projectContext = await this.elicitProjectContext(feature_name, document_type);
      
      if (projectContext.action !== 'accept') {
        return {
          content: [{
            type: 'text',
            text: '❌ 사용자가 프로젝트 컨텍스트 입력을 취소했습니다.'
          }]
        };
      }

      console.error(`✅ 프로젝트 컨텍스트 수집 완료:`);
      console.error(`   📂 프로젝트 경로: ${projectContext.content.project_path}`);
      console.error(`   🏗️ 아키텍처: ${projectContext.content.architecture_type}`);
      console.error(`   💻 주요 기술: ${projectContext.content.tech_stack}`);

      // 3️⃣ Sampling: LLM에게 코드베이스 분석 계획 요청
      const analysisInstructions = this.buildAnalysisInstructions(
        templateData.data,
        guidelines,
        feature_name,
        projectContext.content
      );

      console.error(`🧠 LLM 분석 계획 요청 시작...`);
      const analysisPlan = await this.requestLLMAnalysis(analysisInstructions);
      
      console.error(`✅ LLM 분석 계획 수신:`);
      console.error(`   📋 분석 계획 길이: ${analysisPlan.length} 문자`);

      // 4️⃣ Elicitation: 사용자에게 코드베이스 탐색 요청
      const codebaseResults = await this.elicitCodebaseFindings(
        feature_name,
        analysisPlan,
        projectContext.content
      );

      if (codebaseResults.action !== 'accept') {
        return {
          content: [{
            type: 'text',
            text: '❌ 사용자가 코드베이스 탐색 결과 입력을 취소했습니다.'
          }]
        };
      }

      console.error(`✅ 코드베이스 탐색 결과 수집 완료:`);
      console.error(`   🔍 탐색 결과: ${Object.keys(codebaseResults.content).length}개 항목`);

      // 5️⃣ Sampling: LLM에게 최종 문서 생성 요청
      const finalDocumentInstructions = this.buildFinalDocumentInstructions(
        templateData.data,
        guidelines,
        feature_name,
        projectContext.content,
        analysisPlan,
        codebaseResults.content
      );

      console.error(`🧠 최종 문서 생성 요청 시작...`);
      const finalDocument = await this.requestLLMFinalDocument(finalDocumentInstructions);

      const totalTime = Date.now() - startTime;
      
      console.error(`🎉 하이브리드 워크플로우 완료:`);
      console.error(`   📄 최종 문서 길이: ${finalDocument.length} 문자`);
      console.error(`   ⏱️ 총 처리 시간: ${totalTime}ms`);
      console.error(`   🤖 SDK 기능 활용: Prompts + Elicitation + Sampling`);

      return {
        content: [{
          type: 'text',
          text: `🎉 **하이브리드 워크플로우 완성: ${feature_name} - ${this.getDocumentTypeDisplayName(document_type)}**

## 🤖 **SDK 3종 세트 활용 결과**

### 📋 **처리 과정**
1. ✅ **백엔드 데이터**: 템플릿 + 지침 수집
2. ✅ **Elicitation**: 프로젝트 컨텍스트 수집  
3. ✅ **Sampling**: LLM 분석 계획 생성
4. ✅ **Elicitation**: 코드베이스 탐색 결과 수집
5. ✅ **Sampling**: 최종 문서 생성

### 📄 **생성된 문서**

${finalDocument}

---

### 📊 **워크플로우 통계**
- **총 처리 시간**: ${totalTime}ms
- **SDK 기능 사용**: Prompts + Elicitation + Sampling
- **사용자 상호작용**: ${workflow_mode} 모드
- **데이터 소스**: 백엔드 템플릿 + 사용자 입력 + LLM 분석

💡 **완성**: 실제 프로젝트 정보와 LLM 분석을 결합한 고품질 문서입니다!`
        }],
        metadata: {
          workflow_type: 'hybrid_sdk',
          document_type,
          feature_name,
          processing_time: totalTime,
          sdk_features_used: ['prompts', 'elicitation', 'sampling'],
          workflow_mode
        }
      };

    } catch (error) {
      const totalTime = Date.now() - startTime;
      console.error(`❌ 하이브리드 워크플로우 실패 (${totalTime}ms):`, error);
      
      return {
        content: [{
          type: 'text',
          text: `❌ **하이브리드 워크플로우 실패**\n\n기능: ${feature_name}\n문서 타입: ${document_type}\n오류: ${error instanceof Error ? error.message : '알 수 없는 오류'}\n\n**확인 사항:**\n- 백엔드 서비스가 정상 작동하는지 확인\n- 사이트 설정이 올바른지 확인\n- 네트워크 연결 상태 확인`
        }]
      };
    }
  }

  /**
   * 🔍 Elicitation: 프로젝트 컨텍스트 수집
   */
  private async elicitProjectContext(featureName: string, documentType: string): Promise<any> {
    console.error(`🔍 프로젝트 컨텍스트 수집 시작: ${featureName}`);
    
    return await (this.server as any).elicitInput({
      message: `**${featureName}** 관련 ${this.getDocumentTypeDisplayName(documentType)} 생성을 위해 프로젝트 정보가 필요합니다.`,
      requestedSchema: {
        type: 'object',
        properties: {
          project_path: {
            type: 'string',
            title: '프로젝트 루트 경로',
            description: '현재 작업 중인 프로젝트의 루트 디렉토리',
            default: '.'
          },
          architecture_type: {
            type: 'string',
            title: '아키텍처 유형',
            enum: ['monolithic', 'microservices', 'serverless', 'hybrid'],
            description: '프로젝트의 전체 아키텍처 유형'
          },
          tech_stack: {
            type: 'string',
            title: '주요 기술 스택',
            description: '사용 중인 주요 프레임워크, 언어, 도구들 (예: React, Node.js, PostgreSQL)',
          },
          key_directories: {
            type: 'array',
            title: '주요 디렉토리',
            items: { type: 'string' },
            description: '중요한 소스 디렉토리들 (예: src, components, services, models)'
          },
          business_domain: {
            type: 'string',
            title: '비즈니스 도메인',
            description: '이 기능이 속하는 비즈니스 영역 (예: 인증, 결제, 상품관리)',
          }
        },
        required: ['architecture_type', 'tech_stack', 'business_domain']
      }
    });
  }

  /**
   * 🧠 Sampling: LLM에게 분석 계획 요청
   */
  private async requestLLMAnalysis(instructions: string): Promise<string> {
    console.error(`🧠 LLM 분석 계획 요청: ${instructions.length} 문자`);
    
    const samplingResponse = await (this.server as any).request({
      method: 'sampling/createMessage',
      params: {
        messages: [
          {
            role: 'system',
            content: {
              type: 'text',
              text: '당신은 시니어 개발자이자 아키텍트입니다. 코드베이스 분석과 문서 작성에 전문성을 가지고 있습니다.'
            }
          },
          {
            role: 'user',
            content: {
              type: 'text',
              text: instructions
            }
          }
        ],
        modelPreferences: {
          hints: [{ name: 'claude-3-5-sonnet' }, { name: 'gpt-4' }],
          intelligencePriority: 0.9,
          speedPriority: 0.5,
          costPriority: 0.3
        },
        maxTokens: 2000,
        temperature: 0.1
      }
    });

    const analysisResult = samplingResponse?.result?.content?.[0]?.text || '분석 계획을 생성할 수 없습니다.';
    console.error(`✅ LLM 분석 응답 수신: ${analysisResult.length} 문자`);
    
    return analysisResult;
  }

  /**
   * 🔍 Elicitation: 코드베이스 탐색 결과 수집
   */
  private async elicitCodebaseFindings(featureName: string, analysisPlan: string, projectContext: any): Promise<any> {
    console.error(`🔍 코드베이스 탐색 결과 수집 시작`);
    
    return await (this.server as any).elicitInput({
      message: `**LLM 분석 계획**에 따라 코드베이스를 탐색하고 결과를 입력해주세요.\n\n**분석 계획:**\n${analysisPlan.substring(0, 500)}${analysisPlan.length > 500 ? '...' : ''}`,
      requestedSchema: {
        type: 'object',
        properties: {
          related_functions: {
            type: 'array',
            title: '관련 함수/메서드',
            items: { type: 'string' },
            description: `${featureName}와 관련된 함수들 (예: "handleLogin() - src/auth/login.ts:45")`
          },
          api_endpoints: {
            type: 'array',
            title: 'API 엔드포인트',
            items: { type: 'string' },
            description: '관련 API 라우터/엔드포인트들'
          },
          data_models: {
            type: 'array',
            title: '데이터 모델/스키마',
            items: { type: 'string' },
            description: '관련 데이터 모델, 엔티티, 스키마들'
          },
          config_settings: {
            type: 'array',
            title: '설정 파일/환경변수',
            items: { type: 'string' },
            description: '관련 설정 파일, 환경변수, 상수들'
          },
          business_logic: {
            type: 'string',
            title: '핵심 비즈니스 로직',
            description: '발견한 핵심 비즈니스 로직이나 규칙들'
          },
          dependencies: {
            type: 'array',
            title: '의존성/연관 모듈',
            items: { type: 'string' },
            description: '이 기능과 연관된 다른 모듈/서비스들'
          },
          additional_notes: {
            type: 'string',
            title: '추가 발견사항',
            description: '기타 중요한 발견사항이나 주의사항'
          }
        },
        required: ['related_functions', 'business_logic']
      }
    });
  }

  /**
   * 🧠 Sampling: LLM에게 최종 문서 생성 요청
   */
  private async requestLLMFinalDocument(instructions: string): Promise<string> {
    console.error(`🧠 최종 문서 생성 요청: ${instructions.length} 문자`);
    
    const samplingResponse = await (this.server as any).request({
      method: 'sampling/createMessage',
      params: {
        messages: [
          {
            role: 'system',
            content: {
              type: 'text',
              text: '당신은 시니어 개발자이자 기술 문서 작성 전문가입니다. 실무에서 바로 사용할 수 있는 고품질 문서를 작성하는 데 특화되어 있습니다.'
            }
          },
          {
            role: 'user',
            content: {
              type: 'text',
              text: instructions
            }
          }
        ],
        modelPreferences: {
          hints: [{ name: 'claude-3-5-sonnet' }, { name: 'gpt-4' }],
          intelligencePriority: 0.95,
          speedPriority: 0.4,
          costPriority: 0.2
        },
        maxTokens: 4000,
        temperature: 0.1
      }
    });

    const finalDocument = samplingResponse?.result?.content?.[0]?.text || '최종 문서를 생성할 수 없습니다.';
    console.error(`✅ 최종 문서 생성 완료: ${finalDocument.length} 문자`);
    
    return finalDocument;
  }

  /**
   * LLM 분석 지시사항 구성
   */
  private buildAnalysisInstructions(templateData: any, guidelines: any, featureName: string, projectContext: any): string {
    return `# 코드베이스 분석 계획 요청

## 제공된 정보

### 📄 백엔드 템플릿
\`\`\`markdown
${templateData.template || '템플릿 없음'}
\`\`\`

### 🎯 LLM 지침
**역할**: ${guidelines.combined_instructions?.role || '기본 역할'}
**목표**: ${guidelines.combined_instructions?.objective || '문서 목적 달성'}

### 🏗️ 프로젝트 컨텍스트
- **아키텍처**: ${projectContext.architecture_type}
- **기술 스택**: ${projectContext.tech_stack}
- **비즈니스 도메인**: ${projectContext.business_domain}
- **주요 디렉토리**: ${projectContext.key_directories?.join(', ') || 'N/A'}

## 요청사항

"**${featureName}**" 기능에 대한 코드베이스 분석 계획을 세워주세요.

### 분석해야 할 내용
1. **템플릿 변수 분석**: 템플릿의 {{변수}}들이 어떤 코드베이스 정보를 필요로 하는가?
2. **핵심 키워드 추출**: 기능명에서 중요한 검색 키워드들
3. **탐색 우선순위**: 어떤 정보를 먼저 찾아야 하는가?
4. **구체적인 검색 전략**: 각 정보를 어떻게 찾을 것인가?

### 응답 형식
**명확하고 실행 가능한 분석 계획**을 작성해주세요. 사용자가 이 계획에 따라 실제 코드베이스를 탐색할 수 있도록 구체적이어야 합니다.`;
  }

  /**
   * 최종 문서 생성 지시사항 구성
   */
  private buildFinalDocumentInstructions(
    templateData: any, 
    guidelines: any, 
    featureName: string, 
    projectContext: any,
    analysisPlan: string,
    codebaseFindings: any
  ): string {
    return `# 최종 문서 생성 요청

## 모든 수집된 정보

### 📄 백엔드 템플릿
\`\`\`markdown
${templateData.template || '템플릿 없음'}
\`\`\`

### 🎯 LLM 지침
**역할**: ${guidelines.combined_instructions?.role || '기본 역할'}
**목표**: ${guidelines.combined_instructions?.objective || '문서 목적 달성'}

### 🏗️ 프로젝트 컨텍스트
- **아키텍처**: ${projectContext.architecture_type}
- **기술 스택**: ${projectContext.tech_stack}  
- **비즈니스 도메인**: ${projectContext.business_domain}

### 🧠 LLM 분석 계획
${analysisPlan}

### 🔍 실제 코드베이스 탐색 결과
${JSON.stringify(codebaseFindings, null, 2)}

## 요청사항

위의 **모든 정보를 종합**하여 **"${featureName}"**에 대한 **완성된 ${this.getDocumentTypeDisplayName(templateData.document_type || 'REQUIREMENTS')}**를 작성해주세요.

### 작성 요구사항
1. **템플릿 준수**: 백엔드 템플릿의 구조와 변수를 모두 활용
2. **지침 적용**: LLM 지침의 역할과 목표를 반드시 반영
3. **실제 코드 기반**: 탐색된 실제 코드 정보를 구체적으로 포함
4. **실무 적용 가능**: 개발팀이 바로 사용할 수 있는 수준의 완성도
5. **구체성**: 추상적이지 않고 프로젝트 맞춤형 내용

**실제 프로젝트의 코드와 아키텍처를 기반으로 한 고품질 문서를 작성해주세요.**`;
  }

  // 🎯 ===== Prompts 응답 메서드들 =====

  private async getImpactAnalysisPrompt(args: any) {
    const { feature_name = '', site_name = '', analysis_depth = 'standard' } = args;
    
    return {
      messages: [
        {
          role: 'system',
          content: {
            type: 'text',
            text: '당신은 시니어 개발자이자 아키텍트로서 영향도 분석에 전문성을 가지고 있습니다.'
          }
        },
        {
          role: 'user', 
          content: {
            type: 'text',
            text: `다음 기능의 영향도분석서를 작성해주세요:\n\n기능명: ${feature_name}\n사이트: ${site_name || 'default'}\n분석 깊이: ${analysis_depth}\n\n현재 프로젝트의 코드베이스를 참고하여 구체적이고 실무에 적용 가능한 영향도분석서를 작성해주세요.`
          }
        }
      ]
    };
  }

  private async getRequirementsPrompt(args: any) {
    const { feature_name = '', business_context = '' } = args;
    
    return {
      messages: [
        {
          role: 'system',
          content: {
            type: 'text',
            text: '당신은 비즈니스 애널리스트이자 제품 매니저로서 요구사항 정의에 전문성을 가지고 있습니다.'
          }
        },
        {
          role: 'user',
          content: {
            type: 'text', 
            text: `다음 기능의 요구사항정의서를 작성해주세요:\n\n기능명: ${feature_name}\n비즈니스 컨텍스트: ${business_context || '일반적인 웹 애플리케이션'}\n\n현재 프로젝트의 구조와 기존 기능들을 참고하여 구체적이고 구현 가능한 요구사항을 정의해주세요.`
          }
        }
      ]
    };
  }

  private async getTableSpecPrompt(args: any) {
    const { table_scope = '', db_connection = '' } = args;
    
    return {
      messages: [
        {
          role: 'system',
          content: {
            type: 'text',
            text: '당신은 데이터베이스 아키텍트이자 DBA로서 테이블 설계에 전문성을 가지고 있습니다.'
          }
        },
        {
          role: 'user',
          content: {
            type: 'text',
            text: `다음 범위의 테이블명세서를 작성해주세요:\n\n테이블 범위: ${table_scope}\nDB 연결: ${db_connection || '미설정'}\n\n현재 프로젝트의 데이터 구조와 비즈니스 요구사항을 고려하여 구체적인 테이블 설계를 해주세요.`
          }
        }
      ]
    };
  }

  // 🤖 ===== 대화형 워크플로우 상태 관리 =====

  /**
   * 워크플로우 상태 저장
   */
  private saveWorkflowState(workflowId: string, state: any): void {
    console.error(`💾 워크플로우 상태 저장: ${workflowId}`);
    console.error(`   📋 문서 타입: ${state.documentType}`);
    console.error(`   🎯 기능명: ${state.featureName}`);
    console.error(`   🏠 사이트: ${state.site.name}`);
    console.error(`   ⏳ TTL: ${this.WORKFLOW_STATE_TTL / 1000}초`);
    
    this.workflowStates.set(workflowId, {
      ...state,
      saved_at: Date.now()
    });
  }

  /**
   * 워크플로우 상태 조회
   */
  private getWorkflowState(workflowId: string): any | null {
    console.error(`🔍 워크플로우 상태 조회: ${workflowId}`);
    
    const state = this.workflowStates.get(workflowId);
    if (!state) {
      console.error(`   ❌ 워크플로우 상태 없음`);
      return null;
    }

    const now = Date.now();
    const age = now - state.saved_at;
    
    console.error(`   📅 저장 시간: ${new Date(state.saved_at).toISOString()}`);
    console.error(`   ⏰ 상태 나이: ${Math.round(age / 1000)}초`);
    console.error(`   ✅ 유효 여부: ${age < this.WORKFLOW_STATE_TTL ? '🟢 VALID' : '🔴 EXPIRED'}`);

    if (age > this.WORKFLOW_STATE_TTL) {
      console.error(`   🗑️ 만료된 워크플로우 상태 삭제`);
      this.workflowStates.delete(workflowId);
      return null;
    }

    console.error(`   ✅ 워크플로우 상태 조회 성공`);
    return state;
  }

  /**
   * 워크플로우 실행 핸들러
   */
  private async handleExecuteWorkflow(args: any) {
    const startTime = Date.now();
    const { workflow_id, search_plan, codebase_findings, additional_analysis } = args;

    console.error(`🤖 워크플로우 실행 시작:`);
    console.error(`   🆔 워크플로우 ID: ${workflow_id}`);
    console.error(`   📋 탐색 계획: ${search_plan?.length || 0}개 작업`);
    console.error(`   🔍 코드베이스 발견: ${codebase_findings ? '✅ 제공됨' : '❌ 없음'}`);
    console.error(`   📝 추가 분석: ${additional_analysis ? '✅ 제공됨' : '❌ 없음'}`);

    try {
      // 워크플로우 상태 조회
      const workflowState = this.getWorkflowState(workflow_id);
      if (!workflowState) {
        throw new Error(`워크플로우 상태를 찾을 수 없습니다: ${workflow_id}\n\n워크플로우가 만료되었거나 올바르지 않은 ID입니다.`);
      }

      console.error(`📄 워크플로우 상태 복원:`);
      console.error(`   📋 문서 타입: ${workflowState.documentType}`);
      console.error(`   🎯 기능명: ${workflowState.featureName}`);
      console.error(`   🏠 사이트: ${workflowState.site.name}`);
      console.error(`   📅 생성 시간: ${workflowState.created_at}`);

      // 탐색 계획 분석
      if (search_plan && Array.isArray(search_plan)) {
        console.error(`📊 제안된 탐색 계획 분석:`);
        search_plan.forEach((task: any, index: number) => {
          console.error(`   ${index + 1}. [P${task.priority || 5}] ${task.task}`);
          console.error(`      🔍 검색어: "${task.search_query}"`);
          console.error(`      🎯 타겟: ${task.target_type}`);
        });
      }

      // 코드베이스 발견 내용 분석
      if (codebase_findings) {
        const findingsKeys = Object.keys(codebase_findings);
        console.error(`🔍 코드베이스 발견 내용 분석:`);
        console.error(`   📋 발견 항목: ${findingsKeys.length}개`);
        console.error(`   🔑 항목 유형: [${findingsKeys.join(', ')}]`);
        
        // 각 발견 항목의 크기 분석
        findingsKeys.forEach(key => {
          const content = codebase_findings[key];
          if (typeof content === 'string') {
            console.error(`   📄 ${key}: ${content.length} 문자`);
          } else if (Array.isArray(content)) {
            console.error(`   📋 ${key}: ${content.length}개 항목`);
          } else {
            console.error(`   📦 ${key}: 객체 타입`);
          }
        });
      }

      // 템플릿 변수에 코드베이스 정보 통합
      const enrichedTemplate = this.integrateCodebaseIntoTemplate(
        workflowState.templateData,
        codebase_findings,
        search_plan
      );

      // 최종 문서 생성
      const finalDocument = this.generateFinalDocumentWithCodebase(
        workflowState,
        enrichedTemplate,
        codebase_findings,
        additional_analysis,
        search_plan
      );

      const processingTime = Date.now() - startTime;
      
      console.error(`✅ 워크플로우 실행 완료:`);
      console.error(`   🆔 워크플로우 ID: ${workflow_id}`);
      console.error(`   📄 최종 문서 길이: ${finalDocument.content[0].text.length} 문자`);
      console.error(`   ⏱️ 실행 시간: ${processingTime}ms`);
      console.error(`   📊 총 처리 시간: ${workflowState.processingTime + processingTime}ms`);

      // 워크플로우 상태 정리
      this.workflowStates.delete(workflow_id);
      console.error(`🗑️ 워크플로우 상태 정리 완료`);

      return finalDocument;

    } catch (error) {
      const processingTime = Date.now() - startTime;
      console.error(`❌ 워크플로우 실행 실패 (${processingTime}ms):`, error);
      
      return {
        content: [{
          type: 'text',
          text: `❌ **워크플로우 실행 실패**\n\n워크플로우 ID: ${workflow_id}\n오류: ${error instanceof Error ? error.message : '알 수 없는 오류'}\n\n**확인 사항:**\n- 워크플로우 ID가 정확한지 확인\n- 워크플로우가 만료되지 않았는지 확인 (TTL: ${this.WORKFLOW_STATE_TTL / 1000}초)\n- codebase_findings가 올바른 형식인지 확인`
        }]
      };
    }
  }

  /**
   * 코드베이스 정보를 템플릿에 통합
   */
  private integrateCodebaseIntoTemplate(templateData: any, codebaseFindings: any, searchPlan: any[]): any {
    console.error(`🔧 템플릿-코드베이스 통합 시작`);
    
    const enrichedTemplate = { ...templateData };
    
    if (!enrichedTemplate.variables) {
      enrichedTemplate.variables = {};
    }

    // 코드베이스 발견 내용을 템플릿 변수에 매핑
    if (codebaseFindings) {
      Object.entries(codebaseFindings).forEach(([key, value]) => {
        console.error(`   🔗 통합: ${key} → 템플릿 변수`);
        enrichedTemplate.variables[key] = value;
      });
    }

    // 탐색 계획 메타데이터 추가
    if (searchPlan) {
      enrichedTemplate.search_metadata = {
        plan_count: searchPlan.length,
        high_priority_tasks: searchPlan.filter((task: any) => (task.priority || 5) >= 8).length,
        target_types: [...new Set(searchPlan.map((task: any) => task.target_type))]
      };
    }

    console.error(`   ✅ 통합 완료: ${Object.keys(enrichedTemplate.variables).length}개 변수`);
    return enrichedTemplate;
  }

  /**
   * 코드베이스 정보가 통합된 최종 문서 생성
   */
  private generateFinalDocumentWithCodebase(
    workflowState: any,
    enrichedTemplate: any,
    codebaseFindings: any,
    additionalAnalysis: string,
    searchPlan: any[]
  ): any {
    const { documentType, featureName, site, guidelines, phase } = workflowState;
    const displayName = this.getDocumentTypeDisplayName(documentType);
    const hasGuidelines = guidelines.combined_instructions?.count > 0;

    console.error(`📝 최종 문서 생성:`);
    console.error(`   📋 문서 타입: ${displayName}`);
    console.error(`   🎯 기능명: ${featureName}`);
    console.error(`   📊 변수 개수: ${Object.keys(enrichedTemplate.variables).length}개`);
    console.error(`   🔍 발견 항목: ${Object.keys(codebaseFindings || {}).length}개`);

    let finalDocumentText = `📋 **${featureName} - ${displayName} (완성)**

## 📋 **문서 개요**
- 🏢 **대상 사이트**: ${site.name}
- 📁 **프로젝트**: ${workflowState.projectInfo.projectPath || '.'}
- ⏰ **생성 시간**: ${new Date().toLocaleString('ko-KR')}
- 🚀 **처리 시간**: ${workflowState.processingTime}ms (백엔드) + 워크플로우 실행
- 🎯 **개발 단계**: ${phase}

## 📝 **${displayName} 내용**

### 🎯 **${featureName} 개요**
이 문서는 ${featureName} 관련 ${displayName.toLowerCase()}을 정의합니다.

### 🤖 **코드베이스 분석 결과**
*코드에이전트가 직접 탐색하여 수집한 현재 프로젝트의 실제 정보입니다.*

${this.formatCodebaseFindings(codebaseFindings)}

### 📄 **템플릿 기반 구조**
\`\`\`markdown
${this.fillTemplateVariables(enrichedTemplate.template || '', enrichedTemplate.variables)}
\`\`\`

${hasGuidelines ? `
### 🎯 **LLM 지침 적용**

**역할**: ${guidelines.combined_instructions.role || '기본 역할'}

**목표**: ${guidelines.combined_instructions.objective || '문서 목적 달성'}

**적용된 지침**: ${guidelines.guidelines?.length || 0}개 (총 우선순위: ${guidelines.combined_instructions?.total_priority || 0})
` : ''}

${additionalAnalysis ? `
### 💡 **추가 분석 및 인사이트**
${additionalAnalysis}
` : ''}

### 🔍 **워크플로우 실행 정보**
**탐색 계획**: ${searchPlan?.length || 0}개 작업 수행
**우선순위별 작업**:
${searchPlan?.map((task: any, index: number) => 
  `${index + 1}. [P${task.priority}] ${task.task} (${task.target_type})`
).join('\n') || '정보 없음'}

### ✅ **체크리스트**
- [x] ${displayName} 작성 완료
- [x] 코드베이스 분석 완료
- [x] 템플릿 변수 채우기 완료
- [ ] 관련 팀 검토
- [ ] 승인 프로세스 진행
- [ ] 문서 버전 관리 등록

---
💡 **완성**: 이 ${displayName.toLowerCase()}은 실제 코드베이스 분석을 바탕으로 생성되었습니다.`;

    return {
      content: [{
        type: 'text',
        text: finalDocumentText
      }],
      metadata: {
        workflow_id: workflowState.workflowId,
        workflow_completed: true,
        document_type: documentType,
        feature_name: featureName,
        codebase_integrated: !!codebaseFindings,
        search_plan_executed: !!searchPlan
      }
    };
  }

  /**
   * 코드베이스 발견 내용을 문서 형식으로 포맷팅
   */
  private formatCodebaseFindings(codebaseFindings: any): string {
    if (!codebaseFindings || Object.keys(codebaseFindings).length === 0) {
      return '⚠️ **코드베이스 분석 결과가 제공되지 않았습니다.**\n\n';
    }

    let section = '';
    const findingsKeys = Object.keys(codebaseFindings);

    findingsKeys.forEach((key, index) => {
      const content = codebaseFindings[key];
      section += `#### ${index + 1}. 🔍 ${key}\n\n`;
      
      if (typeof content === 'string') {
        section += `\`\`\`\n${content.length > 1000 ? content.substring(0, 1000) + '\n...(내용이 길어 일부만 표시)' : content}\n\`\`\`\n\n`;
      } else if (Array.isArray(content)) {
        section += `**발견된 항목들** (${content.length}개):\n`;
        content.slice(0, 10).forEach((item: any, idx: number) => {
          if (typeof item === 'string') {
            section += `${idx + 1}. \`${item}\`\n`;
          } else if (typeof item === 'object' && item.file && item.line) {
            section += `${idx + 1}. **${item.file}** (라인 ${item.line})\n`;
            if (item.content) {
              section += `   \`${item.content.substring(0, 100)}${item.content.length > 100 ? '...' : ''}\`\n`;
            }
          } else {
            section += `${idx + 1}. ${JSON.stringify(item).substring(0, 100)}${JSON.stringify(item).length > 100 ? '...' : ''}\n`;
          }
          section += `\n`;
        });
        
        if (content.length > 10) {
          section += `⚠️ *${content.length - 10}개 항목 더 있음 (처음 10개만 표시)*\n\n`;
        }
      } else {
        section += `\`\`\`json\n${JSON.stringify(content, null, 2)}\n\`\`\`\n\n`;
      }
    });

    return section;
  }

  /**
   * 템플릿 변수를 실제 값으로 채우기
   */
  private fillTemplateVariables(template: string, variables: any): string {
    if (!template || !variables) return template || '';

    let filledTemplate = template;
    
    Object.entries(variables).forEach(([key, value]) => {
      const placeholder = `{{${key}}}`;
      let replacement = '';
      
      if (typeof value === 'string') {
        replacement = value;
      } else if (Array.isArray(value)) {
        replacement = value.map((item: any, index: number) => 
          `${index + 1}. ${typeof item === 'string' ? item : JSON.stringify(item)}`
        ).join('\n');
      } else {
        replacement = JSON.stringify(value, null, 2);
      }
      
      filledTemplate = filledTemplate.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), replacement);
    });

    console.error(`🔧 템플릿 변수 채우기 완료: ${Object.keys(variables).length}개 변수 적용`);
    return filledTemplate;
  }

  // 🚀 ===== 서버 시작 =====

  async start(): Promise<void> {
    // 캐시 디렉토리 초기화
    this.initializeCacheDirectory();
    
    // 시작 시 오래된 캐시 정리
    this.cleanupOldCache();
    
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    
    // MCP 연결 후에는 최소한의 로그만 출력 (Cursor IDE 호환성 위해)
    const isProduction = process.env.NODE_ENV === 'production' || process.env.MCP_QUIET === 'true';
    
    if (!isProduction) {
      console.error(`🚀 Figure MCP Server v4.0 시작됨 (단순 협업 모드)`);
      console.error(`📡 Backend: ${this.BACKEND_API_URL}`);
      console.error(`📁 캐시: ${this.CACHE_DIR}`);
      
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
      console.error(`🎯 서버 준비 완료! (코드에이전트 협업 모드)`);
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
