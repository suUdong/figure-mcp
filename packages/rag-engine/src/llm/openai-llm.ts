/**
 * OpenAI LLM 제공자
 */

import OpenAI from 'openai';
import { BaseLLM, LLMMessage, LLMResponse, LLMConfig } from './base-llm';

export interface OpenAIConfig extends LLMConfig {
  apiKey: string;
  model?: string;
  organization?: string;
  baseURL?: string;
}

export class OpenAILLM extends BaseLLM {
  private client: OpenAI;
  private model: string;

  constructor(config: OpenAIConfig) {
    super(config);
    
    this.client = new OpenAI({
      apiKey: config.apiKey,
      organization: config.organization,
      baseURL: config.baseURL,
    });
    
    this.model = config.model || 'gpt-3.5-turbo';
  }

  async generateCompletion(
    messages: LLMMessage[], 
    config?: Partial<LLMConfig>
  ): Promise<LLMResponse> {
    try {
      const finalConfig = { ...this.config, ...config };
      
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: messages as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
        temperature: finalConfig.temperature,
        max_tokens: finalConfig.maxTokens,
        top_p: finalConfig.topP,
        frequency_penalty: finalConfig.frequencyPenalty,
        presence_penalty: finalConfig.presencePenalty,
        stop: finalConfig.stop,
      });

      const choice = response.choices[0];
      if (!choice || !choice.message) {
        throw new Error('OpenAI 응답에서 메시지를 찾을 수 없습니다');
      }

