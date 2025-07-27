#!/usr/bin/env python3
"""
Mock Embedding 테스트
API 키 없이도 embedding 시스템의 구조와 동작을 테스트합니다.
"""

import sys
import asyncio
import time
import json
import random
import math
from pathlib import Path

# 백엔드 경로 추가
sys.path.append('/app')

from app.config import Settings
from app.infrastructure.adapters.embeddings.factory import embedding_factory
from app.domain.repositories.embedding_repository import EmbeddingRepository


class MockEmbeddingAdapter(EmbeddingRepository):
    """Mock Embedding 어댑터 (테스트용)"""
    
    def __init__(self, dimension: int = 1536):
        self.dimension = dimension
        self.call_count = 0
        
    @property
    def provider_name(self) -> str:
        """프로바이더 이름"""
        return "mock"
    
    @property
    def model_name(self) -> str:
        """모델 이름"""
        return "mock-embedding-1536"
        
    def _generate_mock_embedding(self, text: str) -> list[float]:
        """텍스트 기반의 일관된 mock embedding 생성"""
        # 텍스트 해시를 이용해 일관된 embedding 생성
        hash_value = hash(text)
        random.seed(hash_value)
        
        # 정규화된 벡터 생성
        vector = [random.uniform(-1, 1) for _ in range(self.dimension)]
        
        # 정규화
        magnitude = math.sqrt(sum(x*x for x in vector))
        normalized_vector = [x/magnitude for x in vector]
        
        self.call_count += 1
        return normalized_vector
    
    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        """문서 리스트 embedding (동기)"""
        return [self._generate_mock_embedding(text) for text in texts]
    
    def embed_query(self, text: str) -> list[float]:
        """단일 쿼리 embedding (동기)"""
        return self._generate_mock_embedding(text)
    
    async def aembed_documents(self, texts: list[str]) -> list[list[float]]:
        """문서 리스트 embedding (비동기)"""
        # 실제 네트워크 호출 시뮬레이션
        await asyncio.sleep(0.1 * len(texts))
        return self.embed_documents(texts)
    
    async def aembed_query(self, text: str) -> list[float]:
        """단일 쿼리 embedding (비동기)"""
        # 실제 네트워크 호출 시뮬레이션
        await asyncio.sleep(0.05)
        return self.embed_query(text)


