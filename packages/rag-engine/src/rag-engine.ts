/**
 * RAG (Retrieval-Augmented Generation) 엔진
 * 검색 증강 생성을 통한 지능형 문서 기반 응답 시스템
 */

import { BaseLLM, LLMMessage } from './llm/base-llm';
import { OpenAILLM } from './llm/openai-llm';
import { AnthropicLLM } from './llm/anthropic-llm';

export interface RAGConfig {
  llm: BaseLLM;
  maxContextLength?: number;
  maxRetrievedDocuments?: number;
  similarityThreshold?: number;
  temperature?: number;
  enableReranking?: boolean;
  enableCitation?: boolean;
}

export interface RetrievedDocument {
  id: string;
  content: string;
  metadata: Record<string, any>;
  similarity: number;
  chunkIndex?: number;
  source?: string;
}

export interface RAGResponse {
  answer: string;
  sources: RetrievedDocument[];
  confidence: number;
  reasoning?: string;
  citations?: string[];
  metadata: {
    retrievalTime: number;
    generationTime: number;
    totalTokens?: number;
    model: string;
  };
}

export interface ContextWindow {
  documents: RetrievedDocument[];
  totalTokens: number;
  truncated: boolean;
}

export class RAGEngine {
  private config: Required<RAGConfig>;

  constructor(config: RAGConfig) {
    this.config = {
      maxContextLength: 8000,
      maxRetrievedDocuments: 10,
      similarityThreshold: 0.3,
      temperature: 0.7,
      enableReranking: true,
      enableCitation: true,
      ...config,
    };
  }

  /**
   * 메인 RAG 질의응답
   */
  async query(
    question: string,
    retrievalFunction: (query: string, limit: number) => Promise<RetrievedDocument[]>,
    options?: Partial<{
      systemPrompt: string;
      maxDocuments: number;
      temperature: number;
      includeReasoning: boolean;
      language: 'ko' | 'en';
    }>
  ): Promise<RAGResponse> {
    const startTime = Date.now();

    try {
      // 1. 문서 검색
      const retrievalStart = Date.now();
      const maxDocs = options?.maxDocuments || this.config.maxRetrievedDocuments;
      const retrievedDocs = await retrievalFunction(question, maxDocs);
      
      // 유사도 필터링
      const filteredDocs = retrievedDocs.filter(
        doc => doc.similarity >= this.config.similarityThreshold
      );
      
      const retrievalTime = Date.now() - retrievalStart;

      if (filteredDocs.length === 0) {
        return this.createEmptyResponse(question, retrievalTime);
      }

      // 2. 재순위화 (선택사항)
      const rerankedDocs = this.config.enableReranking
        ? await this.rerankedDocuments(question, filteredDocs)
        : filteredDocs;

      // 3. 컨텍스트 윈도우 구성
      const contextWindow = this.buildContextWindow(rerankedDocs);

      // 4. LLM을 통한 응답 생성
      const generationStart = Date.now();
      const response = await this.generateResponse(
        question,
        contextWindow,
        options
      );
      const generationTime = Date.now() - generationStart;

      // 5. 인용 추가 (선택사항)
      const finalResponse = this.config.enableCitation
        ? this.addCitations(response, contextWindow.documents)
        : { ...response, citations: [] };

      return {
        ...finalResponse,
        sources: contextWindow.documents,
        metadata: {
          retrievalTime,
          generationTime,
          totalTokens: response.metadata?.totalTokens,
          model: this.config.llm.getModelInfo().name,
        },
      };

    } catch (error: any) {
      throw new Error(`RAG 질의 처리 실패: ${error.message}`);
    }
  }

