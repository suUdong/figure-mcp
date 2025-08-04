#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import axios, { AxiosInstance } from 'axios';

/**
 * Figure MCP Proxy Server
 * Docker 컨테이너에서 실행되는 Figure Backend와 통신하는 중계 서버
 */

class FigureMCPProxy {
  private server: Server;
  private apiClient: AxiosInstance;
  private readonly BACKEND_API_URL: string;

  constructor() {
    this.BACKEND_API_URL = process.env.BACKEND_API_URL || 'http://localhost:8001/api';
    
    // MCP 서버 초기화
    this.server = new Server(
      {
        name: 'figure-mcp-proxy',
        version: '1.0.0',
      },
      {
        capabilities: {
          resources: {},
          tools: {},
        },
      }
    );

    // Docker API 클라이언트 초기화
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
    // 도구 목록 제공
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'upload_document',
            description: '문서를 업로드하고 임베딩을 생성합니다',
            inputSchema: {
              type: 'object',
              properties: {
                file_path: {
                  type: 'string',
                  description: '업로드할 파일의 경로',
                },
                content: {
                  type: 'string',
                  description: '파일 내용 (file_path가 없는 경우)',
                },
                filename: {
                  type: 'string',
                  description: '파일명',
                },
              },
              required: ['filename'],
            },
          },
          {
            name: 'search_documents',
            description: 'RAG를 사용하여 문서를 검색합니다',
            inputSchema: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: '검색 쿼리',
                },
                limit: {
                  type: 'integer',
                  description: '반환할 결과 수 (기본값: 5)',
                  default: 5,
                },
              },
              required: ['query'],
            },
          },
          {
            name: 'list_documents',
            description: '업로드된 문서 목록을 조회합니다',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
          {
            name: 'create_site',
            description: '새로운 사이트를 생성합니다',
            inputSchema: {
              type: 'object',
              properties: {
                name: {
                  type: 'string',
                  description: '사이트 이름',
                },
                url: {
                  type: 'string',
                  description: '사이트 URL',
                },
                description: {
                  type: 'string',
                  description: '사이트 설명',
                },
              },
              required: ['name', 'url'],
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
            name: 'get_admin_stats',
            description: '관리자 통계 정보를 조회합니다',
            inputSchema: {
              type: 'object',
              properties: {},
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
          case 'upload_document':
            return await this.handleUploadDocument(args as any);
          
          case 'search_documents':
            return await this.handleSearchDocuments(args as any);
          
          case 'list_documents':
            return await this.handleListDocuments();
          
          case 'create_site':
            return await this.handleCreateSite(args as any);
          
          case 'list_sites':
            return await this.handleListSites();
          
          case 'get_admin_stats':
            return await this.handleGetAdminStats();
          
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return {
          content: [
            {
              type: 'text',
              text: `도구 실행 중 오류가 발생했습니다: ${errorMessage}`,
            },
          ],
          isError: true,
        };
      }
    });

    // 리소스 목록 제공
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      return {
        resources: [
          {
            uri: 'figure://documents',
            mimeType: 'application/json',
            name: '문서 목록',
            description: '업로드된 모든 문서의 목록',
          },
          {
            uri: 'figure://sites',
            mimeType: 'application/json',
            name: '사이트 목록',
            description: '등록된 모든 사이트의 목록',
          },
          {
            uri: 'figure://admin/stats',
            mimeType: 'application/json',
            name: '관리자 통계',
            description: '시스템 통계 및 메트릭',
          },
        ],
      };
    });

    // 리소스 읽기
    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const { uri } = request.params;

      try {
        switch (uri) {
          case 'figure://documents':
            const documents = await this.handleListDocuments();
            return {
              contents: [
                {
                  uri,
                  mimeType: 'application/json',
                  text: JSON.stringify(documents, null, 2),
                },
              ],
            };
          
          case 'figure://sites':
            const sites = await this.handleListSites();
            return {
              contents: [
                {
                  uri,
                  mimeType: 'application/json',
                  text: JSON.stringify(sites, null, 2),
                },
              ],
            };
          
          case 'figure://admin/stats':
            const stats = await this.handleGetAdminStats();
            return {
              contents: [
                {
                  uri,
                  mimeType: 'application/json',
                  text: JSON.stringify(stats, null, 2),
                },
              ],
            };
          
          default:
            throw new Error(`Unknown resource: ${uri}`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        throw new Error(`리소스 읽기 중 오류가 발생했습니다: ${errorMessage}`);
      }
    });
  }

  // 도구 핸들러들
  private async handleUploadDocument(args: { file_path?: string; content?: string; filename: string }) {
    const formData = new FormData();
    
    if (args.file_path) {
      // 파일 경로가 제공된 경우 (실제 구현에서는 파일 시스템에서 읽어야 함)
      formData.append('filename', args.filename);
      formData.append('content', args.content || '');
    } else if (args.content) {
      formData.append('filename', args.filename);
      formData.append('content', args.content);
    } else {
      throw new Error('file_path 또는 content 중 하나는 필수입니다');
    }

    const response = await this.apiClient.post('/documents/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    return {
      content: [
        {
          type: 'text',
          text: `문서가 성공적으로 업로드되었습니다: ${JSON.stringify(response.data, null, 2)}`,
        },
      ],
    };
  }

  private async handleSearchDocuments(args: { query: string; limit?: number }) {
    const response = await this.apiClient.post('/rag/search', {
      query: args.query,
      limit: args.limit || 5,
    });

    return {
      content: [
        {
          type: 'text',
          text: `검색 결과:\\n${JSON.stringify(response.data, null, 2)}`,
        },
      ],
    };
  }

  private async handleListDocuments() {
    const response = await this.apiClient.get('/documents');
    return response.data;
  }

  private async handleCreateSite(args: { name: string; url: string; description?: string }) {
    const response = await this.apiClient.post('/sites', {
      name: args.name,
      url: args.url,
      description: args.description || '',
    });

    return {
      content: [
        {
          type: 'text',
          text: `사이트가 성공적으로 생성되었습니다: ${JSON.stringify(response.data, null, 2)}`,
        },
      ],
    };
  }

  private async handleListSites() {
    const response = await this.apiClient.get('/sites');
    return response.data;
  }

  private async handleGetAdminStats() {
    const response = await this.apiClient.get('/admin/stats');
    return response.data;
  }

  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    
    console.error(`🚀 Figure MCP Proxy Server가 시작되었습니다`);
    console.error(`📡 Backend API: ${this.BACKEND_API_URL}`);
    console.error(`🔗 MCP 프로토콜을 통해 Docker 컨테이너와 통신합니다`);
  }
}

// 서버 시작
const proxy = new FigureMCPProxy();
proxy.start().catch((error) => {
  console.error('프록시 서버 시작 중 오류:', error);
  process.exit(1);
});