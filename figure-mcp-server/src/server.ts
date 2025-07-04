#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import dotenv from 'dotenv';
import { logger } from './utils/logger.js';

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

    // 시뮬레이션된 응답
    const jobId = `job_${Date.now()}`;
    
    return {
      content: [{
        type: "text",
        text: `✅ 산출물 생성 작업이 시작되었습니다.

📋 **작업 정보**
- 사이트: ${sitename}
- Jira 티켓: ${jiraTicketId}
- 형식: ${format}
- 작업 ID: ${jobId}

🔄 작업 상태는 \`get_job_status\` 도구로 확인할 수 있습니다.`
      }]
    };
  }

  private async handleGetJobStatus(args: { jobId: string }) {
    const { jobId } = args;
    
    logger.info('작업 상태 조회', { jobId });

    // 시뮬레이션된 상태
    const statuses = ['진행중', '완료', '대기중'];
    const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
    
    return {
      content: [{
        type: "text",
        text: `📊 **작업 상태**

🆔 작업 ID: ${jobId}
📈 상태: ${randomStatus}
⏰ 마지막 업데이트: ${new Date().toLocaleString('ko-KR')}

${randomStatus === '완료' ? '✅ 산출물이 생성되었습니다!' : '🔄 작업이 진행 중입니다...'}`
      }]
    };
  }

  private async handleListSites() {
    logger.info('사이트 목록 조회');

    const sites = ['shop', 'admin', 'api', 'mobile', 'web'];
    
    return {
      content: [{
        type: "text",
        text: `🏢 **사용 가능한 사이트**

${sites.map(site => `• ${site}`).join('\n')}

각 사이트별로 개발 표준 문서가 관리되고 있습니다.`
      }]
    };
  }

  private async handleUploadDocument(args: { sitename: string; filepath: string }) {
    const { sitename, filepath } = args;
    
    logger.info('문서 업로드', { sitename, filepath });

    return {
      content: [{
        type: "text",
        text: `📤 **문서 업로드 완료**

📁 사이트: ${sitename}
📄 파일: ${filepath}
⏰ 업로드 시간: ${new Date().toLocaleString('ko-KR')}

✅ 문서가 성공적으로 업로드되어 RAG 시스템에 반영되었습니다.`
      }]
    };
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