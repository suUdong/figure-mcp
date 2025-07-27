#!/usr/bin/env python3
"""
Provider별 Embedding 테스트
API 키가 설정된 provider만 테스트합니다.
"""

import sys
import asyncio
import time

# 백엔드 경로 추가
sys.path.append('/app')

from app.config import Settings
from app.infrastructure.adapters.embeddings.factory import embedding_factory


async def test_provider(provider_name):
    """특정 provider로 embedding 테스트"""
    print(f'\n🔍 {provider_name.upper()} Provider 테스트')
    print('-' * 40)
    
    try:
        # 설정 생성 및 provider 변경
        settings = Settings()
        settings.embedding_provider = provider_name
        
        # API 키 확인
        if provider_name == 'gemini':
            has_key = bool(settings.gemini_api_key)
        elif provider_name == 'openai':
            has_key = bool(settings.openai_api_key)
        elif provider_name == 'voyage':
            has_key = bool(settings.voyage_api_key)
        else:
            has_key = False
        
        print(f'API 키 상태: {"✅ 설정됨" if has_key else "❌ 미설정"}')
        
        if not has_key:
            print(f'⏭️  {provider_name} API 키가 없어서 건너뜀')
            return False
        
        # 어댑터 생성
        adapter = embedding_factory.create_adapter(settings)
        print(f'어댑터: {type(adapter).__name__}')
        
        # 간단한 테스트 텍스트
        test_text = "이것은 embedding 테스트용 문장입니다."
        
        # embedding 수행
        start_time = time.time()
        embedding = await adapter.aembed_query(test_text)
        duration = time.time() - start_time
        
        print(f'✅ Embedding 성공!')
        print(f'   📏 차원: {len(embedding)}')
        print(f'   ⏱️  시간: {duration:.3f}초')
        print(f'   🔢 처음 3개 값: {embedding[:3]}')
        
        # 배치 테스트
        batch_texts = [
            "첫 번째 테스트 문서입니다.",
            "두 번째 테스트 문서입니다.",
            "세 번째 테스트 문서입니다."
        ]
        
        start_time = time.time()
        batch_embeddings = await adapter.aembed_documents(batch_texts)
        batch_duration = time.time() - start_time
        
        print(f'📦 배치 embedding 성공!')
        print(f'   📊 문서 수: {len(batch_embeddings)}')
        print(f'   ⏱️  총 시간: {batch_duration:.3f}초')
        
        return True
        
    except Exception as e:
        print(f'❌ {provider_name} 테스트 실패: {str(e)}')
        return False


async def main():
    """메인 테스트 함수"""
    print('🚀 Figure Backend Provider별 Embedding 테스트')
    print('=' * 60)
    
    # 사용 가능한 provider 목록
    available_providers = embedding_factory.get_available_providers()
    print(f'📋 등록된 providers: {available_providers}')
    
    success_count = 0
    total_count = len(available_providers)
    
    # 각 provider 테스트
    for provider in available_providers:
        success = await test_provider(provider)
        if success:
            success_count += 1
    
    # 결과 요약
    print(f'\n📊 테스트 결과 요약')
    print('=' * 60)
    print(f'성공한 Provider: {success_count}/{total_count}')
    print(f'성공률: {success_count/total_count*100:.1f}%')
    
    if success_count > 0:
        print('🎉 최소 1개 이상의 provider가 정상 작동합니다!')
        return True
    else:
        print('❌ 모든 provider 테스트 실패')
        return False


if __name__ == "__main__":
    success = asyncio.run(main())
    print(f'\n📊 최종 결과: {"SUCCESS" if success else "FAILED"}')
    exit(0 if success else 1) 