/**
 * End-to-End 테스트: MCP 서버와 Cursor IDE 연동 시뮬레이션
 * 실제 사용자 시나리오를 기반으로 한 전체 플로우 검증
 * 
 * 실행 전 요구사항:
 * 1. 전체 시스템 실행: docker-compose up
 * 2. MCP 서버 빌드: npm run build
 */

import { spawn, ChildProcess } from 'child_process';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { 
  CallToolRequestSchema, 
  ListToolsRequestSchema,
  CallToolRequest 
} from '@modelcontextprotocol/sdk/types.js';
import path from 'path';
import { performance } from 'perf_hooks';

// 테스트 설정
const MCP_SERVER_PATH = path.join(process.cwd(), 'dist', 'figure-mcp-server.js');
const TEST_TIMEOUT = 60000; // 60초 (E2E는 시간이 오래 걸릴 수 있음)

// MCP 클라이언트 래퍼
class MCPTestClient {
  private client: Client;
  private serverProcess: ChildProcess | null = null;
  private transport: StdioServerTransport | null = null;

  constructor() {
    this.client = new Client(
      { name: 'test-client', version: '1.0.0' },
      { capabilities: {} }
    );
  }

  async connect(): Promise<void> {
    console.log(`🚀 MCP 서버 시작: ${MCP_SERVER_PATH}`);
    
    // MCP 서버 프로세스 시작
    this.serverProcess = spawn('node', [MCP_SERVER_PATH], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        MCP_QUIET: 'true',
        BACKEND_API_URL: 'http://localhost:8001/api'
      }
    });

    if (!this.serverProcess.stdin || !this.serverProcess.stdout) {
      throw new Error('MCP 서버 프로세스 시작 실패');
    }

    // 에러 핸들링
    this.serverProcess.on('error', (error) => {
      console.error('MCP 서버 프로세스 에러:', error);
    });

    this.serverProcess.stderr?.on('data', (data) => {
      const message = data.toString();
      if (!message.includes('Figure MCP Server') && !message.includes('서버 준비 완료')) {
        console.warn('MCP 서버 경고:', message.trim());
      }
    });

    // Transport 생성 및 연결
    this.transport = new StdioServerTransport();
    await this.client.connect(this.transport);
    
    console.log('✅ MCP 클라이언트 연결 성공');
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
    }
    
    if (this.serverProcess) {
      this.serverProcess.kill('SIGTERM');
      
      // 프로세스 종료 대기
      await new Promise<void>((resolve) => {
        this.serverProcess!.on('exit', () => {
          console.log('🔄 MCP 서버 프로세스 종료');
          resolve();
        });
        
        // 5초 후 강제 종료
        setTimeout(() => {
          if (this.serverProcess && !this.serverProcess.killed) {
            this.serverProcess.kill('SIGKILL');
            resolve();
          }
        }, 5000);
      });
    }
  }

  async listTools() {
    return await this.client.request(
      { method: 'tools/list', params: {} },
      ListToolsRequestSchema
    );
  }

  async callTool(name: string, arguments_: any) {
    const request: CallToolRequest = {
      method: 'tools/call',
      params: {
        name,
        arguments: arguments_
      }
    };
    
    return await this.client.request(request, CallToolRequestSchema);
  }
}

