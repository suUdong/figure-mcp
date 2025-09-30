#!/usr/bin/env node

/**
 * 🚀 Figure MCP Server V2 - 혁신적 원샷 문서 생성 시스템
 * 
 * 핵심 혁신:
 * - 단일 AI Sampling으로 완전한 문서 생성
 * - 풍부한 컨텍스트 자동 수집
 * - MCP 동시성 문제 완전 해결
 * - 타임아웃 위험 최소화
 * 
 * @version 2.0.0
 * @author Figure MCP Team
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import axios, { AxiosInstance } from 'axios';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { homedir } from 'os';

// 현재 파일의 디렉토리 경로
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 🎯 Figure MCP Server V2 - 완전히 새로운 아키텍처
 */
class FigureMCPServerV2 {
  private server: Server;
  private apiClient: AxiosInstance;
  
  // 설정
  private readonly BACKEND_API_URL = process.env.FIGURE_BACKEND_URL || 'http://localhost:8001';
  private readonly DEFAULT_SITE_NAME = 'KT알파';
  private readonly USER_FOLDER_PATH = path.join(homedir(), 'figure-mcp-documents');
  
  // 상태
  private workspacePath: string | null = null;
  private workspaceResources: any[] = [];
  
  // 캐싱
  private siteCache: Map<string, string> = new Map(); // siteName -> siteId
  private siteCacheExpiry: number = 0;

