import { TestResult, TestSuite, TestConfig } from './types.js';
import { TestLogger } from './logger.js';

export class TestRunner {
  private logger: TestLogger;
  private results: TestResult[] = [];

  constructor() {
    this.logger = TestLogger.getInstance();
  }

  async runTest(
    name: string,
    testFunction: () => Promise<void>,
    timeout: number = 30000
  ): Promise<TestResult> {
    const startTime = Date.now();
    
    try {
      // 타임아웃 설정
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`테스트 타임아웃 (${timeout}ms)`)), timeout);
      });

      await Promise.race([testFunction(), timeoutPromise]);

      const result: TestResult = {
        name,
        status: 'PASS',
        duration: Date.now() - startTime
      };

      this.results.push(result);
      this.logger.result(name, 'PASS', result.duration);
      return result;

    } catch (error) {
      const result: TestResult = {
        name,
        status: 'FAIL',
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error)
      };

      this.results.push(result);
      this.logger.result(name, 'FAIL', result.duration, result.error);
      return result;
    }
  }

  async runTestSuite(
    suiteName: string,
    tests: Array<{
      name: string;
      testFunction: () => Promise<void>;
      timeout?: number;
      skip?: boolean;
    }>
  ): Promise<TestSuite> {
    this.logger.section(`테스트 스위트: ${suiteName}`);
    
    const suiteResults: TestResult[] = [];
    const startTime = Date.now();

    for (const test of tests) {
      if (test.skip) {
        const result: TestResult = {
          name: test.name,
          status: 'SKIP',
          duration: 0
        };
        suiteResults.push(result);
        this.logger.result(test.name, 'SKIP', 0);
        continue;
      }

      const result = await this.runTest(test.name, test.testFunction, test.timeout);
      suiteResults.push(result);
    }

    const suite: TestSuite = {
      name: suiteName,
      tests: suiteResults,
      totalDuration: Date.now() - startTime,
      passCount: suiteResults.filter(r => r.status === 'PASS').length,
      failCount: suiteResults.filter(r => r.status === 'FAIL').length,
      skipCount: suiteResults.filter(r => r.status === 'SKIP').length
    };

    this.logger.summary(suite);
    return suite;
  }

  getResults(): TestResult[] {
    return [...this.results];
  }

  getStats() {
    const passCount = this.results.filter(r => r.status === 'PASS').length;
    const failCount = this.results.filter(r => r.status === 'FAIL').length;
    const skipCount = this.results.filter(r => r.status === 'SKIP').length;
    const totalDuration = this.results.reduce((sum, r) => sum + r.duration, 0);

    return {
      total: this.results.length,
      passCount,
      failCount,
      skipCount,
      totalDuration,
      successRate: passCount / (passCount + failCount) * 100
    };
  }

  clearResults(): void {
    this.results = [];
  }
}

export async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function generateTestData() {
  return {
    sampleDocument: {
      title: 'MCP 통합 테스트 문서',
      content: `
# Model Context Protocol (MCP) 개요

MCP는 AI 애플리케이션과 데이터 소스 간의 표준화된 연결을 제공하는 프로토콜입니다.

## 주요 특징
- 확장 가능한 아키텍처
- 보안 컨텍스트 관리
- 실시간 데이터 동기화

## 사용 사례
1. RAG (Retrieval-Augmented Generation) 시스템
2. 디자인 자동화 도구
3. 문서 관리 시스템

이 문서는 통합 테스트 목적으로 작성되었습니다.
      `.trim(),
      tags: ['mcp', 'test', 'integration'],
      source_url: 'https://example.com/mcp-docs'
    },
    
    sampleQueries: [
      'MCP란 무엇인가요?',
      'RAG 시스템에 대해 설명해주세요',
      'MCP의 주요 특징은 무엇인가요?',
      '디자인 자동화는 어떻게 작동하나요?'
    ],

    sampleDesignPrompts: [
      '모던한 대시보드 디자인을 만들어주세요',
      'MCP 시스템 아키텍처를 시각화해주세요',
      '사용자 친화적인 문서 업로드 인터페이스를 디자인해주세요'
    ]
  };
} 