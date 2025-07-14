import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { MCPToolResult, UploadDocumentRequest, Site } from './types.js';

export class MCPClient {
  private client: Client;
  private transport: StdioClientTransport;
  private connected: boolean = false;

  constructor(private serverPath: string) {
    this.transport = new StdioClientTransport({
      command: 'node',
      args: [serverPath]
    });
    this.client = new Client(
      {
        name: 'figure-mcp-test-client',
        version: '1.0.0'
      },
      {
        capabilities: {
          tools: {}
        }
      }
    );
  }

  async connect(): Promise<void> {
    if (this.connected) return;

    await this.client.connect(this.transport);
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    if (!this.connected) return;

    await this.client.close();
    this.connected = false;
  }

  async listSites(): Promise<MCPToolResult> {
    const startTime = Date.now();
    
    try {
      const result = await this.client.callTool({
        name: 'list_sites',
        arguments: {}
      });

      return {
        toolName: 'list_sites',
        success: true,
        result: result.content,
        duration: Date.now() - startTime
      };
    } catch (error) {
      return {
        toolName: 'list_sites',
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime
      };
    }
  }

  async uploadDocument(request: UploadDocumentRequest): Promise<MCPToolResult> {
    const startTime = Date.now();
    
    try {
      const result = await this.client.callTool({
        name: 'upload_document',
        arguments: {
          site_id: request.site_id,
          content: request.content,
          metadata: request.metadata || {}
        }
      });

      return {
        toolName: 'upload_document',
        success: true,
        result: result.content,
        duration: Date.now() - startTime
      };
    } catch (error) {
      return {
        toolName: 'upload_document',
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime
      };
    }
  }

  async useDesignFigure(
    prompt: string, 
    style: string = 'modern',
    figmaFileKey?: string
  ): Promise<MCPToolResult> {
    const startTime = Date.now();
    
    try {
      const args: any = { prompt, style };
      if (figmaFileKey) {
        args.figma_file_key = figmaFileKey;
      }

      const result = await this.client.callTool({
        name: 'use_design_figure',
        arguments: args
      });

      return {
        toolName: 'use_design_figure',
        success: true,
        result: result.content,
        duration: Date.now() - startTime
      };
    } catch (error) {
      return {
        toolName: 'use_design_figure',
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime
      };
    }
  }

  async getJobStatus(jobId: string): Promise<MCPToolResult> {
    const startTime = Date.now();
    
    try {
      const result = await this.client.callTool({
        name: 'get_job_status',
        arguments: { job_id: jobId }
      });

      return {
        toolName: 'get_job_status',
        success: true,
        result: result.content,
        duration: Date.now() - startTime
      };
    } catch (error) {
      return {
        toolName: 'get_job_status',
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime
      };
    }
  }

  async listTools(): Promise<string[]> {
    try {
      const tools = await this.client.listTools();
      return tools.tools.map((tool: any) => tool.name);
    } catch (error) {
      console.error('Failed to list tools:', error);
      return [];
    }
  }
} 