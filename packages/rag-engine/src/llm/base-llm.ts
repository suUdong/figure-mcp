/**
 * LLM 제공자 기본 인터페이스
 */

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model?: string;
  finishReason?: 'stop' | 'length' | 'content_filter' | 'function_call';
}

export interface LLMConfig {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stop?: string[];
}

export abstract class BaseLLM {
  protected config: LLMConfig;
  
  constructor(config: LLMConfig = {}) {
    this.config = {
      temperature: 0.7,
      maxTokens: 2000,
      topP: 1.0,
      frequencyPenalty: 0,
      presencePenalty: 0,
      ...config
    };
  }

  /**
   * 단일 완성 생성
   */
  abstract generateCompletion(
    messages: LLMMessage[], 
    config?: Partial<LLMConfig>
  ): Promise<LLMResponse>;

  /**
   * 스트리밍 완성 생성
   */
  abstract generateStreamCompletion(
    messages: LLMMessage[], 
    config?: Partial<LLMConfig>
  ): AsyncIterable<string>;

  /**
   * 텍스트 요약
   */
  async summarize(text: string, maxLength: number = 500): Promise<string> {
    const messages: LLMMessage[] = [
      {
        role: 'system',
        content: `주어진 텍스트를 ${maxLength}자 이내로 요약해주세요. 핵심 내용과 주요 정보를 포함하되, 간결하고 명확하게 작성해주세요.`
      },
      {
        role: 'user',
        content: text
      }
    ];

    const response = await this.generateCompletion(messages, {
      maxTokens: Math.ceil(maxLength * 1.5),
      temperature: 0.3
    });

    return response.content;
  }

  /**
   * 키워드 추출
   */
  async extractKeywords(text: string, count: number = 10): Promise<string[]> {
    const messages: LLMMessage[] = [
      {
        role: 'system',
        content: `주어진 텍스트에서 가장 중요한 키워드 ${count}개를 추출해주세요. 각 키워드를 새 줄로 구분하여 나열하고, 번호나 부가 설명 없이 키워드만 작성해주세요.`
      },
      {
        role: 'user',
        content: text
      }
    ];

    const response = await this.generateCompletion(messages, {
      maxTokens: 200,
      temperature: 0.3
    });

    return response.content
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .slice(0, count);
  }

  /**
   * 질의응답
   */
  async answerQuestion(
    question: string, 
    context: string, 
    systemPrompt?: string
  ): Promise<string> {
    const defaultSystemPrompt = `당신은 주어진 맥락 정보를 바탕으로 정확하고 도움이 되는 답변을 제공하는 AI 어시스턴트입니다. 
    
지침:
1. 주어진 맥락 정보만을 사용하여 답변하세요
2. 맥락에 없는 정보는 추측하지 마세요
3. 답변할 수 없는 경우 정직하게 말씀해주세요
4. 답변은 한국어로 작성하고, 명확하고 구체적으로 작성해주세요
5. 필요한 경우 근거가 되는 부분을 인용해주세요`;

    const messages: LLMMessage[] = [
      {
        role: 'system',
        content: systemPrompt || defaultSystemPrompt
      },
      {
        role: 'user',
        content: `맥락 정보:
${context}

질문: ${question}`
      }
    ];

    const response = await this.generateCompletion(messages);
    return response.content;
  }

  /**
   * 코드 생성
   */
  async generateCode(
    requirement: string, 
    language: string = 'javascript',
    context?: string
  ): Promise<string> {
    const systemPrompt = `당신은 숙련된 소프트웨어 개발자입니다. 주어진 요구사항에 따라 ${language} 코드를 생성해주세요.

지침:
1. 코드는 실행 가능하고 버그가 없어야 합니다
2. 적절한 주석을 포함해주세요
3. 모범 사례를 따라 작성해주세요
4. 필요한 경우 예외 처리를 포함해주세요
5. 코드만 반환하고, 부가 설명은 주석으로 작성해주세요`;

    const userContent = context 
      ? `맥락 정보:
${context}

요구사항: ${requirement}`
      : `요구사항: ${requirement}`;

    const messages: LLMMessage[] = [
      {
        role: 'system',
        content: systemPrompt
      },
      {
        role: 'user',
        content: userContent
      }
    ];

    const response = await this.generateCompletion(messages, {
      temperature: 0.2
    });

    return response.content;
  }

  /**
   * 텍스트 분류
   */
  async classifyText(
    text: string, 
    categories: string[], 
    description?: string
  ): Promise<{ category: string; confidence: number; reasoning: string }> {
    const categoryList = categories.map((cat, idx) => `${idx + 1}. ${cat}`).join('\n');
    
    const systemPrompt = `주어진 텍스트를 다음 카테고리 중 하나로 분류해주세요.

카테고리:
${categoryList}

${description ? `분류 기준: ${description}` : ''}

응답 형식 (JSON):
{
  "category": "선택된 카테고리",
  "confidence": 0.95,
  "reasoning": "분류 근거"
}`;

    const messages: LLMMessage[] = [
      {
        role: 'system',
        content: systemPrompt
      },
      {
        role: 'user',
        content: text
      }
    ];

    const response = await this.generateCompletion(messages, {
      temperature: 0.1
    });

    try {
      const result = JSON.parse(response.content);
      return {
        category: result.category,
        confidence: result.confidence,
        reasoning: result.reasoning
      };
    } catch {
      // JSON 파싱 실패 시 기본값 반환
      return {
        category: categories[0],
        confidence: 0.5,
        reasoning: '파싱 오류로 인한 기본 분류'
      };
    }
  }

  /**
   * 설정 업데이트
   */
  updateConfig(newConfig: Partial<LLMConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * 현재 설정 반환
   */
  getConfig(): LLMConfig {
    return { ...this.config };
  }

  /**
   * 모델 정보 반환
   */
  abstract getModelInfo(): {
    name: string;
    provider: string;
    maxContextLength: number;
    supportsFunctionCalling: boolean;
    supportsStreaming: boolean;
  };
} 