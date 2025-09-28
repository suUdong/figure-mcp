#!/usr/bin/env node

// .env 파일 로드 (최우선) - MCP stdout 오염 방지
try {
  // 조용한 환경변수 로드 (stdout 출력 방지)
  const fs = require('fs');
  const path = require('path');
  const envPath = path.join(process.cwd(), '.env');
  
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    envContent.split('\n').forEach((line: string) => {
      const [key, ...valueParts] = line.split('=');
      if (key && valueParts.length > 0) {
        const value = valueParts.join('=').trim();
        if (!process.env[key.trim()]) {
          process.env[key.trim()] = value;
        }
      }
    });
  }
} catch (error) {
  // .env 로드 실패는 무시 (선택사항이므로)
}

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
import { randomUUID } from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

// ==== 간단한 타입 정의 ====

interface DocumentSection {
  id: string;
  title: string;
  description: string;
  order: number;
  dependencies?: string[];
  estimatedTokens?: number;
  prompt?: string;
}

/**
 * Figure MCP Server - 지능형 문서 생성 시스템
 * 통합 워크플로우로 다양한 개발 산출물을 자동 생성
 */
class FigureMCPServerSimple {
  private server: Server;
  private apiClient: AxiosInstance;
  private readonly BACKEND_API_URL: string;
  private readonly DEFAULT_SITE_ID: string;
  private readonly DEFAULT_SITE_NAME: string;
  private availableSites: any[] = [];


  // ==== 캐싱 및 저장 시스템 ====
  private templateCache: Map<string, { data: any; timestamp: number }> = new Map();
  private readonly CACHE_TIMEOUT = 60 * 60 * 1000; // 1시간
  private readonly USER_FOLDER_PATH: string;
  private readonly CACHE_FOLDER_PATH: string;

  constructor() {
    // 환경 변수 설정
    this.BACKEND_API_URL = process.env.BACKEND_API_URL || 'http://localhost:8001/api';
    this.DEFAULT_SITE_ID = process.env.DEFAULT_SITE_ID || '1';
    this.DEFAULT_SITE_NAME = process.env.DEFAULT_SITE_NAME || 'KT알파';

    // 사용자 폴더 및 캐시 폴더 설정
    this.USER_FOLDER_PATH = path.join(os.homedir(), 'figure-mcp-documents');
    this.CACHE_FOLDER_PATH = path.join(os.homedir(), '.figure-mcp-cache');

    // 서버 초기화
    this.server = new Server(
      {
        name: 'figure-mcp-simple',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
          prompts: {},
          sampling: {}, // LLM Sampling 기능 활성화
        },
      }
    );


