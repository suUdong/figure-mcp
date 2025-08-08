#!/usr/bin/env python3
"""
JSON 방식 문서 업로드 테스트 스크립트
"""
import requests
import json

def upload_document_json():
    url = "http://localhost:8001/api/documents/upload"
    
    # 파일 내용 읽기
    with open('test-sample/impact_analysis_work_instructions.md', 'r', encoding='utf-8') as f:
        content = f.read()
    
    # JSON 페이로드 준비
    payload = {
        "title": "영향도 분석서 작성 작업 지침",
        "content": content,
        "doc_type": "text",
        "source_url": "",
        "site_id": "3e98b17b-e987-408e-a5a5-b124c424242b",
        "metadata": {
            "description": "영향도 분석서 작성 작업 지침서 (통합 DB 테스트)",
            "tags": "지침서,영향도분석,템플릿,통합DB",
            "template_type": "IMPACT_ANALYSIS",
            "template_version": "3.0.0",
            "file_name": "impact_analysis_work_instructions.md",
            "file_size": len(content)
        }
    }
    
    headers = {
        'Content-Type': 'application/json'
    }
    
    try:
        print("📤 JSON 방식 문서 업로드 시작...")
        print(f"   URL: {url}")
        print(f"   제목: {payload['title']}")
        print(f"   내용 길이: {len(payload['content'])} 문자")
        print(f"   Site ID: {payload['site_id']}")
        
        response = requests.post(url, json=payload, headers=headers)
        
        print(f"\n📋 응답 상태: {response.status_code}")
        print(f"📋 응답 내용:")
        print(json.dumps(response.json(), indent=2, ensure_ascii=False))
        
        if response.status_code == 200:
            print("\n✅ 업로드 성공!")
        else:
            print(f"\n❌ 업로드 실패: {response.status_code}")
            
    except Exception as e:
        print(f"\n💥 오류 발생: {e}")

if __name__ == "__main__":
    upload_document_json()
