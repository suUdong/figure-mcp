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