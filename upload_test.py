#!/usr/bin/env python3
"""
문서 업로드 테스트 스크립트
"""
import requests
import json

def upload_document():
    url = "http://localhost:8001/api/documents/upload-file"
    
    # 파일과 메타데이터 준비
    files = {
        'file': ('impact_analysis_work_instructions.md', 
                open('test-sample/impact_analysis_work_instructions.md', 'rb'), 
                'text/markdown')
    }
    
    data = {
        'site_id': '3e98b17b-e987-408e-a5a5-b124c424242b',
        'metadata': json.dumps({
            "description": "영향도 분석서 작성 작업 지침서",
            "tags": ["지침서", "영향도분석", "템플릿"],
            "template_type": "IMPACT_ANALYSIS",
            "template_version": "1.0.0"
        })
    }
    
    try:
        print("📤 파일 업로드 시작...")
        print(f"   URL: {url}")
        print(f"   파일: test-sample/impact_analysis_work_instructions.md")
        print(f"   Site ID: {data['site_id']}")
        print(f"   메타데이터: {data['metadata']}")
        
        response = requests.post(url, files=files, data=data)
        
        print(f"\n📋 응답 상태: {response.status_code}")
        print(f"📋 응답 내용:")
        print(json.dumps(response.json(), indent=2, ensure_ascii=False))
        
        if response.status_code == 200:
            print("\n✅ 업로드 성공!")
        else:
            print(f"\n❌ 업로드 실패: {response.status_code}")
            
    except Exception as e:
        print(f"\n💥 오류 발생: {e}")
    finally:
        files['file'][1].close()

if __name__ == "__main__":
    upload_document()
