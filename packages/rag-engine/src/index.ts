/**
 * Figure-MCP RAG Engine
 * 검색 증강 생성 시스템
 */

// RAG 엔진 메인 클래스
export { RAGEngine } from './rag-engine';
export type {
  RAGConfig,
  RetrievedDocument,
  RAGResponse,
  ContextWindow,
} from './rag-engine';

// LLM 기본 클래스 및 인터페이스
export { BaseLLM } from './llm/base-llm';
export type {
  LLMMessage,
  LLMResponse,
  LLMConfig,
} from './llm/base-llm';

// 구체적인 LLM 제공자들
export { OpenAILLM } from './llm/openai-llm';
export type { OpenAIConfig } from './llm/openai-llm';

export { AnthropicLLM } from './llm/anthropic-llm';
export type { AnthropicConfig } from './llm/anthropic-llm';

// 유틸리티 함수들
export * from './utils/prompt-templates';
export * from './utils/response-formatter';

// 버전 정보
export const VERSION = '1.0.0'; 