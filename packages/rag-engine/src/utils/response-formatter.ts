/**
 * RAG 응답 포맷터 유틸리티
 */

import { RAGResponse, RetrievedDocument } from '../rag-engine';

export interface FormattedResponse {
  content: string;
  metadata: {
    confidence: number;
    sources: number;
    processingTime: number;
    model: string;
  };
}

/**
 * 응답 포맷터 클래스
 */
export class ResponseFormatter {
  
  /**
   * 기본 응답 포맷팅
   */
  static formatBasic(response: RAGResponse): FormattedResponse {
    return {
      content: response.answer,
      metadata: {
        confidence: Math.round(response.confidence * 100) / 100,
        sources: response.sources.length,
        processingTime: response.metadata.retrievalTime + response.metadata.generationTime,
        model: response.metadata.model,
      },
    };
  }

  /**
   * 인용 포함 포맷팅
   */
  static formatWithCitations(response: RAGResponse): string {
    let formattedAnswer = response.answer;

    if (response.citations && response.citations.length > 0) {
      formattedAnswer += '\n\n**참고 자료:**\n';
      response.citations.forEach(citation => {
        formattedAnswer += `- ${citation}\n`;
      });
    }

    return formattedAnswer;
  }

  /**
   * 상세 정보 포함 포맷팅
   */
  static formatDetailed(response: RAGResponse): {
    answer: string;
    confidence: string;
    sources: Array<{
      title: string;
      similarity: string;
      preview: string;
    }>;
    performance: {
      retrievalTime: string;
      generationTime: string;
      totalTime: string;
    };
  } {
    return {
      answer: response.answer,
      confidence: `${Math.round(response.confidence * 100)}%`,
      sources: response.sources.map(source => ({
        title: source.metadata.file_name || source.metadata.title || `문서 ${source.id}`,
        similarity: `${Math.round(source.similarity * 100)}%`,
        preview: source.content.substring(0, 150) + (source.content.length > 150 ? '...' : ''),
      })),
      performance: {
        retrievalTime: `${response.metadata.retrievalTime}ms`,
        generationTime: `${response.metadata.generationTime}ms`,
        totalTime: `${response.metadata.retrievalTime + response.metadata.generationTime}ms`,
      },
    };
  }

  /**
   * 마크다운 포맷팅
   */
  static formatMarkdown(response: RAGResponse): string {
    let markdown = `## 답변\n\n${response.answer}\n\n`;

    if (response.sources.length > 0) {
      markdown += `## 참고 문서 (${response.sources.length}개)\n\n`;
      response.sources.forEach((source, index) => {
        const title = source.metadata.file_name || source.metadata.title || `문서 ${source.id}`;
        const similarity = Math.round(source.similarity * 100);
        markdown += `### ${index + 1}. ${title}\n`;
        markdown += `- **유사도:** ${similarity}%\n`;
        markdown += `- **미리보기:** ${source.content.substring(0, 200)}...\n\n`;
      });
    }

    if (response.reasoning) {
      markdown += `## 추론 과정\n\n${response.reasoning}\n\n`;
    }

    markdown += `## 메타데이터\n\n`;
    markdown += `- **신뢰도:** ${Math.round(response.confidence * 100)}%\n`;
    markdown += `- **모델:** ${response.metadata.model}\n`;
    markdown += `- **처리 시간:** ${response.metadata.retrievalTime + response.metadata.generationTime}ms\n`;
    
    if (response.metadata.totalTokens) {
      markdown += `- **사용 토큰:** ${response.metadata.totalTokens}\n`;
    }

    return markdown;
  }

  /**
   * JSON 포맷팅
   */
  static formatJSON(response: RAGResponse): string {
    const formatted = {
      answer: response.answer,
      confidence: response.confidence,
      sources: response.sources.map(source => ({
        id: source.id,
        title: source.metadata.file_name || source.metadata.title,
        similarity: source.similarity,
        content_preview: source.content.substring(0, 200),
        metadata: {
          file_name: source.metadata.file_name,
          chunk_index: source.chunkIndex,
          source: source.source,
        },
      })),
      citations: response.citations,
      reasoning: response.reasoning,
      metadata: response.metadata,
    };

    return JSON.stringify(formatted, null, 2);
  }

  /**
   * 소스 요약 포맷팅
   */
  static formatSourceSummary(sources: RetrievedDocument[]): string {
    if (sources.length === 0) {
      return '참고할 수 있는 문서가 없습니다.';
    }

    let summary = `총 ${sources.length}개의 관련 문서를 찾았습니다:\n\n`;

    sources.forEach((source, index) => {
      const title = source.metadata.file_name || source.metadata.title || `문서 ${source.id}`;
      const similarity = Math.round(source.similarity * 100);
      summary += `${index + 1}. **${title}** (유사도: ${similarity}%)\n`;
      summary += `   ${source.content.substring(0, 100)}...\n\n`;
    });

    return summary;
  }

  /**
   * 신뢰도 설명 포맷팅
   */
  static formatConfidenceExplanation(confidence: number): string {
    if (confidence >= 0.8) {
      return '매우 높은 신뢰도 - 답변이 참고 문서들과 높은 일치도를 보입니다.';
    } else if (confidence >= 0.6) {
      return '높은 신뢰도 - 답변이 참고 문서들을 잘 반영하고 있습니다.';
    } else if (confidence >= 0.4) {
      return '보통 신뢰도 - 답변이 부분적으로 참고 문서들을 반영합니다.';
    } else if (confidence >= 0.2) {
      return '낮은 신뢰도 - 참고 문서들과 제한적인 관련성을 보입니다.';
    } else {
      return '매우 낮은 신뢰도 - 관련 문서를 찾을 수 없거나 불확실한 답변입니다.';
    }
  }

  /**
   * 스트리밍 응답 포맷팅
   */
  static formatStreamingChunk(chunk: {
    type: 'token' | 'sources' | 'complete';
    data: any;
  }): string {
    switch (chunk.type) {
      case 'token':
        return chunk.data;
      
      case 'sources':
        const sources = chunk.data as RetrievedDocument[];
        return `\n\n[참고 문서 ${sources.length}개 발견]\n\n`;
      
      case 'complete':
        const { confidence } = chunk.data;
        return `\n\n[완료 - 신뢰도: ${Math.round(confidence * 100)}%]`;
      
      default:
        return '';
    }
  }

  /**
   * 에러 응답 포맷팅
   */
  static formatError(error: Error, query?: string): {
    error: string;
    message: string;
    query?: string;
    timestamp: string;
  } {
    return {
      error: error.name,
      message: error.message,
      query,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 성능 메트릭 포맷팅
   */
  static formatPerformanceMetrics(response: RAGResponse): {
    retrievalTime: number;
    generationTime: number;
    totalTime: number;
    tokensUsed?: number;
    documentsRetrieved: number;
    averageSimilarity: number;
  } {
    const avgSimilarity = response.sources.length > 0
      ? response.sources.reduce((sum, doc) => sum + doc.similarity, 0) / response.sources.length
      : 0;

    return {
      retrievalTime: response.metadata.retrievalTime,
      generationTime: response.metadata.generationTime,
      totalTime: response.metadata.retrievalTime + response.metadata.generationTime,
      tokensUsed: response.metadata.totalTokens,
      documentsRetrieved: response.sources.length,
      averageSimilarity: Math.round(avgSimilarity * 1000) / 1000,
    };
  }
} 