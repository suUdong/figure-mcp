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
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import axios from 'axios';
import type { AxiosInstance } from 'axios';
import { randomUUID } from 'crypto';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';

// ==== 간단한 타입 정의 ====

interface DocumentSection {
  id: string;
  title: string;
  description: string;
  order: number;
  dependencies?: string[];
  estimatedTokens?: number;
  prompt?: string;
  chunkRange?: string; // 청크 범위 (예: "1-15", "16-45")
  templateChunk?: string; // 해당 청크의 템플릿 내용
  sourceKeywords?: string[]; // AI가 생성한 소스코드 검색 키워드
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

  // ==== 워크스페이스 관리 ====
  private readonly WORKSPACE_ROOT: string;

  // ==== 세션 관리 시스템 ====
  private activeSessions: Map<string, {
    sessionId: string;
    documentType: string;
    featureName: string;
    requirements: string;
    siteName: string;
    siteInfo: any;
    templateData: any;
    sections: DocumentSection[];
    createdAt: number;
  }> = new Map();

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
    
    // 워크스페이스 경로 설정 - 클라이언트 워크스페이스 우선
    this.WORKSPACE_ROOT = this.detectClientWorkspace();
    console.error(`🔍 설정된 워크스페이스: ${this.WORKSPACE_ROOT}`);

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
          resources: {}, // Resources 기능 활성화
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
    this.setupResources();
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