  /**
   * 스트리밍 RAG 응답
   */
  async *queryStream(
    question: string,
    retrievalFunction: (query: string, limit: number) => Promise<RetrievedDocument[]>,
    options?: Partial<{
      systemPrompt: string;
      maxDocuments: number;
      temperature: number;
      language: 'ko' | 'en';
    }>
  ): AsyncIterable<{ type: 'token' | 'sources' | 'complete'; data: any }> {
    try {
      // 1. 문서 검색
      const maxDocs = options?.maxDocuments || this.config.maxRetrievedDocuments;
      const retrievedDocs = await retrievalFunction(question, maxDocs);
      
      const filteredDocs = retrievedDocs.filter(
        doc => doc.similarity >= this.config.similarityThreshold
      );

      if (filteredDocs.length === 0) {
        yield { type: 'complete', data: { answer: '관련 문서를 찾을 수 없습니다.', sources: [] } };
        return;
      }

      // 2. 재순위화 및 컨텍스트 구성
      const rerankedDocs = this.config.enableReranking
        ? await this.rerankedDocuments(question, filteredDocs)
        : filteredDocs;

      const contextWindow = this.buildContextWindow(rerankedDocs);

      // 소스 정보 반환
      yield { type: 'sources', data: contextWindow.documents };

      // 3. 스트리밍 응답 생성
      const messages = this.buildMessages(question, contextWindow, options);

      let fullResponse = '';
      for await (const token of this.config.llm.generateStreamCompletion(messages, {
        temperature: options?.temperature || this.config.temperature,
      })) {
        fullResponse += token;
        yield { type: 'token', data: token };
      }

      // 4. 완료 정보 반환
      yield {
        type: 'complete',
        data: {
          answer: fullResponse,
          sources: contextWindow.documents,
          confidence: this.calculateConfidence(contextWindow.documents, fullResponse)
        }
      };

    } catch (error: any) {
      throw new Error(`RAG 스트리밍 질의 처리 실패: ${error.message}`);
    }
  }

  /**
   * 문서 요약
   */
  async summarizeDocuments(
    documents: RetrievedDocument[],
    summaryType: 'brief' | 'detailed' | 'key_points' = 'brief'
  ): Promise<string> {
    const contextWindow = this.buildContextWindow(documents);
    
    const prompts = {
      brief: '다음 문서들의 핵심 내용을 간략하게 요약해주세요.',
      detailed: '다음 문서들의 내용을 상세하게 요약해주세요.',
      key_points: '다음 문서들에서 가장 중요한 핵심 포인트들을 추출해주세요.',
    };

    const messages: LLMMessage[] = [
      {
        role: 'system',
        content: `당신은 문서 요약 전문가입니다. ${prompts[summaryType]}`
      },
      {
        role: 'user',
        content: this.formatDocumentsForContext(contextWindow.documents)
      }
    ];

    const response = await this.config.llm.generateCompletion(messages, {
      temperature: 0.3
    });

    return response.content;
  }

  /**
   * 질문 생성 (문서 기반)
   */
  async generateQuestions(
    documents: RetrievedDocument[],
    questionType: 'comprehension' | 'analysis' | 'application' = 'comprehension',
    count: number = 5
  ): Promise<string[]> {
    const contextWindow = this.buildContextWindow(documents);
    
    const prompts = {
      comprehension: '이해도를 확인하는',
      analysis: '분석적 사고를 요구하는',
      application: '실무 적용을 위한',
    };

    const messages: LLMMessage[] = [
      {
        role: 'system',
        content: `주어진 문서들을 바탕으로 ${prompts[questionType]} 질문 ${count}개를 생성해주세요. 각 질문을 새 줄로 구분하고, 번호를 매겨주세요.`
      },
      {
        role: 'user',
        content: this.formatDocumentsForContext(contextWindow.documents)
      }
    ];

    const response = await this.config.llm.generateCompletion(messages, {
      temperature: 0.5
    });

    return response.content
      .split('\n')
      .filter(line => line.trim().length > 0)
      .map(line => line.replace(/^\d+\.\s*/, '').trim())
      .slice(0, count);
  }

  /**
   * 컨텍스트 윈도우 구성
   */
  private buildContextWindow(documents: RetrievedDocument[]): ContextWindow {
    const maxTokens = this.config.maxContextLength;
    let totalTokens = 0;
    const selectedDocs: RetrievedDocument[] = [];
    
    for (const doc of documents) {
      const docTokens = this.estimateTokens(doc.content);
      
      if (totalTokens + docTokens <= maxTokens) {
        selectedDocs.push(doc);
        totalTokens += docTokens;
      } else {
        // 남은 공간에 맞게 문서 자르기
        const remainingTokens = maxTokens - totalTokens;
        if (remainingTokens > 100) { // 최소 100토큰은 있어야 의미있음
          const truncatedContent = this.truncateText(doc.content, remainingTokens);
          selectedDocs.push({
            ...doc,
            content: truncatedContent,
          });
          totalTokens = maxTokens;
        }
        break;
      }
    }

    return {
      documents: selectedDocs,
      totalTokens,
      truncated: selectedDocs.length < documents.length,
    };
  }

