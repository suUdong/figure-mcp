#!/usr/bin/env python3
"""
Voyage API 실제 작동 테스트
"""

import sys
import asyncio
sys.path.append('/app')

from app.config import Settings
from app.infrastructure.adapters.embeddings.factory import embedding_factory

async def test_voyage_api():
    """Voyage API 실제 작동 테스트"""
    print('🚀 Voyage API 실제 작동 테스트')
    print('=' * 50)
    
    try:
        # 설정 로드
        settings = Settings()
        print(f'✅ Embedding Provider: {settings.embedding_provider}')
        print(f'✅ Voyage Model: {settings.voyage_embedding_model}')
        print(f'✅ API Key 설정됨: {"예" if settings.voyage_api_key else "아니오"}')
        
        # Voyage 어댑터 생성
        embedding_adapter = embedding_factory.create_adapter(settings)
        print(f'✅ 어댑터 생성 성공: {embedding_adapter.provider_name}')
        
        # 실제 임베딩 테스트
        test_text = "Voyage AI 임베딩 테스트입니다. API 키가 정상적으로 작동하는지 확인합니다."
        print(f'\n📝 테스트 텍스트: {test_text}')
        
        print('\n🔄 임베딩 생성 중...')
        embedding = await embedding_adapter.aembed_query(test_text)
        
        print(f'✅ 임베딩 생성 성공!')
        print(f'📏 임베딩 차원: {len(embedding)}')
        print(f'🔢 처음 5개 값: {embedding[:5]}')
        
        # 문서 임베딩 테스트
        test_documents = [
            "첫 번째 테스트 문서입니다.",
            "두 번째 테스트 문서입니다.",
            "세 번째 테스트 문서입니다."
        ]
        
        print(f'\n📚 문서 임베딩 테스트 ({len(test_documents)}개 문서)')
        embeddings = await embedding_adapter.aembed_documents(test_documents)
        
        print(f'✅ 문서 임베딩 성공!')
        print(f'📏 각 문서 임베딩 차원: {[len(emb) for emb in embeddings]}')
        
        print('\n🎉 Voyage API 테스트 완료 - 모든 기능 정상 작동!')
        return True
        
    except Exception as e:
        print(f'\n❌ Voyage API 테스트 실패: {e}')
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = asyncio.run(test_voyage_api())
    print(f'\n📊 최종 결과: {"SUCCESS" if success else "FAILED"}')
    exit(0 if success else 1) 