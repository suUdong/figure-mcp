#!/usr/bin/env python3
"""
기존 문서를 템플릿으로 수동 등록하는 스크립트
"""
import requests
import json

def register_as_template():
    """기존 문서를 템플릿으로 등록"""
    
    # 1. 현재 문서 목록 조회
    print("📋 현재 문서 목록 조회...")
    response = requests.get("http://localhost:8001/api/documents/")
    
    if response.status_code != 200:
        print(f"❌ 문서 목록 조회 실패: {response.status_code}")
        return
    
    data = response.json()
    documents = data.get('data', {}).get('documents', [])
    
    print(f"📄 총 {len(documents)}개 문서 발견")
    
    # 2. 영향도 분석서 문서 찾기
    impact_docs = []
    for doc in documents:
        title = doc.get('title', '')
        if '영향도' in title and '분석' in title:
            impact_docs.append(doc)
    
    print(f"🎯 영향도 분석서 문서 {len(impact_docs)}개 발견")
    
    for doc in impact_docs:
        print(f"   - ID: {doc.get('id')}")
        print(f"     제목: {doc.get('title')}")
        print(f"     타입: {doc.get('type')}")
        print(f"     생성일: {doc.get('created_at')}")
        print()
    
    # 3. 템플릿 생성 API 호출
    if impact_docs:
        doc = impact_docs[0]  # 첫 번째 문서 사용
        doc_id = doc.get('id')
        
        print(f"📝 문서 '{doc.get('title')}'를 템플릿으로 등록 중...")
        
        # 문서 내용 가져오기 (벡터 DB에서)
        # 실제로는 벡터 DB에서 내용을 가져와야 하지만, 
        # 여기서는 기본 내용으로 대체
        template_content = """# 영향도 분석서 작성 작업 지침

본 지침서는 소스 코드·DB 변경에 따른 **영향도 분석서(Impact Analysis Report)** 를 작성하는 절차를 정의합니다.

## 1. 준비 단계
1. **대상 식별**  
   ‑ 변경이 필요한 클래스·모듈·SQL 등을 명확히 지정합니다.
2. **변경 범위 초안 작성**  
   ‑ 기능, 데이터, UI, 보안 등 어떤 영역이 영향을 받는지 구분만 적어 둡니다.

## 2. 필요 데이터 수집
영향도 분석서는 다음 데이터가 필요합니다. MCP 서버의 각 도구를 호출해 수집하세요.

## 3. 템플릿 채우기
`impact_analysis_spec` 도구를 호출하여 템플릿과 문서 번호를 확보합니다.

## 4. 영향도 평가 작성 요령
| 영역 | 질문 | 예시 |
|------|------|------|
| 기능 | 기능 동작 변경 여부? | "로그인 정책 변경으로 리다이렉트 URL 수정" |
| 성능 | TPS, 쿼리 비용 증가? | "인덱스 추가로 조회 속도 30% 개선" |
| 데이터 | 스키마 변경, 마이그레이션 필요? | "`age` 컬럼 int->smallint 축소" |

## 5. 리스크 및 완화
- **가능성 (Probability)**: 높음/중간/낮음
- **영향도 (Severity)**: 높음/중간/낮음
- **완화 방안**: 롤백 전략, A/B 배포, 추가 코드 리뷰 등

## 6. 산출물 저장
- 파일명: `IMP_KDI_BI_{번호}_{대상모듈}.md`
- 경로: `D:\\KDI\\docs\\영향도 분석서\\`

## 7. 완료 보고
문서 작성 후:
1. 지정된 경로에 저장
2. Slack #dev-docs 채널에 링크 공유
3. JIRA 티켓에 문서 첨부 및 레뷰어 지정"""
        
        # 템플릿 생성 요청
        template_payload = {
            "name": "영향도 분석서 작성 지침 v1.0.0",
            "description": "영향도 분석서 작성을 위한 표준 템플릿",
            "template_type": "IMPACT_ANALYSIS",
            "format": "markdown",
            "site_id": "3e98b17b-e987-408e-a5a5-b124c424242b",
            "content": template_content,
            "variables": {},
            "tags": ["영향도분석", "템플릿", "지침서", "수동등록"],
            "is_default": True,
            "version": "1.0.0"
        }
        
        print("🚀 템플릿 생성 API 호출...")
        create_response = requests.post(
            "http://localhost:8001/api/templates/",
            json=template_payload,
            headers={'Content-Type': 'application/json'}
        )
        
        print(f"📋 응답 상태: {create_response.status_code}")
        
        try:
            result = create_response.json()
            print(f"📋 응답 내용:")
            print(json.dumps(result, indent=2, ensure_ascii=False))
            
            if create_response.status_code == 200 or create_response.status_code == 201:
                print("\n✅ 템플릿 등록 성공!")
            else:
                print(f"\n❌ 템플릿 등록 실패: {create_response.status_code}")
        except Exception as e:
            print(f"💥 응답 파싱 오류: {e}")
            print(f"원본 응답: {create_response.text}")

if __name__ == "__main__":
    register_as_template()