  constructor() {
    console.error('🚀 Figure MCP Server V2 초기화...');
    
    // MCP 서버 생성
    this.server = new Server(
      {
        name: 'figure-mcp-v2',
        version: '2.0.0'
      },
      {
        capabilities: {
          tools: {},
          resources: {},
          sampling: {} // AI Sampling 기능 활성화
        }
      }
    );

    // HTTP 클라이언트 초기화
    this.apiClient = axios.create({
      baseURL: this.BACKEND_API_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    this.setupHandlers();
    this.initializeUserFolder();
  }

  /**
   * 📁 사용자 폴더 초기화
   */
  private async initializeUserFolder(): Promise<void> {
    try {
      await fs.mkdir(this.USER_FOLDER_PATH, { recursive: true });
      console.error(`📂 문서 저장 폴더: ${this.USER_FOLDER_PATH}`);
    } catch (error) {
      console.error('❌ 사용자 폴더 생성 실패:', error);
    }
  }

  /**
   * 🔧 핸들러 설정
   */
  private setupHandlers(): void {
    // 🛠️ 도구 목록
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'create_document',
          description: '개발 산출물 생성 (예: 영향도분석서, 요구사항명세서 등)',
          inputSchema: {
            type: 'object',
            properties: {
              documentType: {
                type: 'string',
                enum: [
                  'IMPACT_ANALYSIS',      // 영향도분석서
                  'REQUIREMENTS',          // 요구사항명세서
                  'TABLE_SPECIFICATION',   // 테이블정의서
                  'PROGRAM_DESIGN_ONLINE', // 프로그램설계서(온라인)
                  'PROGRAM_DESIGN_BATCH',  // 프로그램설계서(배치)
                  'PROGRAM_DESIGN_COMMON', // 프로그램설계서(공통)
                  'INTERFACE_SPECIFICATION' // 인터페이스정의서
                ],
                description: '문서타입 (영향도분석서=IMPACT_ANALYSIS, 요구사항=REQUIREMENTS)'
              },
              featureName: {
                type: 'string',
                description: '기능명 (예: "로그인", "파일업로드")'
              },
              requirements: {
                type: 'string',
                description: '요구사항 상세 설명 (선택)'
              },
              siteName: {
                type: 'string',
                description: '사이트명 (선택, 기본값: KT알파)',
                default: this.DEFAULT_SITE_NAME
              },
              qualityLevel: {
                type: 'string',
                enum: ['DRAFT', 'STANDARD', 'PREMIUM'],
                description: '품질 (선택, 기본값: STANDARD)',
                default: 'STANDARD'
              },
              includeSourceAnalysis: {
                type: 'boolean',
                description: '소스분석 포함 (선택, 기본값: true)',
                default: true
              },
              autoSave: {
                type: 'boolean', 
                description: '자동저장 (선택, 기본값: true)',
                default: true
              }
            },
            required: ['documentType', 'featureName']
          }
        },
        {
          name: 'set_workspace',
          description: '🔧 워크스페이스 경로를 설정합니다.',
          inputSchema: {
            type: 'object',
            properties: {
              workspacePath: {
                type: 'string',
                description: '분석할 프로젝트의 절대 경로'
              }
            },
            required: ['workspacePath']
          }
        }
      ]
    }));

    // 🛠️ 도구 실행
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'create_document':
            return await this.handleCreateDocument(args as any);
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
          isError: true
        };
      }
    });

    // 📚 리소스 목록  
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => ({
      resources: this.workspaceResources.slice(0, 100) // 상위 100개만
    }));

    // 📖 리소스 읽기
    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const uri = request.params.uri;
      
      try {
        if (uri.startsWith('file://')) {
          const filePath = uri.replace('file://', '');
          const content = await fs.readFile(filePath, 'utf-8');
          
          return {
            contents: [{
              uri,
              text: content.length > 5000 ? content.substring(0, 5000) + '\n\n... (파일이 잘렸습니다)' : content,
              mimeType: this.getMimeType(filePath)
            }]
          };
        }
        
        throw new Error('지원하지 않는 URI 형식');
      } catch (error) {
        return {
          contents: [{
            uri,
            text: `❌ 파일 읽기 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`,
            mimeType: 'text/plain'
          }]
        };
      }
    });
  }

  /**
   * 🚀 메인 문서 생성 핸들러 - 단일 Sampling 기반
   */
  private async handleCreateDocument(args: {
    documentType: string;
    featureName: string;
    requirements?: string;
    siteName?: string;
    qualityLevel?: 'DRAFT' | 'STANDARD' | 'PREMIUM';
    includeSourceAnalysis?: boolean;
    autoSave?: boolean;
  }) {
    const startTime = Date.now();
    const documentId = `doc_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

    try {
      console.error(`🚀 원샷 문서 생성 시작: ${args.documentType} - ${args.featureName}`);

      // Step 1: 풍부한 컨텍스트 수집 (AI 없이, 빠름)
      console.error(`📊 Step 1/3: 컨텍스트 수집 중...`);
      const richContext = await this.gatherRichContext(args);

      // Step 2: 통합 프롬프트 생성
      console.error(`📝 Step 2/3: AI 프롬프트 생성 중...`);
      const unifiedPrompt = this.buildUnifiedPrompt(richContext);

      // Step 3: 단일 AI Sampling 실행
      console.error(`🤖 Step 3/3: AI 원샷 생성 중...`);
      const document = await this.executeSingleSampling(unifiedPrompt, args.qualityLevel || 'STANDARD');

      // Step 4: 결과 처리
      const finalResult = await this.processResult(document, richContext, args, startTime);

      const duration = Date.now() - startTime;
      console.error(`✅ 원샷 문서 생성 완료: ${Math.ceil(duration / 1000)}초`);

      return {
        content: [{
          type: 'text',
          text: this.formatSuccessResponse(finalResult, duration, documentId)
        }],
        metadata: {
          documentId,
          method: 'single_sampling_v2',
          duration,
          success: true,
          ...finalResult.metadata
        }
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`❌ 문서 생성 실패:`, error);

      return {
        content: [{
          type: 'text',
          text: this.formatErrorResponse(error, args, duration, documentId)
        }],
        isError: true,
        metadata: {
          documentId,
          method: 'single_sampling_v2',
          duration,
          success: false,
          error: error instanceof Error ? error.message : '알 수 없는 오류'
        }
      };
    }
  }

  /**
   * 🔍 풍부한 컨텍스트 수집 (AI 사용 안함 - 빠름)
   */
  private async gatherRichContext(args: any) {
    const context = {
      // 기본 정보
      documentType: args.documentType,
      featureName: args.featureName,
      requirements: args.requirements || '',
      siteName: args.siteName || this.DEFAULT_SITE_NAME,
      qualityLevel: args.qualityLevel || 'STANDARD',
      
      // 템플릿 정보
      template: null as any,
      
      // 프로젝트 정보
      projectInfo: null as any,
      
      // 소스코드 분석
      sourceAnalysis: null as any,
      
      // 생성 시간
      timestamp: new Date().toISOString()
    };

    try {
      // 템플릿 로드
      console.error(`📋 템플릿 로드 중...`);
      context.template = await this.loadTemplate(args.documentType, context.siteName);
      
      // 템플릿 내용 로그 출력
      if (context.template) {
        console.error(`\n${'='.repeat(80)}`);
        console.error(`📄 로드된 템플릿: ${context.template.name}`);
        console.error(`${'='.repeat(80)}`);
        console.error(context.template.content);
        console.error(`${'='.repeat(80)}\n`);
        
        if (context.template.instructions) {
          console.error(`📌 템플릿 지침:\n${context.template.instructions}\n`);
        }
        
        if (context.template.guidelines && context.template.guidelines.length > 0) {
          console.error(`📋 가이드라인:`);
          context.template.guidelines.forEach((guideline: string, idx: number) => {
            console.error(`  ${idx + 1}. ${guideline}`);
          });
          console.error('');
        }
      }
      
      // 프로젝트 정보 수집
      console.error(`📂 프로젝트 분석 중...`);
      context.projectInfo = await this.analyzeProject();
      
      // 소스코드 분석 (선택적)
      if (args.includeSourceAnalysis !== false) {
        console.error(`🔍 소스코드 분석 중...`);
        context.sourceAnalysis = await this.analyzeSourceCode(args.featureName);
      }
      
    } catch (error) {
      console.error(`⚠️ 컨텍스트 수집 중 일부 오류:`, error);
      // 일부 실패해도 계속 진행
    }

    return context;
  }

  /**
   * 🔄 documentType을 백엔드 MCP 요청 타입으로 변환
   */
  private convertToMCPRequestType(documentType: string): string {
    // 대문자 언더스코어 → 소문자 언더스코어 변환
    const typeMapping: { [key: string]: string } = {
      'IMPACT_ANALYSIS': 'impact_analysis',
      'REQUIREMENTS': 'requirements', 
      'TABLE_SPECIFICATION': 'table_specification',
      'PROGRAM_DESIGN_ONLINE': 'program_design_online',
      'PROGRAM_DESIGN_BATCH': 'program_design_batch',
      'PROGRAM_DESIGN_COMMON': 'program_design_common',
      'INTERFACE_SPECIFICATION': 'interface_specification',
      'BUSINESS_FLOW': 'business_flow',
      'SEQUENCE_DIAGRAM': 'sequence_diagram'
    };
    
    return typeMapping[documentType] || documentType.toLowerCase();
  }

  /**
   * 🏢 사이트 ID 조회 (캐싱 포함)
   */
  private async getSiteId(siteName: string): Promise<string | null> {
    const now = Date.now();
    const CACHE_DURATION = 10 * 60 * 1000; // 10분 캐싱
    
    // 캐시에서 먼저 확인
    if (now < this.siteCacheExpiry && this.siteCache.has(siteName)) {
      const cached = this.siteCache.get(siteName);
      console.error(`🎯 사이트 캐시 히트: ${siteName} → ${cached}`);
      return cached || null;
    }
    
    // 백엔드에서 사이트 목록 조회
    try {
      console.error(`🔍 사이트 조회 중: ${siteName}`);
      const sitesResponse = await this.apiClient.get('/api/sites');
      
      if (sitesResponse.data.success && sitesResponse.data.data) {
        const sites = sitesResponse.data.data;
        console.error(`📋 조회된 사이트 수: ${sites.length}`);
        
        // 디버깅용 로그
        sites.forEach((site: any) => {
          console.error(`  - ID: ${site.id}, Name: "${site.name}", Company: "${site.company}"`);
        });
        
        // 사이트 찾기: name 또는 company가 일치하는 경우
        const foundSite = sites.find((s: any) => 
          s.name === siteName || s.company === siteName
        );
        
        if (foundSite) {
          console.error(`✅ 사이트 매칭 성공: ${siteName} → ${foundSite.id} (${foundSite.name}/${foundSite.company})`);
          
          // 캐시에 모든 사이트 저장
          this.siteCache.clear();
          sites.forEach((site: any) => {
            this.siteCache.set(site.name, site.id);
            this.siteCache.set(site.company, site.id);
          });
          this.siteCacheExpiry = now + CACHE_DURATION;
          
          return foundSite.id;
        } else {
          console.error(`❌ 사이트 매칭 실패: "${siteName}" (대소문자 구분)`);
          
          // 유사 매칭 시도
          const similarSite = sites.find((s: any) => 
            s.name.toLowerCase().includes(siteName.toLowerCase()) ||
            s.company.toLowerCase().includes(siteName.toLowerCase()) ||
            siteName.toLowerCase().includes(s.name.toLowerCase()) ||
            siteName.toLowerCase().includes(s.company.toLowerCase())
          );
          
          if (similarSite) {
            console.error(`🔄 유사 매칭 발견: ${siteName} ≈ ${similarSite.name}/${similarSite.company} → ${similarSite.id}`);
            return similarSite.id;
          }
        }
      }
      
      return null;
      
    } catch (error) {
      console.error('⚠️ 사이트 조회 실패:');
      if (axios.isAxiosError(error)) {
        console.error(`  - 상태 코드: ${error.response?.status || 'N/A'}`);
        console.error(`  - 메시지: ${error.message}`);
        console.error(`  - 응답 데이터:`, error.response?.data);
      } else {
        console.error(`  - 에러:`, error);
      }
      return null;
    }
  }

  /**
   * 📋 템플릿 로드 (사이트 캐싱 포함)
   */
  private async loadTemplate(documentType: string, siteName: string) {
    try {
      // 1. 사이트 ID 조회 (캐싱 포함)
      const siteId = await this.getSiteId(siteName);

      // 2. documentType을 백엔드가 기대하는 MCP 요청 타입으로 변환
      const mcp_request_type = this.convertToMCPRequestType(documentType);
      const templateUrl = `/api/templates/guide/${mcp_request_type}${siteId ? `?site_id=${siteId}` : ''}`;
      
      console.error(`📋 템플릿 조회: ${templateUrl} ${siteId ? `(사이트: ${siteId})` : '(전역)'}`);
      const response = await this.apiClient.get(templateUrl);
      
      // 응답 상태 확인
      if (!response.data.success) {
        console.error(`❌ 백엔드 응답 실패:`, response.data);
        throw new Error(`백엔드 응답 실패: ${response.data.message || '알 수 없는 오류'}`);
      }
      
      if (response.data.success && response.data.data) {
        const data = response.data.data;
        console.error(`✅ 템플릿 로드 성공: ${data.template ? `${data.template.length}자` : '데이터 없음'}`);
        return {
          content: data.template || '# 기본 템플릿\n\n문서 내용을 여기에 작성해주세요.',
          structure: data.variables || {},
          name: `${documentType}_템플릿`,
          instructions: data.instructions || '',
          guidelines: data.guidelines || []
        };
      }
      
      throw new Error('템플릿 데이터 없음');
      
    } catch (error) {
      console.error('⚠️ 템플릿 로드 실패, 기본 템플릿 사용:');
      if (axios.isAxiosError(error)) {
        console.error(`  - 상태 코드: ${error.response?.status || 'N/A'}`);
        console.error(`  - 메시지: ${error.message}`);
        console.error(`  - 응답 데이터:`, error.response?.data);
      } else {
        console.error(`  - 에러:`, error instanceof Error ? error.message : error);
      }
      
      // 문서 타입별 기본 템플릿
      const defaultTemplates: { [key: string]: string } = {
        'IMPACT_ANALYSIS': `# 영향도 분석서

## 1. 분석 개요
- **대상 기능**: [기능명]
- **분석 범위**: [범위]
- **분석 일자**: [날짜]

## 2. 영향 범위
### 2.1 영향받는 시스템
- [시스템 목록]

### 2.2 영향받는 기능
- [기능 목록]

## 3. 위험도 분석
### 3.1 High 위험
- [고위험 항목]

### 3.2 Medium 위험  
- [중위험 항목]

### 3.3 Low 위험
- [저위험 항목]

## 4. 대응 방안
- [대응 계획]

## 5. 결론 및 권장사항
- [결론]`,
        
        'REQUIREMENTS': `# 요구사항 명세서

## 1. 개요
- **프로젝트명**: [프로젝트명]
- **작성자**: [작성자]
- **작성일**: [날짜]

## 2. 기능 요구사항
### 2.1 주요 기능
- [기능 목록]

### 2.2 상세 요구사항
- [상세 내용]

## 3. 비기능 요구사항
### 3.1 성능 요구사항
- [성능 기준]

### 3.2 보안 요구사항
- [보안 요구사항]

## 4. 제약사항
- [제약 조건]

## 5. 검수 기준
- [검수 항목]`,

        'TABLE_SPECIFICATION': `# 테이블 명세서

## 1. 테이블 개요
- **테이블명**: [테이블명]
- **용도**: [테이블 용도]
- **관련 기능**: [연관 기능]

## 2. 테이블 구조
| 컬럼명 | 데이터타입 | 길이 | NULL허용 | 기본값 | 설명 |
|--------|------------|------|----------|--------|------|
| [컬럼] | [타입] | [길이] | [Y/N] | [기본값] | [설명] |

## 3. 인덱스 정보
- **Primary Key**: [PK 컬럼]
- **Index**: [인덱스 정보]

## 4. 관계 정보
- **참조 테이블**: [외래키 정보]
- **제약 조건**: [제약사항]`
      };

      return {
        content: defaultTemplates[documentType] || defaultTemplates['REQUIREMENTS'],
        structure: {},
        name: '기본_템플릿',
        instructions: '기본 템플릿을 사용하여 문서를 작성합니다.',
        guidelines: []
      };
    }
  }

  /**
   * 📊 프로젝트 분석
   */
  private async analyzeProject() {
    const info = {
      name: 'Unknown Project',
      path: this.workspacePath || 'Not Set',
      fileCount: this.workspaceResources.length,
      structure: [] as any[],
      technologies: [] as string[]
    };

    try {
      if (this.workspacePath) {
        // 프로젝트명 추출
        info.name = path.basename(this.workspacePath);
        
        // 파일 구조 분석 (상위 20개)
        info.structure = this.workspaceResources.slice(0, 20).map(r => ({
          path: r.uri.replace('file://', ''),
          description: r.description || 'No description'
        }));

        // 기술 스택 추정
        const extensions = this.workspaceResources
          .map(r => path.extname(r.uri))
          .filter(ext => ext.length > 0);
        
        const techMap: { [key: string]: string } = {
          '.ts': 'TypeScript',
          '.js': 'JavaScript', 
          '.tsx': 'React',
          '.py': 'Python',
          '.java': 'Java',
          '.cs': 'C#',
          '.go': 'Go'
        };

        info.technologies = [...new Set(extensions.map(ext => techMap[ext]).filter(Boolean))];
      }
    } catch (error) {
      console.error('⚠️ 프로젝트 분석 실패:', error);
    }

    return info;
  }

  /**
   * 🔍 검색 키워드 확장 (한글 → 영어, 동의어 추가)
   */
  private expandSearchKeywords(featureName: string): string[] {
    const keywords = [featureName.toLowerCase()];
    const feature = featureName.toLowerCase();
    
    // 한글 → 영어 매핑
    const koToEnMap: { [key: string]: string[] } = {
      '로그인': ['login', 'signin', 'auth', 'authentication'],
      '로그아웃': ['logout', 'signout'],
      '회원가입': ['signup', 'register', 'registration'],
      '인증': ['auth', 'authentication', 'verify'],
      '권한': ['permission', 'role', 'authorization'],
      '사용자': ['user', 'account', 'member'],
      '관리자': ['admin', 'administrator', 'manager'],
      '대시보드': ['dashboard', 'main', 'home'],
      '설정': ['setting', 'config', 'preference'],
      '프로필': ['profile', 'account'],
      '비밀번호': ['password', 'pwd', 'credential'],
      '검색': ['search', 'query', 'find'],
      '필터': ['filter', 'sort'],
      '페이지': ['page', 'pagination'],
      '목록': ['list', 'table', 'grid'],
      '상세': ['detail', 'view', 'show'],
      '등록': ['create', 'add', 'new', 'insert'],
      '수정': ['update', 'edit', 'modify'],
      '삭제': ['delete', 'remove', 'destroy'],
      '저장': ['save', 'submit'],
      '취소': ['cancel', 'close'],
      '확인': ['confirm', 'ok'],
      '알림': ['notification', 'alert', 'message'],
      '파일': ['file', 'upload', 'download'],
      '이미지': ['image', 'picture', 'photo'],
      '문서': ['document', 'doc', 'file'],
      '게시판': ['board', 'post', 'article'],
      '댓글': ['comment', 'reply'],
      '좋아요': ['like', 'favorite'],
      '공유': ['share'],
      '결제': ['payment', 'pay', 'checkout'],
      '주문': ['order', 'purchase'],
      '장바구니': ['cart', 'basket'],
      '배송': ['delivery', 'shipping'],
      '리뷰': ['review', 'rating'],
    };
    
    // 매핑된 영어 키워드 추가
    for (const [ko, enList] of Object.entries(koToEnMap)) {
      if (feature.includes(ko)) {
        keywords.push(...enList);
      }
    }
    
    // 공백을 언더스코어/하이픈으로 변환
    if (feature.includes(' ')) {
      keywords.push(feature.replace(/ /g, '_'));
      keywords.push(feature.replace(/ /g, '-'));
      keywords.push(feature.replace(/ /g, ''));
    }
    
    return [...new Set(keywords)]; // 중복 제거
  }

  /**
   * 🎯 핵심 키워드만 추출 (너무 범용적인 키워드 제외)
   */
  private extractCoreKeywords(featureName: string): string[] {
    const feature = featureName.toLowerCase();
    
    // 제외할 너무 범용적인 단어들
    const excludeWords = ['시스템', '구현', '개발', '관리', '처리', '기능', '화면', '내용'];
    
    // 공백과 특수문자로 분리
    const words = feature.split(/[\s,.\-_]+/).filter(w => 
      w.length > 1 && !excludeWords.includes(w)
    );
    
    // 핵심 키워드만 한영 변환
    const coreKeywords: string[] = [...words];
    
    const coreMap: { [key: string]: string[] } = {
      '로그인': ['login', 'signin'],
      '인증': ['auth'],
      '피드백': ['feedback'],
      '검색': ['search'],
      '결과': ['result'],
      '문서': ['document', 'doc'],
      '업로드': ['upload'],
      '다운로드': ['download'],
      '파일': ['file']
    };
    
    for (const [ko, enList] of Object.entries(coreMap)) {
      if (feature.includes(ko)) {
        coreKeywords.push(...enList);
      }
    }
    
    return [...new Set(coreKeywords)];
  }

  /**
   * 📊 파일 관련성 점수 계산
   */
  private scoreFileRelevance(filePath: string, keywords: string[]): number {
    const path_lower = filePath.toLowerCase();
    let score = 0;
    
    // 1. 파일 타입 점수 (실제 구현 코드 우선)
    const codeExtensions = ['.tsx', '.ts', '.jsx', '.js', '.py', '.java'];
    const docExtensions = ['.md', '.txt', '.json'];
    
    if (codeExtensions.some(ext => path_lower.endsWith(ext))) {
      score += 10;
    } else if (docExtensions.some(ext => path_lower.endsWith(ext))) {
      score -= 5; // 문서 파일은 우선순위 낮춤
    }
    
    // 2. 디렉토리 점수 (구현 디렉토리 우선)
    const priorityDirs = ['components', 'pages', 'api', 'services', 'hooks', 'app'];
    const excludeDirs = ['node_modules', 'dist', 'build', '.git', 'data', 'backups'];
    
    if (priorityDirs.some(dir => path_lower.includes(`/${dir}/`) || path_lower.includes(`\\${dir}\\`))) {
      score += 5;
    }
    if (excludeDirs.some(dir => path_lower.includes(dir))) {
      score -= 20; // 제외 디렉토리는 완전 배제
    }
    
    // 3. 키워드 매칭 점수
    keywords.forEach(keyword => {
      if (keyword.length > 2 && path_lower.includes(keyword)) {
        score += 3;
      }
    });
    
    return score;
  }

  /**
   * 🔍 소스코드 분석 (실제 코드 내용 포함, 개선됨)
   */
  private async analyzeSourceCode(featureName: string) {
    const analysis = {
      summary: `${featureName} 관련 분석`,
      relatedFiles: [] as any[],
      keyComponents: [] as any[]
    };

    try {
      // 핵심 키워드만 추출 (범용 키워드 제외)
      const coreKeywords = this.extractCoreKeywords(featureName);
      console.error(`🔍 핵심 키워드: ${coreKeywords.join(', ')}`);
      
      // 파일 관련성 점수 계산 및 정렬
      const scoredFiles = this.workspaceResources
        .map(r => ({
          resource: r,
          score: this.scoreFileRelevance(r.uri, coreKeywords)
        }))
        .filter(f => f.score > 0) // 관련성 있는 파일만
        .sort((a, b) => b.score - a.score) // 점수 높은 순
        .slice(0, 5); // 상위 5개
      
      console.error(`📊 관련 파일 ${scoredFiles.length}개 발견 (점수순 정렬)`);
      
      // 점수와 함께 파일 목록 출력
      scoredFiles.forEach((sf, idx) => {
        console.error(`  ${idx + 1}. [점수: ${sf.score}] ${path.basename(sf.resource.uri)}`);
      });
      
      const relevantFiles = scoredFiles.map(f => f.resource);

      // 실제 파일 내용 읽기
      for (const file of relevantFiles) {
        try {
          const filePath = file.uri.replace('file://', '');
          const content = await fs.readFile(filePath, 'utf-8');
          
          // 파일이 너무 크면 일부만 (최대 500줄로 축소 - 토큰 절약)
          const lines = content.split('\n');
          const truncated = lines.length > 500;
          const finalContent = truncated ? lines.slice(0, 500).join('\n') : content;
          
          analysis.relatedFiles.push({
            path: filePath,
            description: file.description || 'Related file',
            content: finalContent,
            truncated,
            totalLines: lines.length,
            language: path.extname(filePath).substring(1)
          });
          
          console.error(`  ✓ 읽기 성공: ${path.basename(filePath)} (${lines.length}줄)`);
        } catch (error) {
          // 파일 읽기 실패 시 경로만 포함
          console.error(`⚠️ 파일 읽기 실패: ${file.uri} - ${error instanceof Error ? error.message : error}`);
          analysis.relatedFiles.push({
            path: file.uri.replace('file://', ''),
            description: file.description || 'Related file (content unavailable)',
            content: null,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      analysis.summary = `${featureName} 관련 ${analysis.relatedFiles.length}개 파일 발견 (${analysis.relatedFiles.filter(f => f.content).length}개 읽기 성공)`;

    } catch (error) {
      console.error('⚠️ 소스코드 분석 실패:', error);
    }

    return analysis;
  }

  /**
   * ✅ 프로젝트 컨텍스트 유효성 검사
   */
  private hasValidProjectContext(context: any): boolean {
    const projectInfo = context.projectInfo;
    const sourceAnalysis = context.sourceAnalysis;
    
    // 프로젝트 정보가 유효한지 확인
    const hasValidProjectInfo = projectInfo && 
      projectInfo.name !== 'Unknown Project' &&
      projectInfo.path !== 'Not Set' &&
      projectInfo.fileCount > 0;
    
    // 소스코드 분석이 유효한지 확인
    const hasValidSourceAnalysis = sourceAnalysis && 
      sourceAnalysis.relatedFiles && 
      sourceAnalysis.relatedFiles.length > 0;
    
    // 둘 중 하나라도 유효하면 프로젝트 컨텍스트 섹션 표시
    return hasValidProjectInfo || hasValidSourceAnalysis;
  }

  /**
   * 📝 통합 프롬프트 생성
   */
  private buildUnifiedPrompt(context: any): string {
    const qualitySettings = this.getQualitySettings(context.qualityLevel);
    
    return `# 전문 개발 산출물 생성 요청

## 🎯 생성 목표
- **문서 타입**: ${context.documentType}
- **기능명**: ${context.featureName}
- **품질 레벨**: ${context.qualityLevel}
- **사이트**: ${context.siteName}

## 📋 요구사항
${context.requirements || '기본 요구사항에 따라 생성해주세요.'}

${this.hasValidProjectContext(context) ? `## 🏗️ 프로젝트 컨텍스트

### 프로젝트 정보
- **프로젝트명**: ${context.projectInfo?.name}
- **경로**: ${context.projectInfo?.path}
- **파일 수**: ${context.projectInfo?.fileCount}개
- **주요 기술**: ${context.projectInfo?.technologies?.join(', ')}

${context.projectInfo?.structure?.length > 0 ? `### 주요 파일 구조
${context.projectInfo.structure.map((file: any) => 
  `- **${file.path}**: ${file.description}`
).join('\n')}` : ''}

${context.sourceAnalysis?.relatedFiles?.length > 0 ? `### 관련 소스코드
${context.sourceAnalysis.summary}

${context.sourceAnalysis.relatedFiles.map((file: any) => {
  if (!file.content) {
    return `#### 📄 ${path.basename(file.path)}
- **경로**: \`${file.path}\`
- **설명**: ${file.description}
- **상태**: 읽기 실패 (${file.error || '알 수 없는 오류'})`;
  }
  
  return `#### 📄 ${path.basename(file.path)}
- **경로**: \`${file.path}\`
- **언어**: ${file.language}
- **줄 수**: ${file.totalLines}줄${file.truncated ? ` (처음 1000줄만 표시)` : ''}

\`\`\`${file.language}
${file.content}
\`\`\``;
}).join('\n\n')}` : ''}` : ''}

## 📖 템플릿 기준
다음 템플릿 구조를 **완전히 준수**하여 생성하세요:

\`\`\`markdown
${context.template?.content || '# 기본 구조\n\n## 1. 개요\n## 2. 상세내용\n## 3. 결론'}
\`\`\`

## 🎨 생성 지침
${qualitySettings.description}

**출력**: 한국어 마크다운, 실무 즉시 사용 가능, 모든 섹션 완전 작성, 구체적 파일명/함수명 포함

## 필수 MCP Resources 활용
위에 제공된 소스는 초기 참고용입니다. **MCP Resources로 추가 파일을 직접 읽어** 정확성을 높이세요.

## 생성 요청
위 템플릿 구조를 준수하여 **실무용 ${context.documentType} 문서**를 생성하세요.

생성 시점: ${context.timestamp}`;
  }

  /**
   * 🎚️ 품질 레벨별 설정
   */
  private getQualitySettings(level: string) {
    const settings = {
      DRAFT: {
        maxTokens: 1500,
        description: '간결하고 핵심적인 내용 위주로 작성. 기본 구조와 핵심 정보만 포함.',
        estimatedTime: '5-10초'
      },
      STANDARD: {
        maxTokens: 2500,
        description: '균형잡힌 상세도로 실무에서 활용 가능한 수준. 모든 섹션을 완전히 작성.',
        estimatedTime: '10-20초'  
      },
      PREMIUM: {
        maxTokens: 4000,
        description: '최고 수준의 상세도와 완성도. 추가 인사이트, 권장사항, 심화 내용 포함.',
        estimatedTime: '20-40초'
      }
    };

    return settings[level as keyof typeof settings] || settings.STANDARD;
  }

  /**
   * 🤖 단일 AI Sampling 실행
   */
  private async executeSingleSampling(prompt: string, qualityLevel: string) {
    const settings = this.getQualitySettings(qualityLevel);
    
    console.error(`🤖 AI 생성 중... (${settings.maxTokens} 토큰, 예상 시간: ${settings.estimatedTime})`);

    const samplingRequest = {
      messages: [{
        role: 'user' as const,
        content: {
          type: 'text' as const,
          text: prompt
        }
      }],
      maxTokens: settings.maxTokens
    };
    
    // Sampling 요청 데이터 로깅
    console.error(`\n${'='.repeat(80)}`);
    console.error(`📡 AI Sampling 요청 데이터`);
    console.error(`${'='.repeat(80)}`);
    console.error(`- 최대 토큰: ${samplingRequest.maxTokens}`);
    console.error(`- 메시지 수: ${samplingRequest.messages.length}`);
    console.error(`- 프롬프트 길이: ${prompt.length.toLocaleString()}자`);
    console.error(`- 프롬프트 줄 수: ${prompt.split('\n').length}줄`);
    console.error(`${'='.repeat(80)}`);
    console.error(`\n📝 전송될 프롬프트 내용:\n`);
    console.error(prompt);
    console.error(`\n${'='.repeat(80)}\n`);

    const response = await this.server.createMessage(samplingRequest);

    return {
      content: response.content.type === 'text' ? response.content.text : String(response.content),
      tokensUsed: settings.maxTokens,
      model: response.model || 'unknown',
      stopReason: response.stopReason || 'completed',
      qualityLevel
    };
  }

  /**
   * 💾 결과 처리 (저장 및 백엔드 업로드)
   */
  private async processResult(document: any, context: any, args: any, startTime: number) {
    const fileName = `${args.documentType}_${args.featureName.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.md`;
    
    let savedPath = '';
    let backendUploadResult = { documentId: '', uploadSuccess: false };
    
    if (args.autoSave !== false) {
      try {
        const fullPath = path.join(this.USER_FOLDER_PATH, fileName);
        const content = this.formatDocumentForSave(document, context);
        
        await fs.writeFile(fullPath, content, 'utf-8');
        savedPath = fullPath;
        console.error(`💾 문서 저장 완료: ${fullPath}`);
        
        // 백엔드에 자동 업로드
        const siteId = await this.getSiteId(args.siteName || this.DEFAULT_SITE_NAME);
        backendUploadResult = await this.uploadToBackend(document.content, {
          documentType: args.documentType,
          featureName: args.featureName,
          qualityLevel: context.qualityLevel,
          generatedAt: context.timestamp,
          aiModel: document.model,
          tokensUsed: document.tokensUsed,
          projectName: context.projectInfo?.name,
          sourceFilesAnalyzed: context.sourceAnalysis?.relatedFiles?.length || 0,
          processingTime: Date.now() - startTime,
          method: 'single_sampling',
          documentId: `mcp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        }, siteId);
        
      } catch (error) {
        console.error('⚠️ 문서 저장 실패:', error);
      }
    }

    return {
      content: document.content,
      fileName,
      savedPath,
      contentLength: document.content.length,
      backendDocumentId: backendUploadResult.documentId,
      backendUploadSuccess: backendUploadResult.uploadSuccess,
      metadata: {
        tokensUsed: document.tokensUsed,
        model: document.model,
        qualityLevel: document.qualityLevel,
        projectFiles: context.projectInfo?.fileCount || 0,
        relatedFiles: context.sourceAnalysis?.relatedFiles?.length || 0,
        templateUsed: context.template?.name || 'Unknown'
      }
    };
  }

  /**
   * 📤 백엔드에 문서 업로드
   */
  private async uploadToBackend(content: string, metadata: any, siteId: string | null): Promise<{ documentId: string; uploadSuccess: boolean }> {
    try {
      console.error('📤 백엔드에 문서 업로드 중...');
      
      // 문서 타입 매핑 (MCP → 백엔드)
      const docType = 'text'; // 생성된 마크다운 문서는 text 타입
      
      // 제목 생성
      const title = `${this.getDocumentTypeDisplayName(metadata.documentType)} - ${metadata.featureName}`;
      
      // 메타데이터 구성 (null/undefined 값 방지, 배열을 문자열로 변환)
      const tags = [
        `mcp:${(metadata.documentType || 'unknown').toLowerCase()}`,
        `project:${metadata.projectName || 'unknown'}`,
        `quality:${(metadata.qualityLevel || 'standard').toLowerCase()}`,
        `generator:figure-mcp`,
        'auto-generated'
      ].join(', '); // 쉼표로 구분된 문자열로 변환
      
      const documentMetadata: Record<string, string | number | boolean> = {
        // 기본 정보
        documentType: String(metadata.documentType || 'unknown'),
        featureName: String(metadata.featureName || 'unknown'),
        qualityLevel: String(metadata.qualityLevel || 'STANDARD'),
        
        // 문서 카테고리 (RAG 필터링용)
        documentCategory: 'completed_artifact', // 템플릿이 아닌 완성된 산출물
        isTemplate: false, // 템플릿 여부 명시
        
        // 생성 정보
        generatedAt: String(metadata.generatedAt || new Date().toISOString()),
        generatedBy: 'figure-mcp',
        generatorVersion: '2.0.0',
        
        // AI 정보
        aiModel: String(metadata.aiModel || 'claude-3-5-sonnet'),
        tokensUsed: Number(metadata.tokensUsed || 0),
        contentLength: Number(content.length),
        
        // 프로젝트 정보
        projectName: String(metadata.projectName || 'unknown'),
        sourceFilesAnalyzed: Number(metadata.sourceFilesAnalyzed || 0),
        
        // 처리 정보
        processingTime: Number(metadata.processingTime || 0),
        method: String(metadata.method || 'single_sampling'),
        
        // 태그 (쉼표로 구분된 문자열)
        tags: tags
      };
      
      // undefined/null 값 제거
      const cleanMetadata = Object.fromEntries(
        Object.entries(documentMetadata).filter(([_, value]) => 
          value !== null && value !== undefined
        )
      );
      
      // 백엔드 API 호출
      const uploadData = {
        title,
        content,
        doc_type: docType,
        site_id: siteId,
        source_url: `figure-mcp://document/${metadata.documentId || 'unknown'}`,
        metadata: cleanMetadata
      };
      
      console.error(`📋 업로드 데이터: 제목="${title}", 사이트=${siteId}, 크기=${content.length}자`);
      
      const response = await this.apiClient.post('/api/documents/upload', uploadData);
      
      if (response.data.success) {
        const documentId = response.data.data?.document_id || response.data.data?.id || 'unknown';
        console.error(`✅ 백엔드 업로드 성공: ${documentId}`);
        return { documentId, uploadSuccess: true };
      } else {
        console.error('⚠️ 백엔드 업로드 응답 오류:', response.data);
        return { documentId: '', uploadSuccess: false };
      }
      
    } catch (error) {
      console.error('❌ 백엔드 업로드 실패:');
      if (axios.isAxiosError(error)) {
        console.error(`  - 상태 코드: ${error.response?.status || 'N/A'}`);
        console.error(`  - 메시지: ${error.message}`);
        console.error(`  - URL: ${error.config?.url}`);
        console.error(`  - 응답 데이터:`, error.response?.data);
      } else {
        console.error(`  - 에러:`, error instanceof Error ? error.message : error);
      }
      return { documentId: '', uploadSuccess: false };
    }
  }
  
  /**
   * 📋 문서 타입 표시명 반환
   */
  private getDocumentTypeDisplayName(documentType: string): string {
    const typeNames: { [key: string]: string } = {
      'IMPACT_ANALYSIS': '영향도분석서',
      'REQUIREMENTS': '요구사항정의서',
      'TABLE_SPECIFICATION': '테이블정의서',
      'PROGRAM_DESIGN_ONLINE': '프로그램설계서(온라인)',
      'PROGRAM_DESIGN_BATCH': '프로그램설계서(배치)',
      'PROGRAM_DESIGN_COMMON': '프로그램설계서(공통)',
      'INTERFACE_SPECIFICATION': '인터페이스정의서',
      'BUSINESS_FLOW': '목표업무흐름도',
      'SEQUENCE_DIAGRAM': '시퀀스다이어그램'
    };
    
    return typeNames[documentType] || documentType;
  }

  /**
   * 📄 저장용 문서 포맷팅
   */
  private formatDocumentForSave(document: any, context: any): string {
    return `<!-- 
생성 정보:
- 생성 시간: ${context.timestamp}
- 문서 타입: ${context.documentType}
- 기능명: ${context.featureName}
- 품질 레벨: ${context.qualityLevel}
- 프로젝트: ${context.projectInfo?.name}
- AI 모델: ${document.model}
- 토큰 사용: ${document.tokensUsed}
-->

${document.content}`;
  }

  /**
   * ✅ 성공 응답 포맷팅
   */
  private formatSuccessResponse(result: any, duration: number, documentId: string): string {
    return `🚀 **원샷 문서 생성 완료**

**🆔 문서 ID**: \`${documentId}\`
**⏱️ 처리 시간**: ${Math.ceil(duration / 1000)}초
**📊 품질 레벨**: ${result.metadata.qualityLevel}

## 📄 **생성된 문서**

${result.content}

## 📈 **생성 통계**

✅ **AI 토큰 사용**: ${result.metadata.tokensUsed}토큰
✅ **문서 길이**: ${result.contentLength.toLocaleString()}자
✅ **프로젝트 파일**: ${result.metadata.projectFiles}개 분석
✅ **관련 파일**: ${result.metadata.relatedFiles}개 발견
✅ **템플릿**: ${result.metadata.templateUsed}

${result.savedPath ? `## 💾 **로컬 저장 완료**

**저장 위치**: \`${result.savedPath}\`
**파일명**: \`${result.fileName}\`` : ''}

${result.backendUploadSuccess ? `## 📤 **백엔드 업로드 성공**

**업로드된 문서 ID**: \`${result.backendDocumentId}\`
**백엔드 위치**: 개발 산출물 데이터베이스
**필터링**: 문서 타입, 프로젝트, 품질별 검색 가능
**접근**: 백오피스 > 문서 관리에서 확인 가능` : result.savedPath ? `## ⚠️ **백엔드 업로드 실패**

로컬 파일은 정상 저장되었으나 백엔드 업로드에 실패했습니다.
백엔드 서비스 상태를 확인해주세요.` : ''}

**🎯 완성**: 실무에서 바로 사용 가능한 전문 개발 산출물이 생성되었습니다!

## 🚀 **사용법**
\`\`\`
@figure-mcp create_document "기능명" "문서타입" qualityLevel="STANDARD"
\`\`\``;
  }

  /**
   * ❌ 오류 응답 포맷팅
   */
  private formatErrorResponse(error: any, args: any, duration: number, documentId: string): string {
    return `❌ **원샷 문서 생성 실패**

**🆔 문서 ID**: \`${documentId}\`
**기능**: ${args.featureName}
**문서 타입**: ${args.documentType}
**처리 시간**: ${Math.ceil(duration / 1000)}초
**오류**: ${error instanceof Error ? error.message : '알 수 없는 오류'}

## 🔧 **문제 해결**

1. **백엔드 서비스 확인**: ${this.BACKEND_API_URL}
2. **워크스페이스 설정**: \`set_workspace\` 도구로 프로젝트 경로 설정
3. **네트워크 연결** 상태 확인
4. **요구사항을 더 구체적으로** 작성해보세요

## 🚀 **빠른 재시도**

### 품질 레벨을 낮춰서 시도:
\`\`\`
@figure-mcp create_document "${args.featureName}" "${args.documentType}" qualityLevel="DRAFT"
\`\`\`

### 워크스페이스 설정 후 재시도:
\`\`\`
@figure-mcp set_workspace "C:/your/project/path"
@figure-mcp create_document "${args.featureName}" "${args.documentType}"
\`\`\``;
  }

  /**
   * 🔧 워크스페이스 설정
   */
  private async handleSetWorkspace(args: { workspacePath: string }) {
    try {
      const normalizedPath = path.resolve(args.workspacePath);
      
      // 경로 존재 확인
      await fs.access(normalizedPath);
      
      this.workspacePath = normalizedPath;
      console.error(`🔧 워크스페이스 설정: ${normalizedPath}`);
      
      // 리소스 스캔
      await this.scanWorkspaceResources();
      
      return {
        content: [{
          type: 'text',
          text: `🔧 **워크스페이스 설정 완료**

**경로**: \`${normalizedPath}\`
**스캔된 리소스**: ${this.workspaceResources.length}개

## 📁 **주요 파일들** (상위 10개)

${this.workspaceResources.slice(0, 10).map(r => 
  `- \`${r.uri.replace('file://', '')}\`: ${r.description || 'No description'}`
).join('\n')}

${this.workspaceResources.length > 10 ? `\n... 그 외 ${this.workspaceResources.length - 10}개 파일` : ''}

## 🚀 **다음 단계**
이제 문서를 생성할 수 있습니다:
\`\`\`
@figure-mcp create_document "기능명" "IMPACT_ANALYSIS"
\`\`\``
        }],
        metadata: {
          workspacePath: normalizedPath,
          resourceCount: this.workspaceResources.length
        }
      };
      
    } catch (error) {
      return {
        content: [{
          type: 'text', 
          text: `❌ **워크스페이스 설정 실패**

**경로**: ${args.workspacePath}
**오류**: ${error instanceof Error ? error.message : '알 수 없는 오류'}

**올바른 경로 예시**:
- Windows: \`C:\\workspace\\my-project\`
- Mac/Linux: \`/Users/username/workspace/my-project\``
        }],
        isError: true
      };
    }
  }

  /**
   * 📂 워크스페이스 리소스 스캔
   */
  private async scanWorkspaceResources(): Promise<void> {
    if (!this.workspacePath) {
      return;
    }

    try {
      console.error(`📂 워크스페이스 스캔 중: ${this.workspacePath}`);
      
      const resources: any[] = [];
      const extensions = ['.ts', '.js', '.tsx', '.jsx', '.py', '.java', '.cs', '.go', '.md', '.json'];
      
      const scanDir = async (dirPath: string, depth: number = 0) => {
        if (depth > 3) return; // 깊이 제한

        try {
          const items = await fs.readdir(dirPath);
          
          for (const item of items) {
            if (item.startsWith('.') || item === 'node_modules') continue;
            
            const fullPath = path.join(dirPath, item);
            const stat = await fs.stat(fullPath);
            
            if (stat.isDirectory()) {
              await scanDir(fullPath, depth + 1);
            } else if (stat.isFile()) {
              const ext = path.extname(item);
              if (extensions.includes(ext)) {
                const relativePath = path.relative(this.workspacePath!, fullPath);
                resources.push({
                  uri: `file://${fullPath}`,
                  name: item,
                  description: `${ext.substring(1).toUpperCase()} file: ${relativePath}`,
                  mimeType: this.getMimeType(fullPath)
                });
              }
            }
          }
        } catch (error) {
          // 개별 디렉토리 오류는 무시
        }
      };

      await scanDir(this.workspacePath);
      
      this.workspaceResources = resources.slice(0, 200); // 최대 200개
      console.error(`📊 리소스 스캔 완료: ${this.workspaceResources.length}개 파일`);
      
    } catch (error) {
      console.error('❌ 워크스페이스 스캔 실패:', error);
      this.workspaceResources = [];
    }
  }

  /**
   * 📎 MIME 타입 결정
   */
  private getMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes: { [key: string]: string } = {
      '.ts': 'text/typescript',
      '.js': 'text/javascript',
      '.tsx': 'text/tsx',
      '.jsx': 'text/jsx',
      '.py': 'text/python',
      '.java': 'text/java',
      '.cs': 'text/csharp',
      '.go': 'text/go',
      '.md': 'text/markdown',
      '.json': 'application/json'
    };
    
    return mimeTypes[ext] || 'text/plain';
  }

  /**
   * 🚀 서버 시작
   */
  async run(): Promise<void> {
    try {
      console.error('🚀 Figure MCP Server V2 시작...');
      console.error('📡 백엔드 API:', this.BACKEND_API_URL);
      console.error('📁 문서 저장 폴더:', this.USER_FOLDER_PATH);
      
      const transport = new StdioServerTransport();
      await this.server.connect(transport);
      
      console.error('✅ Figure MCP Server V2 준비 완료!');
      console.error('');
      console.error('🎯 사용법:');
      console.error('1. 워크스페이스 설정: @figure-mcp set_workspace "C:/your/project"');
      console.error('2. 문서 생성: @figure-mcp create_document "OAuth인증" "IMPACT_ANALYSIS"');
      console.error('');
      
    } catch (error) {
      console.error('❌ 서버 시작 실패:', error);
      process.exit(1);
    }
  }
}

// 서버 실행
const server = new FigureMCPServerV2();
server.run().catch((error) => {
  console.error('❌ 실행 중 오류:', error);
  process.exit(1);
});
