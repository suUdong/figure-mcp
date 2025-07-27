#!/usr/bin/env python3
"""
실제 API를 사용한 Embedding 테스트
"""

import sys
import asyncio
import time
import json
from pathlib import Path

# 백엔드 경로 추가
sys.path.append('/app')

from app.config import Settings
from app.infrastructure.adapters.embeddings.factory import embedding_factory


async def test_real_embedding():
    """실제 API를 사용한 embedding 테스트"""
    print('🚀 Figure Backend 실제 Embedding API 테스트')
    print('=' * 60)
    
    try:
        # 설정 로드
        settings = Settings()
        print(f'📝 현재 embedding provider: {settings.embedding_provider}')
        
        # 사용 가능한 provider 확인
        available_providers = embedding_factory.get_available_providers()
        print(f'📋 사용 가능한 providers: {available_providers}')
        
        # 현재 provider로 어댑터 생성
        try:
            adapter = embedding_factory.create_adapter(settings)
            print(f'✅ 어댑터 생성 성공: {type(adapter).__name__}')
            print(f'🔧 Provider: {adapter.provider_name}')
            print(f'🤖 Model: {adapter.model_name}')
        except Exception as e:
            print(f'❌ 어댑터 생성 실패: {e}')
            return False
        
        print('\n' + '='*60)
        
        # 테스트 1: 간단한 단일 텍스트 embedding
        print('🔍 테스트 1: 단일 텍스트 Embedding')
        print('-' * 40)
        
        test_text = "마이크로서비스 아키텍처는 현대적인 소프트웨어 개발 방법론입니다."
        print(f'입력 텍스트: "{test_text}"')
        
        try:
            start_time = time.time()
            embedding = await adapter.aembed_query(test_text)
            duration = time.time() - start_time
            
            print(f'✅ Embedding 성공!')
            print(f'   📏 차원: {len(embedding)}')
            print(f'   ⏱️  시간: {duration:.3f}초')
            print(f'   🔢 첫 5개 값: {embedding[:5]}')
            print(f'   📊 벡터 크기: {sum(x*x for x in embedding):.6f}')
            
            test1_success = True
            
        except Exception as e:
            print(f'❌ 단일 텍스트 embedding 실패: {e}')
            test1_success = False
        
        print('\n' + '='*60)
        
        # 테스트 2: 배치 embedding (성공한 경우만)
        if test1_success:
            print('🔍 테스트 2: 배치 텍스트 Embedding')
            print('-' * 40)
            
            batch_texts = [
                "Docker 컨테이너를 사용한 애플리케이션 배포",
                "프로젝트 관리에서 애자일 방법론 적용",
                "데이터베이스 성능 최적화 기법"
            ]
            
            print(f'배치 크기: {len(batch_texts)}개 텍스트')
            
            try:
                start_time = time.time()
                batch_embeddings = await adapter.aembed_documents(batch_texts)
                batch_duration = time.time() - start_time
                
                print(f'✅ 배치 Embedding 성공!')
                print(f'   📊 처리된 문서 수: {len(batch_embeddings)}')
                print(f'   📏 각 embedding 차원: {len(batch_embeddings[0])}')
                print(f'   ⏱️  총 시간: {batch_duration:.3f}초')
                print(f'   📈 평균 시간: {batch_duration/len(batch_texts):.3f}초/문서')
                print(f'   🏃 처리량: {len(batch_texts)/batch_duration:.1f} 문서/초')
                
                test2_success = True
                
            except Exception as e:
                print(f'❌ 배치 embedding 실패: {e}')
                test2_success = False
        else:
            test2_success = False
            print('⏭️ 단일 텍스트 테스트 실패로 배치 테스트 건너뜀')
        
        print('\n' + '='*60)
        
        # 테스트 3: 의미적 유사도 분석 (성공한 경우만)
        if test1_success:
            print('🔍 테스트 3: 의미적 유사도 분석')
            print('-' * 40)
            
            try:
                # 관련된 텍스트들
                tech_text1 = "마이크로서비스 아키텍처와 컨테이너 기술"
                tech_text2 = "Docker와 Kubernetes를 이용한 배포 자동화"
                
                # 관련 없는 텍스트
                other_text = "프로젝트 관리와 팀 협업 방법론"
                
                print('텍스트 1 (기술): ' + tech_text1)
                print('텍스트 2 (기술): ' + tech_text2)
                print('텍스트 3 (관리): ' + other_text)
                
                # 각각 embedding
                embed1 = await adapter.aembed_query(tech_text1)
                embed2 = await adapter.aembed_query(tech_text2)
                embed3 = await adapter.aembed_query(other_text)
                
                # 코사인 유사도 계산
                def cosine_similarity(a, b):
                    import math
                    dot_product = sum(x * y for x, y in zip(a, b))
                    magnitude_a = math.sqrt(sum(x * x for x in a))
                    magnitude_b = math.sqrt(sum(x * x for x in b))
                    return dot_product / (magnitude_a * magnitude_b)
                
                sim_tech_tech = cosine_similarity(embed1, embed2)
                sim_tech_other = cosine_similarity(embed1, embed3)
                
                print(f'\n📊 유사도 분석 결과:')
                print(f'   기술-기술 유사도: {sim_tech_tech:.4f}')
                print(f'   기술-관리 유사도: {sim_tech_other:.4f}')
                
                # 의미적 일관성 확인
                coherent = sim_tech_tech > sim_tech_other
                print(f'   🎯 의미적 일관성: {"✅ 통과" if coherent else "❌ 실패"}')
                
                if coherent:
                    print(f'      → 같은 도메인 텍스트가 더 높은 유사도를 보입니다!')
                else:
                    print(f'      → 예상과 다른 유사도 패턴입니다.')
                
                test3_success = True
                
            except Exception as e:
                print(f'❌ 의미적 유사도 분석 실패: {e}')
                test3_success = False
        else:
            test3_success = False
            print('⏭️ 이전 테스트 실패로 유사도 분석 건너뜀')
        
        # 최종 결과 요약
        print('\n' + '🎉 테스트 결과 요약')
        print('=' * 60)
        
        results = {
            'provider': settings.embedding_provider,
            'model': adapter.model_name if test1_success else 'N/A',
            'tests': {
                'single_embedding': test1_success,
                'batch_embedding': test2_success,
                'semantic_similarity': test3_success
            }
        }
        
        success_count = sum([test1_success, test2_success, test3_success])
        total_tests = 3
        
        print(f'📊 성공한 테스트: {success_count}/{total_tests}')
        print(f'📈 성공률: {success_count/total_tests*100:.1f}%')
        
        if test1_success:
            print('✅ 단일 텍스트 embedding: 성공')
        else:
            print('❌ 단일 텍스트 embedding: 실패')
            
        if test2_success:
            print('✅ 배치 embedding: 성공')
        elif test1_success:
            print('❌ 배치 embedding: 실패')
        else:
            print('⏭️ 배치 embedding: 건너뜀')
            
        if test3_success:
            print('✅ 의미적 유사도 분석: 성공')
        elif test1_success:
            print('❌ 의미적 유사도 분석: 실패')
        else:
            print('⏭️ 의미적 유사도 분석: 건너뜀')
        
        # 결과 저장
        with open('/app/real_embedding_test_results.json', 'w', encoding='utf-8') as f:
            json.dump(results, f, indent=2, ensure_ascii=False)
        
        print(f'\n💾 결과가 /app/real_embedding_test_results.json에 저장되었습니다')
        
        overall_success = success_count > 0
        print(f'\n📊 최종 결과: {"SUCCESS" if overall_success else "FAILED"}')
        
        if overall_success:
            print('🎉 실제 embedding API가 정상적으로 동작합니다!')
        else:
            print('❌ API 키 설정이나 네트워크 연결을 확인해주세요.')
        
        return overall_success
        
    except Exception as e:
        print(f'\n❌ 테스트 실행 중 치명적 오류: {e}')
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    success = asyncio.run(test_real_embedding())
    exit(0 if success else 1) 