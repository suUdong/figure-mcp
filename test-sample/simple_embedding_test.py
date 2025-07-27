#!/usr/bin/env python3
"""
간단한 Embedding 테스트
"""

import sys
import asyncio
import time
from pathlib import Path

# 백엔드 경로 추가
sys.path.append('/app')

from app.config import Settings
from app.infrastructure.adapters.embeddings.factory import embedding_factory


async def test_embedding():
    """간단한 embedding 테스트"""
    print('🔍 Figure Backend Embedding 테스트')
    print('=' * 50)
    
    try:
        # 설정 로드
        settings = Settings()
        print(f'📝 현재 embedding provider: {settings.embedding_provider}')
        
        # 사용 가능한 provider 확인
        available_providers = embedding_factory.get_available_providers()
        print(f'📋 사용 가능한 providers: {available_providers}')
        
        if not available_providers:
            print('❌ 사용 가능한 embedding provider가 없습니다')
            return False
        
        # 어댑터 생성
        adapter = embedding_factory.create_adapter(settings)
        print(f'✅ 어댑터 생성 성공: {type(adapter).__name__}')
        
        # 테스트 텍스트들
        test_texts = [
            "마이크로서비스 아키텍처는 현대적인 소프트웨어 개발 방법론입니다.",
            "Docker 컨테이너를 사용하여 애플리케이션을 배포할 수 있습니다.",
            "프로젝트 관리에서는 명확한 목표 설정이 중요합니다.",
            "시스템 문제 해결을 위해서는 로그 분석이 필수입니다.",
            "코드 리뷰를 통해 소프트웨어 품질을 향상시킬 수 있습니다."
        ]
        
        print(f'\n📚 테스트 문서 수: {len(test_texts)}')
        
        # 1. 단일 텍스트 embedding
        print(f'\n🔍 단일 텍스트 embedding 테스트...')
        start_time = time.time()
        
        single_embedding = await adapter.aembed_query(test_texts[0])
        single_time = time.time() - start_time
        
        print(f'   ✅ 성공!')
        print(f'   📏 차원: {len(single_embedding)}')
        print(f'   ⏱️  시간: {single_time:.3f}초')
        print(f'   🔢 첫 5개 값: {single_embedding[:5]}')
        
        # 2. 배치 embedding
        print(f'\n📦 배치 embedding 테스트...')
        start_time = time.time()
        
        batch_embeddings = await adapter.aembed_documents(test_texts)
        batch_time = time.time() - start_time
        
        print(f'   ✅ 성공!')
        print(f'   📊 문서 수: {len(batch_embeddings)}')
        print(f'   📏 차원: {len(batch_embeddings[0])}')
        print(f'   ⏱️  총 시간: {batch_time:.3f}초')
        print(f'   📈 문서당 평균: {batch_time/len(test_texts):.3f}초')
        
        # 3. 유사도 테스트
        print(f'\n🎯 유사도 분석 테스트...')
        
        # 기술 관련 텍스트 vs 관리 관련 텍스트
        tech_text = "Docker와 Kubernetes를 이용한 컨테이너 배포"
        mgmt_text = "프로젝트 일정 관리와 팀 커뮤니케이션"
        
        tech_embed = await adapter.aembed_query(tech_text)
        mgmt_embed = await adapter.aembed_query(mgmt_text)
        
        # 코사인 유사도 계산
        def cosine_similarity(a, b):
            import math
            dot_product = sum(x * y for x, y in zip(a, b))
            magnitude_a = math.sqrt(sum(x * x for x in a))
            magnitude_b = math.sqrt(sum(x * x for x in b))
            return dot_product / (magnitude_a * magnitude_b)
        
        # 같은 도메인 내 유사도
        tech_similarity = cosine_similarity(single_embedding, tech_embed)  # 둘 다 기술 관련
        cross_similarity = cosine_similarity(single_embedding, mgmt_embed)  # 다른 도메인
        
        print(f'   📊 기술-기술 유사도: {tech_similarity:.4f}')
        print(f'   📊 기술-관리 유사도: {cross_similarity:.4f}')
        print(f'   🎯 의미적 일관성: {"✅ 통과" if tech_similarity > cross_similarity else "❌ 실패"}')
        
        # 4. 다양한 길이 텍스트 테스트
        print(f'\n📏 텍스트 길이별 테스트...')
        
        short_text = "짧은 텍스트"
        medium_text = "중간 길이의 텍스트입니다. 여러 단어들이 포함되어 있으며 의미를 가지고 있습니다."
        long_text = medium_text * 10  # 긴 텍스트
        
        texts_by_length = [
            ("짧은 텍스트", short_text),
            ("중간 텍스트", medium_text),
            ("긴 텍스트", long_text)
        ]
        
        for label, text in texts_by_length:
            start_time = time.time()
            embedding = await adapter.aembed_query(text)
            duration = time.time() - start_time
            
            print(f'   {label}: {len(text)}자 → {len(embedding)}차원, {duration:.3f}초')
        
        print(f'\n🎉 모든 테스트 완료!')
        return True
        
    except Exception as e:
        print(f'\n❌ 테스트 실패: {str(e)}')
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    success = asyncio.run(test_embedding())
    print(f'\n📊 최종 결과: {"SUCCESS" if success else "FAILED"}')
    exit(0 if success else 1) 