  /**
   * LLM 응답 생성
   */
  private async generateResponse(
    question: string,
    contextWindow: ContextWindow,
    options?: Partial<{
      systemPrompt: string;
      temperature: number;
      includeReasoning: boolean;
      language: 'ko' | 'en';
    }>
  ): Promise<{
    answer: string;
    confidence: number;
    reasoning?: string;
    metadata?: { totalTokens?: number };
  }> {
    const messages = this.buildMessages(question, contextWindow, options);

    const response = await this.config.llm.generateCompletion(messages, {
      temperature: options?.temperature || this.config.temperature,
    });

    const confidence = this.calculateConfidence(contextWindow.documents, response.content);

    const result: any = {
      answer: response.content,
      confidence,
      metadata: {
        totalTokens: response.usage?.totalTokens,
      },
    };

    // 추론 과정 추가 (선택사항)
    if (options?.includeReasoning) {
      result.reasoning = await this.generateReasoning(question, contextWindow, response.content);
    }

    return result;
  }

  /**
   * 메시지 구성
   */
  private buildMessages(
    question: string,
    contextWindow: ContextWindow,
    options?: Partial<{
      systemPrompt: string;
      language: 'ko' | 'en';
    }>
  ): LLMMessage[] {
    const language = options?.language || 'ko';
    
    const defaultSystemPrompt = language === 'ko' 
      ? `당신은 주어진 문서들을 바탕으로 정확하고 도움이 되는 답변을 제공하는 AI 어시스턴트입니다.

지침:
1. 주어진 문서 내용만을 사용하여 답변하세요
2. 문서에 없는 정보는 추측하지 마세요
3. 답변할 수 없는 경우 정직하게 말씀해주세요
4. 답변은 한국어로 작성하고, 명확하고 구체적으로 작성해주세요
5. 가능한 경우 관련 문서의 내용을 인용해주세요
6. 답변의 근거를 명확히 제시해주세요`
      : `You are an AI assistant that provides accurate and helpful answers based on the given documents.

Guidelines:
1. Only use information from the provided documents
2. Do not make assumptions beyond the given information
3. Be honest if you cannot answer based on the available information
4. Provide clear, specific, and well-structured answers
5. Cite relevant document content when possible
6. Clearly indicate the basis for your answers`;

    const systemPrompt = options?.systemPrompt || defaultSystemPrompt;

    const contextText = this.formatDocumentsForContext(contextWindow.documents);

    const userPrompt = language === 'ko'
      ? `참고 문서:
${contextText}

질문: ${question}`
      : `Reference Documents:
${contextText}

Question: ${question}`;

    return [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];
  }

  /**
   * 문서 재순위화
   */
  private async rerankedDocuments(
    query: string,
    documents: RetrievedDocument[]
  ): Promise<RetrievedDocument[]> {
    // 간단한 휴리스틱 기반 재순위화
    // 실제로는 더 정교한 재순위화 모델을 사용할 수 있음
    
    return documents.sort((a, b) => {
      // 유사도 점수
      let scoreA = a.similarity;
      let scoreB = b.similarity;

      // 제목이나 헤딩에 쿼리 키워드가 포함된 경우 가산점
      const queryWords = query.toLowerCase().split(' ');
      const titleA = a.metadata.title || '';
      const titleB = b.metadata.title || '';

      for (const word of queryWords) {
        if (titleA.toLowerCase().includes(word)) scoreA += 0.1;
        if (titleB.toLowerCase().includes(word)) scoreB += 0.1;
      }

      // 최신 문서 우선 (날짜 정보가 있는 경우)
      const dateA = a.metadata.created_at || a.metadata.updated_at;
      const dateB = b.metadata.created_at || b.metadata.updated_at;
      
      if (dateA && dateB) {
        const diffDays = (new Date(dateB).getTime() - new Date(dateA).getTime()) / (1000 * 60 * 60 * 24);
        if (Math.abs(diffDays) > 30) { // 30일 이상 차이나는 경우
          scoreA += diffDays > 0 ? -0.05 : 0.05;
          scoreB += diffDays > 0 ? 0.05 : -0.05;
        }
      }

      return scoreB - scoreA;
    });
  }

