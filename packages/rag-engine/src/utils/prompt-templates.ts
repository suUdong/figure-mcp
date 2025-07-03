/**
 * 프롬프트 템플릿 유틸리티
 */

export interface PromptTemplate {
  system: string;
  user: (context: any) => string;
}

/**
 * 기본 RAG 프롬프트 템플릿
 */
export const DEFAULT_RAG_TEMPLATE: PromptTemplate = {
  system: `당신은 주어진 문서들을 바탕으로 정확하고 도움이 되는 답변을 제공하는 AI 어시스턴트입니다.

지침:
1. 주어진 문서 내용만을 사용하여 답변하세요
2. 문서에 없는 정보는 추측하지 마세요
3. 답변할 수 없는 경우 정직하게 말씀해주세요
4. 답변은 한국어로 작성하고, 명확하고 구체적으로 작성해주세요
5. 가능한 경우 관련 문서의 내용을 인용해주세요
6. 답변의 근거를 명확히 제시해주세요`,

  user: ({ question, documents }) => `참고 문서:
${documents}

질문: ${question}`
};

/**
 * 코드 생성 프롬프트 템플릿
 */
export const CODE_GENERATION_TEMPLATE: PromptTemplate = {
  system: `당신은 개발 표준 문서를 바탕으로 코드를 생성하는 전문 개발자입니다.

지침:
1. 주어진 개발 표준과 가이드라인을 엄격히 준수하세요
2. 실행 가능하고 버그 없는 코드를 작성하세요
3. 적절한 주석과 문서화를 포함하세요
4. 보안과 성능을 고려하세요
5. 테스트 코드도 함께 제공하세요`,

  user: ({ requirement, standards, language }) => `개발 표준:
${standards}

요구사항: ${requirement}
프로그래밍 언어: ${language}

위 개발 표준을 준수하여 코드를 생성해주세요.`
};

/**
 * 문서 요약 프롬프트 템플릿  
 */
export const SUMMARIZATION_TEMPLATE: PromptTemplate = {
  system: `당신은 문서 요약 전문가입니다. 주어진 문서들의 핵심 내용을 정확하고 간결하게 요약합니다.

지침:
1. 중요한 정보는 누락하지 마세요
2. 구조화된 형태로 요약하세요
3. 핵심 키워드를 포함하세요
4. 간결하면서도 포괄적으로 작성하세요`,

  user: ({ documents, summaryType }) => {
    const types = {
      brief: '간략하게',
      detailed: '상세하게', 
      key_points: '핵심 포인트 위주로'
    };
    
    return `다음 문서들을 ${types[summaryType] || '간략하게'} 요약해주세요:

${documents}`;
  }
};

/**
 * 프롬프트 템플릿 팩토리
 */
export class PromptTemplateFactory {
  private templates: Map<string, PromptTemplate> = new Map();

  constructor() {
    this.registerTemplate('default_rag', DEFAULT_RAG_TEMPLATE);
    this.registerTemplate('code_generation', CODE_GENERATION_TEMPLATE);
    this.registerTemplate('summarization', SUMMARIZATION_TEMPLATE);
  }

  /**
   * 템플릿 등록
   */
  registerTemplate(name: string, template: PromptTemplate): void {
    this.templates.set(name, template);
  }

  /**
   * 템플릿 조회
   */
  getTemplate(name: string): PromptTemplate | undefined {
    return this.templates.get(name);
  }

  /**
   * 프롬프트 생성
   */
  generatePrompt(templateName: string, context: any): { system: string; user: string } {
    const template = this.getTemplate(templateName);
    if (!template) {
      throw new Error(`템플릿을 찾을 수 없습니다: ${templateName}`);
    }

    return {
      system: template.system,
      user: template.user(context)
    };
  }

  /**
   * 사용 가능한 템플릿 목록
   */
  getAvailableTemplates(): string[] {
    return Array.from(this.templates.keys());
  }
}

// 전역 팩토리 인스턴스
export const promptTemplateFactory = new PromptTemplateFactory(); 