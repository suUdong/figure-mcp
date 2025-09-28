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

/**
 * Figure MCP Server - 심플 버전
 * 핵심 산출물 생성 기능에 집중
 */
class FigureMCPServerSimple {
  private server: Server;
  private apiClient: AxiosInstance;
  private readonly BACKEND_API_URL: string;
  private readonly DEFAULT_SITE_ID: string;
  private readonly DEFAULT_SITE_NAME: string;
  private availableSites: any[] = [];

  constructor() {
    // 환경 변수 설정
    this.BACKEND_API_URL = process.env.BACKEND_API_URL || 'http://localhost:8001/api';
    this.DEFAULT_SITE_ID = process.env.DEFAULT_SITE_ID || '1';
    this.DEFAULT_SITE_NAME = process.env.DEFAULT_SITE_NAME || 'KT알파';

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
          case 'create_document':
            return await this.handleCreateDocument(args as any);
          case 'create_table_specification':
            return await this.handleCreateTableSpecification(args as any);
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
   * 문서 생성 핸들러
   */
  private async handleCreateDocument(args: {
    documentType: string;
    featureName: string;
    siteName?: string;
    requirements?: string;
  }) {
    const startTime = Date.now();

    try {
      console.error(`📝 문서 생성 시작: ${args.documentType} - ${args.featureName}`);

      // 1. 사이트 정보 확인
      const siteName = args.siteName || this.DEFAULT_SITE_NAME;
      await this.loadSites();
      const targetSite = this.findSite(siteName);

      if (!targetSite) {
        throw new Error(`사이트를 찾을 수 없습니다: ${siteName}`);
      }

      // 2. 백엔드에서 템플릿 데이터 가져오기
      const templateResponse = await this.apiClient.get(`/templates/guide/${args.documentType}`, {
        params: { site_id: targetSite.id }
      });

      const templateData = templateResponse.data;

      // 3. 문서 생성
      const documentContent = this.generateDocumentContent(
        args.documentType,
        args.featureName,
        args.requirements || '',
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
          document_type: args.documentType,
          feature_name: args.featureName,
          site_name: siteName,
          processing_time_ms: processingTime
        }
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      console.error(`❌ 문서 생성 실패 (${processingTime}ms):`, error);

      return {
        content: [{
          type: 'text',
          text: `❌ **문서 생성 실패**\n\n기능: ${args.featureName}\n문서 타입: ${args.documentType}\n오류: ${error instanceof Error ? error.message : '알 수 없는 오류'}\n\n**확인 사항:**\n- 백엔드 서비스가 실행 중인지 확인\n- 사이트명이 정확한지 확인\n- 네트워크 연결 상태 확인`
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
      const response = await this.apiClient.get('/sites');
      this.availableSites = response.data || [];
      console.error(`✅ 사이트 목록 로드 완료: ${this.availableSites.length}개`);
    } catch (error) {
      console.error(`❌ 사이트 목록 로드 실패:`, error);
      this.availableSites = []; // 빈 배열로 초기화
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

  // 🚀 ===== 서버 시작 =====
  async run() {
    console.error('🔧 Figure MCP Server (Simple) 초기화 중...');
    
    try {
      await this.loadSites();
      console.error('✅ 초기화 완료');
    } catch (error) {
      console.error('⚠️ 초기화 중 일부 기능에서 오류가 발생했지만 서버를 시작합니다:', error);
    }

    const transport = new StdioServerTransport();
    await this.server.connect(transport);

    console.error('🚀 Figure MCP Server (Simple) 실행 중...');
    console.error('📋 사용 가능한 도구: create_document, create_table_specification, list_available_sites');
  }
}

// 서버 시작
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new FigureMCPServerSimple();
  server.run().catch((error) => {
    console.error('❌ 서버 실행 실패:', error);
    process.exit(1);
  });
}

export default FigureMCPServerSimple;