class EmbeddingTester:
    """Embedding 시스템 테스터"""
    
    def __init__(self):
        self.adapter = MockEmbeddingAdapter()
        self.test_documents = []
        
    def load_sample_documents(self):
        """샘플 문서 로드"""
        documents = [
            {
                'id': 'tech_001',
                'title': '마이크로서비스 아키텍처 가이드',
                'content': '마이크로서비스 아키텍처는 대규모 애플리케이션을 작고 독립적인 서비스들로 분해하는 설계 패턴입니다. 각 서비스는 비즈니스 기능을 중심으로 구성되며, 독립적으로 배포하고 확장할 수 있습니다.',
                'category': 'technical'
            },
            {
                'id': 'tech_002', 
                'title': 'Docker 컨테이너 배포',
                'content': 'Docker는 애플리케이션을 컨테이너라는 가벼운 가상화 기술로 패키징하는 플랫폼입니다. 컨테이너는 코드, 런타임, 시스템 도구, 라이브러리 등 실행에 필요한 모든 것을 포함합니다.',
                'category': 'technical'
            },
            {
                'id': 'mgmt_001',
                'title': '프로젝트 관리 방법론',
                'content': '애자일 스크럼은 반복적이고 점진적인 소프트웨어 개발 방법론입니다. 2-4주의 스프린트 단위로 작업하며, 일일 스탠드업 미팅을 통해 진행 상황을 공유합니다.',
                'category': 'management'
            },
            {
                'id': 'mgmt_002',
                'title': '팀 협업 전략',
                'content': '효과적인 팀 협업을 위해서는 명확한 커뮤니케이션 채널과 정기적인 피드백 루프가 필요합니다. 코드 리뷰, 페어 프로그래밍, 문서화 등의 방법을 활용할 수 있습니다.',
                'category': 'management'
            },
            {
                'id': 'trouble_001',
                'title': '서버 장애 대응',
                'content': '서버 장애 발생 시 즉시 모니터링 대시보드를 확인하고, 로그 파일을 분석해야 합니다. 502 Bad Gateway 오류는 대부분 업스트림 서버 연결 문제로 발생합니다.',
                'category': 'troubleshooting'
            },
            {
                'id': 'trouble_002',
                'title': '성능 최적화 방법',
                'content': '애플리케이션 성능 최적화를 위해서는 프로파일링 도구를 사용하여 병목점을 식별하고, 데이터베이스 쿼리 최적화, 캐싱 전략, 코드 레벨 최적화를 수행해야 합니다.',
                'category': 'troubleshooting'
            }
        ]
        
        self.test_documents = documents
        print(f'📚 {len(documents)}개 샘플 문서 로드 완료')
        return documents
    
    async def test_basic_embedding(self):
        """기본 embedding 기능 테스트"""
        print('\n🔍 기본 Embedding 기능 테스트')
        print('-' * 40)
        
        # 단일 텍스트 embedding
        test_text = "이것은 embedding 테스트용 문장입니다."
        
        start_time = time.time()
        embedding = await self.adapter.aembed_query(test_text)
        duration = time.time() - start_time
        
        print(f'✅ 단일 텍스트 embedding 성공')
        print(f'   📏 차원: {len(embedding)}')
        print(f'   ⏱️  시간: {duration:.3f}초')
        print(f'   🔢 첫 5개 값: {embedding[:5]}')
        
        # 배치 embedding
        batch_texts = [doc['content'] for doc in self.test_documents[:3]]
        
        start_time = time.time()
        batch_embeddings = await self.adapter.aembed_documents(batch_texts)
        batch_duration = time.time() - start_time
        
        print(f'\n📦 배치 embedding 성공')
        print(f'   📊 문서 수: {len(batch_embeddings)}')
        print(f'   ⏱️  총 시간: {batch_duration:.3f}초')
        print(f'   📈 평균 시간: {batch_duration/len(batch_texts):.3f}초/문서')
        
        return True
    
    def cosine_similarity(self, a: list[float], b: list[float]) -> float:
        """코사인 유사도 계산"""
        dot_product = sum(x * y for x, y in zip(a, b))
        magnitude_a = math.sqrt(sum(x * x for x in a))
        magnitude_b = math.sqrt(sum(x * x for x in b))
        return dot_product / (magnitude_a * magnitude_b)
    
    async def test_semantic_similarity(self):
        """의미적 유사도 테스트"""
        print('\n🎯 의미적 유사도 분석 테스트')
        print('-' * 40)
        
        # 카테고리별 문서 embedding
        tech_docs = [doc for doc in self.test_documents if doc['category'] == 'technical']
        mgmt_docs = [doc for doc in self.test_documents if doc['category'] == 'management']
        
        tech_embeddings = await self.adapter.aembed_documents([doc['content'] for doc in tech_docs])
        mgmt_embeddings = await self.adapter.aembed_documents([doc['content'] for doc in mgmt_docs])
        
        # 같은 카테고리 내 유사도
        tech_similarity = self.cosine_similarity(tech_embeddings[0], tech_embeddings[1])
        mgmt_similarity = self.cosine_similarity(mgmt_embeddings[0], mgmt_embeddings[1])
        
        # 다른 카테고리 간 유사도  
        cross_similarity = self.cosine_similarity(tech_embeddings[0], mgmt_embeddings[0])
        
        print(f'📊 기술 문서 간 유사도: {tech_similarity:.4f}')
        print(f'📊 관리 문서 간 유사도: {mgmt_similarity:.4f}')
        print(f'📊 기술-관리 문서 유사도: {cross_similarity:.4f}')
        
        # 의미적 일관성 검증 (같은 카테고리가 더 유사해야 함)
        coherent = (tech_similarity > cross_similarity) and (mgmt_similarity > cross_similarity)
        print(f'🎯 의미적 일관성: {"✅ 통과" if coherent else "❌ 실패"}')
        
        return coherent
    
    async def test_search_functionality(self):
        """검색 기능 테스트"""
        print('\n🔍 의미적 검색 기능 테스트')
        print('-' * 40)
        
        # 모든 문서 embedding
        all_contents = [doc['content'] for doc in self.test_documents]
        doc_embeddings = await self.adapter.aembed_documents(all_contents)
        
        # 테스트 쿼리들
        test_queries = [
            "마이크로서비스 설계 방법",
            "프로젝트 일정 관리",
            "서버 오류 해결 방법"
        ]
        
        for query in test_queries:
            print(f'\n🔍 검색 쿼리: "{query}"')
            
            # 쿼리 embedding
            query_embedding = await self.adapter.aembed_query(query)
            
            # 유사도 계산 및 순위 매기기
            similarities = []
            for i, doc_embed in enumerate(doc_embeddings):
                similarity = self.cosine_similarity(query_embedding, doc_embed)
                similarities.append((i, similarity, self.test_documents[i]))
            
            # 유사도 순으로 정렬
            similarities.sort(key=lambda x: x[1], reverse=True)
            
            # 상위 3개 결과 출력
            print('   📊 검색 결과:')
            for rank, (doc_idx, score, doc) in enumerate(similarities[:3], 1):
                print(f'      {rank}. {doc["title"]} (유사도: {score:.4f})')
        
        return True
    
    async def test_performance_metrics(self):
        """성능 메트릭 테스트"""
        print('\n⚡ 성능 측정 테스트')
        print('-' * 40)
        
        # 다양한 크기의 배치로 성능 측정
        test_batches = [1, 3, 5, 10]
        performance_results = []
        
        for batch_size in test_batches:
            texts = [f"테스트 문서 {i}: 이것은 성능 테스트를 위한 샘플 텍스트입니다." for i in range(batch_size)]
            
            start_time = time.time()
            embeddings = await self.adapter.aembed_documents(texts)
            duration = time.time() - start_time
            
            throughput = batch_size / duration
            avg_time = duration / batch_size
            
            performance_results.append({
                'batch_size': batch_size,
                'total_time': duration,
                'avg_time_per_doc': avg_time,
                'throughput': throughput
            })
            
            print(f'   📊 배치 크기 {batch_size:2d}: {duration:.3f}초 (평균 {avg_time:.3f}초/문서, {throughput:.1f} 문서/초)')
        
        # 스케일링 분석
        if len(performance_results) >= 2:
            scaling_factor = performance_results[-1]['throughput'] / performance_results[0]['throughput']
            print(f'   📈 처리량 스케일링: {scaling_factor:.2f}x')
        
        return performance_results
    
    async def run_comprehensive_test(self):
        """종합 테스트 실행"""
        print('🚀 Figure Backend Mock Embedding 종합 테스트')
        print('=' * 60)
        
        # 문서 로드
        self.load_sample_documents()
        
        test_results = {
            'timestamp': time.strftime('%Y-%m-%d %H:%M:%S'),
            'adapter_type': 'MockEmbeddingAdapter',
            'dimension': self.adapter.dimension,
            'total_documents': len(self.test_documents)
        }
        
        try:
            # 기본 기능 테스트
            basic_result = await self.test_basic_embedding()
            test_results['basic_embedding'] = basic_result
            
            # 유사도 테스트
            similarity_result = await self.test_semantic_similarity()
            test_results['semantic_similarity'] = similarity_result
            
            # 검색 기능 테스트
            search_result = await self.test_search_functionality()
            test_results['search_functionality'] = search_result
            
            # 성능 테스트
            performance_result = await self.test_performance_metrics()
            test_results['performance_metrics'] = performance_result
            
            # 결과 요약
            print(f'\n📊 테스트 결과 요약')
            print('=' * 40)
            print(f'✅ 기본 Embedding: {"통과" if basic_result else "실패"}')
            print(f'✅ 의미적 일관성: {"통과" if similarity_result else "실패"}')
            print(f'✅ 검색 기능: {"통과" if search_result else "실패"}')
            print(f'📞 총 API 호출 수: {self.adapter.call_count}')
            
            # 결과 저장
            with open('/app/mock_embedding_test_results.json', 'w', encoding='utf-8') as f:
                json.dump(test_results, f, indent=2, ensure_ascii=False)
            
            print(f'\n💾 테스트 결과가 /app/mock_embedding_test_results.json에 저장되었습니다')
            
            success = basic_result and similarity_result and search_result
            print(f'\n🎉 Mock Embedding 테스트 {"완료" if success else "일부 실패"}!')
            
            return success
            
        except Exception as e:
            print(f'\n❌ 테스트 실행 중 오류: {e}')
            import traceback
            traceback.print_exc()
            return False


async def main():
    """메인 실행 함수"""
    tester = EmbeddingTester()
    success = await tester.run_comprehensive_test()
    
    print(f'\n📊 최종 결과: {"SUCCESS" if success else "FAILED"}')
    return success


if __name__ == "__main__":
    success = asyncio.run(main())
    exit(0 if success else 1) 