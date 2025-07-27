#!/usr/bin/env python3
"""
API 키 설정 상태 확인 스크립트
"""

import sys
import os
sys.path.append('/app')

from app.config import Settings


def check_api_keys():
    """API 키 설정 상태 확인"""
    print('🔍 현재 환경 변수 및 API 키 설정 상태')
    print('=' * 50)

    try:
        s = Settings()
        print(f'현재 embedding provider: {s.embedding_provider}')
        print()

        # API 키 설정 상태 확인
        print('API 키 설정 상태:')
        
        gemini_set = bool(s.gemini_api_key and s.gemini_api_key != "your-gemini-api-key-here")
        openai_set = bool(s.openai_api_key and s.openai_api_key != "your-openai-api-key-here") 
        voyage_set = bool(s.voyage_api_key and s.voyage_api_key != "your-voyage-api-key-here")
        
        print(f'  GEMINI_API_KEY: {"✅ 설정됨" if gemini_set else "❌ 미설정"}')
        print(f'  OPENAI_API_KEY: {"✅ 설정됨" if openai_set else "❌ 미설정"}')
        print(f'  VOYAGE_API_KEY: {"✅ 설정됨" if voyage_set else "❌ 미설정"}')
        print()

        # 환경 변수 직접 확인
        print('환경 변수 확인:')
        env_vars = ['FIGURE_GEMINI_API_KEY', 'FIGURE_OPENAI_API_KEY', 'FIGURE_VOYAGE_API_KEY']
        
        for var in env_vars:
            value = os.getenv(var, 'None')
            if value and value != 'None' and 'your-' not in value and len(value) > 10:
                status = '✅ 설정됨'
                masked = value[:10] + '...' + value[-4:] if len(value) > 14 else value[:6] + '...'
                print(f'  {var}: {status} ({masked})')
            else:
                print(f'  {var}: ❌ 미설정')
        
        print()
        
        # 실제 테스트 가능 여부 판단
        available_count = sum([gemini_set, openai_set, voyage_set])
        
        if available_count > 0:
            print(f'🎉 실제 embedding 테스트 가능!')
            print(f'   사용 가능한 provider: {available_count}개')
            
            if gemini_set:
                print(f'   - Gemini: 사용 가능 (모델: {s.gemini_embedding_model})')
            if openai_set:
                print(f'   - OpenAI: 사용 가능 (모델: {s.openai_embedding_model})')
            if voyage_set:
                print(f'   - Voyage: 사용 가능 (모델: {s.voyage_embedding_model})')
        else:
            print('❌ 실제 embedding 테스트 불가능')
            print('   최소 하나의 API 키 설정이 필요합니다.')
            print()
            print('🔧 API 키 설정 방법:')
            print('   1. Docker Compose 환경 변수 설정:')
            print('      docker-compose.yml에서 environment 섹션 수정')
            print()
            print('   2. 환경 변수 직접 설정:')
            print('      export FIGURE_GEMINI_API_KEY="your-actual-key"')
            print('      export FIGURE_OPENAI_API_KEY="your-actual-key"')
            print('      export FIGURE_VOYAGE_API_KEY="your-actual-key"')
            print()
            print('   3. Docker 컨테이너 재시작:')
            print('      docker compose restart figure-backend')
        
        return available_count > 0
        
    except Exception as e:
        print(f'❌ 설정 확인 중 오류: {e}')
        return False


if __name__ == "__main__":
    success = check_api_keys()
    exit(0 if success else 1) 