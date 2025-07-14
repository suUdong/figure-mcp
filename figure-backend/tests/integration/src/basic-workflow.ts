#!/usr/bin/env node

import * as dotenv from 'dotenv';
import path from 'path';
import { MCPClient } from './utils/mcp-client.js';
import { BackendClient } from './utils/backend-client.js';
import { TestRunner, sleep, generateTestData } from './utils/test-runner.js';
import { TestLogger } from './utils/logger.js';
import { TestConfig } from './utils/types.js';

// 환경 변수 로드
dotenv.config({ path: path.join(process.cwd(), '.env') });

async function main() {
  const logger = TestLogger.getInstance();
  logger.setVerbose(process.argv.includes('--verbose'));
  
  logger.section('🧪 Figure-MCP 기본 워크플로우 통합 테스트');

  // 테스트 설정
  const config: TestConfig = {
    mcpServerUrl: process.env.MCP_SERVER_PATH || '../figure-mcp-server/dist/server.js',
    backendUrl: process.env.BACKEND_URL || 'http://localhost:8000',
    openaiApiKey: process.env.FIGURE_OPENAI_API_KEY || '',
    figmaAccessToken: process.env.FIGMA_ACCESS_TOKEN,
    timeout: 30000
  };

  if (!config.openaiApiKey) {
    logger.error('FIGURE_OPENAI_API_KEY 환경변수가 설정되지 않았습니다.');
    process.exit(1);
  }

  // 클라이언트 초기화
  const mcpClient = new MCPClient(config.mcpServerUrl);
  const backendClient = new BackendClient(config.backendUrl, config.timeout);
  const testRunner = new TestRunner();
  const testData = generateTestData();

  let testSiteId: string = '';
  let uploadedDocumentId: string = '';

  try {
    await testRunner.runTestSuite('기본 워크플로우 테스트', [
      {
        name: '1. 백엔드 헬스 체크',
        testFunction: async () => {
          logger.info('백엔드 연결 상태를 확인합니다...');
          const isHealthy = await backendClient.healthCheck();
          if (!isHealthy) {
            throw new Error('백엔드 서버에 연결할 수 없습니다');
          }
          logger.success('백엔드 서버 연결 성공');
        }
      },

      {
        name: '2. MCP 서버 연결',
        testFunction: async () => {
          logger.info('MCP 서버에 연결합니다...');
          await mcpClient.connect();
          
          // 사용 가능한 도구 확인
          const tools = await mcpClient.listTools();
          logger.info(`사용 가능한 MCP 도구: ${tools.join(', ')}`);
          
          const expectedTools = ['list_sites', 'upload_document', 'use_design_figure', 'get_job_status'];
          for (const tool of expectedTools) {
            if (!tools.includes(tool)) {
              throw new Error(`필수 도구 '${tool}'를 찾을 수 없습니다`);
            }
          }
          logger.success('MCP 서버 연결 및 도구 확인 완료');
        }
      },

      {
        name: '3. 기본 사이트 확인',
        testFunction: async () => {
          logger.info('기본 사이트 목록을 조회합니다...');
          
          // MCP를 통한 사이트 목록 조회
          const mcpResult = await mcpClient.listSites();
          if (!mcpResult.success) {
            throw new Error(`MCP list_sites 실패: ${mcpResult.error}`);
          }
          
          // 백엔드 API를 통한 사이트 목록 조회
          const sites = await backendClient.getSites();
          
          if (sites.length === 0) {
            // 테스트용 사이트 생성
            logger.info('테스트용 사이트를 생성합니다...');
            const newSite = await backendClient.createSite(
              'test-integration-site',
              'MCP 통합 테스트용 사이트'
            );
            testSiteId = newSite.id;
            logger.success(`테스트 사이트 생성 완료: ${testSiteId}`);
          } else {
            testSiteId = sites[0].id;
            logger.success(`기존 사이트 사용: ${testSiteId}`);
          }
        }
      },

      {
        name: '4. 문서 업로드 (MCP)',
        testFunction: async () => {
          logger.info('MCP를 통해 테스트 문서를 업로드합니다...');
          
          const uploadResult = await mcpClient.uploadDocument({
            site_id: testSiteId,
            content: testData.sampleDocument.content,
            metadata: {
              title: testData.sampleDocument.title,
              source_url: testData.sampleDocument.source_url,
              tags: testData.sampleDocument.tags
            }
          });

          if (!uploadResult.success) {
            throw new Error(`문서 업로드 실패: ${uploadResult.error}`);
          }

          logger.info('업로드 처리를 위해 잠시 대기합니다...');
          await sleep(3000); // 벡터화 처리 대기

          logger.success('문서 업로드 완료', uploadResult.result);
        }
      },

      {
        name: '5. RAG 쿼리 실행',
        testFunction: async () => {
          logger.info('업로드된 문서를 기반으로 RAG 쿼리를 실행합니다...');
          
          for (const query of testData.sampleQueries.slice(0, 2)) { // 처음 2개만 테스트
            logger.info(`쿼리: "${query}"`);
            
            const ragResponse = await backendClient.ragQuery({
              query,
              site_ids: [testSiteId],
              max_results: 3
            });

            if (!ragResponse.response) {
              throw new Error('RAG 쿼리 응답이 비어있습니다');
            }

            if (ragResponse.sources.length === 0) {
              throw new Error('RAG 쿼리에서 소스를 찾을 수 없습니다');
            }

            logger.success(`RAG 응답 생성 완료 (처리시간: ${ragResponse.processing_time}ms)`);
            logger.info(`응답 길이: ${ragResponse.response.length}자, 소스 개수: ${ragResponse.sources.length}개`);
          }
        }
      },

      {
        name: '6. 디자인 생성 요청',
        testFunction: async () => {
          if (!config.figmaAccessToken) {
            logger.warning('FIGMA_ACCESS_TOKEN이 설정되지 않아 디자인 생성을 건너뜁니다');
            return;
          }

          logger.info('RAG 결과를 기반으로 디자인을 생성합니다...');
          
          const designPrompt = testData.sampleDesignPrompts[0];
          const designResult = await mcpClient.useDesignFigure(
            designPrompt,
            'modern'
          );

          if (!designResult.success) {
            throw new Error(`디자인 생성 실패: ${designResult.error}`);
          }

          logger.success('디자인 생성 요청 완료', designResult.result);

          // 작업 상태 확인 (job_id가 있다면)
          if (designResult.result && designResult.result.job_id) {
            logger.info('작업 상태를 확인합니다...');
            
            let attempts = 0;
            while (attempts < 5) {
              const statusResult = await mcpClient.getJobStatus(designResult.result.job_id);
              
              if (statusResult.success) {
                logger.info(`작업 상태: ${JSON.stringify(statusResult.result)}`);
                
                if (statusResult.result.status === 'completed') {
                  logger.success('디자인 생성 완료!');
                  break;
                } else if (statusResult.result.status === 'failed') {
                  throw new Error('디자인 생성 실패');
                }
              }
              
              attempts++;
              await sleep(2000);
            }
          }
        }
      },

      {
        name: '7. 정리 작업',
        testFunction: async () => {
          logger.info('테스트 정리 작업을 수행합니다...');
          
          // 테스트 사이트 삭제 (필요한 경우)
          if (testSiteId && testSiteId.includes('test-integration')) {
            try {
              await backendClient.deleteSite(testSiteId);
              logger.info('테스트 사이트 삭제 완료');
            } catch (error) {
              logger.warning('테스트 사이트 삭제 실패 (무시됨)');
            }
          }
          
          logger.success('정리 작업 완료');
        }
      }
    ]);

  } catch (error) {
    logger.error('테스트 실행 중 오류 발생:', error);
    process.exit(1);
  } finally {
    // 클라이언트 연결 해제
    try {
      await mcpClient.disconnect();
      logger.info('MCP 클라이언트 연결 해제 완료');
    } catch (error) {
      logger.warning('MCP 클라이언트 연결 해제 실패');
    }
  }

  // 최종 결과 출력
  const stats = testRunner.getStats();
  if (stats.failCount > 0) {
    logger.error(`\n❌ 테스트 실패! ${stats.failCount}/${stats.total} 실패`);
    process.exit(1);
  } else {
    logger.success(`\n✅ 모든 테스트 통과! ${stats.passCount}/${stats.total} 성공`);
    process.exit(0);
  }
}

// 메인 실행
if (require.main === module) {
  main().catch((error) => {
    console.error('실행 오류:', error);
    process.exit(1);
  });
} 