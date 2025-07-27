#!/usr/bin/env python3
"""
RAG API 테스트 스크립트
"""

import requests
import json
import sys

def test_rag_api():
    """RAG API 테스트"""
    print('🧪 RAG API 테스트 시작')
    print('=' * 50)
    
    # API 엔드포인트
    url = "http://localhost:8001/api/rag/query"
    
    # 테스트 요청 데이터
    test_data = {
        "query": "작업 지침에 대해 알려줘",
        "max_results": 5,
        "similarity_threshold": 0.7
    }
    
    headers = {
        "Content-Type": "application/json"
    }
    
    try:
        print(f'📤 요청 URL: {url}')
        print(f'📝 요청 데이터: {json.dumps(test_data, indent=2, ensure_ascii=False)}')
        
        # API 호출
        response = requests.post(url, json=test_data, headers=headers, timeout=30)
        
        print(f'📊 응답 상태: {response.status_code}')
        
        if response.status_code == 200:
            result = response.json()
            print('✅ RAG API 호출 성공!')
            print(f'📄 응답 데이터:')
            print(json.dumps(result, indent=2, ensure_ascii=False))
            
            # 응답 구조 검증
            if result.get('success'):
                data = result.get('data', {})
                print('\n🔍 응답 분석:')
                print(f'  - 답변 길이: {len(data.get("answer", ""))} 문자')
                print(f'  - 소스 개수: {len(data.get("sources", []))} 개')
                print(f'  - 처리 시간: {data.get("query_time", 0):.3f}초')
                
            return True
        else:
            print(f'❌ RAG API 호출 실패: {response.status_code}')
            print(f'📄 오류 응답: {response.text}')
            return False
            
    except requests.exceptions.RequestException as e:
        print(f'❌ 네트워크 오류: {e}')
        return False
    except Exception as e:
        print(f'❌ 예상치 못한 오류: {e}')
        return False

if __name__ == "__main__":
    success = test_rag_api()
    print(f'\n📊 최종 결과: {"SUCCESS" if success else "FAILED"}')
    sys.exit(0 if success else 1) 