    // API 클라이언트 초기화
    this.apiClient = axios.create({
      baseURL: this.BACKEND_API_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    this.setupHandlers();
  }

  private setupHandlers(): void {
    this.setupPrompts();
    this.setupTools();
  }

  // 📝 ===== Prompts 설정 =====
  private setupPrompts(): void {
    this.server.setRequestHandler(ListPromptsRequestSchema, async () => {
      return {
        prompts: [
          {
            name: 'impact_analysis_prompt',
            description: '영향도분석서 생성 프롬프트',
            arguments: [
              {
                name: 'feature_name',
                description: '기능명',
                required: true
              },
              {
                name: 'site_name',
                description: '사이트명 (선택)',
                required: false
              }
            ]
          }
        ]
      };
    });

    this.server.setRequestHandler(GetPromptRequestSchema, async (request) => {
      if (request.params.name === 'impact_analysis_prompt') {
        const featureName = request.params.arguments?.feature_name || '새로운 기능';
        const siteName = request.params.arguments?.site_name || this.DEFAULT_SITE_NAME;
        
        return {
          description: `${featureName}에 대한 영향도분석서 생성`,
          messages: [{
            role: 'user',
            content: {
              type: 'text',
              text: `${featureName} 기능에 대한 영향도분석서를 ${siteName} 사이트 기준으로 작성해주세요.`
            }
          }]
        };
      }
      throw new Error('알 수 없는 프롬프트입니다.');
    });
  }


  // 🛠️ ===== Tools 설정 =====
  private setupTools(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'explore_workspace',
            description: '현재 워크스페이스의 파일과 폴더 구조를 탐색하여 AI가 분석할 수 있도록 ResourceLinks를 제공합니다.',
            inputSchema: {
              type: 'object',
              properties: {
                maxDepth: {
                  type: 'number',
                  description: '탐색할 최대 깊이 (기본값: 2)',
                  default: 2
                },
                includeHidden: {
                  type: 'boolean',
                  description: '숨김 파일/폴더 포함 여부 (기본값: false)',
                  default: false
                }
              },
              additionalProperties: false
            }
          },
          {
            name: 'create_document',
            description: '다양한 개발 문서를 생성합니다. (요구사항서, 영향도분석서, 테이블명세서 등)',
            inputSchema: {
              type: 'object',
              properties: {
                documentType: {
                  type: 'string',
                  enum: ['IMPACT_ANALYSIS', 'REQUIREMENTS', 'TABLE_SPECIFICATION', 'PROGRAM_DESIGN_ONLINE', 'PROGRAM_DESIGN_BATCH', 'PROGRAM_DESIGN_COMMON', 'INTERFACE_SPECIFICATION'],
                  description: '생성할 문서 타입'
                },
                featureName: {
                  type: 'string',
                  description: '기능명/분석 대상'
                },
                siteName: {
                  type: 'string',
                  description: '사이트명 (선택사항)',
                  default: this.DEFAULT_SITE_NAME
                },
                requirements: {
                  type: 'string',
                  description: '요구사항 또는 상세 설명'
                },
                progressToken: {
                  type: ['string', 'number'],
                  description: '진행상황 추적을 위한 토큰 (선택사항)'
                }
              },
              required: ['documentType', 'featureName']
            }
          },
          {
            name: 'create_table_specification',
            description: '데이터베이스 테이블 명세서를 생성합니다.',
            inputSchema: {
              type: 'object',
              properties: {
                tableName: {
                  type: 'string',
                  description: '테이블명'
                },
                siteName: {
                  type: 'string',
                  description: '사이트명 (선택사항)',
                  default: this.DEFAULT_SITE_NAME
                },
                schemaInfo: {
                  type: 'string',
                  description: '테이블 스키마 정보 (DDL, 필드 설명 등)'
                }
              },
              required: ['tableName']
            }
          },
          {
            name: 'search_deliverables',
            description: '개발 산출물에서 업무지식을 검색하여 AI가 완성된 답변을 제공합니다.',
            inputSchema: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: '검색할 질문이나 키워드'
                },
                siteName: {
                  type: 'string',
                  description: '사이트명 (선택사항)',
                  default: this.DEFAULT_SITE_NAME
                },
                maxResults: {
                  type: 'number',
                  description: '최대 검색 결과 수 (기본값: 5)',
                  default: 5
                }
              },
              required: ['query'],
              additionalProperties: false
            }
          },
          {
            name: 'list_available_sites',
            description: '사용 가능한 사이트 목록을 조회합니다.',
            inputSchema: {
              type: 'object',
              properties: {},
              additionalProperties: false
            }
          }
        ]
      };
    });

    // 도구 실행 핸들러
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'explore_workspace':
            return await this.handleExploreWorkspace(args as any);
          case 'create_document':
            return await this.handleCreateDocument(args as any);
          case 'create_table_specification':
            return await this.handleCreateTableSpecification(args as any);
          case 'search_deliverables':
            return await this.handleSearchDeliverables(args as any);
          case 'list_available_sites':
            return await this.handleListAvailableSites();
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

  // 🎯 ===== 핵심 기능 구현 =====

  /**
   * 워크스페이스 탐색 핸들러 - ResourceLinks 제공
   */
  private async handleExploreWorkspace(args: {
    maxDepth?: number;
    includeHidden?: boolean;
  }) {
    try {
      console.error('🔍 워크스페이스 탐색 시작...');
      
      const maxDepth = args.maxDepth || 2;
      const includeHidden = args.includeHidden || false;
      const workspaceRoot = process.cwd();
      
      // 워크스페이스 파일/폴더 탐색
      const resourceLinks = await this.exploreWorkspaceForResourceLinks(
        workspaceRoot,
        maxDepth,
        includeHidden
      );

      console.error(`✅ 워크스페이스 탐색 완료: ${resourceLinks.length}개 항목 발견`);

      return {
        content: [
          {
            type: 'text',
            text: `🔍 **워크스페이스 탐색 결과**

**📁 워크스페이스**: \`${workspaceRoot}\`
**🔍 탐색 깊이**: ${maxDepth}단계
**📄 발견된 항목**: ${resourceLinks.length}개

**💡 사용 방법**: 
아래 파일/폴더들을 참조하여 프로젝트 구조를 파악하고 분석하세요.
각 항목을 클릭하거나 참조하면 해당 파일/폴더의 내용을 확인할 수 있습니다.

---`
          },
          ...resourceLinks
        ]
      };

    } catch (error) {
      console.error('❌ 워크스페이스 탐색 실패:', error);
      
      return {
        content: [{
          type: 'text',
          text: `❌ **워크스페이스 탐색 실패**

**오류**: ${error instanceof Error ? error.message : '알 수 없는 오류'}

**해결 방법**:
1. 올바른 프로젝트 디렉토리에서 실행하고 있는지 확인
2. 파일 시스템 접근 권한 확인
3. 워크스페이스 경로가 유효한지 확인`
        }],
        isError: true
      };
    }
  }

  /**
   * 통합 문서 생성 핸들러 - 전체 워크플로우를 하나의 도구에서 처리
   */
  private async handleCreateDocument(args: {
    documentType: string;
    featureName: string;
    siteName?: string;
    requirements?: string;
    progressToken?: string | number;
  }) {
    const startTime = Date.now();
    const sessionId = `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      console.error(`📝 산출물 생성 시작: ${args.documentType} - ${args.featureName}`);

      // 사용자에게 시작 알림 (stderr로 출력)
      console.error(`\n🚀 **개발 산출물 생성 시작**\n📋 **문서 타입**: ${this.getDocumentTypeDisplayName(args.documentType)}\n🎯 **기능명**: ${args.featureName}\n`);

      // === 1.1 Document Type 확인 ===
      if (args.progressToken) {
        this.sendProgressNotification(args.progressToken, sessionId, 1, 10, '1.1 문서 타입 확인 중...');
      }
      
      const displayName = this.getDocumentTypeDisplayName(args.documentType);
      const siteName = args.siteName || this.DEFAULT_SITE_NAME;
      await this.loadSites();
      const targetSite = this.findSite(siteName);

      if (!targetSite) {
        throw new Error(`사이트를 찾을 수 없습니다: ${siteName}`);
      }

      // === 1.2 백엔드에서 템플릿 가져오기 ===
      if (args.progressToken) {
        this.sendProgressNotification(args.progressToken, sessionId, 2, 10, '1.2 백엔드에서 템플릿 로딩 중...');
      }

      // 캐시된 템플릿 확인 후 백엔드에서 템플릿 가져오기
      let templateData: any = null;
      
      // 1. 캐시 확인
      templateData = this.getCachedTemplate(args.documentType, targetSite.id);
      
      if (!templateData) {
        // 2. 캐시 없으면 백엔드에서 가져오기
        try {
          // 백엔드 API 형식에 맞게 변환 (대문자 → 소문자)
          const backendDocumentType = args.documentType.toLowerCase();
          
          const templateResponse = await this.apiClient.get(`/templates/guide/${backendDocumentType}`, {
            params: { site_id: targetSite.id }
          });
          templateData = templateResponse.data;
          
          // 3. 캐시에 저장
          this.setCachedTemplate(args.documentType, targetSite.id, templateData);
          console.error(`✅ 템플릿 로드 및 캐싱 완료: ${args.documentType}`);
        } catch (error) {
          console.error('백엔드 템플릿 로드 실패:', error);
          templateData = { template: '기본 템플릿이 로드되지 않았습니다.' };
        }
      }

      // === 1.3 AI가 템플릿을 분석하여 섹션 구조 파악 ===
      console.error(`🤖 **AI 템플릿 분석 시작**\n📄 백엔드 템플릿을 분석하여 세분화된 섹션 구조를 설계합니다...`);
      
      if (args.progressToken) {
        this.sendProgressNotification(args.progressToken, sessionId, 3, 10, '1.3 AI가 템플릿 구조 분석 중...');
      }

      const analysis = await this.analyzeTemplateWithAI(
        args.documentType,
        args.featureName,
        args.requirements || '',
        templateData,
        targetSite
      );

      // AI 분석 결과 사용자에게 알림 (stderr로 출력)
      console.error(`✅ **AI 분석 완료**\n📊 총 ${analysis.sections.length}개 섹션으로 구조화됨\n🎯 우선 3개 섹션을 AI가 상세 생성하고, 나머지는 ResourceLinks와 함께 기본 구조 제공`);
      
      if (args.progressToken) {
        this.sendProgressNotification(args.progressToken, sessionId, 4, 10, `1.3 완료 - ${analysis.sections.length}개 섹션 계획됨`);
      }

      // === 1.4 AI가 소스코드를 참조하여 핵심 섹션만 우선 생성 ===
      const generatedSections: { [sectionId: string]: string } = {};
      
      // 타임아웃 방지를 위해 처음 3개 섹션만 생성
      const prioritySections = analysis.sections.slice(0, 3);
      let sectionCount = 0;

      console.error(`🎯 **우선 섹션 AI 생성 시작**\n📝 ${prioritySections.length}개 섹션을 AI가 워크스페이스 파일을 분석하여 상세 생성합니다...`);

      for (const section of prioritySections) {
        sectionCount++;
        
        // 각 섹션 시작 시 사용자에게 알림 (stderr로 출력)
        console.error(`🤖 **${sectionCount}/${prioritySections.length}번째 섹션 생성 중**\n📋 ${section.title}\n💭 ${section.description}`);
        
        if (args.progressToken) {
          this.sendProgressNotification(
            args.progressToken, 
            sessionId, 
            4 + sectionCount, 
            10, 
            `1.4 ${section.title} 생성 중... (${sectionCount}/${prioritySections.length})`
          );
        }

        try {
          // AI가 소스코드 Resources를 참조하여 각 섹션 생성
          const sectionContent = await this.generateSectionWithAI(
            args.documentType,
            section,
            args.featureName,
            args.requirements || '',
            targetSite,
            templateData,
            generatedSections // 이전 섹션들 참조 가능
          );

          // === 1.5 결과물 적재 ===
          generatedSections[section.id] = sectionContent;
          console.error(`✅ 섹션 생성 완료: ${section.title} (${sectionContent.length}자)`);
          
        } catch (error) {
          console.error(`⚠️ 섹션 생성 실패, 기본 내용 사용: ${section.title}`, error);
          generatedSections[section.id] = `### ${section.title}\n\n[이 섹션은 타임아웃으로 인해 기본 구조로 생성되었습니다]\n\n${section.description}`;
        }
      }

      // 나머지 섹션들은 기본 구조 + ResourceLinks로 생성 (타임아웃 방지)
      const remainingSections = analysis.sections.slice(3);
      
      if (args.progressToken) {
        this.sendProgressNotification(args.progressToken, sessionId, 7, 10, '워크스페이스 파일 탐색 중...');
      }
      
      // 워크스페이스 ResourceLinks 미리 생성
      const workspaceLinks = await this.exploreWorkspaceForResourceLinks(process.cwd(), 2, false);
      
      for (const section of remainingSections) {
        const relevantLinks = workspaceLinks.slice(0, 8); // 관련성 높은 상위 8개 파일/폴더
        
        const resourceLinksText = relevantLinks.length > 0 
          ? `\n\n**🔍 분석 참고 파일들**:\n${relevantLinks.map(link => `- [${link.name}](${link.uri}) - ${link.description}`).join('\n')}`
          : '';

        generatedSections[section.id] = `### ${section.title}

**📋 섹션 개요**: ${section.description}

**🔍 상세 분석 필요**: 이 섹션은 워크스페이스의 실제 파일들을 참조하여 상세 분석이 필요합니다.

**📋 작성 지침**: ${section.prompt}${resourceLinksText}

**💡 권장사항**: 위 파일들을 참조하여 구체적인 파일명, 클래스명, 메서드명을 포함한 실무적 내용으로 작성하세요.`;
        
        console.error(`📝 기본 구조 + ResourceLinks 생성: ${section.title}`);
      }

      // === 1.6 최종 문서 조합 및 템플릿 매칭 ===
      if (args.progressToken) {
        this.sendProgressNotification(args.progressToken, sessionId, 8, 10, '1.6 최종 문서 조합 및 검토 중...');
      }

      const finalDocument = await this.assembleAndRefineDocument(
        args.documentType,
        args.featureName,
        args.requirements || '',
        generatedSections,
        analysis.sections,
        targetSite,
        templateData
      );

      if (args.progressToken) {
        this.sendProgressNotification(args.progressToken, sessionId, 9, 10, '최종 품질 검토 중...');
      }

      // 최종 품질 검토 및 개선
      const reviewedDocument = await this.finalQualityReview(
        finalDocument,
        args.documentType,
        args.featureName
      );

      if (args.progressToken) {
        this.sendProgressNotification(args.progressToken, sessionId, 10, 10, '문서 생성 완료! 🎉');
      }

      // 사용자 폴더에 문서 저장
      let savedFilePath: string | null = null;
      try {
        savedFilePath = await this.saveDocumentToUserFolder(
          args.documentType,
          args.featureName,
          reviewedDocument,
          siteName
        );
      } catch (error) {
        console.error('❌ 사용자 폴더 저장 실패:', error);
      }

      // 백엔드에 개발 산출물로 업로드
      let uploadedToBackend = false;
      try {
        await this.uploadDeliverableToBackend(
          args.documentType,
          args.featureName,
          reviewedDocument,
          siteName,
          targetSite.id
        );
        uploadedToBackend = true;
        console.error('✅ 백엔드 개발 산출물 업로드 완료');
      } catch (error) {
        console.error('⚠️ 백엔드 업로드 실패 (로컬 저장은 성공):', error instanceof Error ? error.message : error);
      }

      const processingTime = Date.now() - startTime;

      return {
        content: [{
          type: 'text',
          text: `${reviewedDocument}

---

## 💾 **문서 저장 정보**

${savedFilePath ? `✅ **로컬 저장 완료**: \`${savedFilePath}\`` : '❌ **로컬 저장 실패**: 사용자 폴더 저장 중 오류 발생'}

${uploadedToBackend ? '✅ **백엔드 업로드 완료**: 개발 산출물 카테고리로 업로드됨' : '⚠️ **백엔드 업로드 실패**: 로컬 저장은 성공'}

**📁 사용자 문서 폴더**: \`${this.USER_FOLDER_PATH}\`

**💡 사용 방법**: 
- 저장된 파일을 직접 편집하여 추가 수정 가능
- 백엔드 업로드 성공 시 \`search_deliverables\` 도구로 업무지식 검색 가능
- 버전 관리 시스템에 추가하여 팀과 공유`
        }],
        metadata: {
          document_type: args.documentType,
          feature_name: args.featureName,
          site_name: siteName,
          total_sections_planned: analysis.sections.length,
          priority_sections_generated: prioritySections.length,
          remaining_sections_basic: analysis.sections.length - prioritySections.length,
          complexity: analysis.complexity,
          estimated_vs_actual_time: `${analysis.estimatedTime}분 예상 → ${Math.ceil(processingTime / 60000)}분 실제`,
          processing_time_ms: processingTime,
          workflow_used: 'timeout_optimized_batch',
          session_id: sessionId,
          saved_file_path: savedFilePath,
          user_folder: this.USER_FOLDER_PATH,
          template_cached: true
        }
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      console.error(`❌ 통합 문서 생성 실패 (${processingTime}ms):`, error);

      if (args.progressToken) {
        this.sendProgressNotification(
          args.progressToken,
          sessionId,
          0,
          10,
          `오류 발생: ${error instanceof Error ? error.message : '알 수 없는 오류'}`
        );
      }

      return {
        content: [{
          type: 'text',
          text: `❌ **통합 문서 생성 실패**

**기능**: ${args.featureName}
**문서 타입**: ${args.documentType}
**세션 ID**: ${sessionId}
**오류**: ${error instanceof Error ? error.message : '알 수 없는 오류'}

**확인 사항:**
- 백엔드 서비스가 실행 중인지 확인
- 사이트명이 정확한지 확인
- 네트워크 연결 상태 확인
- 요구사항이 충분히 상세한지 확인

**처리 시간**: ${processingTime}ms`
        }],
        isError: true
      };
    }
  }

  /**
   * 테이블 명세서 생성 핸들러
   */
  private async handleCreateTableSpecification(args: {
    tableName: string;
    siteName?: string;
    schemaInfo?: string;
  }) {
    const startTime = Date.now();

    try {
      console.error(`📊 테이블 명세서 생성 시작: ${args.tableName}`);

      const siteName = args.siteName || this.DEFAULT_SITE_NAME;
      await this.loadSites();
      const targetSite = this.findSite(siteName);

      if (!targetSite) {
        throw new Error(`사이트를 찾을 수 없습니다: ${siteName}`);
      }

      // 백엔드에서 테이블 명세서 템플릿 가져오기
      const templateResponse = await this.apiClient.get('/templates/guide/TABLE_SPECIFICATION', {
        params: { site_id: targetSite.id }
      });

      const templateData = templateResponse.data;

      // 테이블 명세서 내용 생성
      const documentContent = this.generateTableSpecification(
        args.tableName,
        args.schemaInfo || '',
        templateData,
        targetSite
      );

      const processingTime = Date.now() - startTime;

      return {
        content: [{
          type: 'text',
          text: documentContent
        }],
        metadata: {
          document_type: 'TABLE_SPECIFICATION',
          table_name: args.tableName,
          site_name: siteName,
          processing_time_ms: processingTime
        }
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      console.error(`❌ 테이블 명세서 생성 실패 (${processingTime}ms):`, error);

      return {
        content: [{
          type: 'text',
          text: `❌ **테이블 명세서 생성 실패**\n\n테이블: ${args.tableName}\n오류: ${error instanceof Error ? error.message : '알 수 없는 오류'}`
        }],
        isError: true
      };
    }
  }

  /**
   * 개발 산출물 기반 RAG 검색 핸들러
   */
  private async handleSearchDeliverables(args: {
    query: string;
    siteName?: string;
    maxResults?: number;
  }) {
    try {
      console.error(`🔍 개발 산출물 RAG 검색 시작: "${args.query}"`);

      const siteName = args.siteName || this.DEFAULT_SITE_NAME;
      const maxResults = args.maxResults || 5;
      
      await this.loadSites();
      const targetSite = this.findSite(siteName);

      if (!targetSite) {
        throw new Error(`사이트를 찾을 수 없습니다: ${siteName}`);
      }

      // 백엔드 RAG 검색 (개발 산출물 카테고리만)
      const ragResponse = await this.apiClient.post('/rag/search', {
        query: args.query,
        site_id: targetSite.id,
        max_results: maxResults,
        filter: {
          category: 'deliverable' // 개발 산출물만 검색
        }
      });

      const searchResults = ragResponse.data?.data?.results || [];
      
      if (searchResults.length === 0) {
        return {
          content: [{
            type: 'text',
            text: `🔍 **개발 산출물 검색 결과**

**검색어**: "${args.query}"
**대상 사이트**: ${siteName}

❌ **검색 결과 없음**

관련된 개발 산출물이 없습니다. 먼저 \`create_document\`로 개발 산출물을 생성하시기 바랍니다.`
          }]
        };
      }

      // AI가 RAG 결과를 완성된 업무지식으로 변환
      const aiResponse = await this.generateBusinessKnowledgeWithAI(
        args.query,
        searchResults,
        targetSite
      );

      console.error(`✅ RAG 검색 및 AI 완성 완료: ${searchResults.length}개 결과`);

      return {
        content: [{
          type: 'text',
          text: aiResponse
        }],
        metadata: {
          query: args.query,
          site_name: siteName,
          search_results_count: searchResults.length,
          deliverable_sources: searchResults.map((r: any) => r.metadata?.title || 'Unknown'),
          processing_type: 'rag_ai_completion'
        }
      };

    } catch (error) {
      console.error('❌ 개발 산출물 검색 실패:', error);
      
      return {
        content: [{
          type: 'text',
          text: `❌ **개발 산출물 검색 실패**

**검색어**: "${args.query}"
**오류**: ${error instanceof Error ? error.message : '알 수 없는 오류'}

**해결 방법**:
- 백엔드 서비스 상태 확인
- 개발 산출물이 업로드되어 있는지 확인
- 네트워크 연결 상태 확인`
        }],
        isError: true
      };
    }
  }

  /**
   * 사용 가능한 사이트 목록 조회
   */
  private async handleListAvailableSites() {
    try {
      console.error(`🏢 사이트 목록 조회 시작`);

      await this.loadSites();

      if (this.availableSites.length === 0) {
        return {
          content: [{
            type: 'text',
            text: `❌ **사용 가능한 사이트가 없습니다**\n\n백엔드 서비스와의 연결을 확인해주세요.`
          }]
        };
      }

      const sitesList = this.availableSites.map((site, index) => 
        `${index + 1}. **${site.name}** (${site.company})\n   - ID: ${site.id}\n   - 설명: ${site.description || '설명 없음'}`
      ).join('\n\n');

      return {
        content: [{
          type: 'text',
          text: `🏢 **사용 가능한 사이트 목록**\n\n${sitesList}\n\n**기본 사이트**: ${this.DEFAULT_SITE_NAME} (ID: ${this.DEFAULT_SITE_ID})`
        }]
      };

    } catch (error) {
      console.error(`❌ 사이트 목록 조회 실패:`, error);

      return {
        content: [{
          type: 'text',
          text: `❌ **사이트 목록 조회 실패**\n\n오류: ${error instanceof Error ? error.message : '알 수 없는 오류'}\n\n백엔드 서비스 상태를 확인해주세요.`
        }],
        isError: true
      };
    }
  }

  // 🔧 ===== 유틸리티 메서드들 =====

  /**
   * 사이트 목록 로드
   */
  private async loadSites() {
    if (this.availableSites.length > 0) {
      return; // 이미 로드됨
    }

    try {
      console.error(`🔗 백엔드 연결 시도: ${this.BACKEND_API_URL}/sites`);
      const response = await this.apiClient.get('/sites');
      this.availableSites = response.data?.data || response.data || [];
      console.error(`✅ 사이트 목록 로드 완료: ${this.availableSites.length}개`);
    } catch (error) {
      console.error(`⚠️ 사이트 목록 로드 실패 (서버는 계속 실행):`, error instanceof Error ? error.message : error);
      this.availableSites = []; // 빈 배열로 초기화
      // 백엔드 연결 실패해도 MCP 서버는 계속 실행
    }
  }

  /**
   * 사이트 찾기
   */
  private findSite(siteName: string): any | null {
    if (!this.availableSites || this.availableSites.length === 0) {
      return null;
    }

    // ID로 찾기
    let site = this.availableSites.find(s => s.id === siteName);
    if (site) return site;

    // 이름으로 찾기
    site = this.availableSites.find(s => s.name === siteName);
    if (site) return site;

    // 부분 매칭으로 찾기
    site = this.availableSites.find(s => s.name.includes(siteName));
    if (site) return site;

    return null;
  }

  /**
   * 문서 내용 생성
   */
  private generateDocumentContent(
    documentType: string,
    featureName: string,
    requirements: string,
    templateData: any,
    site: any
  ): string {
    const displayName = this.getDocumentTypeDisplayName(documentType);

    return `📋 **${featureName} - ${displayName}**

## 📋 **문서 개요**
- 🏢 **대상 사이트**: ${site.name} (${site.company})
- ⏰ **생성 시간**: ${new Date().toLocaleString('ko-KR')}
- 📄 **문서 타입**: ${displayName}

## 🎯 **${featureName} 개요**
${requirements || '요구사항이 제공되지 않았습니다.'}

## 📝 **${displayName} 내용**

### 1. 기능 개요
- **기능명**: ${featureName}
- **목적**: ${requirements ? '제공된 요구사항 기반' : '상세 요구사항 필요'}

### 2. 상세 분석
${templateData.template || '템플릿 데이터를 불러오지 못했습니다.'}

### 3. 결론 및 권장사항
- 제공된 요구사항을 바탕으로 ${displayName.toLowerCase()}을 작성했습니다.
- 추가적인 상세 요구사항이 있다면 문서를 보완해주세요.

---
💡 **완성**: 이 ${displayName.toLowerCase()}은 ${site.name} 사이트 기준으로 생성되었습니다.`;
  }

  /**
   * 테이블 명세서 생성
   */
  private generateTableSpecification(
    tableName: string,
    schemaInfo: string,
    templateData: any,
    site: any
  ): string {
    return `📊 **${tableName} 테이블 명세서**

## 📋 **문서 개요**
- 🏢 **대상 사이트**: ${site.name} (${site.company})
- ⏰ **생성 시간**: ${new Date().toLocaleString('ko-KR')}
- 📄 **문서 타입**: 테이블 명세서

## 🗃️ **테이블 기본 정보**
- **테이블명**: ${tableName}
- **용도**: ${schemaInfo ? '제공된 스키마 정보 기반' : '상세 정보 필요'}

## 📋 **테이블 구조**
${schemaInfo || '스키마 정보가 제공되지 않았습니다. DDL이나 필드 정보를 제공해주세요.'}

## 📝 **상세 명세**
${templateData.template || '템플릿 데이터를 불러오지 못했습니다.'}

---
💡 **완성**: 이 테이블 명세서는 ${site.name} 사이트 기준으로 생성되었습니다.`;
  }

  /**
   * 문서 타입 표시명 반환
   */
  private getDocumentTypeDisplayName(documentType: string): string {
    const displayNames: Record<string, string> = {
      'IMPACT_ANALYSIS': '영향도분석서',
      'REQUIREMENTS': '요구사항정의서',
      'TABLE_SPECIFICATION': '테이블정의서',
      'PROGRAM_DESIGN_ONLINE': '프로그램명세서(온라인)',
      'PROGRAM_DESIGN_BATCH': '프로그램명세서(배치)',
      'PROGRAM_DESIGN_COMMON': '프로그램명세서(공통)',
      'INTERFACE_SPECIFICATION': '인터페이스정의서'
    };
    return displayNames[documentType] || documentType;
  }

  // 📋 ===== 문서 구조 분석 시스템 =====

  /**
   * 폴백용 문서 타입별 섹션 구조 템플릿 정의
   * 주의: 백엔드에서 템플릿 로드 실패 시에만 사용되는 폴백 메서드
   * 실제로는 백엔드에서 templateData.sections를 통해 섹션 구조를 받아와야 함
   */
  private getDocumentSectionTemplate(documentType: string): DocumentSection[] {
    const templates: Record<string, DocumentSection[]> = {
      'IMPACT_ANALYSIS': [
        {
          id: 'overview',
          title: '1. 변경 개요',
          description: '변경 대상과 범위를 명확히 정의',
          order: 1,
          estimatedTokens: 300,
          prompt: '기능 변경에 대한 전반적인 개요를 작성하세요. 변경 목적, 대상 시스템, 변경 범위를 포함해주세요.'
        },
        {
          id: 'system_analysis',
          title: '2. 시스템 영향 분석',
          description: '관련 시스템과 컴포넌트 영향도 분석',
          order: 2,
          dependencies: ['overview'],
          estimatedTokens: 500,
          prompt: '시스템 간 의존성과 영향을 받는 컴포넌트들을 분석하세요. 아키텍처 관점에서 상세히 설명해주세요.'
        },
        {
          id: 'risk_assessment',
          title: '3. 리스크 평가',
          description: '예상되는 위험 요소와 대응 방안',
          order: 3,
          dependencies: ['system_analysis'],
          estimatedTokens: 400,
          prompt: '변경으로 인한 잠재적 위험 요소들을 식별하고, 각 리스크의 수준과 대응 방안을 제시하세요.'
        },
        {
          id: 'implementation_plan',
          title: '4. 구현 계획',
          description: '단계별 구현 방안과 일정',
          order: 4,
          dependencies: ['risk_assessment'],
          estimatedTokens: 350,
          prompt: '안전한 구현을 위한 단계별 계획과 롤백 전략을 수립하세요.'
        }
      ],

      'REQUIREMENTS': [
        {
          id: 'business_requirements',
          title: '1. 비즈니스 요구사항',
          description: '업무적 요구사항과 배경',
          order: 1,
          estimatedTokens: 400,
          prompt: '비즈니스 관점에서의 요구사항과 그 배경을 상세히 설명하세요.'
        },
        {
          id: 'functional_requirements',
          title: '2. 기능적 요구사항',
          description: '시스템이 제공해야 할 기능들',
          order: 2,
          dependencies: ['business_requirements'],
          estimatedTokens: 600,
          prompt: '시스템이 수행해야 할 구체적인 기능들을 사용자 관점에서 명세하세요.'
        },
        {
          id: 'non_functional_requirements',
          title: '3. 비기능적 요구사항',
          description: '성능, 보안, 가용성 등 품질 요구사항',
          order: 3,
          dependencies: ['functional_requirements'],
          estimatedTokens: 400,
          prompt: '성능, 보안, 확장성, 가용성 등 품질 속성에 대한 요구사항을 정의하세요.'
        },
        {
          id: 'constraints',
          title: '4. 제약 조건',
          description: '기술적, 비즈니스적 제약 사항',
          order: 4,
          dependencies: ['non_functional_requirements'],
          estimatedTokens: 300,
          prompt: '프로젝트 진행 시 고려해야 할 기술적, 비즈니스적 제약 조건들을 나열하세요.'
        }
      ],

      'PROGRAM_DESIGN_ONLINE': [
        {
          id: 'system_overview',
          title: '1. 시스템 개요',
          description: '온라인 프로그램의 전체적인 구조와 목적',
          order: 1,
          estimatedTokens: 350,
          prompt: '온라인 시스템의 목적, 주요 기능, 전체 아키텍처를 개요 형태로 설명하세요.'
        },
        {
          id: 'ui_ux_design',
          title: '2. UI/UX 설계',
          description: '사용자 인터페이스와 사용자 경험 설계',
          order: 2,
          dependencies: ['system_overview'],
          estimatedTokens: 500,
          prompt: '사용자 인터페이스 구성요소, 화면 흐름, 사용자 경험을 고려한 설계 방안을 제시하세요.'
        },
        {
          id: 'api_design',
          title: '3. API 설계',
          description: 'RESTful API 또는 GraphQL 설계',
          order: 3,
          dependencies: ['ui_ux_design'],
          estimatedTokens: 450,
          prompt: 'API 엔드포인트, 요청/응답 구조, 인증 방식을 포함한 API 설계를 상세히 작성하세요.'
        },
        {
          id: 'performance_design',
          title: '4. 성능 설계',
          description: '실시간 처리 및 성능 최적화 방안',
          order: 4,
          dependencies: ['api_design'],
          estimatedTokens: 400,
          prompt: '예상 사용자 수, 응답 시간, 캐싱 전략, 부하 분산 등 성능 요구사항과 해결 방안을 제시하세요.'
        }
      ],

      'PROGRAM_DESIGN_BATCH': [
        {
          id: 'batch_overview',
          title: '1. 배치 프로그램 개요',
          description: '배치 프로그램의 목적과 처리 범위',
          order: 1,
          estimatedTokens: 350,
          prompt: '배치 프로그램의 목적, 처리 대상 데이터, 실행 주기를 명확히 정의하세요.'
        },
        {
          id: 'data_processing_design',
          title: '2. 데이터 처리 설계',
          description: '대용량 데이터 처리 로직과 최적화',
          order: 2,
          dependencies: ['batch_overview'],
          estimatedTokens: 500,
          prompt: '대용량 데이터 처리를 위한 알고리즘, 청크 단위 처리, 메모리 최적화 방안을 설계하세요.'
        },
        {
          id: 'scheduling_design',
          title: '3. 스케줄링 설계',
          description: '실행 일정과 의존성 관리',
          order: 3,
          dependencies: ['data_processing_design'],
          estimatedTokens: 350,
          prompt: '배치 작업의 실행 스케줄, 다른 작업과의 의존성, 우선순위를 고려한 설계를 제시하세요.'
        },
        {
          id: 'error_recovery_design',
          title: '4. 오류 처리 및 복구',
          description: '장애 상황 처리와 데이터 복구 방안',
          order: 4,
          dependencies: ['scheduling_design'],
          estimatedTokens: 400,
          prompt: '배치 실행 중 발생할 수 있는 오류 상황과 데이터 복구 전략을 상세히 설계하세요.'
        }
      ],

      'TABLE_SPECIFICATION': [
        {
          id: 'table_overview',
          title: '1. 테이블 개요',
          description: '테이블의 목적과 역할',
          order: 1,
          estimatedTokens: 250,
          prompt: '테이블의 업무적 목적, 저장하는 데이터의 성격, 시스템에서의 역할을 설명하세요.'
        },
        {
          id: 'column_specification',
          title: '2. 컬럼 명세',
          description: '각 컬럼의 상세 정의',
          order: 2,
          dependencies: ['table_overview'],
          estimatedTokens: 600,
          prompt: '각 컬럼의 이름, 데이터 타입, 길이, NULL 여부, 기본값, 설명을 상세히 정의하세요.'
        },
        {
          id: 'index_design',
          title: '3. 인덱스 설계',
          description: '성능 최적화를 위한 인덱스 전략',
          order: 3,
          dependencies: ['column_specification'],
          estimatedTokens: 350,
          prompt: '조회 패턴을 고려한 인덱스 설계와 성능 최적화 방안을 제시하세요.'
        },
        {
          id: 'relationship_design',
          title: '4. 관계 설계',
          description: '다른 테이블과의 관계 정의',
          order: 4,
          dependencies: ['index_design'],
          estimatedTokens: 300,
          prompt: '외래키, 참조 무결성, 다른 테이블과의 관계를 ERD와 함께 설명하세요.'
        }
      ]
    };

    // 공통 템플릿들도 추가
    if (!templates[documentType]) {
      // 기본 템플릿 사용
      return [
        {
          id: 'overview',
          title: '1. 개요',
          description: '문서의 목적과 범위',
          order: 1,
          estimatedTokens: 300,
          prompt: '이 문서의 목적과 다루는 범위를 명확히 설명하세요.'
        },
        {
          id: 'details',
          title: '2. 상세 내용',
          description: '핵심 내용',
          order: 2,
          dependencies: ['overview'],
          estimatedTokens: 500,
          prompt: '요구사항에 따른 상세한 내용을 작성하세요.'
        },
        {
          id: 'conclusion',
          title: '3. 결론 및 권장사항',
          description: '결론과 향후 방향',
          order: 3,
          dependencies: ['details'],
          estimatedTokens: 250,
          prompt: '결론과 향후 실행해야 할 사항들을 정리하세요.'
        }
      ];
    }

    return templates[documentType] || [];
  }

  /**
   * 폴백용 문서 구조 분석 및 계획 수립
   * 주의: 백엔드에서 템플릿 및 섹션 구조 로드 실패 시에만 사용
   */
  private async analyzeDocumentStructure(
    documentType: string,
    featureName: string,
    requirements: string,
    siteInfo: any
  ): Promise<{
    sections: DocumentSection[];
    estimatedTime: number;
    complexity: 'low' | 'medium' | 'high';
    recommendations: string[];
  }> {
    const sections = this.getDocumentSectionTemplate(documentType);
    const totalTokens = sections.reduce((sum, section) => sum + (section.estimatedTokens || 0), 0);
    
    // 복잡도 계산
    let complexity: 'low' | 'medium' | 'high' = 'low';
    if (totalTokens > 2000) complexity = 'high';
    else if (totalTokens > 1000) complexity = 'medium';

    // 예상 소요 시간 (분)
    const estimatedTime = Math.ceil(sections.length * 2 + totalTokens / 500);

    // 권장사항 생성
    const recommendations: string[] = [
      `총 ${sections.length}개 섹션으로 구성됩니다.`,
      `예상 소요 시간: 약 ${estimatedTime}분`,
      `복잡도: ${complexity === 'high' ? '높음' : complexity === 'medium' ? '보통' : '낮음'}`
    ];

    if (complexity === 'high') {
      recommendations.push('복잡한 문서이므로 중간 검토를 권장합니다.');
    }

    return {
      sections,
      estimatedTime,
      complexity,
      recommendations
    };
  }

  // 📊 ===== 백엔드 중심 분석 시스템 =====

  /**
   * 백엔드에서 받은 섹션 정보로 복잡도 계산
   */
  private calculateComplexity(sections: DocumentSection[]): 'low' | 'medium' | 'high' {
    const totalTokens = sections.reduce((sum, section) => sum + (section.estimatedTokens || 0), 0);
    
    if (totalTokens > 2000) return 'high';
    if (totalTokens > 1000) return 'medium';
    return 'low';
  }

  /**
   * 백엔드에서 받은 섹션 정보로 예상 시간 계산
   */
  private calculateEstimatedTime(sections: DocumentSection[]): number {
    const totalTokens = sections.reduce((sum, section) => sum + (section.estimatedTokens || 0), 0);
    return Math.ceil(sections.length * 2 + totalTokens / 500);
  }

  /**
   * 백엔드에서 받은 섹션 정보로 권장사항 생성
   */
  private generateRecommendations(sections: DocumentSection[]): string[] {
    const recommendations: string[] = [
      `총 ${sections.length}개 섹션으로 구성됩니다.`,
      `예상 소요 시간: 약 ${this.calculateEstimatedTime(sections)}분`
    ];

    const complexity = this.calculateComplexity(sections);
    recommendations.push(`복잡도: ${complexity === 'high' ? '높음' : complexity === 'medium' ? '보통' : '낮음'}`);

    if (complexity === 'high') {
      recommendations.push('복잡한 문서이므로 중간 검토를 권장합니다.');
    }

    if (sections.some(s => s.dependencies && s.dependencies.length > 0)) {
      recommendations.push('섹션 간 의존성이 있으므로 순서대로 생성됩니다.');
    }

    return recommendations;
  }

  // 🤖 ===== AI 기반 템플릿 분석 시스템 =====

  /**
   * AI가 백엔드 템플릿을 분석하여 섹션 구조 파악
   */
  private async analyzeTemplateWithAI(
    documentType: string,
    featureName: string,
    requirements: string,
    templateData: any,
    siteInfo: any
  ): Promise<{
    sections: DocumentSection[];
    complexity: 'low' | 'medium' | 'high';
    estimatedTime: number;
    recommendations: string[];
  }> {
    try {
      console.error(`🤖 AI가 템플릿 구조 분석 시작: ${documentType}`);

      const templateAnalysisPrompt = `당신은 **소프트웨어 개발 산출물 전문가**입니다.

**🎯 임무**: 실제 개발 프로젝트에서 사용할 **전문적인 개발 산출물**을 생성하기 위한 섹션 구조를 설계

**📋 개발 산출물 정보:**
- **문서 타입**: ${this.getDocumentTypeDisplayName(documentType)}
- **대상 기능**: ${featureName}
- **개발 요구사항**: ${requirements}
- **개발 환경**: ${siteInfo.name} (${siteInfo.company})

**📄 기준 템플릿 (백엔드 제공):**
${templateData?.content || templateData?.template || '템플릿 정보 없음'}

**📋 템플릿 메타정보:**
- 템플릿 타입: ${templateData?.template_type || '정보 없음'}
- 버전: ${templateData?.version || '정보 없음'}  
- 변수: ${JSON.stringify(templateData?.variables || {}, null, 2)}
- 지침: ${templateData?.instructions || '지침 없음'}

**🎯 템플릿 세분화 분석 요청:**
위 백엔드 템플릿을 **단락 단위로 세세하게 분석**하여, 각 단락별로 개별 AI 생성이 가능하도록 **세분화된 섹션 구조**를 설계해주세요.

**🔍 세분화 분석 원칙:**
1. **단락별 분해**: 템플릿의 모든 항목을 개별 단락으로 분해 (예: "개요" → "목적", "범위", "배경"으로 세분화)
2. **세부 항목 식별**: 큰 항목 안의 모든 하위 항목들을 놓치지 않고 개별 섹션으로 추출
3. **독립적 생성 가능**: 각 단락이 개별 AI 요청으로 생성 가능하도록 설계
4. **논리적 순서**: 단락 간 의존성과 순서 고려
5. **완전성 보장**: 템플릿의 모든 요구사항을 빠짐없이 커버

**🎯 핵심 목표:**
이 개발 산출물은 **실제 개발팀이 바로 사용**할 수 있어야 합니다:
- 소스코드 레벨의 구체적 분석
- 실제 파일명, 클래스명, 메서드명 포함
- 개발자가 바로 실행할 수 있는 액션 아이템
- 기술적 의사결정을 위한 정확한 정보

**📋 세분화 예시:**
템플릿에 "변경 개요" 항목이 있다면:
- 1.1 변경 목적 및 배경 (왜 이 변경이 필요한가?)
- 1.2 변경 대상 시스템 식별 (구체적으로 어떤 파일/클래스가 변경되는가?)
- 1.3 변경 범위 정의 (변경의 경계는 어디까지인가?)
- 1.4 변경으로 인한 기대 효과 (변경 후 달라지는 점은?)

**🔍 각 단락 설계 시 고려사항:**
1. **소스코드 분석 필수**: 각 단락에서 실제 코드를 참조해야 함
2. **구체적 내용**: 추상적 설명이 아닌 구체적 기술 내용  
3. **독립적 완성도**: 해당 단락만 읽어도 이해 가능한 수준
4. **실무 활용성**: 개발자가 바로 적용할 수 있는 수준
5. **템플릿 충실도**: 백엔드 템플릿의 모든 요구사항 반영

**📋 응답 형식 (JSON):**
\`\`\`json
{
  "sections": [
    {
      "id": "change_purpose",
      "title": "1.1 변경 목적 및 배경", 
      "description": "OAuth 도입의 비즈니스적, 기술적 목적과 배경 설명",
      "order": 1,
      "estimatedTokens": 200,
      "prompt": "현재 인증 시스템의 문제점과 OAuth 도입 필요성을 구체적으로 분석하세요",
      "dependencies": [],
      "requiredResources": ["file://project/src/auth"]
    },
    {
      "id": "target_system_identification",
      "title": "1.2 변경 대상 시스템 식별",
      "description": "OAuth 도입으로 변경될 구체적인 시스템 컴포넌트들",
      "order": 2, 
      "estimatedTokens": 300,
      "prompt": "실제 소스코드를 분석하여 변경될 클래스, 메서드, 파일들을 구체적으로 나열하세요",
      "dependencies": ["change_purpose"],
      "requiredResources": ["file://project/src/auth", "file://project/src/models"]
    }
  ],
  "complexity": "high",
  "reasoning": "템플릿을 세분화하여 총 15-20개의 상세 단락으로 분해됨"
}
\`\`\`

**💡 핵심**: 템플릿의 **모든 항목을 놓치지 않고** 세세한 단락으로 분해하여, 각 단락별로 **소스코드 기반의 구체적 내용**을 생성할 수 있도록 설계해주세요.

**⚡ 세분화 목표**: 
- 기존 3-5개 큰 섹션 → 15-20개 세세한 단락
- 각 단락은 200-400 토큰 분량의 집중된 내용
- 개발자가 각 단락별로 명확한 액션을 취할 수 있는 수준`;

      const response = await this.server.createMessage({
        messages: [{
          role: 'user',
          content: {
            type: 'text',
            text: `[작업] ${featureName}의 ${this.getDocumentTypeDisplayName(documentType)} 템플릿 구조 분석 중

${templateAnalysisPrompt}`
          }
        }],
        maxTokens: 1500
      });

      // AI 응답에서 JSON 추출 및 파싱
      const aiResponse = response.content.type === 'text' ? response.content.text : '';
      const jsonMatch = aiResponse.match(/```json\s*([\s\S]*?)\s*```/);
      
      if (jsonMatch) {
        try {
          const analysisResult = JSON.parse(jsonMatch[1]);
          
          // AI가 분석한 섹션 구조 사용
          const sections: DocumentSection[] = analysisResult.sections || [];
          const complexity = analysisResult.complexity || 'medium';
          const estimatedTime = this.calculateEstimatedTime(sections);
          const recommendations = [
            `AI가 템플릿을 분석하여 ${sections.length}개 섹션을 제안했습니다.`,
            `복잡도: ${complexity}`,
            `예상 소요 시간: 약 ${estimatedTime}분`,
            analysisResult.reasoning || ''
          ];

          console.error(`✅ AI 템플릿 분석 완료: ${sections.length}개 섹션`);
          
          return {
            sections,
            complexity: complexity as 'low' | 'medium' | 'high',
            estimatedTime,
            recommendations
          };
          
        } catch (parseError) {
          console.error('AI 응답 JSON 파싱 실패:', parseError);
          throw new Error('AI 분석 결과를 파싱할 수 없습니다.');
        }
      } else {
        console.error('AI 응답에서 JSON을 찾을 수 없음:', aiResponse);
        throw new Error('AI가 올바른 형식으로 응답하지 않았습니다.');
      }

    } catch (error) {
      console.error('AI 템플릿 분석 실패:', error);
      
      // 폴백: 기본 구조 사용
      console.error('⚠️ AI 분석 실패, 폴백 구조 사용');
      return await this.analyzeDocumentStructure(
        documentType,
        featureName,
        requirements,
        siteInfo
      );
    }
  }

  // 🤖 ===== LLM 협업 시스템 =====

  /**
   * LLM과 협업하여 특정 섹션 생성
   */
  private async generateSectionWithAI(
    documentType: string,
    section: DocumentSection,
    featureName: string,
    requirements: string,
    siteInfo: any,
    templateData: any,
    previousSections: { [sectionId: string]: string }
  ): Promise<string> {
    try {
      // 이전 섹션들의 컨텍스트 구성 (간단하게)
      const previousContext = Object.entries(previousSections).length > 0
        ? `**이전 섹션 참조**: ${Object.keys(previousSections).join(', ')} 섹션들이 이미 작성됨`
        : '';

      const contextPrompt = `당신은 **${siteInfo.name}의 소프트웨어 개발 산출물 전문가**입니다.

**🎯 개발 산출물 생성 임무**: ${this.getDocumentTypeDisplayName(documentType)}

**📋 프로젝트 정보:**
- **대상 기능**: ${featureName}
- **개발 요구사항**: ${requirements}
- **개발 환경**: ${siteInfo.name} (${siteInfo.company})

**📄 현재 작성 중인 섹션**: ${section.title}
**섹션 목적**: ${section.description}
**작성 가이드라인**: ${section.prompt}

${previousContext ? `**🔗 이전 섹션 참조:**\n${previousContext}` : ''}

${templateData?.content || templateData?.template ? `**📋 기준 템플릿**: 백엔드 템플릿 구조 참조` : ''}

${templateData?.instructions ? `**📋 템플릿 지침**: ${templateData.instructions.substring(0, 200)}...` : ''}

**🔍 소스코드 분석 방법:**

⚠️ **중요**: 현재 워크스페이스의 실제 파일들을 분석하여 구체적인 파일명과 코드 구조를 파악하세요!

**⚡ 개발 산출물 작성 원칙:**

1. **🔍 실제 코드 기반**: 추상적 설명 금지, 반드시 실제 소스코드 분석 기반
2. **📂 구체적 명시**: 파일명(예: UserController.ts), 클래스명(예: AuthService), 메서드명(예: authenticate()) 반드시 포함
3. **🔗 의존성 분석**: import/export 관계, 모듈 간 의존성 정확히 파악
4. **⚠️ 영향도 평가**: 변경 시 영향받는 모든 컴포넌트와 파일 식별
5. **🛠️ 실행 가능**: 개발자가 이 문서만 보고 바로 구현 시작 가능한 수준

**💻 개발팀 관점에서 "${section.title}" 섹션을 작성해주세요:**
- PM/PL이 기술 검토할 수 있는 수준
- 시니어 개발자가 아키텍처 판단할 수 있는 수준  
- 주니어 개발자가 구현 가이드로 사용할 수 있는 수준

필요한 소스코드 리소스를 선택적으로 참조하여 **실제 개발 현장에서 바로 사용 가능한** 전문적인 "${section.title}" 섹션을 작성해주세요.`;

      // 🚀 실제 MCP LLM Sampling 사용! Cursor/Copilot과 연동
      console.error(`🤖 LLM 협업 시작: ${section.title}`);
      
      try {
        // 타임아웃 방지를 위해 토큰 수 더 제한 (누적 효과 고려)
        const baseTokens = section.estimatedTokens || 300;
        const maxTokens = Math.min(baseTokens, 200); // 최대 200토큰으로 제한
        
        const response = await this.server.createMessage({
          messages: [{
            role: 'user',
            content: { 
              type: 'text', 
              text: `[TASK] Generating ${section.title} section for ${featureName}

${contextPrompt}`
            }
          }],
          maxTokens
        });

        // AI가 생성한 실제 콘텐츠 사용
        const generatedContent = response.content.type === 'text' 
          ? response.content.text 
          : `### ${section.title}\n\n[AI 응답 형식 오류: ${response.content.type}]`;

        console.error(`✅ AI 생성 완료: ${section.title} (${generatedContent.length}자)`);
        return generatedContent;

      } catch (error) {
        console.error(`⚠️ LLM Sampling 실패, 폴백 사용: ${section.title}`, error instanceof Error ? error.message : error);
        
        // 타임아웃이나 컨텍스트 유실 시 간단한 폴백 사용
        if (error instanceof Error && (
          error.message.includes('timeout') || 
          error.message.includes('context') ||
          error.message.includes('32603')
        )) {
          return `### ${section.title}\n\n**📋 개요**: ${section.description}\n\n**🔍 상세 분석 필요**: 이 섹션은 MCP 타임아웃으로 인해 기본 구조로 생성되었습니다.\n\n**💡 권장사항**: 별도 요청으로 이 섹션만 상세 생성하시기 바랍니다.\n\n**작성 지침**: ${section.prompt}`;
        }
        
        // 기타 에러의 경우 구조화된 컨텐츠 생성
        const fallbackContent = this.generateStructuredSectionContent(
          section,
          featureName,
          requirements,
          siteInfo,
          templateData,
          previousSections
        );
        
        return `${fallbackContent}\n\n---\n⚠️ **참고**: 이 섹션은 AI 연동 실패로 인해 기본 구조로 생성되었습니다.`;
      }

    } catch (error) {
      console.error(`❌ 섹션 생성 실패: ${section.title}`, error);
      return `**${section.title}**\n\n[섹션 생성 중 오류 발생: ${error instanceof Error ? error.message : '알 수 없는 오류'}]\n\n${section.description}에 대한 내용을 수동으로 작성해주세요.`;
    }
  }

  /**
   * 구조화된 섹션 컨텐츠 생성 (LLM 대체용 임시)
   */
  private generateStructuredSectionContent(
    section: DocumentSection,
    featureName: string,
    requirements: string,
    siteInfo: any,
    templateData: any,
    previousSections: { [sectionId: string]: string }
  ): string {
    const displayName = this.getDocumentTypeDisplayName(section.id);
    
    const baseContent = `### ${section.title}

#### 📋 개요
${featureName} 기능의 ${section.description}에 대해 상세히 분석합니다.

#### 🎯 주요 내용
${requirements ? `**요구사항 기반 분석:**\n${requirements}` : '요구사항이 제공되지 않았습니다.'}

#### 💡 ${siteInfo.name} 특화 고려사항
- **대상 시스템**: ${siteInfo.name} (${siteInfo.company})
- **환경 특성**: ${siteInfo.description || '사이트별 특성 분석 필요'}
- **적용 방안**: 해당 환경에 최적화된 구현 방법 제시

#### 🔍 상세 분석
${section.prompt}

**분석 결과:**
- 현재 섹션의 핵심 요소들을 체계적으로 정리
- 실무진이 바로 활용할 수 있는 구체적 방안 제시
- 다음 단계와의 연계성 고려

${templateData?.template ? `#### 📝 템플릿 기반 보완\n${templateData.template.substring(0, 300)}...` : ''}

#### ✅ 결론
${section.title}에 대한 분석을 완료했습니다. 위 내용을 바탕으로 다음 단계를 진행할 수 있습니다.`;

    return baseContent;
  }

  /**
   * 최종 문서 조합 및 개선
   */
  private async assembleAndRefineDocument(
    documentType: string,
    featureName: string,
    requirements: string,
    generatedSections: { [sectionId: string]: string },
    sections: DocumentSection[],
    siteInfo: any,
    templateData: any
  ): Promise<string> {
    const displayName = this.getDocumentTypeDisplayName(documentType);
    const currentTime = new Date().toLocaleString('ko-KR');
    
    // 섹션들을 순서대로 조합
    const orderedSections = sections
      .sort((a, b) => a.order - b.order)
      .map(section => generatedSections[section.id] || `[${section.title} 생성 실패]`)
      .join('\n\n---\n\n');

    const assembledDocument = `# 📋 ${featureName} - ${displayName}

## 📊 문서 정보
- **📄 문서 타입**: ${displayName}
- **🏢 대상 사이트**: ${siteInfo.name} (${siteInfo.company})
- **⏰ 생성 시간**: ${currentTime}
- **🎯 대상 기능**: ${featureName}

## 📝 개요
${requirements || '이 문서는 시스템 요구사항에 따라 생성되었습니다.'}

---

${orderedSections}

---

## 📋 종합 결론

### ✅ 완료 사항
- **총 섹션 수**: ${sections.length}개
- **분석 완료**: 모든 핵심 영역에 대한 상세 분석 완료
- **실행 방안**: 구체적이고 실용적인 실행 계획 수립

### 🎯 다음 단계
1. **검토 및 승인**: 관련 부서의 검토 및 승인 진행
2. **상세 계획 수립**: 구현을 위한 상세 실행 계획 작성
3. **자원 확보**: 필요한 인력 및 예산 확보
4. **일정 수립**: 프로젝트 일정 및 마일스톤 설정

### 💡 권장사항
- 정기적인 진행상황 점검 및 리뷰 실시
- 관련 이해관계자들과의 지속적인 소통 유지
- 변경사항 발생 시 문서 업데이트 필수

---
💡 **생성 정보**: 이 ${displayName.toLowerCase()}은 ${siteInfo.name} 사이트 환경을 고려하여 생성되었습니다.
🤖 **생성 방식**: 통합 워크플로우 시스템 (Unified Workflow v1.0)`;

    return assembledDocument;
  }

  /**
   * 최종 품질 검토 및 개선
   */
  private async finalQualityReview(
    document: string,
    documentType: string,
    featureName: string
  ): Promise<string> {
    console.error(`🔍 최종 품질 검토 시작: ${documentType}`);
    
    // 기본적인 품질 검증
    const wordCount = document.length;
    const sectionCount = (document.match(/###/g) || []).length;
    const displayName = this.getDocumentTypeDisplayName(documentType);

    // 품질 지표 계산
    const qualityIndicators = {
      length: wordCount > 1000 ? '✅ 충분' : wordCount > 500 ? '⚠️ 보통' : '❌ 부족',
      structure: sectionCount >= 3 ? '✅ 체계적' : '⚠️ 구조 보완 필요',
      completeness: document.includes('결론') && document.includes('권장사항') ? '✅ 완료' : '⚠️ 보완 필요'
    };

    const qualitySummary = `

---

## 📊 품질 검토 결과

### 🔍 품질 지표
- **📝 문서 길이**: ${wordCount.toLocaleString()}자 ${qualityIndicators.length}
- **📋 구조 완성도**: ${sectionCount}개 섹션 ${qualityIndicators.structure}
- **✅ 완료도**: ${qualityIndicators.completeness}

### 💡 최종 검토 의견
이 ${displayName.toLowerCase()}은 **${featureName}** 기능에 대한 포괄적이고 체계적인 분석을 제공합니다. 
실무진이 바로 활용할 수 있도록 구체적이고 실용적인 내용으로 구성되었습니다.

### 🎯 활용 방안
1. **즉시 활용**: 현재 상태로 프로젝트 진행 가능
2. **보완 필요**: 특정 부분에 대한 추가 상세 분석 고려
3. **정기 업데이트**: 프로젝트 진행에 따른 내용 갱신 권장

---
🤖 **품질 검토 완료**: ${new Date().toLocaleString('ko-KR')}`;

    const reviewedDocument = document + qualitySummary;
    
    console.error(`✅ 최종 품질 검토 완료: ${wordCount.toLocaleString()}자 문서`);
    return reviewedDocument;
  }



  // 🔍 ===== 워크스페이스 탐색 시스템 (ResourceLinks) =====

  /**
   * 워크스페이스를 탐색하여 ResourceLinks 생성
   */
  private async exploreWorkspaceForResourceLinks(
    rootPath: string,
    maxDepth: number,
    includeHidden: boolean,
    currentDepth: number = 0
  ): Promise<Array<{ type: 'resource_link'; uri: string; name: string; mimeType?: string; description?: string }>> {
    const resourceLinks: Array<{ type: 'resource_link'; uri: string; name: string; mimeType?: string; description?: string }> = [];
    
    if (currentDepth >= maxDepth) {
      return resourceLinks;
    }

    try {
      const items = await fs.readdir(rootPath, { withFileTypes: true });
      
      for (const item of items) {
        // 숨김 파일/폴더 필터링
        if (!includeHidden && item.name.startsWith('.')) {
          continue;
        }
        
        // 제외할 디렉토리들
        const excludeDirs = ['node_modules', '__pycache__', '.git', 'dist', 'build', 'target', '.next'];
        if (item.isDirectory() && excludeDirs.includes(item.name)) {
          continue;
        }

        const fullPath = path.join(rootPath, item.name);
        const relativePath = path.relative(process.cwd(), fullPath);
        const uri = `file:///${relativePath.replace(/\\/g, '/')}`;

        if (item.isDirectory()) {
          // 폴더 ResourceLink
          resourceLinks.push({
            type: 'resource_link',
            uri: uri + '/',
            name: `📁 ${item.name}/`,
            mimeType: 'text/directory',
            description: `디렉토리: ${relativePath}`
          });

          // 재귀적으로 하위 디렉토리 탐색 (일부만)
          if (currentDepth < maxDepth - 1) {
            const subLinks = await this.exploreWorkspaceForResourceLinks(
              fullPath,
              maxDepth,
              includeHidden,
              currentDepth + 1
            );
            resourceLinks.push(...subLinks.slice(0, 5)); // 하위 항목은 5개까지만
          }
        } else {
          // 파일 ResourceLink
          const ext = path.extname(item.name).toLowerCase();
          const mimeType = this.getMimeTypeFromExtension(ext);
          
          // 중요한 파일들만 포함
          if (this.isImportantFile(item.name, ext)) {
            resourceLinks.push({
              type: 'resource_link',
              uri,
              name: `📄 ${item.name}`,
              mimeType,
              description: `파일: ${relativePath}`
            });
          }
        }
      }
    } catch (error) {
      console.error(`디렉토리 탐색 실패: ${rootPath}`, error);
    }

    return resourceLinks;
  }

  /**
   * 파일 확장자로 MIME 타입 결정
   */
  private getMimeTypeFromExtension(ext: string): string {
    const mimeTypes: Record<string, string> = {
      '.js': 'text/javascript',
      '.ts': 'text/typescript',
      '.tsx': 'text/typescript',
      '.jsx': 'text/javascript',
      '.py': 'text/x-python',
      '.java': 'text/x-java',
      '.cs': 'text/x-csharp',
      '.json': 'application/json',
      '.md': 'text/markdown',
      '.txt': 'text/plain',
      '.yml': 'text/yaml',
      '.yaml': 'text/yaml',
      '.xml': 'text/xml',
      '.html': 'text/html',
      '.css': 'text/css',
      '.sql': 'text/sql'
    };
    
    return mimeTypes[ext] || 'text/plain';
  }

  /**
   * 중요한 파일인지 판단
   */
  private isImportantFile(fileName: string, ext: string): boolean {
    // 설정 파일들
    const configFiles = [
      'package.json', 'tsconfig.json', 'next.config.js', 'vite.config.js',
      'requirements.txt', 'setup.py', 'pyproject.toml',
      'pom.xml', 'build.gradle', 'Cargo.toml',
      'docker-compose.yml', 'Dockerfile', '.env.example',
      'README.md', 'LICENSE'
    ];
    
    if (configFiles.includes(fileName)) {
      return true;
    }
    
    // 코드 파일들
    const codeExtensions = ['.js', '.ts', '.tsx', '.jsx', '.py', '.java', '.cs', '.rs', '.go'];
    if (codeExtensions.includes(ext)) {
      return true;
    }
    
    return false;
  }

  // 🧠 ===== AI 업무지식 완성 시스템 =====

  /**
   * RAG 검색 결과를 AI가 완성된 업무지식으로 변환
   */
  private async generateBusinessKnowledgeWithAI(
    query: string,
    searchResults: any[],
    siteInfo: any
  ): Promise<string> {
    try {
      const ragContext = searchResults.map((result, index) => 
        `**📄 관련 문서 ${index + 1}**: ${result.metadata?.title || 'Unknown'}\n${result.content?.substring(0, 500)}...`
      ).join('\n\n---\n\n');

      const businessKnowledgePrompt = `당신은 **${siteInfo.name}의 업무지식 전문가**입니다.

**🎯 임무**: 개발 산출물에서 검색된 정보를 바탕으로 완성된 업무지식 답변을 제공

**❓ 사용자 질문**: ${query}

**📚 검색된 개발 산출물들**:
${ragContext}

**📋 답변 작성 지침**:
1. **정확성**: 검색된 개발 산출물의 내용만을 기반으로 답변
2. **완성도**: 사용자가 추가 질문 없이 이해할 수 있는 완전한 답변
3. **실무성**: 실제 업무에 바로 적용할 수 있는 구체적 내용
4. **출처 명시**: 어떤 개발 산출물에서 가져온 정보인지 명시

**💡 업무지식 답변을 작성해주세요**:
- 질문에 대한 명확하고 완성된 답변
- 관련 파일명, 프로세스, 정책 등 구체적 정보 포함
- 실무진이 바로 활용할 수 있는 액션 가이드 제공`;

      const response = await this.server.createMessage({
        messages: [{
          role: 'user',
          content: {
            type: 'text',
            text: `[TASK] Generating business knowledge answer for: "${query}"

${businessKnowledgePrompt}`
          }
        }],
        maxTokens: 1000
      });

      const aiAnswer = response.content.type === 'text' 
        ? response.content.text 
        : '업무지식 생성 중 오류가 발생했습니다.';

      return `🧠 **업무지식 답변**

**❓ 질문**: ${query}

${aiAnswer}

---

## 📚 **참조된 개발 산출물들**
${searchResults.map((result, index) => 
  `${index + 1}. **${result.metadata?.title || 'Unknown'}** (${result.metadata?.document_type || 'Unknown'})`
).join('\n')}

💡 **참고**: 이 답변은 ${siteInfo.name}의 개발 산출물을 기반으로 AI가 생성했습니다.`;

    } catch (error) {
      console.error('AI 업무지식 생성 실패:', error);
      
      // 폴백: RAG 결과만 제공
      return `🔍 **검색 결과** (AI 처리 실패)

**❓ 질문**: ${query}

**📚 관련 개발 산출물들**:
${searchResults.map((result, index) => 
  `${index + 1}. **${result.metadata?.title || 'Unknown'}**\n${result.content?.substring(0, 300)}...`
).join('\n\n---\n\n')}

⚠️ **참고**: AI 처리 실패로 원본 검색 결과를 제공합니다.`;
    }
  }

  // 📤 ===== 백엔드 업로드 시스템 =====

  /**
   * 완성된 개발 산출물을 백엔드에 업로드
   */
  private async uploadDeliverableToBackend(
    documentType: string,
    featureName: string,
    content: string,
    siteName: string,
    siteId: string
  ): Promise<void> {
    try {
      const displayName = this.getDocumentTypeDisplayName(documentType);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
      
      const uploadRequest = {
        title: `${featureName} - ${displayName}`,
        content: content,
        doc_type: 'text',
        site_id: siteId,
        source_url: `mcp_generated_${timestamp}`,
        metadata: {
          category: 'deliverable', // 개발 산출물 카테고리
          document_type: documentType,
          feature_name: featureName,
          site_name: siteName,
          generated_by: 'Figure MCP Server',
          generated_at: new Date().toISOString(),
          is_ai_generated: true,
          deliverable_type: displayName,
          version: '1.0.0'
        }
      };

      const response = await this.apiClient.post('/documents/upload', uploadRequest);
      
      if (response.data?.success) {
        console.error(`✅ 개발 산출물 업로드 성공: ${response.data.data?.document_id}`);
      } else {
        throw new Error(`업로드 실패: ${response.data?.message || '알 수 없는 오류'}`);
      }
      
    } catch (error) {
      console.error('백엔드 업로드 실패:', error);
      throw error;
    }
  }

  // 💾 ===== 캐싱 및 저장 시스템 =====

  /**
   * 사용자 폴더 및 캐시 폴더 초기화
   */
  private async initializeFolders(): Promise<void> {
    try {
      // 사용자 문서 폴더 생성
      await fs.mkdir(this.USER_FOLDER_PATH, { recursive: true });
      console.error(`✅ 사용자 문서 폴더 초기화: ${this.USER_FOLDER_PATH}`);

      // 캐시 폴더 생성
      await fs.mkdir(this.CACHE_FOLDER_PATH, { recursive: true });
      console.error(`✅ 캐시 폴더 초기화: ${this.CACHE_FOLDER_PATH}`);

      // 템플릿 캐시 하위 폴더 생성
      const templateCacheDir = path.join(this.CACHE_FOLDER_PATH, 'templates');
      await fs.mkdir(templateCacheDir, { recursive: true });
      
    } catch (error) {
      console.error('⚠️ 폴더 초기화 실패:', error);
    }
  }

  /**
   * 템플릿 캐시 키 생성
   */
  private getTemplateCacheKey(documentType: string, siteId: string): string {
    return `${documentType}_${siteId}`;
  }

  /**
   * 캐시된 템플릿 조회
   */
  private getCachedTemplate(documentType: string, siteId: string): any | null {
    const cacheKey = this.getTemplateCacheKey(documentType, siteId);
    const cached = this.templateCache.get(cacheKey);
    
    if (!cached) {
      return null;
    }

    // 캐시 만료 확인
    if (Date.now() - cached.timestamp > this.CACHE_TIMEOUT) {
      this.templateCache.delete(cacheKey);
      console.error(`🗑️ 만료된 템플릿 캐시 삭제: ${cacheKey}`);
      return null;
    }

    console.error(`📋 캐시된 템플릿 사용: ${cacheKey}`);
    return cached.data;
  }

  /**
   * 템플릿 캐시 저장
   */
  private setCachedTemplate(documentType: string, siteId: string, data: any): void {
    const cacheKey = this.getTemplateCacheKey(documentType, siteId);
    this.templateCache.set(cacheKey, {
      data,
      timestamp: Date.now()
    });
    console.error(`💾 템플릿 캐시 저장: ${cacheKey}`);
  }

  /**
   * 생성된 문서를 사용자 폴더에 저장
   */
  private async saveDocumentToUserFolder(
    documentType: string,
    featureName: string,
    content: string,
    siteName: string
  ): Promise<string> {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
      const displayName = this.getDocumentTypeDisplayName(documentType);
      const fileName = `${timestamp}_${featureName}_${displayName}.md`;
      const filePath = path.join(this.USER_FOLDER_PATH, fileName);

      // 메타데이터 추가
      const documentWithMetadata = `---
title: ${featureName} - ${displayName}
documentType: ${documentType}
siteName: ${siteName}
generatedAt: ${new Date().toISOString()}
generator: Figure MCP Server v1.0.0
---

${content}`;

      await fs.writeFile(filePath, documentWithMetadata, 'utf-8');
      console.error(`💾 문서 저장 완료: ${filePath}`);
      
      return filePath;
    } catch (error) {
      console.error('❌ 문서 저장 실패:', error);
      throw new Error(`문서 저장 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
    }
  }

  /**
   * 캐시 정리 (만료된 항목들 제거)
   */
  private cleanupExpiredCache(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, cached] of this.templateCache.entries()) {
      if (now - cached.timestamp > this.CACHE_TIMEOUT) {
        expiredKeys.push(key);
      }
    }

    expiredKeys.forEach(key => {
      this.templateCache.delete(key);
    });

    if (expiredKeys.length > 0) {
      console.error(`🧹 만료된 템플릿 캐시 정리: ${expiredKeys.length}개`);
    }
  }

  // 📊 ===== 간단한 진행상황 추적 =====

  /**
   * 진행상황 알림 전송 (stderr만 사용)
   */
  private sendProgressNotification(
    progressToken: string | number,
    sessionId: string,
    progress: number,
    total?: number,
    message?: string
  ): void {
    // stderr로만 로그 출력 (stdout 오염 방지)
    if (message && total) {
      const percentage = Math.round((progress / total) * 100);
      const progressBar = '█'.repeat(Math.floor(percentage / 10)) + '░'.repeat(10 - Math.floor(percentage / 10));
      console.error(`📊 진행상황 (${percentage}%) ${progressBar} - ${message}`);
    } else {
      console.error(`📊 진행상황: ${progress}${total ? `/${total}` : ''} - ${message || ''}`);
    }
  }

  // 🚀 ===== 서버 시작 =====
  async run() {
    try {
      console.error('🔧 Figure MCP Server 초기화 시작...');
      
      console.error('📁 폴더 초기화 중...');
      await this.initializeFolders();
      console.error('✅ 폴더 초기화 완료');
      
      console.error('🏢 사이트 정보 로드 중...');
      try {
        await this.loadSites();
        console.error('✅ 사이트 정보 로드 완료');
      } catch (error) {
        console.error('⚠️ 사이트 정보 로드 실패 (서버는 계속 실행):', error instanceof Error ? error.message : error);
      }
      
      console.error('🔌 Transport 연결 중...');
      const transport = new StdioServerTransport();
      await this.server.connect(transport);
      console.error('✅ Transport 연결 완료');
      
      console.error('✅ 전체 초기화 완료');
    } catch (error) {
      console.error('❌ 초기화 실패:', error);
      console.error('스택 트레이스:', error instanceof Error ? error.stack : error);
      process.exit(1);
    }

    // 주기적 캐시 정리 (5분마다)
    setInterval(() => {
      this.cleanupExpiredCache();
    }, 5 * 60 * 1000);

    console.error('🚀 Figure MCP Server (AI 기반 개발 산출물 + RAG 업무지식) 실행 중...');
    console.error('📋 지원 도구: explore_workspace, create_document, search_deliverables, create_table_specification, list_available_sites');
    console.error('🎯 create_document: 개발 산출물 생성 → 로컬 저장 + 백엔드 업로드');
    console.error('🔍 search_deliverables: 개발 산출물 기반 RAG 검색 → AI 업무지식 완성');
    console.error('📁 explore_workspace: 워크스페이스 파일/폴더 구조 탐색 (ResourceLinks)');
    console.error('🤖 AI 삼중 역할: (1)템플릿→구조분석 (2)워크스페이스→산출물생성 (3)RAG→업무지식완성');
    console.error('💾 완전한 워크플로우: 생성 → 저장 → 업로드 → 검색 → 지식완성');
    console.error('📄 지원 산출물: 영향도분석서, 요구사항정의서, 테이블명세서, 프로그램명세서, 인터페이스정의서');
    console.error('🎯 MCP 서버 대기 중... (Ctrl+C로 종료)');
  }
}

// 서버 시작 - 항상 실행 (모듈 체크 제거)
console.error('🚀 MCP 서버 시작 중...');
const server = new FigureMCPServerSimple();
server.run().catch((error) => {
  console.error('❌ 서버 실행 실패:', error);
  console.error('상세 에러:', error instanceof Error ? error.stack : error);
  process.exit(1);
});

export default FigureMCPServerSimple;