  // 📁 ===== Resources 설정 =====
  private setupResources(): void {
    // 사용 가능한 리소스 목록 반환
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      try {
        console.error('🔍 워크스페이스 리소스 스캔 시작...');
        const workspaceRoot = this.WORKSPACE_ROOT;
        const resources = await this.scanWorkspaceResources(workspaceRoot);
        
        console.error(`✅ ${resources.length}개 리소스 발견`);
        
        return {
          resources: resources.map(resource => ({
            uri: resource.uri,
            name: resource.name,
            description: resource.description,
            mimeType: resource.mimeType
          }))
        };
      } catch (error) {
        console.error('❌ 리소스 스캔 실패:', error);
        return { resources: [] };
      }
    });

    // 특정 리소스 내용 반환
    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      try {
        const uri = request.params.uri;
        console.error(`📄 리소스 읽기: ${uri}`);
        
        // file:// URI에서 실제 파일 경로 추출
        const filePath = this.uriToFilePath(uri);
        
        if (!filePath) {
          throw new Error(`지원하지 않는 URI 형식: ${uri}`);
        }
        
        // 파일 존재 확인
        try {
          await fs.access(filePath);
        } catch {
          throw new Error(`파일을 찾을 수 없습니다: ${filePath}`);
        }
        
        // 파일 내용 읽기
        const content = await fs.readFile(filePath, 'utf-8');
        const mimeType = this.getMimeTypeFromPath(filePath);
        
        return {
          contents: [{
            uri: uri,
            mimeType: mimeType,
            text: content
          }]
        };
        
      } catch (error) {
        console.error(`❌ 리소스 읽기 실패: ${request.params.uri}`, error);
        throw error;
      }
    });
  }

  /**
   * 워크스페이스 리소스 스캔
   */
  private async scanWorkspaceResources(rootPath: string): Promise<Array<{
    uri: string;
    name: string;
    description: string;
    mimeType: string;
  }>> {
    const resources: Array<{
      uri: string;
      name: string;
      description: string;
      mimeType: string;
    }> = [];

    try {
      console.error(`🔍 워크스페이스 루트: ${rootPath}`);
      
      // 모든 디렉토리 스캔 (더 포괄적으로)
      const allItems = await fs.readdir(rootPath, { withFileTypes: true });
      const directories = allItems
        .filter(item => item.isDirectory() && !item.name.startsWith('.') && 
                !['node_modules', 'dist', 'build', '.git', '.next', '__pycache__'].includes(item.name))
        .map(item => item.name);
      
      console.error(`📁 발견된 디렉토리들: ${directories.join(', ')}`);
      
      // 기본 검색 디렉토리 + 발견된 모든 디렉토리
      const searchDirs = [...new Set([
        'src', 'lib', 'components', 'services', 'models', 'controllers', 'routes', 'utils', 'pages',
        ...directories
      ])];
      
      for (const dir of searchDirs) {
        const dirPath = path.join(rootPath, dir);
        try {
          await fs.access(dirPath);
          const files = await this.scanDirectoryForResources(dirPath, 2); // 최대 2단계 깊이로 축소
          resources.push(...files);
        } catch (error) {
        }
      }
      
      // 루트 레벨의 중요 파일들도 포함
      const rootFiles = await fs.readdir(rootPath);
      
      let rootFileCount = 0;
      for (const file of rootFiles) {
        const filePath = path.join(rootPath, file);
        const stats = await fs.stat(filePath);
        
        if (stats.isFile() && this.isConfigFile(file)) {
          const uri = this.filePathToUri(filePath);
          const mimeType = this.getMimeTypeFromPath(filePath);
          
          resources.push({
            uri,
            name: file,
            description: `루트 설정 파일: ${file}`,
            mimeType
          });
          rootFileCount++;
        }
      }
      console.error(`📄 루트에서 중요 파일 ${rootFileCount}개 발견`);
      
      
    } catch (error) {
      console.error('❌ 워크스페이스 리소스 스캔 실패:', error);
    }

    return resources;
  }

  /**
   * 디렉토리 재귀 스캔 (리소스용)
   */
  private async scanDirectoryForResources(
    dirPath: string,
    maxDepth: number,
    currentDepth: number = 0
  ): Promise<Array<{
    uri: string;
    name: string;
    description: string;
    mimeType: string;
  }>> {
    if (currentDepth >= maxDepth) return [];
    
    const resources: Array<{
      uri: string;
      name: string;
      description: string;
      mimeType: string;
    }> = [];
    
    try {
      const items = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const item of items) {
        if (item.name.startsWith('.')) continue;
        
        const fullPath = path.join(dirPath, item.name);
        const relativePath = path.relative(this.WORKSPACE_ROOT, fullPath);
        
        if (item.isDirectory()) {
          if (!['node_modules', 'dist', 'build', '.git', '.next', '__pycache__'].includes(item.name)) {
            const subResources = await this.scanDirectoryForResources(fullPath, maxDepth, currentDepth + 1);
            resources.push(...subResources);
          }
        } else if (item.isFile()) {
          const ext = path.extname(item.name);
          if (['.js', '.ts', '.tsx', '.jsx', '.py', '.java', '.cs', '.json', '.md', '.yml', '.yaml'].includes(ext)) {
            const uri = this.filePathToUri(fullPath);
            const mimeType = this.getMimeTypeFromPath(fullPath);
            
            resources.push({
              uri,
              name: item.name,
              description: `소스 파일: ${relativePath}`,
              mimeType
            });
          }
        }
      }
    } catch (error) {
      console.error(`⚠️ 디렉토리 스캔 실패: ${dirPath}`, error);
    }
    
    return resources;
  }

  /**
   * 파일 경로를 MCP Resource URI로 변환
   */
  private filePathToUri(filePath: string): string {
    const relativePath = path.relative(this.WORKSPACE_ROOT, filePath);
    return `file:///${relativePath.replace(/\\/g, '/')}`;
  }

  /**
   * MCP Resource URI를 파일 경로로 변환
   */
  private uriToFilePath(uri: string): string | null {
    if (!uri.startsWith('file:///')) {
      return null;
    }
    
    const relativePath = uri.substring(8); // 'file:///' 제거
    const absolutePath = path.resolve(this.WORKSPACE_ROOT, relativePath.replace(/\//g, path.sep));
    return absolutePath;
  }

  /**
   * 파일 경로에서 MIME 타입 결정
   */
  private getMimeTypeFromPath(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
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
   * 중요한 설정 파일인지 판단
   */
  private isConfigFile(fileName: string): boolean {
    const configFiles = [
      'package.json', 'tsconfig.json', 'next.config.js', 'vite.config.js',
      'requirements.txt', 'setup.py', 'pyproject.toml',
      'pom.xml', 'build.gradle', 'Cargo.toml',
      'docker-compose.yml', 'Dockerfile', '.env.example',
      'README.md', 'LICENSE'
    ];
    
    return configFiles.includes(fileName);
  }

  // 🛠️ ===== Tools 설정 =====
  private setupTools(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'create_document_workflow',
            description: '🔄 자동 워크플로우: 템플릿 분석 → 섹션별 생성 → 문서 조합을 자동으로 실행합니다.',
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
                maxSections: {
                  type: 'number',
                  description: '생성할 최대 섹션 수 (기본값: 3, 타임아웃 방지)',
                  default: 3
                },
                autoSave: {
                  type: 'boolean',
                  description: '자동 저장 여부 (기본값: true)',
                  default: true
                }
              },
              required: ['documentType', 'featureName']
            }
          },
          {
            name: 'analyze_template',
            description: '1단계: 백엔드 템플릿을 분석하여 섹션 구조를 설계합니다.',
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
            name: 'generate_section',
            description: '2단계: MCP Resources를 활용하여 개별 섹션을 생성합니다.',
            inputSchema: {
              type: 'object',
              properties: {
                sessionId: {
                  type: 'string',
                  description: 'analyze_template에서 받은 세션 ID'
                },
                sectionId: {
                  type: 'string',
                  description: '생성할 섹션 ID'
                },
                previousSections: {
                  type: 'object',
                  description: '이전에 생성된 섹션들 (선택사항)',
                  additionalProperties: true
                }
              },
              required: ['sessionId', 'sectionId']
            }
          },
          {
            name: 'assemble_document',
            description: '3단계: 생성된 섹션들을 조합하여 최종 문서를 완성합니다.',
            inputSchema: {
              type: 'object',
              properties: {
                sessionId: {
                  type: 'string',
                  description: 'analyze_template에서 받은 세션 ID'
                },
                sections: {
                  type: 'object',
                  description: '생성된 섹션들 (sectionId: content)',
                  additionalProperties: true
                },
                saveToFile: {
                  type: 'boolean',
                  description: '파일로 저장할지 여부 (기본값: true)',
                  default: true
                }
              },
              required: ['sessionId', 'sections']
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
          },
          {
            name: 'set_workspace',
            description: '🔧 워크스페이스 경로를 설정합니다. (IntelliJ 사용 시 첫 실행에만 필요)',
            inputSchema: {
              type: 'object',
              properties: {
                workspacePath: {
                  type: 'string',
                  description: '분석할 프로젝트의 절대 경로 (예: C:\\workspace\\my-project)'
                }
              },
              required: ['workspacePath']
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
          case 'create_document_workflow':
            return await this.handleCreateDocumentWorkflow(args as any);
          case 'analyze_template':
            return await this.handleAnalyzeTemplate(args as any);
          case 'generate_section':
            return await this.handleGenerateSection(args as any);
          case 'assemble_document':
            return await this.handleAssembleDocument(args as any);
          case 'search_deliverables':
            return await this.handleSearchDeliverables(args as any);
          case 'list_available_sites':
            return await this.handleListAvailableSites();
          case 'set_workspace':
            return await this.handleSetWorkspace(args as any);
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

  // 🎯 ===== 자동 워크플로우 시스템 =====

  /**
   * 🔄 자동 워크플로우: 3단계를 자동으로 실행
   */
  private async handleCreateDocumentWorkflow(args: {
    documentType: string;
    featureName: string;
    siteName?: string;
    requirements?: string;
    maxSections?: number;
    autoSave?: boolean;
  }) {
    const startTime = Date.now();
    const workflowId = `workflow_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      console.error(`🔄 자동 워크플로우 시작: ${args.documentType} - ${args.featureName}`);
      
      const maxSections = args.maxSections || 3;
      const autoSave = args.autoSave !== false;
      
      // === 1단계: 템플릿 분석 ===
      console.error(`📋 Step 1/3: 템플릿 분석 중...`);
      const step1Result = await this.handleAnalyzeTemplate({
        documentType: args.documentType,
        featureName: args.featureName,
        siteName: args.siteName,
        requirements: args.requirements
      });
      
      if (step1Result.isError) {
        throw new Error('1단계 템플릿 분석 실패');
      }
      
      const sessionId = step1Result.metadata?.sessionId;
      if (!sessionId) {
        throw new Error('세션 ID를 가져올 수 없습니다');
      }
      
      const session = this.activeSessions.get(sessionId);
      if (!session) {
        throw new Error('세션 정보를 찾을 수 없습니다');
      }
      
      console.error(`✅ Step 1/3 완료: ${session.sections.length}개 섹션 설계됨`);
      
      // === 2단계: 섹션별 생성 (제한된 수만) ===
      console.error(`📝 Step 2/3: 섹션 생성 중... (최대 ${maxSections}개)`);
      const generatedSections: { [sectionId: string]: string } = {};
      const sectionsToGenerate = session.sections.slice(0, maxSections);
      
      for (let i = 0; i < sectionsToGenerate.length; i++) {
        const section = sectionsToGenerate[i];
        console.error(`🤖 섹션 ${i + 1}/${sectionsToGenerate.length}: ${section.title}`);
        
        try {
          const step2Result = await this.handleGenerateSection({
            sessionId,
            sectionId: section.id,
            previousSections: generatedSections
          });
          
          if (!step2Result.isError && step2Result.content?.[0]?.text) {
            // 생성된 내용에서 실제 섹션 내용만 추출
            const fullContent = step2Result.content[0].text;
            const sectionContentMatch = fullContent.match(/## 📄 \*\*생성된 내용\*\*\n\n([\s\S]*?)\n\n## 🚀/);
            const sectionContent = sectionContentMatch ? sectionContentMatch[1].trim() : fullContent;
            
            generatedSections[section.id] = sectionContent;
            console.error(`✅ 섹션 완료: ${section.title} (${sectionContent.length}자)`);
          } else {
            console.error(`⚠️ 섹션 생성 실패, 기본 구조 사용: ${section.title}`);
            generatedSections[section.id] = `### ${section.title}\n\n[워크플로우 중 생성 실패]\n\n${section.description}`;
          }
        } catch (error) {
          console.error(`❌ 섹션 생성 오류: ${section.title}`, error);
          generatedSections[section.id] = `### ${section.title}\n\n[생성 중 오류 발생]\n\n${section.description}`;
        }
      }
      
      // 나머지 섹션들은 기본 구조로 생성
      const remainingSections = session.sections.slice(maxSections);
      for (const section of remainingSections) {
        generatedSections[section.id] = `### ${section.title}\n\n**📋 섹션 개요**: ${section.description}\n\n**🔍 상세 분석 필요**: 이 섹션은 워크플로우 최적화를 위해 기본 구조로 생성되었습니다.\n\n**💡 권장사항**: 필요시 \`generate_section\` 도구로 이 섹션만 별도 생성하세요.\n\n**작성 지침**: ${section.prompt}`;
      }
      
      console.error(`✅ Step 2/3 완료: ${Object.keys(generatedSections).length}개 섹션 생성`);
      
      // === 3단계: 문서 조합 ===
      console.error(`📋 Step 3/3: 문서 조합 및 저장 중...`);
      const step3Result = await this.handleAssembleDocument({
        sessionId,
        sections: generatedSections,
        saveToFile: autoSave
      });
      
      if (step3Result.isError) {
        throw new Error('3단계 문서 조합 실패');
      }
      
      const processingTime = Date.now() - startTime;
      console.error(`✅ 자동 워크플로우 완료: ${Math.ceil(processingTime / 1000)}초`);
      
      return {
        content: [{
          type: 'text',
          text: `🔄 **자동 워크플로우 완료**

**🆔 워크플로우 ID**: \`${workflowId}\`
**⏱️ 총 처리 시간**: ${Math.ceil(processingTime / 1000)}초

## 📊 **처리 결과**

✅ **1단계**: 템플릿 분석 완료 (${session.sections.length}개 섹션 설계)
✅ **2단계**: ${sectionsToGenerate.length}개 섹션 AI 생성 완료
📋 **기본 구조**: ${remainingSections.length}개 섹션 기본 구조 제공
✅ **3단계**: 문서 조합 및 저장 완료

${step3Result.content?.[0]?.text || '최종 문서가 생성되었습니다.'}

## 💡 **추가 개선**

기본 구조로 생성된 섹션들을 상세하게 개선하려면:
${remainingSections.map(section => 
`\`\`\`
generate_section {
  "sessionId": "${sessionId}",
  "sectionId": "${section.id}"
}
\`\`\``).slice(0, 3).join('\n\n')}

**🚀 완성**: 실제 소스코드 기반의 전문 개발 산출물이 자동으로 생성되었습니다!`
        }],
        metadata: {
          workflowId,
          sessionId,
          documentType: args.documentType,
          featureName: args.featureName,
          totalSections: session.sections.length,
          aiGeneratedSections: sectionsToGenerate.length,
          basicStructureSections: remainingSections.length,
          processingTime,
          autoSave,
          step1Success: true,
          step2Success: true,
          step3Success: true
        }
      };
      
    } catch (error) {
      const processingTime = Date.now() - startTime;
      console.error(`❌ 자동 워크플로우 실패 (${processingTime}ms):`, error);
      
      return {
        content: [{
          type: 'text',
          text: `❌ **자동 워크플로우 실패**

**🆔 워크플로우 ID**: \`${workflowId}\`
**기능**: ${args.featureName}
**문서 타입**: ${args.documentType}
**오류**: ${error instanceof Error ? error.message : '알 수 없는 오류'}
**처리 시간**: ${processingTime}ms

**확인 사항:**
- 백엔드 서비스가 실행 중인지 확인
- 사이트명이 정확한지 확인
- 네트워크 연결 상태 확인
- 요구사항이 충분히 상세한지 확인

**💡 대안**: 개별 단계별로 실행해보세요:
1. \`analyze_template\` 
2. \`generate_section\`
3. \`assemble_document\``
        }],
        isError: true
      };
    }
  }

  // 🎯 ===== 3단계 문서 생성 시스템 =====

  /**
   * 1단계: 템플릿 분석 핸들러
   */
  private async handleAnalyzeTemplate(args: {
    documentType: string;
    featureName: string;
    siteName?: string;
    requirements?: string;
  }) {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      console.error(`📋 1단계 - 템플릿 분석 시작: ${args.documentType} - ${args.featureName}`);

      const siteName = args.siteName || this.DEFAULT_SITE_NAME;
      await this.loadSites();
      const targetSite = this.findSite(siteName);

      if (!targetSite) {
        throw new Error(`사이트를 찾을 수 없습니다: ${siteName}`);
      }

      // 백엔드에서 템플릿 가져오기
      let templateData = this.getCachedTemplate(args.documentType, targetSite.id);
      
      if (!templateData) {
        const backendDocumentType = args.documentType.toLowerCase();
        const templateResponse = await this.apiClient.get(`/templates/guide/${backendDocumentType}`, {
          params: { site_id: targetSite.id }
        });
        templateData = templateResponse.data;
        this.setCachedTemplate(args.documentType, targetSite.id, templateData);
      }

      // AI가 템플릿을 분석하여 섹션 구조 설계
      const analysis = await this.analyzeTemplateWithAI(
        args.documentType,
        args.featureName,
        args.requirements || '',
        templateData,
        targetSite
      );

      // 세션 정보 저장
      this.activeSessions.set(sessionId, {
        sessionId,
        documentType: args.documentType,
        featureName: args.featureName,
        requirements: args.requirements || '',
        siteName,
        siteInfo: targetSite,
        templateData,
        sections: analysis.sections,
        createdAt: Date.now()
      });

      console.error(`✅ 1단계 완료 - 세션 생성: ${sessionId}, ${analysis.sections.length}개 섹션`);

      return {
        content: [{
            type: 'text',
          text: `📋 **1단계: 템플릿 분석 완료**

**🆔 세션 ID**: \`${sessionId}\`
**📄 문서 타입**: ${this.getDocumentTypeDisplayName(args.documentType)}
**🎯 기능명**: ${args.featureName}
**🏢 사이트**: ${siteName}

## 📊 **분석 결과**

**총 섹션 수**: ${analysis.sections.length}개
**복잡도**: ${analysis.complexity}
**예상 소요 시간**: 약 ${analysis.estimatedTime}분

## 📋 **섹션 구조**

${analysis.sections.map((section, index) => 
`**${index + 1}. ${section.title}** (\`${section.id}\`)
   - ${section.description}
   - 예상 토큰: ${section.estimatedTokens || 300}개
   ${section.chunkRange ? `- 청크 범위: ${section.chunkRange}` : ''}
   ${section.sourceKeywords ? `- 검색 키워드: ${section.sourceKeywords.join(', ')}` : ''}`
).join('\n\n')}

## 🚀 **다음 단계**

각 섹션을 개별적으로 생성하세요:
\`\`\`
generate_section {
  "sessionId": "${sessionId}",
  "sectionId": "${analysis.sections[0]?.id || 'section_1'}"
}
\`\`\`

**💡 권장사항**: ${analysis.recommendations.join(', ')}`
        }],
        metadata: {
          sessionId,
          documentType: args.documentType,
          featureName: args.featureName,
          totalSections: analysis.sections.length,
          sectionIds: analysis.sections.map(s => s.id),
          complexity: analysis.complexity,
          estimatedTime: analysis.estimatedTime
        }
      };

    } catch (error) {
      console.error(`❌ 1단계 템플릿 분석 실패:`, error);
      
      return {
        content: [{
          type: 'text',
          text: `❌ **1단계: 템플릿 분석 실패**

**기능**: ${args.featureName}
**문서 타입**: ${args.documentType}
**오류**: ${error instanceof Error ? error.message : '알 수 없는 오류'}

**확인 사항:**
- 백엔드 서비스가 실행 중인지 확인
- 사이트명이 정확한지 확인
- 네트워크 연결 상태 확인`
        }],
        isError: true
      };
    }
  }

  /**
   * 2단계: 개별 섹션 생성 핸들러
   */
  private async handleGenerateSection(args: {
    sessionId: string;
    sectionId: string;
    previousSections?: { [sectionId: string]: string };
  }) {
    try {
      console.error(`📝 2단계 - 섹션 생성 시작: ${args.sectionId}`);

      // 세션 정보 조회
      const session = this.activeSessions.get(args.sessionId);
      if (!session) {
        throw new Error(`세션을 찾을 수 없습니다: ${args.sessionId}`);
      }

      // 해당 섹션 정보 찾기
      const section = session.sections.find(s => s.id === args.sectionId);
      if (!section) {
        throw new Error(`섹션을 찾을 수 없습니다: ${args.sectionId}`);
      }

      console.error(`🎯 섹션 생성: ${section.title}`);

      // MCP Resources를 통한 소스코드 분석 및 섹션 생성
      const sectionContent = await this.generateSectionWithAI(
        session.documentType,
        section,
        session.featureName,
        session.requirements,
        session.siteInfo,
        session.templateData,
        args.previousSections || {}
      );

      console.error(`✅ 2단계 완료 - 섹션 생성: ${section.title} (${sectionContent.length}자)`);

      return {
        content: [{
          type: 'text',
          text: `📝 **2단계: 섹션 생성 완료**

**🆔 세션 ID**: \`${args.sessionId}\`
**📋 섹션**: ${section.title} (\`${args.sectionId}\`)

## 📄 **생성된 내용**

${sectionContent}

## 🚀 **다음 단계**

### **더 많은 섹션 생성**
다른 섹션들도 생성하세요:
${session.sections.filter(s => s.id !== args.sectionId).map(s => 
`\`\`\`
generate_section {
  "sessionId": "${args.sessionId}",
  "sectionId": "${s.id}",
  "previousSections": { "${args.sectionId}": "생성된 내용..." }
}
\`\`\``).slice(0, 3).join('\n\n')}

### **문서 조합**
모든 섹션 생성 완료 후:
\`\`\`
assemble_document {
  "sessionId": "${args.sessionId}",
  "sections": {
    "${args.sectionId}": "생성된 내용...",
    "다른_섹션_id": "다른 섹션 내용..."
  }
}
\`\`\``
        }],
        metadata: {
          sessionId: args.sessionId,
          sectionId: args.sectionId,
          sectionTitle: section.title,
          contentLength: sectionContent.length,
          remainingSections: session.sections.filter(s => s.id !== args.sectionId).map(s => s.id)
        }
      };

    } catch (error) {
      console.error(`❌ 2단계 섹션 생성 실패:`, error);
      
      return {
        content: [{
          type: 'text',
          text: `❌ **2단계: 섹션 생성 실패**

**세션 ID**: ${args.sessionId}
**섹션 ID**: ${args.sectionId}
**오류**: ${error instanceof Error ? error.message : '알 수 없는 오류'}

**확인 사항:**
- 세션 ID가 유효한지 확인
- 섹션 ID가 존재하는지 확인
- MCP Resources 접근 권한 확인`
        }],
        isError: true
      };
    }
  }

  /**
   * 3단계: 문서 조합 핸들러
   */
  private async handleAssembleDocument(args: {
    sessionId: string;
    sections: { [sectionId: string]: string };
    saveToFile?: boolean;
  }) {
    try {
      console.error(`📋 3단계 - 문서 조합 시작: ${args.sessionId}`);

      // 세션 정보 조회
      const session = this.activeSessions.get(args.sessionId);
      if (!session) {
        throw new Error(`세션을 찾을 수 없습니다: ${args.sessionId}`);
      }

      console.error(`📊 섹션 조합: ${Object.keys(args.sections).length}개 섹션`);

      // 최종 문서 조합
      const finalDocument = await this.assembleAndRefineDocument(
        session.documentType,
        session.featureName,
        session.requirements,
        args.sections,
        session.sections,
        session.siteInfo,
        session.templateData
      );

      // 최종 품질 검토
      const reviewedDocument = await this.finalQualityReview(
        finalDocument,
        session.documentType,
        session.featureName
      );

      // 파일 저장 및 백엔드 업로드
      let savedFilePath: string | null = null;
      let uploadedToBackend = false;

      if (args.saveToFile !== false) {
        try {
          savedFilePath = await this.saveDocumentToUserFolder(
            session.documentType,
            session.featureName,
            reviewedDocument,
            session.siteName
          );
        } catch (error) {
          console.error('❌ 파일 저장 실패:', error);
        }

        try {
          await this.uploadDeliverableToBackend(
            session.documentType,
            session.featureName,
            reviewedDocument,
            session.siteName,
            session.siteInfo.id
          );
          uploadedToBackend = true;
        } catch (error) {
          console.error('⚠️ 백엔드 업로드 실패:', error);
        }
      }

      // 세션 정리
      this.activeSessions.delete(args.sessionId);
      console.error(`✅ 3단계 완료 - 문서 조합 및 세션 정리: ${args.sessionId}`);

      return {
        content: [{
          type: 'text',
          text: `${reviewedDocument}

---

## 💾 **3단계: 문서 조합 완료**

**🆔 세션 ID**: \`${args.sessionId}\`
**📋 조합된 섹션**: ${Object.keys(args.sections).length}개

${savedFilePath ? `✅ **로컬 저장 완료**: \`${savedFilePath}\`` : ''}
${uploadedToBackend ? '✅ **백엔드 업로드 완료**: 개발 산출물 카테고리로 업로드됨' : ''}

**📁 사용자 문서 폴더**: \`${this.USER_FOLDER_PATH}\`

**💡 완성**: 3단계 워크플로우를 통한 전문 개발 산출물 생성이 완료되었습니다.`
        }],
        metadata: {
          sessionId: args.sessionId,
          documentType: session.documentType,
          featureName: session.featureName,
          totalSections: Object.keys(args.sections).length,
          savedFilePath,
          uploadedToBackend,
          processingTime: Date.now() - session.createdAt
        }
      };

    } catch (error) {
      console.error(`❌ 3단계 문서 조합 실패:`, error);
      
      return {
        content: [{
          type: 'text',
          text: `❌ **3단계: 문서 조합 실패**

**세션 ID**: ${args.sessionId}
**오류**: ${error instanceof Error ? error.message : '알 수 없는 오류'}

**확인 사항:**
- 세션 ID가 유효한지 확인
- 모든 필수 섹션이 제공되었는지 확인
- 섹션 내용이 올바른 형식인지 확인`
        }],
        isError: true
      };
    }
  }

  /**
   * 기존 통합 문서 생성 핸들러 (하위 호환성용)
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
      console.error(`✅ **AI 분석 완료**\n📊 총 ${analysis.sections.length}개 섹션으로 구조화됨\n🎯 우선 3개 섹션을 AI가 상세 생성하고, 나머지는 기본 구조 제공`);
      
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

      // 나머지 섹션들은 기본 구조로 생성 (타임아웃 방지)
      const remainingSections = analysis.sections.slice(3);
      
      if (args.progressToken) {
        this.sendProgressNotification(args.progressToken, sessionId, 7, 10, '나머지 섹션 구조 생성 중...');
      }
      
      for (const section of remainingSections) {
        generatedSections[section.id] = `### ${section.title}

**📋 섹션 개요**: ${section.description}

**🔍 AI 분석 대상**: 
- 워크스페이스 경로: \`${this.WORKSPACE_ROOT}\`
- 프로젝트 구조를 직접 탐색하여 관련 파일들을 찾아 분석
- 코드 패턴, 설정 파일, 데이터베이스 스키마 등을 종합적으로 검토

**📋 작성 지침**: ${section.prompt}

**💡 AI 작성 가이드**: 
1. \`codebase_search\`, \`read_file\`, \`glob_file_search\` 등의 도구를 활용하여 관련 파일들을 직접 탐색
2. 구체적인 파일명, 클래스명, 메서드명, 테이블명 등을 포함한 실무적 내용으로 작성
3. 현재 코드베이스의 실제 구현 상황을 반영한 정확한 분석 제공`;
        
        console.error(`📝 기본 구조 생성: ${section.title}`);
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

  /**
   * 워크스페이스 설정 핸들러 (간단 버전)
   */
  private async handleSetWorkspace(args: { workspacePath: string }) {
    try {
      console.error(`🔧 워크스페이스 수동 설정: ${args.workspacePath}`);

      // 경로 유효성 검사
      if (!fsSync.existsSync(args.workspacePath)) {
        throw new Error(`경로가 존재하지 않습니다: ${args.workspacePath}`);
      }

      const stats = fsSync.statSync(args.workspacePath);
      if (!stats.isDirectory()) {
        throw new Error('디렉토리가 아닙니다');
      }

      // 워크스페이스 저장
      await this.saveWorkspaceConfig(args.workspacePath);
      
      // 런타임 업데이트
      (this as any).WORKSPACE_ROOT = args.workspacePath;

      // 리소스 재스캔
      const resources = await this.scanWorkspaceResources(args.workspacePath);

      console.error(`✅ 워크스페이스 설정 완료: ${resources.length}개 리소스 발견`);

      return {
        content: [{
          type: 'text',
          text: `🔧 **워크스페이스 설정 완료**

**📁 설정된 경로**: \`${args.workspacePath}\`
**📊 발견된 리소스**: ${resources.length}개

**💡 이제 자동으로 해당 프로젝트의 소스코드를 분석합니다!**

**🚀 다음 단계**: 
\`\`\`
@figure-mcp create_document_workflow "기능명 영향도분석서"
\`\`\``
        }],
        metadata: {
          workspacePath: args.workspacePath,
          resourcesFound: resources.length
        }
      };

    } catch (error) {
      console.error('❌ 워크스페이스 설정 실패:', error);
      
      return {
        content: [{
          type: 'text',
          text: `❌ **워크스페이스 설정 실패**

**경로**: ${args.workspacePath}
**오류**: ${error instanceof Error ? error.message : '알 수 없는 오류'}

**올바른 경로 예시**:
- \`C:\\\\workspace\\\\my-spring-project\`
- \`C:\\\\Projects\\\\my-react-app\`
- \`C:\\\\dev\\\\my-python-project\``
        }],
        isError: true
      };
    }
  }

  // 🔍 ===== 워크스페이스 자동 감지 시스템 =====

  /**
   * 클라이언트 워크스페이스 자동 감지
   */
  private detectClientWorkspace(): string {
    // 1. 저장된 워크스페이스 설정 로드 (최우선)
    const savedWorkspace = this.loadSavedWorkspaceConfig();
    if (savedWorkspace) {
      console.error(`💾 저장된 워크스페이스: ${savedWorkspace}`);
      return savedWorkspace;
    }

    // 2. 환경변수로 명시적 설정
    if (process.env.WORKSPACE_ROOT) {
      console.error(`🎯 명시적 워크스페이스: ${process.env.WORKSPACE_ROOT}`);
      return process.env.WORKSPACE_ROOT;
    }

    // 2. 클라이언트가 전달한 워크스페이스 (Cursor 등)
    const clientWorkspace = this.detectCursorWorkspace();
    if (clientWorkspace) {
      console.error(`🖥️ Cursor 워크스페이스 감지: ${clientWorkspace}`);
      return clientWorkspace;
    }

    // 3. 현재 작업 디렉토리에서 프로젝트 루트 찾기
    const detectedRoot = this.findProjectRoot(process.cwd());
    if (detectedRoot && detectedRoot !== process.cwd()) {
      console.error(`🔍 자동 감지된 프로젝트 루트: ${detectedRoot}`);
      return detectedRoot;
    }

    // 4. 현재 디렉토리가 IntelliJ bin인지 확인하고 강제 프로젝트 찾기
    const currentDir = process.cwd();
    if (currentDir.includes('IntelliJ IDEA') && currentDir.includes('bin')) {
      console.error(`⚠️ IntelliJ bin 디렉토리 감지, 강제 프로젝트 검색...`);
      
      // 이미 위에서 강제 감지 로직이 실행되므로 제거
    }

    // 5. 폴백: 사용자에게 안내 후 현재 디렉토리
    console.error(`❌ 자동 감지 실패 - IntelliJ에서 현재 프로젝트를 찾을 수 없습니다`);
    console.error(`💡 해결: 첫 실행 시 워크스페이스를 수동 지정하세요`);
    return currentDir;
  }

  /**
   * 프로젝트 루트 디렉토리 찾기
   */
  private findProjectRoot(startPath: string): string | null {
    let currentPath = startPath;
    const maxDepth = 5; // 최대 5단계까지만 상위로 검색
    
    for (let i = 0; i < maxDepth; i++) {
      // 프로젝트 루트 지표 파일들 확인
      const indicators = [
        'package.json', 'pom.xml', 'build.gradle', 'requirements.txt', 
        'composer.json', 'Cargo.toml', 'go.mod', '.git'
      ];
      
      try {
        const items = fsSync.readdirSync(currentPath);
        const hasIndicator = indicators.some(indicator => items.includes(indicator));
        
        if (hasIndicator && !this.isMCPServerDirectory(currentPath)) {
          return currentPath;
        }
      } catch (error) {
        break;
      }
      
      const parentPath = path.dirname(currentPath);
      if (parentPath === currentPath) break; // 루트에 도달
      currentPath = parentPath;
    }
    
    return null;
  }

  /**
   * MCP 서버 자체 디렉토리인지 확인
   */
  private isMCPServerDirectory(dirPath: string): boolean {
    try {
      const items = fsSync.readdirSync(dirPath);
      // figure-mcp 관련 디렉토리나 파일이 있으면 MCP 서버 디렉토리
      return items.some((item: string) => 
        item.includes('figure-mcp') || 
        item === 'figure-mcp-server.ts' ||
        item === 'figure-mcp-server.js'
      );
    } catch {
      return false;
    }
  }

  /**
   * 인근 프로젝트 찾기
   */
  private findNearbyProject(mcpPath: string): string | null {
    try {
      // MCP 서버 경로의 상위 디렉토리들 검색
      const parentDir = path.dirname(path.dirname(mcpPath)); // 2단계 상위
      const siblings = fsSync.readdirSync(parentDir, { withFileTypes: true });
      
      for (const sibling of siblings) {
        if (sibling.isDirectory() && !sibling.name.includes('figure-mcp')) {
          const siblingPath = path.join(parentDir, sibling.name);
          const projectRoot = this.findProjectRoot(siblingPath);
          if (projectRoot) {
            return projectRoot;
          }
        }
      }
    } catch (error) {
      console.error('⚠️ 인근 프로젝트 검색 실패:', error);
    }
    
    return null;
  }

  /**
   * Cursor 워크스페이스 자동 감지
   */
  private detectCursorWorkspace(): string | null {
    try {
      // 1. 환경변수에서 Cursor 워크스페이스 찾기
      const envVars = [
        'CURSOR_WORKSPACE',
        'VSCODE_WORKSPACE', 
        'WORKSPACE',
        'PWD',
        'INIT_CWD'
      ];
      
      for (const envVar of envVars) {
        const value = process.env[envVar];
        if (value && !this.isMCPServerDirectory(value)) {
          console.error(`📍 환경변수 ${envVar}에서 워크스페이스 발견: ${value}`);
          return value;
        }
      }

      // 2. 프로세스 argv에서 워크스페이스 힌트 찾기
      const argv = process.argv.join(' ');
      const workspaceMatch = argv.match(/--workspace[=\s]+"?([^"\s]+)"?/);
      if (workspaceMatch && workspaceMatch[1]) {
        console.error(`📍 프로세스 인자에서 워크스페이스 발견: ${workspaceMatch[1]}`);
        return workspaceMatch[1];
      }

    // 3. IntelliJ bin 디렉토리 특별 처리
    const currentDir = process.cwd();
    if (currentDir.includes('IntelliJ IDEA') && currentDir.includes('bin')) {
      console.error(`⚠️ IntelliJ bin 디렉토리 감지, 일반적인 개발 경로에서 프로젝트 검색...`);
      
      // 강제로 가장 가능성 높은 프로젝트 경로 시도
      const likelyPaths = [
        'C:\\workspace\\ds\\01_source',
        'C:\\workspace\\ds',
        'C:\\workspace',
        'C:\\Projects'
      ];
      
      for (const basePath of likelyPaths) {
        try {
          if (fsSync.existsSync(basePath)) {
            const items = fsSync.readdirSync(basePath, { withFileTypes: true });
            for (const item of items) {
              if (item.isDirectory() && !item.name.includes('figure-mcp')) {
                const projectPath = path.join(basePath, item.name);
                if (this.isValidProjectPath(projectPath)) {
                  console.error(`🎯 강제 감지 성공: ${projectPath}`);
                  // 자동 저장
                  this.saveWorkspaceConfig(projectPath).catch(() => {});
                  return projectPath;
                }
              }
            }
          }
        } catch {
          continue;
        }
      }
    }

    // 4. IntelliJ 특별 처리: 최근 프로젝트 찾기
    const intellijProject = this.findIntellijCurrentProject();
    if (intellijProject) {
      console.error(`📁 워크스페이스: ${intellijProject}`);
      return intellijProject;
    }

      // 4. 일반적인 개발 워크스페이스 패턴 확인
      const workspaceFromPattern = this.findWorkspaceFromPatterns(currentDir);
      if (workspaceFromPattern) {
        return workspaceFromPattern;
      }

    } catch (error) {
      console.error('⚠️ Cursor 워크스페이스 감지 실패:', error);
    }
    
    return null;
  }

  /**
   * IntelliJ 현재 프로젝트 찾기 - 고급 감지 시스템
   */
  private findIntellijCurrentProject(): string | null {
    try {
      // 1. IntelliJ 프로세스 정보에서 현재 프로젝트 추출
      const intellijProject = this.detectIntellijFromProcess();
      if (intellijProject) {
        return intellijProject;
      }

      // 2. IntelliJ 설정 파일에서 최근 프로젝트 찾기
      const recentProject = this.findIntellijRecentProject();
      if (recentProject) {
        return recentProject;
      }

      // 3. 일반적인 개발 경로에서 가장 최근 프로젝트 찾기
      const commonProject = this.findMostRecentProject();
      if (commonProject) {
        return commonProject;
      }

    } catch (error) {
      console.error('⚠️ IntelliJ 프로젝트 감지 실패:', error);
    }
    
    return null;
  }

  /**
   * IntelliJ 프로세스 정보에서 현재 프로젝트 추출
   */
  private detectIntellijFromProcess(): string | null {
    try {
      // Windows에서 IntelliJ 프로세스의 명령줄 인수 확인
      
      try {
        // wmic으로 IntelliJ 프로세스의 CommandLine 확인
        const result = execSync(
          'wmic process where "name=\'idea64.exe\' or name=\'idea.exe\'" get CommandLine /format:value',
          { encoding: 'utf-8', timeout: 5000 }
        );
        
        const lines = result.split('\n');
        for (const line of lines) {
          if (line.startsWith('CommandLine=') && line.includes('workspace')) {
            // CommandLine에서 프로젝트 경로 추출
            const projectMatch = line.match(/([C-Z]:[^"'\s]+workspace[^"'\s]*)/i);
            if (projectMatch) {
              const projectPath = projectMatch[1];
              if (this.isValidProjectPath(projectPath)) {
                return projectPath;
              }
            }
          }
        }
      } catch (wmicError) {
        console.error('⚠️ wmic 명령 실패:', wmicError);
      }

      // PowerShell로 대체 시도
      try {
        const psResult = execSync(
          'powershell "Get-Process | Where-Object {$_.ProcessName -like \'*idea*\'} | Select-Object -ExpandProperty Path"',
          { encoding: 'utf-8', timeout: 5000 }
        );
        
        if (psResult.includes('IntelliJ')) {
          // IntelliJ 실행 경로에서 프로젝트 추정
          return this.findNearbyIntellijProject();
        }
      } catch (psError) {
        console.error('⚠️ PowerShell 명령 실패:', psError);
      }

    } catch (error) {
      console.error('⚠️ 프로세스 분석 실패:', error);
    }
    
    return null;
  }

  /**
   * IntelliJ 설정에서 최근 프로젝트 찾기
   */
  private findIntellijRecentProject(): string | null {
    try {
      const userHome = os.homedir();
      
      // IntelliJ 설정 디렉토리 패턴들
      const configDirs = [
        path.join(userHome, '.IntelliJIdea*'),
        path.join(userHome, 'AppData', 'Roaming', 'JetBrains', 'IntelliJIdea*'),
        path.join(userHome, '.config', 'JetBrains', 'IntelliJIdea*')
      ];

      for (const configPattern of configDirs) {
        try {
          // glob 패턴 매칭을 위한 간단한 구현
          const parentDir = path.dirname(configPattern);
          const pattern = path.basename(configPattern);
          
          if (fsSync.existsSync(parentDir)) {
            const items = fsSync.readdirSync(parentDir);
            const matchingDirs = items.filter((item: string) => 
              item.includes('IntelliJIdea') || item.includes('IDEA')
            );
            
            for (const dir of matchingDirs) {
              const configDir = path.join(parentDir, dir);
              const recentProjectsPath = path.join(configDir, 'config', 'options', 'recentProjects.xml');
              
              if (fsSync.existsSync(recentProjectsPath)) {
                const recentProject = this.parseIntellijRecentProjects(recentProjectsPath);
                if (recentProject) {
                  return recentProject;
                }
              }
            }
          }
        } catch {
          continue;
        }
      }
    } catch (error) {
      console.error('⚠️ IntelliJ 설정 파일 읽기 실패:', error);
    }
    
    return null;
  }

  /**
   * IntelliJ recentProjects.xml 파싱
   */
  private parseIntellijRecentProjects(xmlPath: string): string | null {
    try {
      const xmlContent = fsSync.readFileSync(xmlPath, 'utf-8');
      
      // 간단한 XML 파싱 (정규식 사용)
      const projectMatches = xmlContent.match(/<option name="path" value="([^"]+)"/g);
      
      if (projectMatches && projectMatches.length > 0) {
        // 첫 번째 (가장 최근) 프로젝트 경로 추출
        const firstMatch = projectMatches[0];
        const pathMatch = firstMatch.match(/value="([^"]+)"/);
        
        if (pathMatch && pathMatch[1]) {
          const projectPath = pathMatch[1].replace(/\$USER_HOME\$/g, os.homedir());
          if (this.isValidProjectPath(projectPath)) {
            return projectPath;
          }
        }
      }
    } catch (error) {
      console.error('⚠️ XML 파싱 실패:', error);
    }
    
    return null;
  }

  /**
   * 가장 최근에 수정된 프로젝트 찾기
   */
  private findMostRecentProject(): string | null {
    try {
      const searchPaths = [
        'C:\\workspace',
        'C:\\workspace\\ds',
        'C:\\workspace\\ds\\01_source',
        'C:\\Projects',
        path.join(os.homedir(), 'IdeaProjects'),
        path.join(os.homedir(), 'workspace')
      ];

      let mostRecentProject: { path: string; mtime: number } | null = null;

      for (const basePath of searchPaths) {
        try {
          if (!fsSync.existsSync(basePath)) continue;
          
          const projects = this.findProjectsInDirectory(basePath);
          
          for (const projectPath of projects) {
            try {
              const stats = fsSync.statSync(projectPath);
              const mtime = stats.mtime.getTime();
              
              if (!mostRecentProject || mtime > mostRecentProject.mtime) {
                mostRecentProject = { path: projectPath, mtime };
              }
            } catch {
              continue;
            }
          }
        } catch {
          continue;
        }
      }

      return mostRecentProject?.path || null;
    } catch (error) {
      console.error('⚠️ 최근 프로젝트 검색 실패:', error);
      return null;
    }
  }

  /**
   * IntelliJ 인근 프로젝트 찾기
   */
  private findNearbyIntellijProject(): string | null {
    try {
      // IntelliJ가 실행 중이면 일반적인 개발 경로에서 프로젝트 찾기
      const devPaths = [
        'C:\\workspace\\ds\\01_source',
        'C:\\workspace\\work',
        'C:\\Projects'
      ];

      for (const basePath of devPaths) {
        const projects = this.findProjectsInDirectory(basePath);
        if (projects.length > 0) {
          return projects[0]; // 첫 번째 발견된 프로젝트
        }
      }
    } catch (error) {
      console.error('⚠️ 인근 프로젝트 검색 실패:', error);
    }
    
    return null;
  }

  /**
   * 유효한 프로젝트 경로인지 확인
   */
  private isValidProjectPath(projectPath: string): boolean {
    try {
      if (!fsSync.existsSync(projectPath)) {
        return false;
      }
      
      const stats = fsSync.statSync(projectPath);
      if (!stats.isDirectory()) {
        return false;
      }
      
      // MCP 서버 자체 디렉토리는 제외
      if (this.isMCPServerDirectory(projectPath)) {
        return false;
      }
      
      // 프로젝트 지표 파일이 있는지 확인
      const indicators = ['package.json', 'pom.xml', 'build.gradle', '.git', 'requirements.txt'];
      const items = fsSync.readdirSync(projectPath);
      
      return indicators.some(indicator => items.includes(indicator));
    } catch {
      return false;
    }
  }

  /**
   * 디렉토리에서 프로젝트들 찾기
   */
  private findProjectsInDirectory(basePath: string): string[] {
    try {
      const items = fsSync.readdirSync(basePath, { withFileTypes: true });
      const projects: string[] = [];

      for (const item of items) {
        if (item.isDirectory() && !item.name.startsWith('.') && !item.name.includes('figure-mcp')) {
          const projectPath = path.join(basePath, item.name);
          const projectRoot = this.findProjectRoot(projectPath);
          if (projectRoot) {
            projects.push(projectRoot);
          }
        }
      }

      return projects;
    } catch {
      return [];
    }
  }

  /**
   * 패턴 기반 워크스페이스 찾기
   */
  private findWorkspaceFromPatterns(dirPath: string): string | null {
    // 일반적인 개발 디렉토리 패턴 확인
    const devPatterns = [
      /workspace[\/\\]/,
      /projects?[\/\\]/,
      /dev[\/\\]/,
      /src[\/\\]/,
      /code[\/\\]/
    ];
    
    for (const pattern of devPatterns) {
      if (pattern.test(dirPath)) {
        // 패턴이 매치되면 해당 부분까지를 워크스페이스로 간주
        const match = dirPath.match(pattern);
        if (match) {
          const workspaceCandidate = dirPath.substring(0, dirPath.indexOf(match[0]) + match[0].length - 1);
          console.error(`📍 개발 패턴에서 워크스페이스 추정: ${workspaceCandidate}`);
          return workspaceCandidate;
        }
      }
    }
    
    return null;
  }

  /**
   * 워크스페이스 설정 저장
   */
  private async saveWorkspaceConfig(workspacePath: string): Promise<void> {
    try {
      const configPath = path.join(this.CACHE_FOLDER_PATH, 'workspace.json');
      const config = {
        workspacePath,
        savedAt: new Date().toISOString(),
        source: 'user_set'
      };
      
      await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
      console.error(`💾 워크스페이스 설정 저장: ${configPath}`);
    } catch (error) {
      console.error('⚠️ 워크스페이스 설정 저장 실패:', error);
    }
  }

  /**
   * 저장된 워크스페이스 설정 로드
   */
  private loadSavedWorkspaceConfig(): string | null {
    try {
      const configPath = path.join(this.CACHE_FOLDER_PATH, 'workspace.json');
      const configContent = fsSync.readFileSync(configPath, 'utf-8');
      const config = JSON.parse(configContent);
      
      // 24시간 이내 설정만 유효
      const savedTime = new Date(config.savedAt).getTime();
      const now = Date.now();
      if (now - savedTime < 24 * 60 * 60 * 1000) {
        return config.workspacePath;
      } else {
        console.error('⏰ 저장된 워크스페이스 설정이 만료됨 (24시간 초과)');
        return null;
      }
    } catch {
      // 설정 파일이 없거나 읽기 실패 시 null 반환
      return null;
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
   * 템플릿 내용 추출 및 정제
   */
  private extractTemplateContent(templateData: any): string {
    // 다양한 템플릿 데이터 구조에서 실제 내용 추출
    let content = '';
    
    if (templateData?.content) {
      content = templateData.content;
    } else if (templateData?.template) {
      content = templateData.template;
    } else if (typeof templateData === 'string') {
      content = templateData;
    } else if (templateData?.sections) {
      // 섹션 기반 템플릿인 경우
      content = templateData.sections.map((section: any) => 
        `${section.title || section.name || ''}\n${section.content || section.description || ''}`
      ).join('\n\n');
    }
    
    // 내용이 없으면 기본 구조 생성
    if (!content || content.trim().length < 50) {
      content = `기본 템플릿 구조
      
1. 개요
   - 목적 및 배경
   - 범위 정의
   
2. 상세 분석
   - 요구사항 분석
   - 기술적 고려사항
   
3. 구현 방안
   - 설계 방향
   - 구현 계획
   
4. 결론
   - 요약
   - 권장사항`;
    }
    
    return content.trim();
  }

  /**
   * 템플릿 통계 분석
   */
  private analyzeTemplateStats(templateContent: string): {
    totalLines: number;
    totalChars: number;
    mainSections: string[];
    estimatedComplexity: 'low' | 'medium' | 'high';
    hasStructure: boolean;
  } {
    const lines = templateContent.split('\n');
    const totalLines = lines.length;
    const totalChars = templateContent.length;
    
    // 주요 섹션 식별 (번호나 제목 패턴 찾기)
    const sectionPatterns = [
      /^\s*\d+\.\s*(.+)/,  // "1. 제목" 패턴
      /^\s*#+\s*(.+)/,     // "# 제목" 패턴  
      /^\s*\[(.+)\]/,      // "[제목]" 패턴
      /^\s*【(.+)】/,       // "【제목】" 패턴
      /^\s*■\s*(.+)/,      // "■ 제목" 패턴
    ];
    
    const mainSections: string[] = [];
    const hasStructure = lines.some(line => {
      for (const pattern of sectionPatterns) {
        const match = line.match(pattern);
        if (match && match[1]) {
          const sectionTitle = match[1].trim();
          if (sectionTitle.length > 2 && sectionTitle.length < 50) {
            mainSections.push(sectionTitle);
            return true;
          }
        }
      }
      return false;
    });
    
    // 복잡도 계산
    let estimatedComplexity: 'low' | 'medium' | 'high' = 'low';
    if (totalLines > 100 || mainSections.length > 8) {
      estimatedComplexity = 'high';
    } else if (totalLines > 50 || mainSections.length > 4) {
      estimatedComplexity = 'medium';
    }
    
    return {
      totalLines,
      totalChars,
      mainSections: mainSections.slice(0, 10), // 최대 10개만
      estimatedComplexity,
      hasStructure
    };
  }

  /**
   * 최적 청크 분할 전략 계산
   */
  private calculateOptimalChunkStrategy(
    templateStats: any,
    documentType: string
  ): {
    totalChunks: number;
    averageChunkSize: number;
    chunkSizes: number[];
    minChunkSize: number;
    maxChunkSize: number;
    strategy: 'small' | 'medium' | 'large' | 'adaptive';
  } {
    const { totalLines, estimatedComplexity, mainSections } = templateStats;
    
    // 기본 청크 크기 범위 설정
    let minChunkSize = 8;
    let maxChunkSize = 25;
    let targetChunks = 4;
    
    // 문서 타입별 조정
    const documentTypeSettings: Record<string, any> = {
      'IMPACT_ANALYSIS': { min: 10, max: 30, target: 6 },
      'REQUIREMENTS': { min: 12, max: 35, target: 7 },
      'PROGRAM_DESIGN_ONLINE': { min: 8, max: 25, target: 5 },
      'PROGRAM_DESIGN_BATCH': { min: 10, max: 28, target: 6 },
      'TABLE_SPECIFICATION': { min: 6, max: 20, target: 4 }
    };
    
    const settings = documentTypeSettings[documentType];
    if (settings) {
      minChunkSize = settings.min;
      maxChunkSize = settings.max;
      targetChunks = settings.target;
    }
    
    // 템플릿 길이에 따른 동적 조정
    if (totalLines <= 30) {
      // 짧은 템플릿: 2-3개 청크
      targetChunks = Math.max(2, Math.ceil(totalLines / 12));
      maxChunkSize = Math.max(15, Math.ceil(totalLines / 2));
    } else if (totalLines <= 60) {
      // 중간 템플릿: 3-5개 청크  
      targetChunks = Math.max(3, Math.ceil(totalLines / 15));
      maxChunkSize = Math.max(20, Math.ceil(totalLines / 3));
    } else if (totalLines <= 100) {
      // 긴 템플릿: 4-7개 청크
      targetChunks = Math.max(4, Math.ceil(totalLines / 18));
      maxChunkSize = Math.max(25, Math.ceil(totalLines / 4));
    } else {
      // 매우 긴 템플릿: 6-10개 청크
      targetChunks = Math.max(6, Math.min(10, Math.ceil(totalLines / 20)));
      maxChunkSize = Math.max(30, Math.ceil(totalLines / 6));
    }
    
    // 주요 섹션 수를 고려한 조정
    if (mainSections.length > 0) {
      targetChunks = Math.max(targetChunks, Math.min(mainSections.length, 8));
    }
    
    // 복잡도에 따른 조정
    if (estimatedComplexity === 'high') {
      targetChunks = Math.min(targetChunks + 2, 10);
      minChunkSize = Math.max(minChunkSize - 2, 6);
    } else if (estimatedComplexity === 'low') {
      targetChunks = Math.max(targetChunks - 1, 2);
      maxChunkSize = Math.min(maxChunkSize + 5, 40);
    }
    
    // 실제 청크 크기 배분 계산
    const averageChunkSize = Math.ceil(totalLines / targetChunks);
    const chunkSizes: number[] = [];
    
    // 균등 분배를 기본으로 하되, 약간의 변동 허용
    let remainingLines = totalLines;
    for (let i = 0; i < targetChunks; i++) {
      if (i === targetChunks - 1) {
        // 마지막 청크는 남은 모든 줄
        chunkSizes.push(remainingLines);
      } else {
        // 평균 크기 ± 20% 범위에서 조정
        const variation = Math.floor(averageChunkSize * 0.2);
        const randomAdjustment = Math.floor(Math.random() * variation * 2) - variation;
        let chunkSize = Math.max(
          minChunkSize,
          Math.min(maxChunkSize, averageChunkSize + randomAdjustment)
        );
        
        // 남은 줄 수 고려
        if (chunkSize > remainingLines - (targetChunks - i - 1) * minChunkSize) {
          chunkSize = Math.max(minChunkSize, remainingLines - (targetChunks - i - 1) * minChunkSize);
        }
        
        chunkSizes.push(chunkSize);
        remainingLines -= chunkSize;
      }
    }
    
    // 전략 결정
    let strategy: 'small' | 'medium' | 'large' | 'adaptive' = 'adaptive';
    if (averageChunkSize <= 15) strategy = 'small';
    else if (averageChunkSize <= 25) strategy = 'medium';
    else strategy = 'large';
    
    return {
      totalChunks: targetChunks,
      averageChunkSize,
      chunkSizes,
      minChunkSize,
      maxChunkSize,
      strategy
    };
  }

  /**
   * 청크 범위에 따른 템플릿 내용 추출
   */
  private extractChunkContent(templateData: any, chunkRange?: string): string {
    if (!chunkRange) {
      return '';
    }

    const templateContent = this.extractTemplateContent(templateData);
    const lines = templateContent.split('\n');
    
    // 청크 범위 파싱 (예: "1-15", "16-45")
    const rangeMatch = chunkRange.match(/(\d+)-(\d+)/);
    if (!rangeMatch) {
      return '';
    }
    
    const startLine = parseInt(rangeMatch[1]) - 1; // 0-based index
    const endLine = parseInt(rangeMatch[2]) - 1;   // 0-based index
    
    if (startLine < 0 || endLine >= lines.length || startLine > endLine) {
      return '';
    }
    
    // 해당 범위의 줄들만 추출
    const chunkLines = lines.slice(startLine, endLine + 1);
    return chunkLines.join('\n').trim();
  }

  /**
   * AI가 백엔드 템플릿을 동적으로 분석하여 청크 기반 구조 설계
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
      console.error(`🤖 AI가 템플릿 동적 분석 시작: ${documentType}`);

      // 1단계: 템플릿 내용 추출 및 전처리
      const templateContent = this.extractTemplateContent(templateData);
      const templateStats = this.analyzeTemplateStats(templateContent);
      
      console.error(`📊 템플릿 분석: ${templateStats.totalLines}줄, ${templateStats.totalChars}자, 복잡도: ${templateStats.estimatedComplexity}`);

      // 2단계: 동적 청크 분할 전략 수립
      const chunkStrategy = this.calculateOptimalChunkStrategy(templateStats, documentType);
      console.error(`🔄 청크 전략: ${chunkStrategy.totalChunks}개 청크, 평균 ${chunkStrategy.averageChunkSize}줄`);

      // 3단계: AI가 템플릿을 청크별로 분석하여 섹션 구조 설계
      const templateAnalysisPrompt = `당신은 **소프트웨어 개발 산출물 전문가**입니다.

**🎯 임무**: 백엔드 템플릿을 **동적으로 분석**하여 청크 기반의 최적화된 섹션 구조를 설계

**📋 개발 산출물 정보:**
- **문서 타입**: ${this.getDocumentTypeDisplayName(documentType)}
- **대상 기능**: ${featureName}
- **개발 요구사항**: ${requirements}
- **개발 환경**: ${siteInfo.name} (${siteInfo.company})

**📊 템플릿 분석 결과:**
- **총 길이**: ${templateStats.totalLines}줄 (${templateStats.totalChars}자)
- **복잡도**: ${templateStats.estimatedComplexity}
- **주요 섹션**: ${templateStats.mainSections.join(', ')}
- **권장 청크 수**: ${chunkStrategy.totalChunks}개

**📄 분석 대상 템플릿:**
${templateContent}

**🔄 동적 청크 분할 전략:**
템플릿을 **${chunkStrategy.totalChunks}개의 청크**로 나누어 각각 독립적인 AI 생성 단위로 처리합니다.

**청크별 예상 크기:**
${chunkStrategy.chunkSizes.map((size, idx) => `- 청크 ${idx + 1}: 약 ${size}줄`).join('\n')}

**🎯 청크 기반 섹션 설계 요청:**
위 템플릿을 분석하여 다음 원칙에 따라 섹션을 설계해주세요:

**📋 동적 분할 원칙:**
1. **내용 기반 분할**: 템플릿 내용의 의미적 경계에 따라 청크 분할
2. **적절한 크기**: 각 청크는 ${chunkStrategy.minChunkSize}-${chunkStrategy.maxChunkSize}줄 범위
3. **독립성 보장**: 각 청크별로 독립적인 AI 생성이 가능하도록 설계
4. **논리적 흐름**: 청크 간 자연스러운 연결과 의존성 고려
5. **완전성**: 템플릿의 모든 내용을 빠짐없이 포함

**🔍 소스코드 검색 키워드 생성:**
각 섹션별로 관련된 소스코드를 찾기 위한 **영어 키워드**를 생성해주세요:

**키워드 생성 원칙:**
1. **한글→영어 변환**: 템플릿의 한글 용어를 적절한 영어 개발 용어로 변환
2. **기술적 용어**: 파일명, 클래스명, 함수명에서 사용될 만한 기술 용어 포함
3. **섹션별 특화**: 각 섹션의 내용에 특화된 검색 키워드 제공
4. **실용성**: 실제 소스코드에서 매칭될 가능성이 높은 키워드 우선

**키워드 예시:**
- "로그인 화면" → ["login", "auth", "signin", "page", "view", "form"]
- "사용자 관리" → ["user", "member", "account", "manage", "admin"]  
- "데이터 처리" → ["data", "process", "service", "controller", "api"]

**💡 핵심 목표:**
- 템플릿 길이에 관계없이 **동적으로 최적화된 청크** 생성
- 각 청크별로 **풍부하고 구체적인 내용** 생성 가능
- **AI가 실제 소스코드를 찾을 수 있는** 정확한 검색 키워드 제공
- 전체적으로 **일관성 있는 개발 산출물** 완성

**📋 응답 형식 (JSON):**
\`\`\`json
{
  "sections": [
    {
      "id": "chunk_1_overview",
      "title": "1. 개요 및 배경",
      "description": "기능의 목적과 비즈니스 배경 분석",
      "order": 1,
      "estimatedTokens": 250,
      "chunkRange": "1-15",
      "prompt": "템플릿 1-15줄 내용을 바탕으로 구체적인 개요를 작성하세요",
      "dependencies": [],
      "templateChunk": "템플릿의 해당 청크 내용",
      "sourceKeywords": ["login", "auth", "user", "page", "view"]
    },
    {
      "id": "chunk_2_analysis", 
      "title": "2. 상세 분석",
      "description": "핵심 기능과 기술적 요구사항 분석",
      "order": 2, 
      "estimatedTokens": 400,
      "chunkRange": "16-45", 
      "prompt": "템플릿 16-45줄의 핵심 내용을 소스코드와 연결하여 상세 분석하세요",
      "dependencies": ["chunk_1_overview"],
      "templateChunk": "템플릿의 해당 청크 내용",
      "sourceKeywords": ["controller", "service", "component", "api", "database"]
    }
  ],
  "globalSourceKeywords": ["login", "auth", "user", "controller", "service", "model", "component", "page", "view", "api"],
  "totalChunks": ${chunkStrategy.totalChunks},
  "chunkingStrategy": "dynamic_content_based",
  "complexity": "${templateStats.estimatedComplexity}",
  "reasoning": "템플릿을 ${chunkStrategy.totalChunks}개의 의미적 청크로 동적 분할하여 각각 독립적으로 풍부한 내용 생성"
}
\`\`\`

**⚡ 동적 분할 목표:**
- 템플릿 길이: ${templateStats.totalLines}줄 → ${chunkStrategy.totalChunks}개 최적화 청크
- 각 청크별 AI가 집중적으로 **풍부한 데이터** 생성
- 전체적으로 **일관성과 완성도** 확보`;

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
          
          // AI가 분석한 청크 기반 섹션 구조 사용
          const sections: DocumentSection[] = (analysisResult.sections || []).map((section: any) => ({
            id: section.id,
            title: section.title,
            description: section.description,
            order: section.order,
            estimatedTokens: section.estimatedTokens || 300,
            prompt: section.prompt,
            dependencies: section.dependencies || [],
            chunkRange: section.chunkRange, // 청크 범위 정보 추가
            templateChunk: section.templateChunk, // 해당 청크의 템플릿 내용
            sourceKeywords: section.sourceKeywords || [] // AI가 생성한 검색 키워드
          }));
          
          // 전역 소스 키워드 추출 (모든 섹션에서 공통 사용)
          const globalSourceKeywords = analysisResult.globalSourceKeywords || [];
          console.error(`🤖 AI 생성 키워드: ${globalSourceKeywords.join(', ')}`);
          
          // 섹션별 키워드도 로깅
          sections.forEach(section => {
            if (section.sourceKeywords && section.sourceKeywords.length > 0) {
              console.error(`📋 ${section.title}: ${section.sourceKeywords.join(', ')}`);
            }
          });
          
          const complexity = analysisResult.complexity || templateStats.estimatedComplexity;
          const estimatedTime = this.calculateEstimatedTime(sections);
          const recommendations = [
            `🔄 동적 청크 분석: ${templateStats.totalLines}줄 → ${chunkStrategy.totalChunks}개 청크`,
            `📋 AI 섹션 설계: ${sections.length}개 섹션 생성`,
            `📊 청크 전략: ${chunkStrategy.strategy} (평균 ${chunkStrategy.averageChunkSize}줄)`,
            `🎯 복잡도: ${complexity}`,
            `⏱️ 예상 소요 시간: 약 ${estimatedTime}분`,
            analysisResult.reasoning || '템플릿을 의미적 청크로 분할하여 풍부한 내용 생성'
          ];

          console.error(`✅ AI 동적 청크 분석 완료: ${sections.length}개 섹션, ${chunkStrategy.totalChunks}개 청크`);
          
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

  // 🔍 ===== MCP Resources 기반 소스코드 분석 시스템 =====

  /**
   * LLM을 통한 요구사항 기반 소스코드 검색 키워드 생성
   */
  private async generateSourceKeywordsFromRequirements(
    featureName: string,
    requirements: string,
    section: DocumentSection
  ): Promise<string[]> {
    try {
      const keywordPrompt = `당신은 **소프트웨어 개발 전문가**입니다.

**🎯 임무**: 요구사항을 분석하여 **실제 소스코드에서 찾을 수 있는** 영어 검색 키워드를 생성

**📋 분석 대상:**
- **기능명**: ${featureName}
- **요구사항**: ${requirements || '상세 요구사항 없음'}
- **현재 섹션**: ${section.title} - ${section.description}

**🔍 키워드 생성 원칙:**

1. **실제 파일명/클래스명 예측**: 개발자가 이 기능을 구현할 때 사용할 것 같은 파일명, 클래스명, 함수명
2. **구체적 기술 용어**: 추상적 용어가 아닌 실제 코드에서 사용되는 구체적 용어
3. **영어 개발 용어**: 한글 용어를 적절한 영어 개발 용어로 변환
4. **파일 확장자 고려**: .ts, .tsx, .js, .jsx 파일에서 찾을 수 있는 키워드

**💡 예시 분석:**

**요구사항**: "사용자 로그인 화면에 비밀번호 찾기 버튼 추가"
**예상 키워드**: ["login", "auth", "password", "reset", "forgot", "button", "form", "user", "signin", "page", "component"]

**요구사항**: "주문 목록 페이지에 검색 필터 추가" 
**예상 키워드**: ["order", "list", "search", "filter", "page", "table", "grid", "query", "component"]

**🎯 현재 요구사항 분석:**

위 요구사항을 분석하여 **실제 소스코드 파일에서 찾을 수 있는** 영어 키워드 10-15개를 생성해주세요.

**응답 형식**: 키워드만 쉼표로 구분하여 한 줄로 작성
**예시**: login, auth, password, reset, button, form, component, page, user, signin

**키워드 생성**:`;

      const response = await this.server.createMessage({
        messages: [{
          role: 'user',
          content: {
            type: 'text',
            text: keywordPrompt
          }
        }],
        maxTokens: 200
      });

      // AI 응답에서 키워드 추출
      let aiKeywords: string[] = [];
      if (response.content.type === 'text') {
        const keywordText = response.content.text.trim();
        
        // 다양한 형식으로 응답할 수 있으므로 파싱
        aiKeywords = keywordText
          .replace(/[\[\]"']/g, '') // 괄호, 따옴표 제거
          .split(/[,\s]+/) // 쉼표나 공백으로 분리
          .map(keyword => keyword.trim().toLowerCase())
          .filter(keyword => keyword.length > 1 && /^[a-z]+$/.test(keyword)) // 영어만
          .slice(0, 15); // 최대 15개
      }

      // AI가 키워드를 제대로 생성하지 못한 경우
      if (aiKeywords.length === 0) {
        console.error('⚠️ AI 키워드 생성 실패');
        return [];
      }

      return aiKeywords;

    } catch (error) {
      console.error('❌ LLM 키워드 생성 실패:', error);
      return [];
    }
  }


  /**
   * MCP Resources를 통한 소스코드 수집 및 분석
   */
  private async collectRelevantSourceCodeViaMCP(
    featureName: string,
    documentType: string,
    section: DocumentSection,
    requirements: string
  ): Promise<{
    files: Array<{ uri: string; name: string; content: string; relevance: number }>;
    totalLines: number;
    summary: string;
  }> {
    try {
      // 1단계: LLM을 통한 요구사항 기반 키워드 추출
      console.error(`🤖 요구사항 분석하여 소스코드 검색 키워드 생성 중...`);
      const requirementKeywords = await this.generateSourceKeywordsFromRequirements(
        featureName,
        requirements,
        section
      );
      console.error(`📝 요구사항 기반 키워드: ${requirementKeywords.join(', ')}`);
      
      // 2단계: AI 템플릿 분석 키워드와 결합
      let searchKeywords: string[] = [...requirementKeywords];
      
      if (section.sourceKeywords && section.sourceKeywords.length > 0) {
        // AI 템플릿 분석 키워드도 추가 (중복 제거)
        const templateKeywords = section.sourceKeywords.filter(keyword => 
          !searchKeywords.includes(keyword)
        );
        searchKeywords.push(...templateKeywords);
        console.error(`🤖 템플릿 분석 키워드 추가: ${templateKeywords.join(', ')}`);
      }
      
      // 3단계: 기본 기술 키워드 보강
      const techKeywords = ['controller', 'service', 'model', 'component', 'api', 'view', 'page'];
      searchKeywords.push(...techKeywords.filter(keyword => !searchKeywords.includes(keyword)));
      
      console.error(`🔍 최종 통합 키워드: ${searchKeywords.join(', ')}`);

      // 2단계: MCP Resources 목록 조회
      const workspaceRoot = process.cwd();
      const allResources = await this.scanWorkspaceResources(workspaceRoot);

      if (allResources.length === 0) {
        console.error('❌ MCP Resources를 찾을 수 없습니다.');
        return {
          files: [],
          totalLines: 0,
          summary: 'MCP Resources에서 소스코드를 찾을 수 없습니다. 워크스페이스에 소스 파일이 있는지 확인해주세요.'
        };
      }

      // 3단계: 키워드 매칭으로 관련 리소스 필터링
      const relevantResources = this.filterResourcesByKeywords(allResources, searchKeywords);

      // 4단계: 상위 N개 리소스의 내용 읽기 (관련 리소스가 없으면 상위 5개 선택)
      const maxFiles = 5;
      const selectedResources = relevantResources.length > 0 
        ? relevantResources.slice(0, maxFiles)
        : allResources.slice(0, maxFiles);
      const filesWithContent: Array<{ uri: string; name: string; content: string; relevance: number }> = [];

      for (const resource of selectedResources) {
        try {
          // MCP ReadResource를 통해 파일 내용 읽기
          const filePath = this.uriToFilePath(resource.uri);
          if (!filePath) continue;

          const content = await fs.readFile(filePath, 'utf-8');
          
          // 파일 크기 제한 (3000자 초과 시 요약)
          const processedContent = content.length > 3000 
            ? await this.summarizeSourceFileForMCP(content, resource.name, searchKeywords)
            : content;

          const relevance = this.calculateResourceRelevance(resource, searchKeywords);

          filesWithContent.push({
            uri: resource.uri,
            name: resource.name,
            content: processedContent,
            relevance
          });

          console.error(`📄 리소스 로드: ${resource.name} (${processedContent.length}자)`);
          
        } catch (error) {
          console.error(`⚠️ 리소스 읽기 실패: ${resource.uri}`, error);
        }
      }

      // 5단계: 관련성 순으로 정렬
      filesWithContent.sort((a, b) => b.relevance - a.relevance);
      
      const totalLines = filesWithContent.reduce((sum, file) => sum + file.content.split('\n').length, 0);
      const summary = this.generateMCPSourceCodeSummary(filesWithContent, featureName, section);

      return {
        files: filesWithContent,
        totalLines,
        summary
      };
      
    } catch (error) {
      console.error('❌ MCP 소스코드 수집 실패:', error);
      return {
        files: [],
        totalLines: 0,
        summary: 'MCP Resources를 통한 소스코드 분석을 수행할 수 없습니다.'
      };
    }
  }

  /**
   * 키워드로 리소스 필터링
   */
  private filterResourcesByKeywords(
    resources: Array<{ uri: string; name: string; description: string; mimeType: string }>,
    keywords: string[]
  ): Array<{ uri: string; name: string; description: string; mimeType: string; score: number }> {
    return resources
      .map(resource => ({
        ...resource,
        score: this.calculateResourceRelevance(resource, keywords)
      }))
      .filter(resource => resource.score > 0.1) // 최소 관련성 임계값
      .sort((a, b) => b.score - a.score);
  }

  /**
   * 리소스 관련성 점수 계산
   */
  private calculateResourceRelevance(
    resource: { name: string; description: string },
    keywords: string[]
  ): number {
    let score = 0;
    const resourceText = (resource.name + ' ' + resource.description).toLowerCase();
    
    for (const keyword of keywords) {
      if (resourceText.includes(keyword.toLowerCase())) {
        // 파일명에서 매칭되면 높은 점수
        if (resource.name.toLowerCase().includes(keyword.toLowerCase())) {
          score += 0.5;
        } else {
          score += 0.2;
        }
      }
    }
    
    // 파일 타입별 보너스
    const importantExtensions = ['.ts', '.tsx', '.js', '.jsx'];
    if (importantExtensions.some(ext => resource.name.toLowerCase().endsWith(ext))) {
      score += 0.1;
    }
    
    return Math.min(score, 2.0);
  }

  /**
   * MCP용 소스파일 요약
   */
  private async summarizeSourceFileForMCP(content: string, fileName: string, keywords: string[]): Promise<string> {
    const lines = content.split('\n');
    const summary: string[] = [];
    
    summary.push(`// === ${fileName} ===`);
    
    // import/export 문들
    const imports = lines.filter(line => 
      line.trim().startsWith('import') || 
      line.trim().startsWith('export') ||
      line.trim().startsWith('from')
    );
    if (imports.length > 0) {
      summary.push('// Imports & Exports:');
      summary.push(...imports.slice(0, 8));
    }
    
    // 클래스, 함수, 인터페이스 선언부
    const declarations = lines.filter(line => {
      const trimmed = line.trim();
      return trimmed.match(/^(export\s+)?(class|function|interface|const|let|var)\s+\w+/);
    });
    
    if (declarations.length > 0) {
      summary.push('// Main declarations:');
      summary.push(...declarations.slice(0, 10));
    }
    
    // 키워드 관련 줄들
    const keywordLines = lines.filter(line => 
      keywords.some(keyword => line.toLowerCase().includes(keyword.toLowerCase()))
    );
    
    if (keywordLines.length > 0) {
      summary.push('// Relevant lines:');
      summary.push(...keywordLines.slice(0, 15));
    }
    
    return summary.join('\n');
  }

  /**
   * MCP 소스코드 요약 생성
   */
  private generateMCPSourceCodeSummary(
    files: Array<{ uri: string; name: string; content: string; relevance: number }>,
    featureName: string,
    section: DocumentSection
  ): string {
    if (files.length === 0) {
      return `${featureName}과 관련된 MCP 리소스를 찾을 수 없습니다.`;
    }
    
    const summary = [
      `🔍 MCP Resources 분석 결과 (${featureName}):`,
      '',
      `📁 분석된 리소스: ${files.length}개`,
      ...files.map(file => `  - ${file.name} (관련성: ${(file.relevance * 100).toFixed(0)}%)`),
      '',
      '💡 주요 발견사항:',
      `  - 총 ${files.reduce((sum, f) => sum + f.content.split('\n').length, 0)}줄의 코드 분석`,
      `  - ${section.title} 섹션과 관련된 구체적인 구현 내용 확인`,
      `  - MCP Resources 프로토콜을 통한 안전한 파일 접근`,
      ''
    ];
    
    return summary.join('\n');
  }










  // 🤖 ===== LLM 협업 시스템 =====

  /**
   * LLM과 협업하여 특정 섹션 생성 - 실제 소스코드 분석 포함
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

      // 청크별 템플릿 내용 추출
      const chunkContent = this.extractChunkContent(templateData, section.chunkRange);

      // 🔍 MCP Resources를 통한 소스코드 분석
      console.error(`🔍 소스코드 분석 시작: ${section.title}`);
      const sourceCodeContext = await this.collectRelevantSourceCodeViaMCP(
        featureName,
        documentType,
        section,
        requirements
      );
      console.error(`📄 수집된 소스코드: ${sourceCodeContext.files.length}개 파일, ${sourceCodeContext.totalLines}줄`);

      const contextPrompt = `당신은 **${siteInfo.name}의 소프트웨어 개발 산출물 전문가**입니다.

**🎯 개발 산출물 생성 임무**: ${this.getDocumentTypeDisplayName(documentType)}

**📋 프로젝트 정보:**
- **대상 기능**: ${featureName}
- **개발 요구사항**: ${requirements}
- **개발 환경**: ${siteInfo.name} (${siteInfo.company})

**📄 현재 작성 중인 섹션**: ${section.title}
**섹션 목적**: ${section.description}
**작성 가이드라인**: ${section.prompt}

${section.chunkRange ? `**🔄 청크 범위**: ${section.chunkRange} (템플릿의 해당 부분만 집중 분석)` : ''}

${previousContext ? `**🔗 이전 섹션 참조:**\n${previousContext}` : ''}

**📋 해당 청크의 템플릿 내용** (이 부분에만 집중):
${chunkContent || section.templateChunk || '해당 청크 내용 없음'}

${templateData?.instructions ? `**📋 템플릿 지침**: ${templateData.instructions.substring(0, 200)}...` : ''}

**🔍 실제 소스코드 분석 결과:**

${sourceCodeContext.summary}

**📂 MCP Resources 분석된 소스코드:**
${sourceCodeContext.files.map(file => 
`
### 📄 ${file.name} (관련성: ${(file.relevance * 100).toFixed(0)}%)
**🔗 MCP Resource URI**: \`${file.uri}\`
\`\`\`
${file.content.split('\n').slice(0, 50).join('\n')}${file.content.split('\n').length > 50 ? '\n... (생략됨)' : ''}
\`\`\`
`).join('\n')}

**⚡ 개발 산출물 작성 원칙:**

1. **🔍 실제 코드 기반**: 위에 제공된 실제 소스코드를 반드시 참조하여 작성
2. **📂 구체적 명시**: 위 파일들의 실제 클래스명, 함수명, 변수명을 정확히 인용
3. **🔗 의존성 분석**: import/export 관계, 모듈 간 의존성을 소스코드에서 확인하여 명시
4. **⚠️ 영향도 평가**: 실제 코드 구조를 바탕으로 변경 시 영향받는 컴포넌트 식별
5. **🛠️ 실행 가능**: 개발자가 위 소스코드를 보고 바로 구현할 수 있는 구체적 가이드 제공

**💻 위의 실제 소스코드를 기반으로 "${section.title}" 섹션을 작성해주세요:**
- 실제 파일명, 클래스명, 메서드명을 정확히 인용
- 코드의 구체적인 구조와 로직을 바탕으로 분석
- PM/PL이 기술 검토할 수 있는 구체적 내용
- 시니어 개발자가 아키텍처 판단할 수 있는 실제 구현 정보
- 주니어 개발자가 구현 가이드로 사용할 수 있는 상세 설명

**🚨 중요**: 추상적인 설명이 아닌, 위에 제공된 실제 소스코드를 분석한 구체적이고 실무적인 내용으로 작성해주세요.`;

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
    console.error('📋 지원 도구: create_document, search_deliverables, create_table_specification, list_available_sites, set_workspace');
    console.error('🎯 create_document: 개발 산출물 생성 → 로컬 저장 + 백엔드 업로드');
    console.error('🔍 search_deliverables: 개발 산출물 기반 RAG 검색 → AI 업무지식 완성');
    console.error('🔧 set_workspace: 워크스페이스 경로 설정 (IntelliJ 사용 시 첫 실행에만 필요)');
    console.error('🤖 AI 이중 역할: (1)백엔드 템플릿→세분화된 구조 분석 (2)워크스페이스 직접 탐색→실무 내용 생성');
    console.error('💾 통합 워크플로우: 템플릿 분석 → AI 생성 → 로컬 저장 → 백엔드 업로드 → RAG 검색');
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
