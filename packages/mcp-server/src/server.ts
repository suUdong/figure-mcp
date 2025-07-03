import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ErrorCode,
} from '@modelcontextprotocol/sdk/types.js';
import dotenv from 'dotenv';
import { logger } from './utils/logger';
import { DesignFigureHandler } from './handlers/design-figure.handler';
import { AdminHandler } from './handlers/admin.handler';
import { DatabaseService } from './services/database.service';
import { RedisService } from './services/redis.service';

// 환경 변수 로드
dotenv.config();

class FigureMcpServer {
  private server: Server;
  private designFigureHandler: DesignFigureHandler;
  private adminHandler: AdminHandler;
  private databaseService: DatabaseService;
  private redisService: RedisService;

  constructor() {
    this.server = new Server(
      {
        name: 'figure-mcp',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.databaseService = new DatabaseService();
    this.redisService = new RedisService();
    this.designFigureHandler = new DesignFigureHandler(
      this.databaseService,
      this.redisService
    );
    this.adminHandler = new AdminHandler(this.databaseService);

    this.setupHandlers();
  }

  private setupHandlers() {
    // 도구 목록 제공
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'use_design_figure',
            description: '개발 표준을 기반으로 Jira 요구사항에 맞는 산출물을 생성합니다',
            inputSchema: {
              type: 'object',
              properties: {
                sitename: {
                  type: 'string',
                  description: '프로젝트/사이트명',
                },
                jiraTicketId: {
                  type: 'string',
                  description: 'Jira 티켓 ID',
                },
                options: {
                  type: 'object',
                  properties: {
                    outputFormat: {
                      type: 'string',
                      enum: ['code', 'documentation', 'both'],
                      description: '출력 형식',
                      default: 'both',
                    },
                    deliveryMethod: {
                      type: 'string',
                      enum: ['inline', 'file', 'repository'],
                      description: '전달 방식',
                      default: 'inline',
                    },
                  },
                },
              },
              required: ['sitename', 'jiraTicketId'],
            },
          },
          {
            name: 'list_sites',
            description: '등록된 사이트 목록을 조회합니다',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
          {
            name: 'upload_document',
            description: '개발 표준 문서를 업로드합니다',
            inputSchema: {
              type: 'object',
              properties: {
                sitename: {
                  type: 'string',
                  description: '프로젝트/사이트명',
                },
                filePath: {
                  type: 'string',
                  description: '업로드할 파일 경로',
                },
                documentType: {
                  type: 'string',
                  description: '문서 타입',
                  default: 'standard',
                },
              },
              required: ['sitename', 'filePath'],
            },
          },
          {
            name: 'get_job_status',
            description: '작업 상태를 확인합니다',
            inputSchema: {
              type: 'object',
              properties: {
                jobId: {
                  type: 'string',
                  description: '작업 ID',
                },
              },
              required: ['jobId'],
            },
          },
        ],
      };
    });

    // 도구 실행 핸들러
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'use_design_figure':
            return await this.designFigureHandler.handleDesignFigure(args);

          case 'list_sites':
            return await this.adminHandler.handleListSites();

          case 'upload_document':
            return await this.adminHandler.handleUploadDocument(args);

          case 'get_job_status':
            return await this.adminHandler.handleGetJobStatus(args);

          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `알 수 없는 도구: ${name}`
            );
        }
      } catch (error) {
        logger.error('Tool execution error:', {
          tool: name,
          args,
          error: error instanceof Error ? error.message : String(error),
        });

        if (error instanceof McpError) {
          throw error;
        }

        throw new McpError(
          ErrorCode.InternalError,
          `도구 실행 중 오류가 발생했습니다: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    });
  }

  public async start() {
    try {
      // 데이터베이스 연결
      await this.databaseService.connect();
      logger.info('Database connected successfully');

      // Redis 연결
      await this.redisService.connect();
      logger.info('Redis connected successfully');

      // MCP 서버 시작
      const transport = new StdioServerTransport();
      await this.server.connect(transport);

      logger.info('Figure-MCP server started successfully', {
        version: '1.0.0',
        environment: process.env.NODE_ENV,
      });

      // Graceful shutdown
      process.on('SIGINT', () => this.shutdown());
      process.on('SIGTERM', () => this.shutdown());

    } catch (error) {
      logger.error('Failed to start server:', error);
      process.exit(1);
    }
  }

  private async shutdown() {
    logger.info('Shutting down Figure-MCP server...');

    try {
      await this.databaseService.disconnect();
      await this.redisService.disconnect();
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown:', error);
      process.exit(1);
    }
  }
}

// 서버 시작
const server = new FigureMcpServer();
server.start().catch((error) => {
  logger.error('Failed to start server:', error);
  process.exit(1);
});

export default FigureMcpServer; 