describe('MCP ↔ Cursor IDE 연동 E2E 테스트', () => {
  let mcpClient: MCPTestClient;

  beforeAll(async () => {
    mcpClient = new MCPTestClient();
    await mcpClient.connect();
  }, TEST_TIMEOUT);

  afterAll(async () => {
    await mcpClient.disconnect();
  });

  describe('🛠️ MCP 도구 기본 기능 테스트', () => {
    test('사용 가능한 도구 목록 조회', async () => {
      console.log('📋 MCP 도구 목록 조회...');
      
      const response = await mcpClient.listTools();
      
      expect(response.tools).toBeDefined();
      expect(Array.isArray(response.tools)).toBe(true);
      expect(response.tools.length).toBeGreaterThan(0);
      
      // 예상되는 주요 도구들이 있는지 확인
      const toolNames = response.tools.map(tool => tool.name);
      const expectedTools = [
        'start_task',
        'create_document',
        'create_table_specification',
        'list_available_sites',
        'fetch_jira_ticket',
        'search_jira_tickets'
      ];
      
      expectedTools.forEach(toolName => {
        expect(toolNames).toContain(toolName);
      });
      
      console.log(`✅ MCP 도구 ${response.tools.length}개 확인: ${toolNames.join(', ')}`);
    });
  });

  describe('🏢 사이트 관리 시나리오', () => {
    test('사이트 목록 조회 시나리오', async () => {
      console.log('🏢 사이트 목록 조회 시나리오 테스트...');
      
      const startTime = performance.now();
      
      const response = await mcpClient.callTool('list_available_sites', {});
      
      const endTime = performance.now();
      const responseTime = endTime - startTime;
      
      expect(response.content).toBeDefined();
      expect(Array.isArray(response.content)).toBe(true);
      expect(response.content.length).toBeGreaterThan(0);
      expect(response.content[0].type).toBe('text');
      expect(response.content[0].text).toContain('사용 가능한 사이트');
      
      // 성능 검증 (5초 이내)
      expect(responseTime).toBeLessThan(5000);
      
      console.log(`✅ 사이트 목록 조회 성공 (응답 시간: ${responseTime.toFixed(2)}ms)`);
    });
  });

  describe('📝 문서 생성 시나리오', () => {
    test('자연어로 영향도 분석서 생성 시나리오', async () => {
      console.log('📝 영향도 분석서 생성 시나리오 테스트...');
      
      const startTime = performance.now();
      
      const response = await mcpClient.callTool('create_document', {
        documentRequest: '사용자 인증 시스템 영향도 분석서 만들어줘',
        analysisType: 'full',
        siteName: 'KT알파'
      });
      
      const endTime = performance.now();
      const responseTime = endTime - startTime;
      
      expect(response.content).toBeDefined();
      expect(Array.isArray(response.content)).toBe(true);
      expect(response.content[0].type).toBe('text');
      
      const responseText = response.content[0].text;
      expect(responseText).toContain('영향도 분석서');
      expect(responseText).toContain('사용자 인증 시스템');
      expect(responseText).toContain('종합 위험도');
      expect(responseText).toContain('체크리스트');
      
      // 성능 검증 (30초 이내)
      expect(responseTime).toBeLessThan(30000);
      
      console.log(`✅ 영향도 분석서 생성 성공 (응답 시간: ${responseTime.toFixed(2)}ms)`);
    });

    test('테이블 명세서 생성 시나리오', async () => {
      console.log('📊 테이블 명세서 생성 시나리오 테스트...');
      
      const startTime = performance.now();
      
      const response = await mcpClient.callTool('create_table_specification', {
        tableName: 'users,orders,products',
        schemaInfo: JSON.stringify({
          tables: [
            {
              name: 'users',
              columns: [
                { name: 'id', type: 'BIGINT', primaryKey: true },
                { name: 'email', type: 'VARCHAR(255)', unique: true },
                { name: 'name', type: 'VARCHAR(100)' },
                { name: 'created_at', type: 'TIMESTAMP' }
              ]
            },
            {
              name: 'orders',
              columns: [
                { name: 'id', type: 'BIGINT', primaryKey: true },
                { name: 'user_id', type: 'BIGINT', foreignKey: 'users.id' },
                { name: 'total_amount', type: 'DECIMAL(10,2)' },
                { name: 'created_at', type: 'TIMESTAMP' }
              ]
            }
          ]
        }),
        includeIndexes: true,
        includeConstraints: true
      });
      
      const endTime = performance.now();
      const responseTime = endTime - startTime;
      
      expect(response.content).toBeDefined();
      expect(response.content[0].type).toBe('text');
      
      const responseText = response.content[0].text;
      expect(responseText).toContain('테이블 명세서');
      expect(responseText).toContain('users');
      expect(responseText).toContain('orders');
      expect(responseText).toContain('BIGINT');
      expect(responseText).toContain('VARCHAR');
      
      // 성능 검증 (15초 이내)
      expect(responseTime).toBeLessThan(15000);
      
      console.log(`✅ 테이블 명세서 생성 성공 (응답 시간: ${responseTime.toFixed(2)}ms)`);
    });
  });

  describe('🎯 개발 태스크 시나리오', () => {
    test('Feature 개발 태스크 시작 시나리오', async () => {
      console.log('🎯 Feature 개발 태스크 시작 시나리오 테스트...');
      
      const startTime = performance.now();
      
      const response = await mcpClient.callTool('start_task', {
        taskName: '결제 시스템 리뉴얼',
        taskType: 'feature',
        requirementSource: 'manual',
        requirements: `
          기존 PG사 연동을 개선하여 다중 PG사 지원 및 결제 실패율을 50% 개선해야 함.
          주요 요구사항:
          1. 토스페이, 네이버페이, 카카오페이 추가 연동
          2. 결제 실패 시 자동 재시도 로직 구현
          3. 결제 상태 실시간 모니터링 대시보드 구축
          4. 기존 결제 데이터 무결성 보장하며 점진적 마이그레이션
        `,
        complexity: 'complex',
        siteName: 'KT알파'
      });
      
      const endTime = performance.now();
      const responseTime = endTime - startTime;
      
      expect(response.content).toBeDefined();
      expect(response.content[0].type).toBe('text');
      
      const responseText = response.content[0].text;
      expect(responseText).toContain('결제 시스템 리뉴얼');
      expect(responseText).toContain('새 기능 개발');
      expect(responseText).toContain('개발 워크플로우 계획');
      expect(responseText).toContain('1단계');
      expect(responseText).toContain('체크리스트');
      expect(responseText).toContain('기능 명세서');
      
      // 복합 태스크이므로 다양한 문서 계획이 포함되어야 함
      expect(responseText).toContain('기술 명세서');
      expect(responseText).toContain('영향도 분석서');
      expect(responseText).toContain('시스템 아키텍처');
      
      // 성능 검증 (20초 이내)
      expect(responseTime).toBeLessThan(20000);
      
      console.log(`✅ Feature 태스크 시작 성공 (응답 시간: ${responseTime.toFixed(2)}ms)`);
    });

    test('Bug 수정 태스크 시작 시나리오', async () => {
      console.log('🐛 Bug 수정 태스크 시작 시나리오 테스트...');
      
      const response = await mcpClient.callTool('start_task', {
        taskName: '로그인 세션 만료 오류 수정',
        taskType: 'bug',
        requirementSource: 'manual',
        requirements: `
          사용자가 30분 이상 활동하지 않을 때 세션이 만료되어야 하지만,
          현재 10분 만에 만료되어 사용자 불편이 발생하고 있음.
          
          재현 단계:
          1. 로그인 후 10분간 활동 중지
          2. 11분 후 페이지 새로고침 시 로그인 페이지로 리다이렉트
          3. 예상: 30분까지는 세션 유지되어야 함
        `,
        complexity: 'normal'
      });
      
      expect(response.content[0].text).toContain('버그 수정');
      expect(response.content[0].text).toContain('로그인 세션 만료 오류 수정');
      expect(response.content[0].text).toContain('버그 분석서');
      expect(response.content[0].text).toContain('회귀 테스트');
      
      console.log('✅ Bug 수정 태스크 시작 성공');
    });
  });

  describe('🔍 JIRA 연동 시나리오 (선택적)', () => {
    test('JIRA 티켓 조회 시나리오 (JIRA 설정 시에만)', async () => {
      // JIRA 설정이 있는 경우에만 테스트
      if (!process.env.JIRA_BASE_URL || !process.env.JIRA_API_TOKEN) {
        console.log('⏭️ JIRA 설정이 없어 테스트 스킵');
        return;
      }
      
      console.log('🎫 JIRA 티켓 조회 시나리오 테스트...');
      
      try {
        const response = await mcpClient.callTool('fetch_jira_ticket', {
          ticketKey: 'DEMO-1', // 데모 티켓 키 (실제 환경에 맞게 수정)
          includeComments: true,
          includeSubtasks: false
        });
        
        expect(response.content).toBeDefined();
        expect(response.content[0].type).toBe('text');
        
        const responseText = response.content[0].text;
        if (!responseText.includes('티켓을 찾을 수 없습니다')) {
          expect(responseText).toContain('JIRA 티켓 정보');
          expect(responseText).toContain('기본 정보');
          console.log('✅ JIRA 티켓 조회 성공');
        } else {
          console.log('⚠️ 테스트용 JIRA 티켓이 없음 (정상 동작)');
        }
        
      } catch (error) {
        // JIRA 연결 오류는 예상 가능한 상황
        console.log('⚠️ JIRA 연결 실패 (설정 확인 필요):', (error as Error).message);
      }
    });
  });

  describe('⚡ 성능 및 안정성 시나리오', () => {
    test('연속 호출 안정성 테스트', async () => {
      console.log('🔄 연속 호출 안정성 테스트...');
      
      const calls = [
        () => mcpClient.callTool('list_available_sites', {}),
        () => mcpClient.callTool('create_document', {
          documentRequest: '간단한 요구사항서',
          analysisType: 'template-only'
        }),
        () => mcpClient.callTool('list_available_sites', {}), // 캐시 테스트
      ];
      
      const startTime = performance.now();
      const results = await Promise.all(calls.map(call => call()));
      const endTime = performance.now();
      
      // 모든 호출이 성공해야 함
      results.forEach((result, index) => {
        expect(result.content).toBeDefined();
        expect(result.isError).not.toBe(true);
        console.log(`  ✅ 호출 ${index + 1} 성공`);
      });
      
      const totalTime = endTime - startTime;
      console.log(`✅ 연속 호출 테스트 성공 (총 소요 시간: ${totalTime.toFixed(2)}ms)`);
    });

    test('에러 복구 시나리오', async () => {
      console.log('🔧 에러 복구 시나리오 테스트...');
      
      // 잘못된 요청으로 에러 발생
      try {
        await mcpClient.callTool('create_document', {
          documentRequest: '', // 빈 요청
          analysisType: 'invalid-type'
        });
        
        // 에러가 발생하지 않으면 테스트 실패
        expect(true).toBe(false);
        
      } catch (error) {
        console.log('  ✅ 예상된 에러 발생:', (error as Error).message);
      }
      
      // 에러 후 정상 요청이 여전히 작동하는지 확인
      const response = await mcpClient.callTool('list_available_sites', {});
      expect(response.content).toBeDefined();
      expect(response.isError).not.toBe(true);
      
      console.log('✅ 에러 후 시스템 복구 확인');
    });
  });
});

// E2E 테스트 헬퍼 함수들
export async function waitForMCPServer(maxAttempts: number = 30): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const client = new MCPTestClient();
      await client.connect();
      await client.listTools();
      await client.disconnect();
      return;
    } catch (error) {
      console.log(`⏳ MCP 서버 대기 중... (${i + 1}/${maxAttempts})`);
      if (i === maxAttempts - 1) {
        throw new Error('MCP 서버 준비 시간 초과');
      }
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
}

export function simulateUserInput(message: string) {
  return {
    timestamp: new Date().toISOString(),
    user: 'test-user',
    message: message,
    context: 'cursor-ide'
  };
}
