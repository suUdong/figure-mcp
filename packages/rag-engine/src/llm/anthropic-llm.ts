/**
 * Anthropic (Claude) LLM 제공자
 */

import Anthropic from '@anthropic-ai/sdk';
import { BaseLLM, LLMMessage, LLMResponse, LLMConfig } from './base-llm';

export interface AnthropicConfig extends LLMConfig {
  apiKey: string;
  model?: string;
  baseURL?: string;
}

export class AnthropicLLM extends BaseLLM {
  private client: Anthropic;
  private model: string;

  constructor(config: AnthropicConfig) {
    super(config);
    
    this.client = new Anthropic({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
    });
    
    this.model = config.model || 'claude-3-sonnet-20240229';
  }

  async generateCompletion(
    messages: LLMMessage[], 
    config?: Partial<LLMConfig>
  ): Promise<LLMResponse> {
    try {
      const finalConfig = { ...this.config, ...config };
      
      // Anthropic은 system 메시지와 user/assistant 메시지를 분리해서 처리
      const systemMessage = messages.find(m => m.role === 'system');
      const conversationMessages = messages.filter(m => m.role !== 'system');
      
      const anthropicMessages = conversationMessages.map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      }));

      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: finalConfig.maxTokens || 2000,
        temperature: finalConfig.temperature,
        top_p: finalConfig.topP,
        system: systemMessage?.content,
        messages: anthropicMessages,
        stop_sequences: finalConfig.stop,
      });

      if (response.content.length === 0) {
        throw new Error('Anthropic 응답에서 콘텐츠를 찾을 수 없습니다');
      }

      // Anthropic은 여러 content block을 반환할 수 있음
      const textContent = response.content
        .filter(block => block.type === 'text')
        .map(block => (block as any).text)
        .join('');

      return {
        content: textContent,
        usage: response.usage ? {
          promptTokens: response.usage.input_tokens,
          completionTokens: response.usage.output_tokens,
          totalTokens: response.usage.input_tokens + response.usage.output_tokens,
        } : undefined,
        model: response.model,
        finishReason: this.mapFinishReason(response.stop_reason),
      };
    } catch (error: any) {
      throw new Error(`Anthropic API 호출 실패: ${error.message}`);
    }
  }

  async *generateStreamCompletion(
    messages: LLMMessage[], 
    config?: Partial<LLMConfig>
  ): AsyncIterable<string> {
    try {
      const finalConfig = { ...this.config, ...config };
      
      // Anthropic은 system 메시지와 user/assistant 메시지를 분리해서 처리
      const systemMessage = messages.find(m => m.role === 'system');
      const conversationMessages = messages.filter(m => m.role !== 'system');
      
      const anthropicMessages = conversationMessages.map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      }));

      const stream = await this.client.messages.create({
        model: this.model,
        max_tokens: finalConfig.maxTokens || 2000,
        temperature: finalConfig.temperature,
        top_p: finalConfig.topP,
        system: systemMessage?.content,
        messages: anthropicMessages,
        stop_sequences: finalConfig.stop,
        stream: true,
      });

      for await (const event of stream) {
        if (event.type === 'content_block_delta' && 
            event.delta.type === 'text_delta') {
          yield event.delta.text;
        }
      }
    } catch (error: any) {
      throw new Error(`Anthropic 스트리밍 API 호출 실패: ${error.message}`);
    }
  }

  getModelInfo() {
    const modelInfo: Record<string, any> = {
      'claude-3-haiku-20240307': {
        name: 'Claude 3 Haiku',
        provider: 'Anthropic',
        maxContextLength: 200000,
        supportsFunctionCalling: false,
        supportsStreaming: true,
      },
      'claude-3-sonnet-20240229': {
        name: 'Claude 3 Sonnet',
        provider: 'Anthropic',
        maxContextLength: 200000,
        supportsFunctionCalling: false,
        supportsStreaming: true,
      },
      'claude-3-opus-20240229': {
        name: 'Claude 3 Opus',
        provider: 'Anthropic',
        maxContextLength: 200000,
        supportsFunctionCalling: false,
        supportsStreaming: true,
      },
      'claude-2.1': {
        name: 'Claude 2.1',
        provider: 'Anthropic',
        maxContextLength: 200000,
        supportsFunctionCalling: false,
        supportsStreaming: true,
      },
      'claude-2.0': {
        name: 'Claude 2.0',
        provider: 'Anthropic',
        maxContextLength: 100000,
        supportsFunctionCalling: false,
        supportsStreaming: true,
      },
      'claude-instant-1.2': {
        name: 'Claude Instant 1.2',
        provider: 'Anthropic',
        maxContextLength: 100000,
        supportsFunctionCalling: false,
        supportsStreaming: true,
      },
    };

    return modelInfo[this.model] || {
      name: this.model,
      provider: 'Anthropic',
      maxContextLength: 100000,
      supportsFunctionCalling: false,
      supportsStreaming: true,
    };
  }

  /**
   * Claude 특화 기능: 구조화된 응답 생성
   */
  async generateStructuredResponse(
    prompt: string,
    schema: Record<string, any>,
    context?: string
  ): Promise<any> {
    const systemPrompt = `당신은 주어진 스키마에 맞는 JSON 응답을 생성하는 AI입니다.

스키마:
${JSON.stringify(schema, null, 2)}

지침:
1. 응답은 반드시 유효한 JSON 형식이어야 합니다
2. 스키마의 모든 필수 필드를 포함해야 합니다
3. 추가적인 설명 없이 JSON만 반환하세요
4. 값은 실제 데이터를 기반으로 정확하게 생성하세요`;

    const userContent = context 
      ? `맥락 정보:
${context}

요청: ${prompt}`
      : prompt;

    const messages: LLMMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent }
    ];

    const response = await this.generateCompletion(messages, {
      temperature: 0.1,
      maxTokens: 4000
    });

    try {
      return JSON.parse(response.content);
    } catch (error) {
      throw new Error(`구조화된 응답 파싱 실패: ${error}`);
    }
  }

  /**
   * Claude 특화 기능: 긴 텍스트 분석
   */
  async analyzeLongText(
    text: string,
    analysisType: 'summary' | 'key_points' | 'sentiment' | 'themes' | 'questions'
  ): Promise<string> {
    const prompts = {
      summary: '다음 텍스트의 핵심 내용을 요약해주세요.',
      key_points: '다음 텍스트에서 가장 중요한 핵심 포인트들을 추출해주세요.',
      sentiment: '다음 텍스트의 감정과 톤을 분석해주세요.',
      themes: '다음 텍스트에서 주요 테마와 주제들을 식별해주세요.',
      questions: '다음 텍스트를 바탕으로 중요한 질문들을 생성해주세요.',
    };

    const messages: LLMMessage[] = [
      {
        role: 'system',
        content: '당신은 텍스트 분석 전문가입니다. 주어진 텍스트를 정확하고 체계적으로 분석해주세요.'
      },
      {
        role: 'user',
        content: `${prompts[analysisType]}

텍스트:
${text}`
      }
    ];

    const response = await this.generateCompletion(messages, {
      temperature: 0.3
    });

    return response.content;
  }

  /**
   * 토큰 수 추정 (Claude는 더 정확한 추정 가능)
   */
  estimateTokens(text: string): number {
    // Claude의 경우 대략 3-4자 당 1토큰
    return Math.ceil(text.length / 3.5);
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
    
    // 문장 경계에서 자르기 시도
    const truncatedText = text.substring(0, truncatedLength);
    const lastSentenceEnd = Math.max(
      truncatedText.lastIndexOf('.'),
      truncatedText.lastIndexOf('!'),
      truncatedText.lastIndexOf('?'),
      truncatedText.lastIndexOf('다.'),
      truncatedText.lastIndexOf('다!'),
      truncatedText.lastIndexOf('다?')
    );
    
    if (lastSentenceEnd > truncatedLength * 0.8) {
      return truncatedText.substring(0, lastSentenceEnd + 1);
    }
    
    return truncatedText + '...';
  }

  private mapFinishReason(reason: string | null): LLMResponse['finishReason'] {
    switch (reason) {
      case 'end_turn':
      case 'stop_sequence':
        return 'stop';
      case 'max_tokens':
        return 'length';
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

  /**
   * Claude 특화: 사고 과정 설명
   */
  async explainThinking(
    problem: string,
    solution?: string
  ): Promise<string> {
    const messages: LLMMessage[] = [
      {
        role: 'system',
        content: '당신은 문제 해결 과정을 단계별로 설명하는 전문가입니다. 사고 과정을 명확하고 논리적으로 설명해주세요.'
      },
      {
        role: 'user',
        content: solution
          ? `문제: ${problem}

해결책: ${solution}

이 해결책에 도달한 사고 과정을 단계별로 설명해주세요.`
          : `문제: ${problem}

이 문제를 해결하기 위한 사고 과정을 단계별로 설명해주세요.`
      }
    ];

    const response = await this.generateCompletion(messages, {
      temperature: 0.5
    });

    return response.content;
  }
} 