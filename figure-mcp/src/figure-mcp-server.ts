#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import axios, { AxiosInstance } from 'axios';
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
  private readonly BACKEND_API_URL: string;
  private readonly CACHE_DIR: string;
  private readonly CACHE_TTL: number = 60 * 60 * 1000; // 1시간 (밀리초)

  constructor() {
    this.BACKEND_API_URL = process.env.BACKEND_API_URL || 'http://localhost:8001/api';
    this.CACHE_DIR = path.join(process.cwd(), '.cache', 'figure-mcp');
    
    // 캐시 디렉토리 생성
    this.initializeCacheDirectory();
    
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
    // 단일 통합 도구만 제공
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'create_impact_analysis',
            description: '기능명을 입력받아 영향도 분석서를 생성합니다. 백엔드에서 템플릿을 조회하고 LLM이 코드베이스를 분석하여 완전한 분석서를 작성합니다.',
            inputSchema: {
              type: 'object',
              properties: {
                featureName: { 
                  type: 'string', 
                  description: '분석할 기능명 (예: ABC 기능, 결제 시스템, 사용자 인증 등)' 
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
                }
              },
              required: ['featureName'],
            },
          },
          {
            name: 'list_available_sites',
            description: '사용 가능한 사이트 목록을 조회합니다.',
            inputSchema: {
              type: 'object',
              properties: {},
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
          case 'create_impact_analysis': 
            return await this.handleCreateImpactAnalysis(args as any);
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

  /**
   * 핵심 기능: 영향도 분석서 생성
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
   * 템플릿만 반환하는 응답 생성
   */
  private async generateTemplateOnlyResponse(featureName: string, site: any, templateData: any, startTime: Date) {
    const processingTime = Date.now() - startTime.getTime();
    
    return {
      content: [{
        type: 'text',
        text: `📋 **${featureName} - 영향도 분석서 템플릿**

🏢 **대상 사이트**: ${site.name} (${site.id})
⏰ **조회 시간**: ${new Date().toLocaleString('ko-KR')}
🚀 **처리 시간**: ${processingTime}ms

## 📝 **작성 지침**
${templateData.instructions || '표준 영향도 분석서 작성 지침을 따르세요.'}

## 📄 **템플릿**
\`\`\`markdown
${templateData.template}
\`\`\`

💡 **다음 단계**: 이 템플릿을 기반으로 ${featureName}의 구체적인 내용을 작성하세요.`
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
    
    console.error(`🚀 Figure MCP Server v2.0 시작됨`);
    console.error(`📡 Backend API: ${this.BACKEND_API_URL}`);
    console.error(`📁 캐시 디렉토리: ${this.CACHE_DIR}`);
    console.error(`⏰ 캐시 TTL: ${this.CACHE_TTL / 1000}초`);
    console.error(`🎯 영향도 분석서 생성 전용 서버`);
    console.error(`⚡ 워크플로우: 사용자 요청 → MCP → 백엔드(캐싱) → SQLite → 템플릿 → LLM 분석`);
  }
}

// 서버 시작
const mcpServer = new FigureMCPServer();
mcpServer.start().catch((error) => {
  console.error('MCP 서버 시작 중 오류:', error);
  process.exit(1);
});
