#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import axios, { AxiosInstance } from 'axios';

/**
 * Figure MCP Proxy Server
 * Docker 컨테이너에서 실행되는 Figure Backend와 통신하는 중계 서버
 * 영향도 분석서 작성을 위한 전문 도구들 제공
 */
class FigureMCPProxy {
  private server: Server;
  private apiClient: AxiosInstance;
  private readonly BACKEND_API_URL: string;

  constructor() {
    this.BACKEND_API_URL = process.env.BACKEND_API_URL || 'http://localhost:8001/api';
    
    this.server = new Server(
      {
        name: 'figure-mcp-proxy',
        version: '1.0.0',
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
    // 도구 목록 제공 - 기존 MCP 서버의 모든 기능 포함
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'use_design_figure',
            description: '사이트별 개발 표준을 기반으로 Jira 티켓의 요구사항에 맞는 산출물을 생성합니다.',
            inputSchema: {
              type: 'object',
              properties: {
                sitename: { type: 'string', description: '사이트명 (예: shop, admin, api)' },
                jiraTicketId: { type: 'string', description: 'Jira 티켓 ID (예: SHOP-123)' },
                format: { type: 'string', enum: ['code', 'documentation', 'both'], default: 'both' },
              },
              required: ['sitename', 'jiraTicketId'],
            },
          },
          {
            name: 'method_dependency_matrix',
            description: '소스 코드를 분석하여 메서드 간 의존성 매트릭스를 생성합니다.',
            inputSchema: {
              type: 'object',
              properties: {
                projectPath: { type: 'string', description: '분석할 프로젝트 경로' },
                language: { type: 'string', enum: ['java', 'python', 'javascript', 'typescript', 'csharp'], default: 'java' },
                targetClass: { type: 'string', description: '분석할 특정 클래스명 (선택사항)' },
              },
              required: ['projectPath', 'language'],
            },
          },
          {
            name: 'table_schema',
            description: '데이터베이스 스키마 정보를 분석하여 테이블 구조와 관계를 추출합니다.',
            inputSchema: {
              type: 'object',
              properties: {
                databaseType: { type: 'string', enum: ['mysql', 'postgresql', 'oracle', 'mssql', 'sqlite'] },
                connectionString: { type: 'string', description: '데이터베이스 연결 문자열 (선택사항)' },
                schemaFile: { type: 'string', description: 'DDL 스키마 파일 경로' },
                targetTables: { type: 'array', items: { type: 'string' }, description: '분석할 특정 테이블 목록' },
              },
              required: ['databaseType'],
            },
          },
          {
            name: 'circular_dependency_detection',
            description: '소스 코드에서 순환 의존성을 탐지하고 분석합니다.',
            inputSchema: {
              type: 'object',
              properties: {
                projectPath: { type: 'string', description: '분석할 프로젝트 경로' },
                language: { type: 'string', enum: ['java', 'python', 'javascript', 'typescript', 'csharp'], default: 'java' },
                maxDepth: { type: 'number', description: '최대 탐지 깊이', default: 10 },
              },
              required: ['projectPath', 'language'],
            },
          },
          {
            name: 'impact_score_calculation',
            description: '변경 대상의 영향도 점수를 자동으로 계산합니다.',
            inputSchema: {
              type: 'object',
              properties: {
                projectPath: { type: 'string', description: '분석할 프로젝트 경로' },
                targetFiles: { type: 'array', items: { type: 'string' }, description: '영향도를 계산할 대상 파일들' },
                changeType: { type: 'string', enum: ['modify', 'add', 'delete', 'refactor'], default: 'modify' },
                language: { type: 'string', enum: ['java', 'python', 'javascript', 'typescript', 'csharp'] },
              },
              required: ['projectPath', 'targetFiles', 'language'],
            },
          },
          {
            name: 'comprehensive_impact_report',
            description: '종합 영향도 분석 리포트를 생성합니다.',
            inputSchema: {
              type: 'object',
              properties: {
                projectPath: { type: 'string', description: '분석할 프로젝트 경로' },
                changeDescription: { type: 'string', description: '변경 사항 설명' },
                targetModules: { type: 'array', items: { type: 'string' }, description: '변경 대상 모듈/파일 목록' },
                language: { type: 'string', enum: ['java', 'python', 'javascript', 'typescript', 'csharp'] },
                includeDatabase: { type: 'boolean', description: '데이터베이스 영향도 포함 여부', default: false },
                databaseType: { type: 'string', enum: ['mysql', 'postgresql', 'oracle', 'mssql', 'sqlite'] },
              },
              required: ['projectPath', 'changeDescription', 'targetModules', 'language'],
            },
          },
          {
            name: 'list_sites',
            description: '사용 가능한 사이트 목록을 조회합니다.',
            inputSchema: { type: 'object', properties: {} },
          },
          {
            name: 'upload_document',
            description: '개발 표준 문서를 업로드합니다.',
            inputSchema: {
              type: 'object',
              properties: {
                sitename: { type: 'string', description: '사이트명' },
                content: { type: 'string', description: '문서 내용' },
                filename: { type: 'string', description: '파일명' },
              },
              required: ['sitename', 'content', 'filename'],
            },
          },
          {
            name: 'search_documents',
            description: 'RAG를 사용하여 문서를 검색합니다.',
            inputSchema: {
              type: 'object',
              properties: {
                query: { type: 'string', description: '검색 쿼리' },
                limit: { type: 'integer', description: '반환할 결과 수', default: 5 },
              },
              required: ['query'],
            },
          },
          {
            name: 'get_job_status',
            description: '산출물 생성 작업의 상태를 확인합니다.',
            inputSchema: {
              type: 'object',
              properties: {
                jobId: { type: 'string', description: '작업 ID' },
              },
              required: ['jobId'],
            },
          },
        ],
      };
    });

    // 도구 실행
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'use_design_figure': return await this.handleUseDesignFigure(args as any);
          case 'method_dependency_matrix': return await this.handleMethodDependencyMatrix(args as any);
          case 'table_schema': return await this.handleTableSchema(args as any);
          case 'circular_dependency_detection': return await this.handleCircularDependencyDetection(args as any);
          case 'impact_score_calculation': return await this.handleImpactScoreCalculation(args as any);
          case 'comprehensive_impact_report': return await this.handleComprehensiveImpactReport(args as any);
          case 'list_sites': return await this.handleListSites();
          case 'upload_document': return await this.handleUploadDocument(args as any);
          case 'search_documents': return await this.handleSearchDocuments(args as any);
          case 'get_job_status': return await this.handleGetJobStatus(args as any);
          default: throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [{ type: 'text', text: `❌ 오류: ${error instanceof Error ? error.message : '알 수 없는 오류'}` }],
          isError: true,
        };
      }
    });
  }

  // 핵심 도구 핸들러들
  private async handleUseDesignFigure(args: { sitename: string; jiraTicketId: string; format?: string }) {
    try {
      const response = await this.apiClient.get(`/templates/guide/requirements_doc`, {
        params: { site_id: args.sitename }
      });

      if (!response.data.success) {
        return {
          content: [{
            type: 'text',
            text: `⚠️ 사이트 '${args.sitename}'에 대한 요구사항 정의서 템플릿을 찾을 수 없습니다.\n\n📝 관리자 UI에서 해당 사이트의 템플릿을 먼저 등록해주세요.`
          }]
        };
      }

      const templateGuide = response.data.data;
      
      return {
        content: [{
          type: 'text',
          text: `✅ ${args.sitename} 사이트의 요구사항 정의서 가이드

📋 **JIRA 티켓**: ${args.jiraTicketId}
🎯 **생성 형식**: ${args.format || 'both'}

## 📝 작성 지침
${templateGuide.instructions || '작성 지침이 제공되지 않았습니다.'}

## 📄 기본 템플릿
\`\`\`markdown
${templateGuide.template || '템플릿 내용을 찾을 수 없습니다.'}
\`\`\`

💡 **팁**: 위 템플릿을 기반으로 JIRA 티켓 ${args.jiraTicketId}의 내용을 반영하여 요구사항 정의서를 작성하세요.`
        }]
      };
    } catch (error) {
      return { content: [{ type: 'text', text: `❌ 처리 중 오류: ${error instanceof Error ? error.message : '알 수 없는 오류'}` }], isError: true };
    }
  }

  private async handleMethodDependencyMatrix(args: { projectPath: string; language: string; targetClass?: string }) {
    try {
      const response = await this.apiClient.post('/analysis/method-dependency', {
        project_path: args.projectPath,
        language: args.language,
        target_class: args.targetClass
      });

      if (!response.data.success) {
        return { content: [{ type: 'text', text: `❌ 메서드 의존성 분석 실패: ${response.data.message}` }], isError: true };
      }

      const result = response.data.data;
      return {
        content: [{
          type: 'text',
          text: `✅ **메서드 의존성 분석 완료**

🔍 **분석 정보**:
- 📁 프로젝트: ${args.projectPath}
- 💻 언어: ${args.language}
- 🎯 대상 클래스: ${args.targetClass || '전체'}

📊 **분석 결과**:
- 🔗 총 의존성: ${result.totalDependencies}개
- 📄 분석 파일: ${result.analyzedFiles}개  
- ⚠️ 복잡도: ${result.complexityLevel}

📋 **의존성 매트릭스**:
\`\`\`
${result.dependencyMatrix}
\`\`\`

💡 이 매트릭스를 영향도 분석서의 "메서드 의존성 행렬" 섹션에 활용하세요.`
        }]
      };
    } catch (error) {
      return { content: [{ type: 'text', text: `❌ 메서드 의존성 분석 오류: ${error instanceof Error ? error.message : '알 수 없는 오류'}` }], isError: true };
    }
  }

  private async handleTableSchema(args: { databaseType: string; connectionString?: string; schemaFile?: string; targetTables?: string[] }) {
    try {
      const response = await this.apiClient.post('/analysis/table-schema', {
        database_type: args.databaseType,
        connection_string: args.connectionString,
        schema_file: args.schemaFile,
        target_tables: args.targetTables
      });

      if (!response.data.success) {
        return { content: [{ type: 'text', text: `❌ 테이블 스키마 분석 실패: ${response.data.message}` }], isError: true };
      }

      const result = response.data.data;
      return {
        content: [{
          type: 'text',
          text: `✅ **테이블 스키마 분석 완료**

🗄️ **데이터베이스 정보**:
- 타입: ${args.databaseType}
- 대상 테이블: ${args.targetTables?.length || result.totalTables}개

📋 **스키마 정보**:
- 🔗 외래키 관계: ${result.foreignKeyCount}개
- 📇 인덱스: ${result.indexCount}개
- 🔒 제약조건: ${result.constraintCount}개

📊 **테이블 스키마**:
\`\`\`sql
${result.schemaDefinition}
\`\`\`

🔗 **관계 다이어그램**:
\`\`\`
${result.relationshipDiagram}
\`\`\`

💡 이 스키마 정보를 영향도 분석서의 "관련 테이블 스키마" 섹션에 활용하세요.`
        }]
      };
    } catch (error) {
      return { content: [{ type: 'text', text: `❌ 테이블 스키마 분석 오류: ${error instanceof Error ? error.message : '알 수 없는 오류'}` }], isError: true };
    }
  }

  private async handleCircularDependencyDetection(args: { projectPath: string; language: string; maxDepth?: number }) {
    try {
      const response = await this.apiClient.post('/analysis/circular-dependency', {
        project_path: args.projectPath,
        language: args.language,
        max_depth: args.maxDepth
      });

      if (!response.data.success) {
        return { content: [{ type: 'text', text: `❌ 순환 의존성 탐지 실패: ${response.data.message}` }], isError: true };
      }

      const result = response.data.data;
      const circularCount = result.circularDependencies?.length || 0;
      const statusIcon = circularCount > 0 ? "⚠️" : "✅";
      const statusText = circularCount > 0 ? "순환 의존성 발견" : "순환 의존성 없음";

      return {
        content: [{
          type: 'text',
          text: `${statusIcon} **순환 의존성 탐지 완료**

🔍 **분석 정보**:
- 📁 프로젝트: ${args.projectPath}
- 💻 언어: ${args.language}
- 🎯 최대 깊이: ${args.maxDepth || 10}

📊 **탐지 결과**:
- ${statusIcon} 상태: **${statusText}**
- 🔍 분석된 파일: ${result.totalFiles}개
- ⚠️ 순환 의존성: **${circularCount}개**
- 📈 복잡도 지수: ${result.complexityIndex}

${circularCount > 0 ? `⚠️ **발견된 순환 의존성**:
\`\`\`
${result.circularDependencies.map((cycle: any, index: number) => 
  `${index + 1}. ${cycle.cycle.join(' → ')} → ${cycle.cycle[0]}`
).join('\n')}
\`\`\`` : ''}

💡 이 결과를 영향도 분석서의 "의존성 분석" 섹션에 활용하세요.`
        }]
      };
    } catch (error) {
      return { content: [{ type: 'text', text: `❌ 순환 의존성 탐지 오류: ${error instanceof Error ? error.message : '알 수 없는 오류'}` }], isError: true };
    }
  }

  private async handleImpactScoreCalculation(args: { projectPath: string; targetFiles: string[]; changeType?: string; language: string }) {
    try {
      const response = await this.apiClient.post('/analysis/impact-score', {
        project_path: args.projectPath,
        target_files: args.targetFiles,
        change_type: args.changeType || 'modify',
        language: args.language
      });

      if (!response.data.success) {
        return { content: [{ type: 'text', text: `❌ 영향도 점수 계산 실패: ${response.data.message}` }], isError: true };
      }

      const result = response.data.data;
      const riskLevel = result.overallScore >= 80 ? "높음" : result.overallScore >= 50 ? "보통" : "낮음";
      const riskIcon = result.overallScore >= 80 ? "🔴" : result.overallScore >= 50 ? "🟡" : "🟢";

      return {
        content: [{
          type: 'text',
          text: `${riskIcon} **영향도 점수 계산 완료**

🎯 **계산 정보**:
- 📁 프로젝트: ${args.projectPath}
- 📄 대상 파일: ${args.targetFiles.length}개
- 🔄 변경 유형: ${args.changeType || 'modify'}

📊 **영향도 점수**:
- ${riskIcon} **종합 점수**: **${result.overallScore}/100**
- 📈 **위험도**: **${riskLevel}**
- 🔗 의존성 점수: ${result.dependencyScore}/100
- 📏 복잡도 점수: ${result.complexityScore}/100

💡 이 점수를 영향도 분석서의 "영향도 평가" 섹션에 활용하세요.`
        }]
      };
    } catch (error) {
      return { content: [{ type: 'text', text: `❌ 영향도 점수 계산 오류: ${error instanceof Error ? error.message : '알 수 없는 오류'}` }], isError: true };
    }
  }

  private async handleComprehensiveImpactReport(args: { projectPath: string; changeDescription: string; targetModules: string[]; language: string; includeDatabase?: boolean; databaseType?: string }) {
    try {
      const response = await this.apiClient.post('/analysis/comprehensive-impact-report', {
        project_path: args.projectPath,
        change_description: args.changeDescription,
        target_modules: args.targetModules,
        language: args.language,
        include_database: args.includeDatabase,
        database_type: args.databaseType
      });

      if (!response.data.success) {
        return { content: [{ type: 'text', text: `❌ 종합 영향도 분석 리포트 생성 실패: ${response.data.message}` }], isError: true };
      }

      const result = response.data.data;
      const overallRisk = result.overallRiskLevel;
      const riskIcon = overallRisk === "높음" ? "🔴" : overallRisk === "보통" ? "🟡" : "🟢";

      return {
        content: [{
          type: 'text',
          text: `📋 **종합 영향도 분석 리포트**

## 📊 변경 개요
- **프로젝트**: ${args.projectPath}
- **변경 내용**: ${args.changeDescription}
- **대상 모듈**: ${args.targetModules.join(', ')}
- **언어**: ${args.language}
- **분석 일시**: ${new Date().toLocaleString('ko-KR')}

## ${riskIcon} 종합 위험도: **${overallRisk}**

### 🔍 영향도 분석 결과:
- **📈 종합 점수**: ${result.impactScore}/100
- **🔗 의존성 영향**: ${result.dependencyImpact}
- **📏 복잡도 영향**: ${result.complexityImpact}

### 🎯 영향 받는 컴포넌트:
${result.affectedComponents?.map((comp: any) => `- **${comp.name}**: ${comp.impactLevel}`).join('\n') || '정보 없음'}

### ⚠️ 주요 리스크:
${result.identifiedRisks?.map((risk: any, index: number) => `${index + 1}. **${risk.category}**: ${risk.description}`).join('\n') || '추가 리스크 없음'}

### 🧪 권장 테스트 범위:
${result.testRecommendations?.map((test: string) => `- ${test}`).join('\n') || '- 기본 단위 테스트\n- 통합 테스트'}

### 🚀 배포 권장사항:
${result.deploymentRecommendations?.map((rec: string) => `- ${rec}`).join('\n') || '- 단계적 배포\n- 모니터링 강화'}

---
💡 **이 리포트를 영향도 분석서 템플릿에 활용하여 완전한 문서를 작성하세요.**`
        }]
      };
    } catch (error) {
      return { content: [{ type: 'text', text: `❌ 종합 영향도 분석 리포트 생성 오류: ${error instanceof Error ? error.message : '알 수 없는 오류'}` }], isError: true };
    }
  }

  // 기타 도구들
  private async handleListSites() {
    try {
      const response = await this.apiClient.get('/sites');
      if (!response.data.success) return { content: [{ type: 'text', text: `❌ 사이트 목록 조회 실패: ${response.data.message}` }], isError: true };
      
      const sites = response.data.data || [];
      if (sites.length === 0) return { content: [{ type: 'text', text: '📋 등록된 사이트가 없습니다. 관리자 UI에서 사이트를 등록하세요.' }] };
      
      return {
        content: [{
          type: 'text',
          text: `🏢 **사용 가능한 사이트** (총 ${sites.length}개)\n\n${sites.map((site: any) => `• **${site.name}** (${site.id})${site.description ? ` - ${site.description}` : ''}`).join('\n')}\n\n💡 **사용법**: \`use_design_figure\` 도구에서 사이트 ID를 사용하세요.`
        }]
      };
    } catch (error) {
      return { content: [{ type: 'text', text: `❌ 사이트 목록 조회 오류: ${error instanceof Error ? error.message : '알 수 없는 오류'}` }], isError: true };
    }
  }

  private async handleUploadDocument(args: { sitename: string; content: string; filename: string }) {
    try {
      const response = await this.apiClient.post('/documents/upload', {
        title: args.filename,
        content: args.content,
        doc_type: 'text',
        site_id: args.sitename,
        metadata: { uploaded_via: 'mcp' }
      });

      if (!response.data.success) return { content: [{ type: 'text', text: `❌ 문서 업로드 실패: ${response.data.message}` }], isError: true };

      const result = response.data.data;
      return {
        content: [{
          type: 'text',
          text: `✅ **문서 업로드 완료**\n\n📁 **사이트**: ${args.sitename}\n📄 **파일**: ${args.filename}\n🆔 **문서 ID**: ${result.id}\n⏰ **업로드 시간**: ${new Date().toLocaleString('ko-KR')}\n\n💡 업로드된 문서는 RAG 검색에서 사용할 수 있습니다.`
        }]
      };
    } catch (error) {
      return { content: [{ type: 'text', text: `❌ 문서 업로드 오류: ${error instanceof Error ? error.message : '알 수 없는 오류'}` }], isError: true };
    }
  }

  private async handleSearchDocuments(args: { query: string; limit?: number }) {
    try {
      const response = await this.apiClient.post('/rag/query', {
        query: args.query,
        max_results: args.limit || 5,
      });
      return { content: [{ type: 'text', text: `검색 결과:\n${JSON.stringify(response.data, null, 2)}` }] };
    } catch (error) {
      return { content: [{ type: 'text', text: `❌ 문서 검색 오류: ${error instanceof Error ? error.message : '알 수 없는 오류'}` }], isError: true };
    }
  }

  private async handleGetJobStatus(args: { jobId: string }) {
    try {
      const response = await this.apiClient.get(`/usage/jobs/${args.jobId}`);
      if (!response.data.success) return { content: [{ type: 'text', text: `❌ 작업을 찾을 수 없습니다: ${args.jobId}` }], isError: true };
      
      const job = response.data.data;
      const statusEmojis: { [key: string]: string } = { pending: '⏳', processing: '🔄', completed: '✅', failed: '❌' };
      const statusEmoji = statusEmojis[job.status] || '❓';
      
      return {
        content: [{
          type: 'text',
          text: `📊 **작업 상태**\n\n🆔 **작업 ID**: ${args.jobId}\n${statusEmoji} **상태**: ${job.status}\n💬 **메시지**: ${job.message || '메시지 없음'}\n⏰ **마지막 업데이트**: ${new Date().toLocaleString('ko-KR')}`
        }]
      };
    } catch (error) {
      return { content: [{ type: 'text', text: `❌ 작업 상태 조회 오류: ${error instanceof Error ? error.message : '알 수 없는 오류'}` }], isError: true };
    }
  }

  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    
    console.error(`🚀 Figure MCP Proxy Server가 시작되었습니다`);
    console.error(`📡 Backend API: ${this.BACKEND_API_URL}`);
    console.error(`🔗 MCP 프로토콜을 통해 Docker 컨테이너와 통신합니다`);
    console.error(`⭐ 영향도 분석서 작성을 위한 전문 도구들을 제공합니다`);
  }
}

// 서버 시작
const proxy = new FigureMCPProxy();
proxy.start().catch((error) => {
  console.error('프록시 서버 시작 중 오류:', error);
  process.exit(1);
});