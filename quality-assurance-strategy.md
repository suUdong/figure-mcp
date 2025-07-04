# 산출물 품질 보장 전략

## 🎯 문제 정의
단순히 가이드만 제공할 경우 사용자 LLM(Copilot)의 해석 차이로 인한 품질 편차 문제

## 🔄 3단계 품질 보장 전략

### 1단계: 초고품질 가이드 제공
단순한 가이드가 아닌 **실행 가능한 상세 지침** 제공

```python
# figure-backend에서 생성하는 고품질 가이드 예시
{
  "deliverable_guide": {
    "template": {
      "sections": [
        {
          "title": "1. API 개요",
          "required_content": [
            "API 목적과 주요 기능",
            "대상 사용자 (내부/외부)",
            "API 버전 정보"
          ],
          "example": "이 API는 결제 처리를 담당하며...",
          "validation_criteria": [
            "목적이 명확히 기술되었는가?",
            "버전 정보가 포함되었는가?"
          ]
        }
      ]
    },
    "detailed_instructions": {
      "security_requirements": {
        "must_include": [
          "인증 방식 (JWT, API Key 등)",
          "권한 레벨별 접근 제어",
          "데이터 암호화 방식",
          "보안 헤더 설정"
        ],
        "examples": {
          "authentication": "```\nAuthorization: Bearer <JWT_TOKEN>\n```",
          "rate_limiting": "분당 100회 요청 제한"
        },
        "checklist": [
          "[ ] 인증 방식이 명시되었는가?",
          "[ ] 권한별 접근 제어가 설명되었는가?",
          "[ ] 보안 헤더가 문서화되었는가?"
        ]
      }
    },
    "code_examples": {
      "request_example": "실제 요청 예시 코드",
      "response_example": "실제 응답 예시",
      "error_handling": "에러 처리 예시"
    },
    "validation_rules": [
      "모든 필수 섹션이 포함되어야 함",
      "예시 코드는 실행 가능해야 함",
      "보안 요구사항은 구체적이어야 함"
    ]
  }
}
```

### 2단계: 협업 생성 방식
figure-backend에서 **초안을 생성**하고, 사용자 LLM이 **개선**하는 방식

```typescript
// MCP 도구 확장: 협업 생성 모드
interface CollaborativeCreationRequest {
  site_id: string;
  deliverable_type: string;
  source_code?: string;
  collaboration_mode: 'guide_only' | 'draft_generation' | 'full_generation';
}

// 협업 생성 워크플로우
async function collaborativeGeneration(request: CollaborativeCreationRequest) {
  if (request.collaboration_mode === 'draft_generation') {
    // 1. figure-backend에서 표준 준수 초안 생성
    const draft = await backend.generateStandardDraft(request);
    
    // 2. 사용자 LLM에게 초안 + 개선 가이드 제공
    return {
      draft_document: draft.content,
      improvement_guide: draft.improvement_suggestions,
      user_instruction: `
        위 초안은 ${request.site_id} 사이트 표준에 맞게 생성되었습니다.
        다음 관점에서 개선해주세요:
        - 사용자 관점에서 이해하기 쉽게 설명 추가
        - 실제 사용 사례 보강
        - 개발자 친화적 설명 추가
        
        ⚠️ 표준 구조와 필수 항목은 유지해주세요.
      `
    };
  }
}
```

### 3단계: 실시간 검증 및 피드백
생성된 문서를 **실시간으로 검증**하고 개선 제안

```python
class DocumentValidator:
    def __init__(self, site_standards):
        self.site_standards = site_standards
        self.validation_rules = self.load_validation_rules()
    
    async def validate_document(self, document: str, doc_type: str) -> ValidationResult:
        """생성된 문서를 사이트 표준에 맞게 검증"""
        
        validation_result = ValidationResult()
        
        # 1. 구조 검증
        structure_check = await self.validate_structure(document, doc_type)
        validation_result.add_check("structure", structure_check)
        
        # 2. 필수 내용 검증
        content_check = await self.validate_required_content(document, doc_type)
        validation_result.add_check("content", content_check)
        
        # 3. 표준 준수 검증
        standards_check = await self.validate_standards_compliance(document)
        validation_result.add_check("standards", standards_check)
        
        # 4. 개선 제안 생성
        if not validation_result.is_perfect():
            improvements = await self.generate_improvement_suggestions(
                document, validation_result.issues
            )
            validation_result.improvement_suggestions = improvements
        
        return validation_result

class ValidationResult:
    def __init__(self):
        self.checks = {}
        self.overall_score = 0
        self.issues = []
        self.improvement_suggestions = []
    
    def get_feedback_for_user(self) -> str:
        """사용자 LLM이 이해할 수 있는 피드백 생성"""
        feedback = f"문서 품질 점수: {self.overall_score}/100\n\n"
        
        if self.issues:
            feedback += "개선이 필요한 부분:\n"
            for issue in self.issues:
                feedback += f"- {issue.description}\n"
                feedback += f"  해결 방법: {issue.solution}\n"
        
        if self.improvement_suggestions:
            feedback += "\n추가 개선 제안:\n"
            for suggestion in self.improvement_suggestions:
                feedback += f"- {suggestion}\n"
        
        return feedback
```