  /**
   * 신뢰도 계산
   */
  private calculateConfidence(
    documents: RetrievedDocument[],
    answer: string
  ): number {
    if (documents.length === 0) return 0;

    // 기본 신뢰도는 검색된 문서들의 평균 유사도
    const avgSimilarity = documents.reduce((sum, doc) => sum + doc.similarity, 0) / documents.length;
    
    let confidence = avgSimilarity;

    // 여러 문서에서 일관된 정보가 있는 경우 신뢰도 증가
    if (documents.length >= 3) confidence += 0.1;
    if (documents.length >= 5) confidence += 0.1;

    // 답변 길이가 적절한 경우 신뢰도 증가
    const answerLength = answer.length;
    if (answerLength > 50 && answerLength < 2000) {
      confidence += 0.05;
    }

    // "모르겠다" 류의 답변인 경우 신뢰도 감소
    const uncertainPhrases = ['모르겠', '확실하지 않', '정보가 없', '알 수 없'];
    for (const phrase of uncertainPhrases) {
      if (answer.includes(phrase)) {
        confidence -= 0.2;
        break;
      }
    }

    return Math.max(0, Math.min(1, confidence));
  }

  /**
   * 인용 추가
   */
  private addCitations(
    response: { answer: string; confidence: number },
    documents: RetrievedDocument[]
  ): { answer: string; confidence: number; citations: string[] } {
    const citations: string[] = [];

    for (let i = 0; i < documents.length; i++) {
      const doc = documents[i];
      const citation = `[${i + 1}] ${doc.metadata.file_name || doc.metadata.title || `문서 ${doc.id}`}`;
      citations.push(citation);
    }

    return {
      ...response,
      citations,
    };
  }

  /**
   * 추론 과정 생성
   */
  private async generateReasoning(
    question: string,
    contextWindow: ContextWindow,
    answer: string
  ): Promise<string> {
    const messages: LLMMessage[] = [
      {
        role: 'system',
        content: '주어진 질문, 참고 문서, 그리고 답변을 바탕으로 답변에 도달한 추론 과정을 설명해주세요.'
      },
      {
        role: 'user',
        content: `질문: ${question}

참고 문서:
${this.formatDocumentsForContext(contextWindow.documents)}

답변: ${answer}

이 답변에 어떻게 도달했는지 추론 과정을 설명해주세요.`
      }
    ];

    const response = await this.config.llm.generateCompletion(messages, {
      temperature: 0.3
    });

    return response.content;
  }

  /**
   * 빈 응답 생성
   */
  private createEmptyResponse(
    question: string,
    retrievalTime: number
  ): RAGResponse {
    return {
      answer: '죄송합니다. 질문과 관련된 문서를 찾을 수 없습니다. 다른 키워드나 표현으로 다시 질문해 주세요.',
      sources: [],
      confidence: 0,
      citations: [],
      metadata: {
        retrievalTime,
        generationTime: 0,
        model: this.config.llm.getModelInfo().name,
      },
    };
  }

  /**
   * 문서들을 컨텍스트 형식으로 포맷팅
   */
  private formatDocumentsForContext(documents: RetrievedDocument[]): string {
    return documents
      .map((doc, index) => {
        const title = doc.metadata.file_name || doc.metadata.title || `문서 ${index + 1}`;
        return `=== ${title} ===
${doc.content}
`;
      })
      .join('\n');
  }

  /**
   * 토큰 수 추정
   */
  private estimateTokens(text: string): number {
    // 대략적인 토큰 수 추정
    return Math.ceil(text.length / 4);
  }

  /**
   * 텍스트 자르기
   */
  private truncateText(text: string, maxTokens: number): string {
    const maxChars = maxTokens * 4; // 대략적인 변환
    if (text.length <= maxChars) return text;

    // 문장 경계에서 자르기 시도
    const truncated = text.substring(0, maxChars);
    const lastSentenceEnd = Math.max(
      truncated.lastIndexOf('.'),
      truncated.lastIndexOf('!'),
      truncated.lastIndexOf('?')
    );

    if (lastSentenceEnd > maxChars * 0.8) {
      return truncated.substring(0, lastSentenceEnd + 1);
    }

    return truncated + '...';
  }

  /**
   * 설정 업데이트
   */
  updateConfig(newConfig: Partial<RAGConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * 현재 설정 반환
   */
  getConfig(): Required<RAGConfig> {
    return { ...this.config };
  }

  /**
   * 엔진 정보 반환
   */
  getEngineInfo(): {
    llmInfo: ReturnType<BaseLLM['getModelInfo']>;
    config: Required<RAGConfig>;
  } {
    return {
      llmInfo: this.config.llm.getModelInfo(),
      config: this.config,
    };
  }
} 