#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import dotenv from 'dotenv';
import { logger } from './utils/logger.js';
import { backendClient } from './api/backend-client.js';

// 환경 변수 로드
dotenv.config();

/**
 * Figure-MCP Server
 * 개발 표준 기반 자동 산출물 생성을 위한 MCP 서버
 */
class FigureMcpServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      {
        name: "figure-mcp-server",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupTools();
    this.setupErrorHandling();
  }

  private setupTools() {
    // 도구 목록 반환
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: "use_design_figure",
            description: "사이트별 개발 표준을 기반으로 Jira 티켓의 요구사항에 맞는 산출물을 생성합니다.",
            inputSchema: {
              type: "object",
              properties: {
                sitename: {
                  type: "string",
                  description: "사이트명 (예: shop, admin, api)"
                },
                jiraTicketId: {
                  type: "string", 
                  description: "Jira 티켓 ID (예: SHOP-123)"
                },
                format: {
                  type: "string",
                  enum: ["code", "documentation", "both"],
                  description: "생성할 산출물 형식",
                  default: "both"
                }
              },
              required: ["sitename", "jiraTicketId"]
            }
          },
          {
            name: "get_job_status",
            description: "산출물 생성 작업의 상태를 확인합니다.",
            inputSchema: {
              type: "object",
              properties: {
                jobId: {
                  type: "string",
                  description: "작업 ID"
                }
              },
              required: ["jobId"]
            }
          },
          {
            name: "list_sites",
            description: "사용 가능한 사이트 목록을 조회합니다.",
            inputSchema: {
              type: "object",
              properties: {},
              required: []
            }
          },
          {
            name: "upload_document",
            description: "개발 표준 문서를 업로드합니다.",
            inputSchema: {
              type: "object",
              properties: {
                sitename: {
                  type: "string",
                  description: "사이트명"
                },
                filepath: {
                  type: "string",
                  description: "파일 경로"
                }
              },
              required: ["sitename", "filepath"]
            }
          },
          {
            name: "method_dependency_matrix",
            description: "소스 코드를 분석하여 메서드 간 의존성 매트릭스를 생성합니다.",
            inputSchema: {
              type: "object",
              properties: {
                projectPath: {
                  type: "string",
                  description: "분석할 프로젝트 경로"
                },
                language: {
                  type: "string",
                  enum: ["java", "python", "javascript", "typescript", "csharp"],
                  description: "프로그래밍 언어",
                  default: "java"
                },
                targetClass: {
                  type: "string", 
                  description: "분석할 특정 클래스명 (선택사항)"
                }
              },
              required: ["projectPath", "language"]
            }
          },
          {
            name: "table_schema",
            description: "데이터베이스 스키마 정보를 분석하여 테이블 구조와 관계를 추출합니다.",
            inputSchema: {
              type: "object",
              properties: {
                databaseType: {
                  type: "string",
                  enum: ["mysql", "postgresql", "oracle", "mssql", "sqlite"],
                  description: "데이터베이스 타입"
                },
                connectionString: {
                  type: "string",
                  description: "데이터베이스 연결 문자열 (선택사항)"
                },
                schemaFile: {
                  type: "string",
                  description: "DDL 스키마 파일 경로 (연결 문자열 대신 사용 가능)"
                },
                targetTables: {
                  type: "array",
                  items: {
                    type: "string"
                  },
                  description: "분석할 특정 테이블 목록 (선택사항)"
                }
              },
              required: ["databaseType"]
            }
          },
          {
            name: "circular_dependency_detection",
            description: "소스 코드에서 순환 의존성을 탐지하고 분석합니다.",
            inputSchema: {
              type: "object",
              properties: {
                projectPath: {
                  type: "string",
                  description: "분석할 프로젝트 경로"
                },
                language: {
                  type: "string",
                  enum: ["java", "python", "javascript", "typescript", "csharp"],
                  description: "프로그래밍 언어",
                  default: "java"
                },
                maxDepth: {
                  type: "number",
                  description: "최대 탐지 깊이",
                  default: 10
                }
              },
              required: ["projectPath", "language"]
            }
          },
          {
            name: "impact_score_calculation",
            description: "변경 대상의 영향도 점수를 자동으로 계산합니다.",
            inputSchema: {
              type: "object",
              properties: {
                projectPath: {
                  type: "string",
                  description: "분석할 프로젝트 경로"
                },
                targetFiles: {
                  type: "array",
                  items: {
                    type: "string"
                  },
                  description: "영향도를 계산할 대상 파일들"
                },
                changeType: {
                  type: "string",
                  enum: ["modify", "add", "delete", "refactor"],
                  description: "변경 유형",
                  default: "modify"
                },
                language: {
                  type: "string",
                  enum: ["java", "python", "javascript", "typescript", "csharp"],
                  description: "프로그래밍 언어"
                }
              },
              required: ["projectPath", "targetFiles", "language"]
            }
          },
          {
            name: "comprehensive_impact_report",
            description: "종합 영향도 분석 리포트를 생성합니다.",
            inputSchema: {
              type: "object",
              properties: {
                projectPath: {
                  type: "string",
                  description: "분석할 프로젝트 경로"
                },
                changeDescription: {
                  type: "string",
                  description: "변경 사항 설명"
                },
                targetModules: {
                  type: "array",
                  items: {
                    type: "string"
                  },
                  description: "변경 대상 모듈/파일 목록"
                },
                language: {
                  type: "string",
                  enum: ["java", "python", "javascript", "typescript", "csharp"],
                  description: "프로그래밍 언어"
                },
                includeDatabase: {
                  type: "boolean",
                  description: "데이터베이스 영향도 포함 여부",
                  default: false
                },
                databaseType: {
                  type: "string",
                  enum: ["mysql", "postgresql", "oracle", "mssql", "sqlite"],
                  description: "데이터베이스 타입 (includeDatabase가 true일 때 필수)"
                },
                siteId: {
                  type: "string",
                  description: "사이트 ID (템플릿 매칭용)",
                  default: null
                }
              },
              required: ["projectPath", "changeDescription", "targetModules", "language"]
            }
          },
          {
            name: "get_document_template",
            description: "문서 타입에 맞는 템플릿을 SQLite에서 조회합니다.",
            inputSchema: {
              type: "object",
              properties: {
                documentType: {
                  type: "string",
                  enum: ["impact_analysis", "requirements_doc", "api_documentation", "deployment_guide", "test_plan", "technical_spec", "user_manual", "release_notes"],
                  description: "문서 타입"
                },
                siteId: {
                  type: "string",
                  description: "사이트 ID (선택사항)"
                }
              },
              required: ["documentType"]
            }
          }
        ]
      };
    });

    // 도구 실행 처리
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case "use_design_figure":
            return await this.handleUseDesignFigure(args as any);
            
          case "get_job_status":
            return await this.handleGetJobStatus(args as any);
            
          case "list_sites":
            return await this.handleListSites();
            
          case "upload_document":
            return await this.handleUploadDocument(args as any);
            
          case "method_dependency_matrix":
            return await this.handleMethodDependencyMatrix(args as any);
            
          case "table_schema":
            return await this.handleTableSchema(args as any);
            
          case "circular_dependency_detection":
            return await this.handleCircularDependencyDetection(args as any);
            
          case "impact_score_calculation":
            return await this.handleImpactScoreCalculation(args as any);
            
          case "comprehensive_impact_report":
            return await this.handleComprehensiveImpactReport(args as any);
            
          case "get_document_template":
            return await this.handleGetDocumentTemplate(args as any);
            
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error: any) {
        logger.error('도구 실행 오류', { tool: name, error: error.message });
        return {
          content: [{
            type: "text",
            text: `오류: ${error.message}`
          }],
          isError: true
        };
      }
    });
  }

  private async handleUseDesignFigure(args: { sitename: string; jiraTicketId: string; format?: string }) {
    const { sitename, jiraTicketId, format = "both" } = args;
    
    logger.info('산출물 생성 요청', { sitename, jiraTicketId, format });

    try {
      // 백엔드 연결 상태 확인
      const isHealthy = await backendClient.healthCheck();
      if (!isHealthy) {
        return {
          content: [{
            type: "text", 
            text: "❌ 백엔드 서버에 연결할 수 없습니다. 서버 상태를 확인해주세요."
          }],
          isError: true
        };
      }

      // 요구사항 정의서 템플릿 가이드 조회
      const templateGuide = await backendClient.getTemplateGuide("requirements_doc", sitename);
      
      if (!templateGuide) {
        return {
          content: [{
            type: "text",
            text: `⚠️ 사이트 '${sitename}'에 대한 요구사항 정의서 템플릿을 찾을 수 없습니다.

📝 **다음 단계:**
1. 관리자 UI에서 해당 사이트의 템플릿을 먼저 등록해주세요.
2. 또는 \`list_sites\` 도구로 사용 가능한 사이트를 확인하세요.`
          }]
        };
      }

      // 템플릿 가이드 반환
      return {
        content: [{
          type: "text",
          text: `✅ ${sitename} 사이트의 요구사항 정의서 가이드를 제공합니다.

📋 **JIRA 티켓**: ${jiraTicketId}
🎯 **생성 형식**: ${format}
📊 **템플릿 사용 횟수**: ${templateGuide.usage_count}회

## 📝 작성 지침

${templateGuide.instructions}

## 🔧 템플릿 변수

${Object.keys(templateGuide.variables).length > 0 
  ? Object.entries(templateGuide.variables)
      .map(([key, value]) => `- **${key}**: ${typeof value === 'object' ? JSON.stringify(value) : value}`)
      .join('\n')
  : '설정된 변수가 없습니다.'
}

## 📄 기본 템플릿

\`\`\`markdown
${templateGuide.template}
\`\`\`

💡 **팁**: 위 템플릿을 기반으로 JIRA 티켓 ${jiraTicketId}의 내용을 반영하여 요구사항 정의서를 작성하세요.`
        }]
      };

    } catch (error) {
      logger.error('산출물 생성 처리 중 오류', error);
      return {
        content: [{
          type: "text",
          text: `❌ 처리 중 오류가 발생했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`
        }],
        isError: true
      };
    }
  }

  private async handleGetJobStatus(args: { jobId: string }) {
    const { jobId } = args;
    
    logger.info('작업 상태 조회', { jobId });

    try {
      // 백엔드에서 실제 작업 상태 조회
      const jobStatus = await backendClient.getJobStatus(jobId);

      if (!jobStatus) {
        return {
          content: [{
            type: "text",
            text: `❌ **작업을 찾을 수 없습니다**

🆔 작업 ID: ${jobId}

🔧 **가능한 원인:**
- 잘못된 작업 ID
- 작업이 만료됨
- 서버 오류

💡 **확인사항**: 작업 ID가 올바른지 다시 확인해보세요.`
          }],
          isError: true
        };
      }

      // 상태별 이모지 및 메시지
      const statusEmojis = {
        pending: '⏳',
        processing: '🔄', 
        completed: '✅',
        failed: '❌'
      };

      const statusMessages = {
        pending: '대기 중',
        processing: '처리 중',
        completed: '완료',
        failed: '실패'
      };

      const statusEmoji = statusEmojis[jobStatus.status] || '❓';
      const statusMessage = statusMessages[jobStatus.status] || jobStatus.status;

      let resultText = `📊 **작업 상태**

🆔 **작업 ID**: ${jobId}
📋 **작업 유형**: ${jobStatus.type}
${statusEmoji} **상태**: ${statusMessage}
📈 **진행률**: ${jobStatus.progress.toFixed(1)}%
💬 **메시지**: ${jobStatus.message}
⏰ **마지막 업데이트**: ${new Date().toLocaleString('ko-KR')}`;

      // 추가 정보가 있는 경우
      if (jobStatus.metadata && Object.keys(jobStatus.metadata).length > 0) {
        resultText += `

📝 **추가 정보**:`;
        Object.entries(jobStatus.metadata).forEach(([key, value]) => {
          resultText += `\n- **${key}**: ${value}`;
        });
      }

      // 오류가 있는 경우
      if (jobStatus.error) {
        resultText += `

❌ **오류 내용**: ${jobStatus.error}`;
      }

      // 상태별 다음 단계 안내
      if (jobStatus.status === 'completed') {
        resultText += `

🎉 **작업이 성공적으로 완료되었습니다!**`;
      } else if (jobStatus.status === 'failed') {
        resultText += `

🔧 **다음 단계**: 오류를 확인하고 다시 시도해보세요.`;
      } else if (jobStatus.status === 'processing') {
        resultText += `

⏱️ **잠시만 기다려주세요...** 작업이 진행 중입니다.`;
      }

      return {
        content: [{
          type: "text",
          text: resultText
        }],
        isError: jobStatus.status === 'failed'
      };

    } catch (error) {
      logger.error('작업 상태 조회 오류', error);
      return {
        content: [{
          type: "text",
          text: `❌ 작업 상태 조회 중 오류가 발생했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}

🆔 작업 ID: ${jobId}
🔧 백엔드 서버 상태를 확인해주세요.`
        }],
        isError: true
      };
    }
  }

  private async handleListSites() {
    logger.info('사이트 목록 조회');

    try {
      // 백엔드에서 실제 사이트 목록 조회
      const sites = await backendClient.getSites();
      
      if (sites.length === 0) {
        return {
          content: [{
            type: "text",
            text: `📋 **등록된 사이트가 없습니다**

🔧 **다음 단계:**
1. 관리자 UI (http://localhost:3001)에서 사이트를 등록하세요.
2. 각 사이트별 개발 표준 템플릿을 업로드하세요.

💡 **예시 사이트**: shop, admin, api, mobile, web`
          }]
        };
      }

      const activeSites = sites.filter(site => site.is_active);
      const inactiveSites = sites.filter(site => !site.is_active);

      let siteListText = `🏢 **사용 가능한 사이트** (총 ${sites.length}개)

## ✅ 활성 사이트 (${activeSites.length}개)
${activeSites.length > 0 
  ? activeSites.map(site => `• **${site.name}** (${site.id})${site.description ? ` - ${site.description}` : ''}`).join('\n')
  : '없음'
}`;

      if (inactiveSites.length > 0) {
        siteListText += `

## ⏸️ 비활성 사이트 (${inactiveSites.length}개)
${inactiveSites.map(site => `• **${site.name}** (${site.id})${site.description ? ` - ${site.description}` : ''}`).join('\n')}`;
      }

      siteListText += `

💡 **사용법**: \`use_design_figure\` 도구에서 사이트 ID를 사용하세요.`;

      return {
        content: [{
          type: "text",
          text: siteListText
        }]
      };

    } catch (error) {
      logger.error('사이트 목록 조회 오류', error);
      return {
        content: [{
          type: "text",
          text: `❌ 사이트 목록 조회 중 오류가 발생했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}

🔧 백엔드 서버 상태를 확인해주세요.`
        }],
        isError: true
      };
    }
  }

  private async handleUploadDocument(args: { sitename: string; filepath: string }) {
    const { sitename, filepath } = args;
    
    logger.info('문서 업로드', { sitename, filepath });

    try {
      // 백엔드 연결 상태 확인
      const isHealthy = await backendClient.healthCheck();
      if (!isHealthy) {
        return {
          content: [{
            type: "text",
            text: "❌ 백엔드 서버에 연결할 수 없습니다. 서버 상태를 확인해주세요."
          }],
          isError: true
        };
      }

      // 문서 업로드 요청
      const uploadResult = await backendClient.uploadDocument(sitename, filepath);

      if (!uploadResult) {
        return {
          content: [{
            type: "text",
            text: `❌ 문서 업로드에 실패했습니다.

📁 사이트: ${sitename}
📄 파일: ${filepath}

🔧 **가능한 원인:**
- 파일 경로가 올바르지 않음
- 사이트가 존재하지 않음
- 서버 처리 오류

💡 \`list_sites\` 도구로 유효한 사이트를 확인해보세요.`
          }],
          isError: true  
        };
      }

      return {
        content: [{
          type: "text",
          text: `✅ **문서 업로드 완료**

📁 **사이트**: ${sitename}
📄 **파일**: ${filepath}
🆔 **문서 ID**: ${uploadResult.document_id}
📊 **작업 ID**: ${uploadResult.job_id}
📏 **파일 크기**: ${(uploadResult.file_size / 1024).toFixed(1)} KB
📋 **문서 타입**: ${uploadResult.doc_type}
⏰ **업로드 시간**: ${new Date(uploadResult.created_at).toLocaleString('ko-KR')}

🔄 **처리 상태**: 
- ChromaDB 벡터화 완료 ✅
- 검색 인덱스에 추가됨 ✅

💡 **다음 단계**: \`get_job_status\` 도구로 상세 처리 상태를 확인할 수 있습니다.`
        }]
      };

    } catch (error) {
      logger.error('문서 업로드 처리 중 오류', error);
      return {
        content: [{
          type: "text",
          text: `❌ 문서 업로드 처리 중 오류가 발생했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}

📁 사이트: ${sitename}
📄 파일: ${filepath}`
        }],
        isError: true
      };
    }
  }

  private async handleMethodDependencyMatrix(args: {
    projectPath: string;
    language: string;
    targetClass?: string;
  }) {
    try {
      logger.info('메서드 의존성 분석 요청', args);
      
      // 백엔드 API 호출
      const analysisResult = await backendClient.analyzeMethodDependency(
        args.projectPath,
        args.language,
        args.targetClass
      );

      if (!analysisResult) {
        return {
          content: [{
            type: "text",
            text: `❌ 메서드 의존성 분석에 실패했습니다.

🔍 **분석 대상**:
- 프로젝트 경로: ${args.projectPath}
- 언어: ${args.language}
- 대상 클래스: ${args.targetClass || '전체'}

🔧 **가능한 원인**:
- 프로젝트 경로가 존재하지 않음
- 지원하지 않는 언어
- 파싱 가능한 소스 파일이 없음

💡 경로와 언어 설정을 확인해보세요.`
          }],
          isError: true
        };
      }

      return {
        content: [{
          type: "text", 
          text: `✅ **메서드 의존성 분석 완료**

🔍 **분석 정보**:
- 📁 프로젝트: ${args.projectPath}
- 💻 언어: ${args.language}
- 🎯 대상 클래스: ${args.targetClass || '전체'}

📊 **분석 결과**:
- 🔗 총 의존성: ${analysisResult.totalDependencies}개
- 📄 분석 파일: ${analysisResult.analyzedFiles}개  
- ⚠️ 복잡도: ${analysisResult.complexityLevel}

📋 **의존성 매트릭스**:
\`\`\`
${analysisResult.dependencyMatrix}
\`\`\`

💡 **활용 방법**: 
이 매트릭스를 영향도 분석서의 "메서드 의존성 행렬" 섹션에 활용하여 변경 시 영향을 받을 수 있는 메서드들을 파악하세요.`
        }]
      };

    } catch (error) {
      logger.error('메서드 의존성 분석 처리 중 오류', error);
      return {
        content: [{
          type: "text",
          text: `❌ 메서드 의존성 분석 처리 중 오류가 발생했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}

🔍 분석 대상: ${args.projectPath} (${args.language})`
        }],
        isError: true
      };
    }
  }

  private async handleTableSchema(args: {
    databaseType: string;
    connectionString?: string;
    schemaFile?: string;
    targetTables?: string[];
  }) {
    try {
      logger.info('테이블 스키마 분석 요청', args);
      
      // 백엔드 API 호출
      const schemaResult = await backendClient.analyzeTableSchema(
        args.databaseType,
        args.connectionString,
        args.schemaFile,
        args.targetTables
      );

      if (!schemaResult) {
        return {
          content: [{
            type: "text",
            text: `❌ 테이블 스키마 분석에 실패했습니다.

🗄️ **분석 대상**:
- DB 타입: ${args.databaseType}
- 연결 문자열: ${args.connectionString ? '제공됨' : '없음'}
- 스키마 파일: ${args.schemaFile || '없음'}
- 대상 테이블: ${args.targetTables?.join(', ') || '전체'}

🔧 **가능한 원인**:
- 데이터베이스 연결 실패
- 스키마 파일을 찾을 수 없음
- 권한 부족
- 지원하지 않는 DB 타입

💡 연결 정보나 스키마 파일을 확인해보세요.`
          }],
          isError: true
        };
      }

      return {
        content: [{
          type: "text",
          text: `✅ **테이블 스키마 분석 완료**

🗄️ **데이터베이스 정보**:
- 타입: ${args.databaseType}
- 분석 방법: ${args.connectionString ? 'DB 연결' : 'DDL 파일'}
- 대상 테이블: ${args.targetTables?.length || schemaResult.totalTables}개

📋 **스키마 정보**:
- 🔗 외래키 관계: ${schemaResult.foreignKeyCount}개
- 📇 인덱스: ${schemaResult.indexCount}개
- 🔒 제약조건: ${schemaResult.constraintCount}개

📊 **테이블 스키마**:
\`\`\`sql
${schemaResult.schemaDefinition}
\`\`\`

🔗 **관계 다이어그램**:
\`\`\`
${schemaResult.relationshipDiagram}
\`\`\`

💡 **활용 방법**: 
이 스키마 정보를 영향도 분석서의 "관련 테이블 스키마" 섹션에 활용하여 DB 변경의 영향도를 분석하세요.`
        }]
      };

    } catch (error) {
      logger.error('테이블 스키마 분석 처리 중 오류', error);
      return {
        content: [{
          type: "text",
          text: `❌ 테이블 스키마 분석 처리 중 오류가 발생했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}

🗄️ DB 타입: ${args.databaseType}`
        }],
        isError: true
      };
    }
  }

  private async handleCircularDependencyDetection(args: {
    projectPath: string;
    language: string;
    maxDepth?: number;
  }) {
    try {
      logger.info('순환 의존성 탐지 요청', args);
      
      // 백엔드 API 호출
      const analysisResult = await backendClient.detectCircularDependency(
        args.projectPath,
        args.language,
        args.maxDepth
      );

      if (!analysisResult) {
        return {
          content: [{
            type: "text",
            text: `❌ 순환 의존성 탐지에 실패했습니다.

🔍 **분석 대상**:
- 프로젝트 경로: ${args.projectPath}
- 언어: ${args.language}
- 최대 깊이: ${args.maxDepth || 10}

🔧 **가능한 원인**:
- 프로젝트 경로가 존재하지 않음
- 분석 가능한 소스 파일이 없음
- 메모리 부족 또는 처리 시간 초과

💡 프로젝트 구조와 설정을 확인해보세요.`
          }],
          isError: true
        };
      }

      const circularCount = analysisResult.circularDependencies?.length || 0;
      const statusIcon = circularCount > 0 ? "⚠️" : "✅";
      const statusText = circularCount > 0 ? "순환 의존성 발견" : "순환 의존성 없음";

      return {
        content: [{
          type: "text", 
          text: `${statusIcon} **순환 의존성 탐지 완료**

🔍 **분석 정보**:
- 📁 프로젝트: ${args.projectPath}
- 💻 언어: ${args.language}
- 🎯 최대 깊이: ${args.maxDepth || 10}

📊 **탐지 결과**:
- ${statusIcon} 상태: **${statusText}**
- 🔍 분석된 파일: ${analysisResult.totalFiles}개
- ⚠️ 순환 의존성: **${circularCount}개**
- 📈 복잡도 지수: ${analysisResult.complexityIndex}

${circularCount > 0 ? `⚠️ **발견된 순환 의존성**:
\`\`\`
${analysisResult.circularDependencies.map((cycle: any, index: number) => 
  `${index + 1}. ${cycle.cycle.join(' → ')} → ${cycle.cycle[0]}`
).join('\n')}
\`\`\`

🔧 **권장 조치**:
${analysisResult.recommendations.map((rec: string) => `• ${rec}`).join('\n')}` : ''}

💡 **활용 방법**: 
이 결과를 영향도 분석서의 "의존성 분석" 섹션에 활용하여 리팩토링 우선순위를 결정하세요.`
        }]
      };

    } catch (error) {
      logger.error('순환 의존성 탐지 처리 중 오류', error);
      return {
        content: [{
          type: "text",
          text: `❌ 순환 의존성 탐지 처리 중 오류가 발생했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}

🔍 분석 대상: ${args.projectPath} (${args.language})`
        }],
        isError: true
      };
    }
  }

  private async handleImpactScoreCalculation(args: {
    projectPath: string;
    targetFiles: string[];
    changeType?: string;
    language: string;
  }) {
    try {
      logger.info('영향도 점수 계산 요청', args);
      
      // 백엔드 API 호출
      const scoreResult = await backendClient.calculateImpactScore(
        args.projectPath,
        args.targetFiles,
        args.changeType || 'modify',
        args.language
      );

      if (!scoreResult) {
        return {
          content: [{
            type: "text",
            text: `❌ 영향도 점수 계산에 실패했습니다.

🎯 **계산 대상**:
- 프로젝트: ${args.projectPath}
- 대상 파일: ${args.targetFiles.join(', ')}
- 변경 유형: ${args.changeType || 'modify'}
- 언어: ${args.language}

🔧 **가능한 원인**:
- 대상 파일을 찾을 수 없음
- 의존성 분석 실패
- 복잡도 계산 오류

💡 파일 경로와 프로젝트 구조를 확인해보세요.`
          }],
          isError: true
        };
      }

      const riskLevel = scoreResult.overallScore >= 80 ? "높음" : 
                       scoreResult.overallScore >= 50 ? "보통" : "낮음";
      const riskIcon = scoreResult.overallScore >= 80 ? "🔴" : 
                      scoreResult.overallScore >= 50 ? "🟡" : "🟢";

      return {
        content: [{
          type: "text",
          text: `${riskIcon} **영향도 점수 계산 완료**

🎯 **계산 정보**:
- 📁 프로젝트: ${args.projectPath}
- 📄 대상 파일: ${args.targetFiles.length}개
- 🔄 변경 유형: ${args.changeType || 'modify'}
- 💻 언어: ${args.language}

📊 **영향도 점수**:
- ${riskIcon} **종합 점수**: **${scoreResult.overallScore}/100**
- 📈 **위험도**: **${riskLevel}**
- 🔗 의존성 점수: ${scoreResult.dependencyScore}/100
- 📏 복잡도 점수: ${scoreResult.complexityScore}/100
- 👥 사용빈도 점수: ${scoreResult.usageScore}/100

📋 **세부 분석**:
${scoreResult.fileScores.map((file: any) => 
  `• ${file.fileName}: ${file.score}/100 (${file.reason})`
).join('\n')}

⚠️ **주요 위험 요소**:
${scoreResult.riskFactors.map((risk: string) => `• ${risk}`).join('\n')}

🔧 **권장 조치**:
${scoreResult.recommendations.map((rec: string) => `• ${rec}`).join('\n')}

💡 **활용 방법**: 
이 점수를 영향도 분석서의 "영향도 평가" 섹션에 활용하여 리스크 레벨을 설정하세요.`
        }]
      };

    } catch (error) {
      logger.error('영향도 점수 계산 처리 중 오류', error);
      return {
        content: [{
          type: "text",
          text: `❌ 영향도 점수 계산 처리 중 오류가 발생했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}

🎯 대상: ${args.targetFiles.join(', ')}`
        }],
        isError: true
      };
    }
  }

  private async handleComprehensiveImpactReport(args: {
    projectPath: string;
    changeDescription: string;
    targetModules: string[];
    language: string;
    includeDatabase?: boolean;
    databaseType?: string;
    siteId?: string;  // 사이트 ID 추가
  }) {
    try {
      logger.info('종합 영향도 분석 리포트 생성 요청', args);
      
      // 1. 먼저 영향도 분석 템플릿 조회 시도
      const templateMatch = await backendClient.getMatchingTemplate('impact_analysis', args.siteId);
      
      // 2. 백엔드 API 호출 (기존 분석 로직)
      const reportResult = await backendClient.generateComprehensiveImpactReport(
        args.projectPath,
        args.changeDescription,
        args.targetModules,
        args.language,
        args.includeDatabase,
        args.databaseType
      );

      if (!reportResult) {
        return {
          content: [{
            type: "text",
            text: `❌ 종합 영향도 분석 리포트 생성에 실패했습니다.

📋 **분석 대상**:
- 프로젝트: ${args.projectPath}
- 변경 사항: ${args.changeDescription}
- 대상 모듈: ${args.targetModules.join(', ')}
- 언어: ${args.language}
- DB 포함: ${args.includeDatabase ? 'Yes' : 'No'}

🔧 **가능한 원인**:
- 프로젝트 경로 또는 모듈을 찾을 수 없음
- 종합 분석 처리 시간 초과
- 메모리 부족

💡 프로젝트 구조와 대상 모듈을 확인해보세요.`
          }],
          isError: true
        };
      }

      const overallRisk = reportResult.overallRiskLevel;
      const riskIcon = overallRisk === "높음" ? "🔴" : 
                      overallRisk === "보통" ? "🟡" : "🟢";

      // 3. 템플릿이 있는 경우 템플릿 포함해서 응답 생성
      let responseText = `📋 **종합 영향도 분석 리포트**

## 📊 변경 개요
- **프로젝트**: ${args.projectPath}
- **변경 내용**: ${args.changeDescription}
- **대상 모듈**: ${args.targetModules.join(', ')}
- **언어**: ${args.language}
- **분석 일시**: ${new Date().toLocaleString('ko-KR')}

## ${riskIcon} 종합 위험도: **${overallRisk}**

### 🔍 영향도 분석 결과:
- **📈 종합 점수**: ${reportResult.impactScore}/100
- **🔗 의존성 영향**: ${reportResult.dependencyImpact}
- **📏 복잡도 영향**: ${reportResult.complexityImpact}
- **👥 사용자 영향**: ${reportResult.userImpact}

### 🎯 영향 받는 컴포넌트:
${reportResult.affectedComponents.map((comp: any) => 
  `- **${comp.name}**: ${comp.impactLevel} (${comp.reason})`
).join('\n')}

### ⚠️ 주요 리스크:
${reportResult.identifiedRisks.map((risk: any, index: number) => 
  `${index + 1}. **${risk.category}**: ${risk.description} (${risk.severity})`
).join('\n')}

### 🧪 권장 테스트 범위:
${reportResult.testRecommendations.map((test: string) => `- ${test}`).join('\n')}

### 🚀 배포 권장사항:
${reportResult.deploymentRecommendations.map((rec: string) => `- ${rec}`).join('\n')}

${args.includeDatabase && reportResult.databaseImpact ? `
### 🗄️ 데이터베이스 영향도:
- **영향 테이블**: ${reportResult.databaseImpact.affectedTables.join(', ')}
- **마이그레이션 필요**: ${reportResult.databaseImpact.migrationRequired ? 'Yes' : 'No'}
- **백업 권장**: ${reportResult.databaseImpact.backupRecommended ? 'Yes' : 'No'}
` : ''}

### 📝 체크리스트:
${reportResult.checklist.map((item: any) => 
  `- [ ] **${item.category}**: ${item.task}`
).join('\n')}

---`;

      // 템플릿 매칭 결과에 따라 추가 정보 포함
      if (templateMatch && templateMatch.template) {
        responseText += `
## 📄 **매칭된 영향도 분석서 템플릿**

**템플릿 정보:**
- **이름**: ${templateMatch.template.name}
- **설명**: ${templateMatch.template.description || '설명 없음'}
- **사이트**: ${templateMatch.template.site_id || '전체'}
- **타입**: ${templateMatch.templateType}

**템플릿 내용:**
\`\`\`markdown
${templateMatch.template.content || '템플릿 내용이 비어있습니다.'}
\`\`\`

💡 **위의 분석 결과를 아래 템플릿에 적용하여 완전한 영향도 분석서를 작성하세요.**
📋 **SQLite에서 가져온 정형화된 템플릿을 사용하여 일관성 있는 문서를 생성할 수 있습니다.**`;
      } else {
        responseText += `
💡 **이 리포트를 영향도 분석서 템플릿에 활용하여 완전한 문서를 작성하세요.**
⚠️ **매칭되는 영향도 분석서 템플릿이 없습니다. 먼저 템플릿을 업로드해주세요.**`;
      }

      return {
        content: [{
          type: "text",
          text: responseText
        }]
      };

    } catch (error) {
      logger.error('종합 영향도 분석 리포트 생성 처리 중 오류', error);
      return {
        content: [{
          type: "text",
          text: `❌ 종합 영향도 분석 리포트 생성 처리 중 오류가 발생했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}

📋 프로젝트: ${args.projectPath}
📝 변경 사항: ${args.changeDescription}`
        }],
        isError: true
      };
    }
  }

  private async handleGetDocumentTemplate(args: {
    documentType: string;
    siteId?: string;
  }) {
    try {
      logger.info('문서 템플릿 조회 요청', args);
      
      // 백엔드에서 템플릿 매칭
      const templateMatch = await backendClient.getMatchingTemplate(args.documentType, args.siteId);
      
      if (!templateMatch || !templateMatch.template) {
        return {
          content: [{
            type: "text",
            text: `⚠️ **템플릿을 찾을 수 없습니다**

📋 **요청 정보:**
- **문서 타입**: ${args.documentType}
- **사이트 ID**: ${args.siteId || '전체'}

💡 **해결 방법:**
1. 해당 문서 타입의 템플릿을 먼저 업로드해주세요
2. 사이트별 템플릿이 필요한 경우 사이트 ID를 확인해주세요
3. 관리자 페이지에서 템플릿 목록을 확인해보세요

🔧 **지원하는 문서 타입:**
- impact_analysis (영향도 분석서)
- requirements_doc (요구사항 정의서)
- api_documentation (API 문서)
- deployment_guide (배포 가이드)
- test_plan (테스트 계획서)
- technical_spec (기술 명세서)
- user_manual (사용자 매뉴얼)
- release_notes (릴리즈 노트)`
          }]
        };
      }

      const template = templateMatch.template;
      
      return {
        content: [{
          type: "text",
          text: `📄 **${args.documentType} 템플릿 조회 성공**

## 📋 템플릿 정보
- **이름**: ${template.name}
- **설명**: ${template.description || '설명 없음'}
- **타입**: ${templateMatch.templateType}
- **사이트**: ${template.site_id || '전체 사이트'}
- **생성일**: ${template.created_at ? new Date(template.created_at).toLocaleString('ko-KR') : '정보 없음'}
- **기본 템플릿**: ${template.is_default ? 'Yes' : 'No'}

## 📝 템플릿 내용

\`\`\`markdown
${template.content || '템플릿 내용이 비어있습니다.'}
\`\`\`

---
💡 **이 템플릿을 사용하여 ${args.documentType} 문서를 작성하세요.**
🔄 **SQLite에서 가져온 정형화된 템플릿으로 일관성 있는 문서를 생성할 수 있습니다.**`
        }]
      };

    } catch (error) {
      logger.error('문서 템플릿 조회 처리 중 오류', error);
      return {
        content: [{
          type: "text",
          text: `❌ 문서 템플릿 조회 처리 중 오류가 발생했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}

📋 **요청 정보:**
- **문서 타입**: ${args.documentType}
- **사이트 ID**: ${args.siteId || '전체'}

🔧 **가능한 원인:**
- 백엔드 서버 연결 실패
- 데이터베이스 접근 오류
- 템플릿 서비스 장애

💡 관리자에게 문의하거나 잠시 후 다시 시도해보세요.`
        }],
        isError: true
      };
    }
  }

  private setupErrorHandling() {
    this.server.onerror = (error: any) => {
      logger.error('MCP 서버 오류', error);
    };

    process.on('SIGINT', async () => {
      logger.info('서버 종료 중...');
      await this.server.close();
      process.exit(0);
    });
  }

  public async start() {
    try {
      const transport = new StdioServerTransport();
      await this.server.connect(transport);
      
      logger.info('Figure-MCP 서버가 시작되었습니다', {
        name: 'figure-mcp-server',
        version: '1.0.0',
        transport: 'stdio'
      });
      
    } catch (error) {
      logger.error('서버 시작 실패', error);
      process.exit(1);
    }
  }
}

// 서버 시작
const server = new FigureMcpServer();
server.start().catch((error) => {
  console.error('서버 시작 중 오류 발생:', error);
  process.exit(1);
}); 