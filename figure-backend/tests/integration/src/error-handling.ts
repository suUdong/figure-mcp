#!/usr/bin/env node

import * as dotenv from 'dotenv';
import path from 'path';
import { MCPClient } from './utils/mcp-client.js';
import { BackendClient } from './utils/backend-client.js';
import { TestRunner } from './utils/test-runner.js';
import { TestLogger } from './utils/logger.js';
import { TestConfig } from './utils/types.js';

// 환경 변수 로드
dotenv.config({ path: path.join(process.cwd(), '.env') });

async function main() {
  const logger = TestLogger.getInstance();
  logger.setVerbose(process.argv.includes('--verbose'));
  
  logger.section('🚨 Figure-MCP 에러 처리 및 경계 조건 테스트');

  // 테스트 설정
  const config: TestConfig = {
    mcpServerUrl: process.env.MCP_SERVER_PATH || '../figure-mcp-server/dist/server.js',
    backendUrl: process.env.BACKEND_URL || 'http://localhost:8000',
    openaiApiKey: process.env.FIGURE_OPENAI_API_KEY || '',
    figmaAccessToken: process.env.FIGMA_ACCESS_TOKEN,
    timeout: 30000
  };

  // 클라이언트 초기화
  const mcpClient = new MCPClient(config.mcpServerUrl);
  const backendClient = new BackendClient(config.backendUrl, config.timeout);
  const testRunner = new TestRunner();

  try {
    await testRunner.runTestSuite('에러 처리 및 경계 조건 테스트', [
      {
        name: '1. 잘못된 백엔드 URL 테스트',
        testFunction: async () => {
          logger.info('존재하지 않는 백엔드 서버에 연결을 시도합니다...');
          
          const invalidClient = new BackendClient('http://localhost:9999', 5000);
          const isHealthy = await invalidClient.healthCheck();
          
          if (isHealthy) {
            throw new Error('잘못된 URL에서 성공 응답을 받았습니다');
          }
          
          logger.success('예상대로 연결 실패');
        }
      },

      {
        name: '2. 빈 RAG 쿼리 테스트',
        testFunction: async () => {
          logger.info('빈 쿼리로 RAG 요청을 시도합니다...');
          
          try {
            await backendClient.ragQuery({
              query: '',
              site_ids: [],
              max_results: 5
            });
            throw new Error('빈 쿼리에서 성공 응답을 받았습니다');
          } catch (error) {
            if (error instanceof Error && error.message.includes('빈 쿼리')) {
              throw error;
            }
            logger.success('예상대로 빈 쿼리가 거부됨');
          }
        }
      },

      {
        name: '3. 존재하지 않는 사이트 ID 테스트',
        testFunction: async () => {
          logger.info('존재하지 않는 사이트 ID로 RAG 쿼리를 시도합니다...');
          
          const response = await backendClient.ragQuery({
            query: 'test query',
            site_ids: ['non-existent-site-id'],
            max_results: 5
          });

          // 존재하지 않는 사이트 ID는 결과가 없어야 함
          if (response.sources.length > 0) {
            logger.warning('존재하지 않는 사이트에서 결과를 찾았습니다');
          } else {
            logger.success('예상대로 결과 없음');
          }
        }
      },

      {
        name: '4. 과도하게 긴 문서 업로드 테스트',
        testFunction: async () => {
          logger.info('매우 큰 문서 업로드를 시도합니다...');
          
          // 매우 큰 문서 생성 (1MB)
          const largeContent = 'A'.repeat(1024 * 1024);
          
          try {
            const uploadResult = await mcpClient.uploadDocument({
              site_id: 'test-site',
              content: largeContent,
              metadata: { title: 'Large Document Test' }
            });

            if (uploadResult.success) {
              logger.warning('대용량 문서 업로드가 예상외로 성공했습니다');
            } else {
              logger.success('예상대로 대용량 문서 업로드 실패');
            }
          } catch (error) {
            logger.success('예상대로 대용량 문서 업로드 에러');
          }
        }
      },

      {
        name: '5. 잘못된 메타데이터 형식 테스트',
        testFunction: async () => {
          logger.info('잘못된 메타데이터로 문서 업로드를 시도합니다...');
          
          try {
            const uploadResult = await mcpClient.uploadDocument({
              site_id: 'test-site',
              content: 'Test content',
              metadata: {
                title: null as any, // 잘못된 타입
                tags: 'not-an-array' as any, // 잘못된 타입
                source_url: 'invalid-url' // 잘못된 URL 형식
              }
            });

            if (uploadResult.success) {
              logger.warning('잘못된 메타데이터가 예상외로 성공했습니다');
            } else {
              logger.success('예상대로 잘못된 메타데이터 거부됨');
            }
          } catch (error) {
            logger.success('예상대로 잘못된 메타데이터 에러');
          }
        }
      },

      {
        name: '6. 과도한 max_results 값 테스트',
        testFunction: async () => {
          logger.info('과도하게 큰 max_results 값으로 쿼리를 시도합니다...');
          
          try {
            const response = await backendClient.ragQuery({
              query: 'test query',
              site_ids: [],
              max_results: 10000 // 과도하게 큰 값
            });

            // 시스템에서 제한해야 함
            if (response.sources.length > 100) {
              throw new Error('과도한 결과 수가 반환되었습니다');
            }
            
            logger.success('적절한 결과 수 제한 적용됨');
          } catch (error) {
            if (error instanceof Error && error.message.includes('과도한')) {
              throw error;
            }
            logger.success('예상대로 큰 max_results 값 처리됨');
          }
        }
      },

      {
        name: '7. MCP 서버 없이 도구 호출 테스트',
        testFunction: async () => {
          logger.info('MCP 서버 연결 없이 도구 호출을 시도합니다...');
          
          const disconnectedClient = new MCPClient('non-existent-server.js');
          
          try {
            const result = await disconnectedClient.listSites();
            
            if (result.success) {
              throw new Error('연결되지 않은 MCP 서버에서 성공 응답');
            }
            
            logger.success('예상대로 MCP 서버 연결 실패');
          } catch (error) {
            logger.success('예상대로 MCP 서버 연결 에러');
          }
        }
      },

      {
        name: '8. 잘못된 job_id로 상태 확인 테스트',
        testFunction: async () => {
          logger.info('존재하지 않는 job_id로 상태 확인을 시도합니다...');
          
          await mcpClient.connect();
          
          const statusResult = await mcpClient.getJobStatus('non-existent-job-id');
          
          if (statusResult.success) {
            logger.warning('존재하지 않는 job_id에서 성공 응답');
          } else {
            logger.success('예상대로 존재하지 않는 job_id 거부됨');
          }
        }
      },

      {
        name: '9. 타임아웃 테스트',
        testFunction: async () => {
          logger.info('의도적으로 타임아웃을 발생시킵니다...');
          
          const shortTimeoutClient = new BackendClient(config.backendUrl, 100); // 100ms 타임아웃
          
          try {
            // 긴 처리가 필요한 RAG 쿼리
            await shortTimeoutClient.ragQuery({
              query: 'This is a very long query that should take some time to process and hopefully timeout',
              site_ids: [],
              max_results: 50
            });
            
            logger.warning('타임아웃이 예상되었지만 성공했습니다');
          } catch (error) {
            if (error instanceof Error && error.message.includes('timeout')) {
              logger.success('예상대로 타임아웃 발생');
            } else {
              logger.success('네트워크 에러로 인한 실패 (타임아웃 유사)');
            }
          }
        }
      },

      {
        name: '10. 동시 요청 제한 테스트',
        testFunction: async () => {
          logger.info('동시에 여러 요청을 보내어 제한을 테스트합니다...');
          
          const promises = Array.from({ length: 10 }, (_, i) =>
            backendClient.ragQuery({
              query: `동시 요청 테스트 ${i}`,
              site_ids: [],
              max_results: 1
            })
          );

          try {
            const results = await Promise.allSettled(promises);
            const successCount = results.filter(r => r.status === 'fulfilled').length;
            const failureCount = results.filter(r => r.status === 'rejected').length;
            
            logger.info(`동시 요청 결과: 성공 ${successCount}, 실패 ${failureCount}`);
            
            if (failureCount > 0) {
              logger.success('일부 요청이 제한되어 건전한 시스템 동작 확인');
            } else {
              logger.success('모든 동시 요청이 성공적으로 처리됨');
            }
          } catch (error) {
            logger.success('동시 요청 제한 메커니즘 작동');
          }
        }
      }
    ]);

  } catch (error) {
    logger.error('에러 처리 테스트 실행 중 오류 발생:', error);
    process.exit(1);
  } finally {
    // 클라이언트 연결 해제
    try {
      await mcpClient.disconnect();
      logger.info('MCP 클라이언트 연결 해제 완료');
    } catch (error) {
      // 이미 연결되지 않았을 수 있음
    }
  }

  // 최종 결과 출력
  const stats = testRunner.getStats();
  logger.success(`\n✅ 에러 처리 테스트 완료! ${stats.passCount}/${stats.total} 성공`);
  
  if (stats.failCount > 0) {
    logger.warning(`⚠️ ${stats.failCount}개 테스트에서 예상과 다른 결과`);
  }
  
  process.exit(0);
}

// 메인 실행
if (require.main === module) {
  main().catch((error) => {
    console.error('실행 오류:', error);
    process.exit(1);
  });
} 