      return {
        content: choice.message.content || '',
        usage: response.usage ? {
          promptTokens: response.usage.prompt_tokens,
          completionTokens: response.usage.completion_tokens,
          totalTokens: response.usage.total_tokens,
        } : undefined,
        model: response.model,
        finishReason: this.mapFinishReason(choice.finish_reason),
      };
    } catch (error: any) {
      throw new Error(`OpenAI API 호출 실패: ${error.message}`);
    }
  }

  async *generateStreamCompletion(
    messages: LLMMessage[], 
    config?: Partial<LLMConfig>
  ): AsyncIterable<string> {
    try {
      const finalConfig = { ...this.config, ...config };
      
      const stream = await this.client.chat.completions.create({
        model: this.model,
        messages: messages as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
        temperature: finalConfig.temperature,
        max_tokens: finalConfig.maxTokens,
        top_p: finalConfig.topP,
        frequency_penalty: finalConfig.frequencyPenalty,
        presence_penalty: finalConfig.presencePenalty,
        stop: finalConfig.stop,
        stream: true,
      });

      for await (const chunk of stream) {
        const choice = chunk.choices[0];
        if (choice && choice.delta && choice.delta.content) {
          yield choice.delta.content;
        }
      }
    } catch (error: any) {
      throw new Error(`OpenAI 스트리밍 API 호출 실패: ${error.message}`);
    }
  }

  getModelInfo() {
    const modelInfo: Record<string, any> = {
      'gpt-3.5-turbo': {
        name: 'GPT-3.5 Turbo',
        provider: 'OpenAI',
        maxContextLength: 4096,
        supportsFunctionCalling: true,
        supportsStreaming: true,
      },
      'gpt-3.5-turbo-16k': {
        name: 'GPT-3.5 Turbo 16K',
        provider: 'OpenAI',
        maxContextLength: 16384,
        supportsFunctionCalling: true,
        supportsStreaming: true,
      },
      'gpt-4': {
        name: 'GPT-4',
        provider: 'OpenAI',
        maxContextLength: 8192,
        supportsFunctionCalling: true,
        supportsStreaming: true,
      },
      'gpt-4-32k': {
        name: 'GPT-4 32K',
        provider: 'OpenAI',
        maxContextLength: 32768,
        supportsFunctionCalling: true,
        supportsStreaming: true,
      },
      'gpt-4-turbo-preview': {
        name: 'GPT-4 Turbo',
        provider: 'OpenAI',
        maxContextLength: 128000,
        supportsFunctionCalling: true,
        supportsStreaming: true,
      },
      'gpt-4o': {
        name: 'GPT-4o',
        provider: 'OpenAI',
        maxContextLength: 128000,
        supportsFunctionCalling: true,
        supportsStreaming: true,
      },
    };

    return modelInfo[this.model] || {
      name: this.model,
      provider: 'OpenAI',
      maxContextLength: 4096,
      supportsFunctionCalling: false,
      supportsStreaming: true,
    };
  }

  /**
   * 함수 호출 지원
   */
  async generateFunctionCall(
    messages: LLMMessage[],
    functions: OpenAI.Chat.Completions.ChatCompletionCreateParams.Function[],
    config?: Partial<LLMConfig>
  ): Promise<{
    content: string;
    functionCall?: {
      name: string;
      arguments: string;
    };
    usage?: LLMResponse['usage'];
  }> {
    try {
      const finalConfig = { ...this.config, ...config };
      
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: messages as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
        functions,
        temperature: finalConfig.temperature,
        max_tokens: finalConfig.maxTokens,
        top_p: finalConfig.topP,
        frequency_penalty: finalConfig.frequencyPenalty,
        presence_penalty: finalConfig.presencePenalty,
      });

      const choice = response.choices[0];
      if (!choice || !choice.message) {
        throw new Error('OpenAI 응답에서 메시지를 찾을 수 없습니다');
      }

      return {
        content: choice.message.content || '',
        functionCall: choice.message.function_call ? {
          name: choice.message.function_call.name || '',
          arguments: choice.message.function_call.arguments || '',
        } : undefined,
        usage: response.usage ? {
          promptTokens: response.usage.prompt_tokens,
          completionTokens: response.usage.completion_tokens,
          totalTokens: response.usage.total_tokens,
        } : undefined,
      };
    } catch (error: any) {
      throw new Error(`OpenAI 함수 호출 실패: ${error.message}`);
    }
  }

  /**
   * 임베딩 생성 (텍스트 유사도 검색용)
   */
  async generateEmbedding(
    text: string | string[], 
    model: string = 'text-embedding-ada-002'
  ): Promise<number[][]> {
    try {
      const response = await this.client.embeddings.create({
        model,
        input: text,
      });

      return response.data.map(item => item.embedding);
    } catch (error: any) {
      throw new Error(`OpenAI 임베딩 생성 실패: ${error.message}`);
    }
  }

  /**
   * 텍스트 조정 (moderation)
   */
  async moderateContent(text: string): Promise<{
    flagged: boolean;
    categories: Record<string, boolean>;
    categoryScores: Record<string, number>;
  }> {
    try {
      const response = await this.client.moderations.create({
        input: text,
      });

      const result = response.results[0];
      return {
        flagged: result.flagged,
        categories: result.categories,
        categoryScores: result.category_scores,
      };
    } catch (error: any) {
      throw new Error(`OpenAI 콘텐츠 조정 실패: ${error.message}`);
    }
  }

  /**
   * 토큰 수 추정
   */
  estimateTokens(text: string): number {
    // 대략적인 토큰 수 추정 (정확하지 않음)
    // 실제로는 tiktoken 라이브러리를 사용하는 것이 좋음
    return Math.ceil(text.length / 4);
  }

  /**
   * 컨텍스트 길이에 맞게 텍스트 자르기
   */
  truncateToContextLength(text: string, reserveTokens: number = 1000): string {
    const modelInfo = this.getModelInfo();
    const maxTokens = modelInfo.maxContextLength - reserveTokens;
    const estimatedTokens = this.estimateTokens(text);
    
    if (estimatedTokens <= maxTokens) {
      return text;
    }
    
    // 대략적으로 텍스트 자르기
    const ratio = maxTokens / estimatedTokens;
    const truncatedLength = Math.floor(text.length * ratio);
    
    return text.substring(0, truncatedLength) + '...';
  }

  private mapFinishReason(reason: string | null): LLMResponse['finishReason'] {
    switch (reason) {
      case 'stop':
        return 'stop';
      case 'length':
        return 'length';
      case 'content_filter':
        return 'content_filter';
      case 'function_call':
        return 'function_call';
      default:
        return 'stop';
    }
  }

  /**
   * 모델 변경
   */
  setModel(model: string): void {
    this.model = model;
  }

  /**
   * 현재 모델 반환
   */
  getCurrentModel(): string {
    return this.model;
  }
} 