## 🎯 구체적 개선 방안

### 방안 1: 극도로 상세한 가이드
```json
{
  "api_documentation_guide": {
    "section_1_overview": {
      "title": "API 개요",
      "required_length": "150-300자",
      "must_include": [
        "API의 비즈니스 목적",
        "주요 기능 3-5개",
        "대상 사용자"
      ],
      "template": "이 API는 [목적]을 위해 설계되었으며, [주요기능1], [주요기능2], [주요기능3]을 제공합니다. 주로 [대상사용자]가 사용합니다.",
      "good_example": "결제 API는 온라인 상거래 결제 처리를 위해 설계되었으며, 카드 결제, 간편 결제, 환불 처리를 제공합니다. 주로 프론트엔드 개발자와 모바일 앱 개발자가 사용합니다.",
      "bad_example": "결제 관련 API입니다.",
      "validation_regex": ".*API.*목적.*기능.*사용자.*"
    }
  }
}
```

### 방안 2: 초안 생성 + 개선
```python
async def generate_api_doc_draft(code_analysis, site_standards):
    """표준에 완벽히 맞는 초안 생성"""
    
    # LLM으로 초안 생성
    draft_prompt = f"""
    다음 코드를 분석하여 {site_standards.site_name} 표준에 맞는 API 문서 초안을 생성하세요.
    
    코드: {code_analysis.source_code}
    
    반드시 다음 구조를 따르세요:
    {site_standards.api_doc_template}
    
    각 섹션별 요구사항:
    {site_standards.section_requirements}
    
    ⚠️ 이는 초안이므로 완벽한 표준 준수가 최우선입니다.
    """
    
    draft = await llm.generate(draft_prompt)
    
    # 표준 준수 검증
    validation = await validate_against_standards(draft, site_standards)
    
    if validation.score < 90:
        # 재생성 또는 수정
        draft = await fix_standards_issues(draft, validation.issues)
    
    return {
        "draft": draft,
        "user_instruction": """
        위 초안은 사이트 표준에 맞게 생성되었습니다.
        다음 관점에서만 개선해주세요:
        1. 개발자 친화적 설명 추가
        2. 실제 사용 예시 보강
        3. 더 명확한 설명으로 개선
        
        ⚠️ 구조와 필수 항목은 절대 변경하지 마세요.
        """
    }
```

### 방안 3: 반복적 개선 루프
```typescript
// MCP에서 반복적 개선 지원
{
  "name": "improve_deliverable",
  "description": "생성된 산출물을 표준에 맞게 개선",
  "inputSchema": {
    "properties": {
      "document_content": {"type": "string"},
      "improvement_focus": {
        "enum": ["standards_compliance", "clarity", "completeness", "examples"]
      }
    }
  }
}

// 사용 예시
사용자: "API 문서 초안 완성했는데 표준 준수 검토해줘"
→ improve_deliverable 호출
→ 표준 준수 점검 후 구체적 개선 제안
```

## 🎯 최종 추천 방안

### **하이브리드 접근: 초안 생성 + 가이드 개선**

1. **figure-backend**: 표준 완벽 준수 초안 생성 (90% 완성도)
2. **사용자 LLM**: 사용성과 명확성 개선 (나머지 10%)
3. **실시간 검증**: 개선 과정에서 표준 이탈 방지

```
워크플로우:
사용자 요청 → figure-backend (초안 생성) → 사용자 LLM (개선) → 검증 → 완성
```

**장점:**
- ✅ 표준 준수 보장 (figure-backend가 담당)
- ✅ 사용자 맞춤 개선 (사용자 LLM이 담당)  
- ✅ 품질 일관성 유지
- ✅ 유연성 확보

이 방식이 가장 현실적이고 효과적일 것 같습니다. 어떻게 생각하시나요? 