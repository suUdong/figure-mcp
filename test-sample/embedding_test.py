#!/usr/bin/env python3
"""
Embedding 테스트 케이스
다양한 문서 타입과 embedding 모델을 테스트합니다.
"""

import asyncio
import os
import sys
import time
from pathlib import Path
from typing import List, Dict, Any

# 백엔드 경로를 Python path에 추가
sys.path.append(str(Path(__file__).parent.parent / "figure-backend"))

from app.config import Settings
from app.infrastructure.adapters.embeddings.factory import embedding_factory
from app.domain.repositories.embedding_repository import EmbeddingRepository


class EmbeddingTester:
    """Embedding 테스트 클래스"""
    
    def __init__(self):
        self.settings = Settings()
        self.test_documents = []
        self.test_results = {}
        
    def load_test_documents(self) -> List[str]:
        """테스트용 문서들을 로드합니다."""
        test_files = [
            "technical_documentation.md",
            "troubleshooting_guide.md", 
            "project_management.md",
            "work_instructions.md",
            "impact_analysis_work_instructions.md"
        ]
        
        documents = []
        current_dir = Path(__file__).parent
        
        for file_name in test_files:
            file_path = current_dir / file_name
            if file_path.exists():
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                    documents.append({
                        'filename': file_name,
                        'content': content,
                        'length': len(content),
                        'type': 'markdown'
                    })
                    print(f"✅ 로드됨: {file_name} ({len(content):,} 문자)")
            else:
                print(f"❌ 파일 없음: {file_name}")
        
        return documents
    
    def create_text_chunks(self, documents: List[Dict]) -> List[str]:
        """문서를 embedding 테스트용 청크로 분할합니다."""
        chunks = []
        
        for doc in documents:
            content = doc['content']
            # 단락별로 분할 (간단한 청킹 전략)
            paragraphs = content.split('\n\n')
            
            for paragraph in paragraphs:
                paragraph = paragraph.strip()
                if len(paragraph) > 50:  # 너무 짧은 텍스트 제외
                    chunks.append({
                        'text': paragraph,
                        'source': doc['filename'],
                        'length': len(paragraph)
                    })
        
        return chunks
    
    async def test_embedding_adapter(self, provider: str) -> Dict[str, Any]:
        """특정 embedding 어댑터를 테스트합니다."""
        print(f"\n🔍 {provider.upper()} Embedding 테스트 시작...")
        
        try:
            # 설정 업데이트
            self.settings.embedding_provider = provider
            
            # 어댑터 생성
            adapter: EmbeddingRepository = embedding_factory.create_adapter(self.settings)
            
            # 테스트 텍스트 준비
            test_texts = [
                "마이크로서비스 아키텍처는 애플리케이션을 작고 독립적인 서비스들로 구성하는 방법입니다.",
                "JWT 토큰 기반 인증을 통해 사용자의 신원을 확인할 수 있습니다.",
                "Docker 컨테이너를 사용하여 애플리케이션을 패키징하고 배포할 수 있습니다.",
                "프로젝트 관리에서는 명확한 목표 설정이 중요합니다.",
                "시스템 문제 해결 시 로그 분석이 핵심입니다."
            ]
            
            results = {
                'provider': provider,
                'model': getattr(self.settings, f'{provider}_embedding_model', 'unknown'),
                'success': True,
                'error': None,
                'metrics': {}
            }
            
            # 1. 단일 텍스트 embedding 테스트
            print(f"  📝 단일 텍스트 embedding 테스트...")
            start_time = time.time()
            
            single_embedding = await adapter.aembed_query(test_texts[0])
            single_time = time.time() - start_time
            
            results['metrics']['single_embedding'] = {
                'dimension': len(single_embedding),
                'time_seconds': round(single_time, 3),
                'text_length': len(test_texts[0])
            }
            
            print(f"    ✅ 차원: {len(single_embedding)}, 시간: {single_time:.3f}초")
            
            # 2. 배치 embedding 테스트
            print(f"  📚 배치 embedding 테스트...")
            start_time = time.time()
            
            batch_embeddings = await adapter.aembed_documents(test_texts)
            batch_time = time.time() - start_time
            
            results['metrics']['batch_embedding'] = {
                'count': len(batch_embeddings),
                'dimension': len(batch_embeddings[0]) if batch_embeddings else 0,
                'time_seconds': round(batch_time, 3),
                'avg_time_per_doc': round(batch_time / len(test_texts), 3)
            }
            
            print(f"    ✅ 문서 수: {len(batch_embeddings)}, 차원: {len(batch_embeddings[0])}, 시간: {batch_time:.3f}초")
            
            # 3. 유사도 테스트
            print(f"  🔍 유사도 분석 테스트...")
            
            # 기술 관련 텍스트들과 비기술 텍스트의 유사도 비교
            tech_text1 = "마이크로서비스 아키텍처와 컨테이너 기술"
            tech_text2 = "Docker와 Kubernetes를 이용한 배포"
            non_tech_text = "프로젝트 관리와 팀 협업"
            
            embed1 = await adapter.aembed_query(tech_text1)
            embed2 = await adapter.aembed_query(tech_text2)
            embed3 = await adapter.aembed_query(non_tech_text)
            
            # 코사인 유사도 계산
            def cosine_similarity(a, b):
                import math
                dot_product = sum(x * y for x, y in zip(a, b))
                magnitude_a = math.sqrt(sum(x * x for x in a))
                magnitude_b = math.sqrt(sum(x * x for x in b))
                return dot_product / (magnitude_a * magnitude_b)
            
            tech_similarity = cosine_similarity(embed1, embed2)
            cross_similarity = cosine_similarity(embed1, embed3)
            
            results['metrics']['similarity_analysis'] = {
                'tech_to_tech': round(tech_similarity, 4),
                'tech_to_non_tech': round(cross_similarity, 4),
                'semantic_coherence': tech_similarity > cross_similarity
            }
            
            print(f"    ✅ 기술-기술 유사도: {tech_similarity:.4f}")
            print(f"    ✅ 기술-비기술 유사도: {cross_similarity:.4f}")
            print(f"    ✅ 의미적 일관성: {'통과' if tech_similarity > cross_similarity else '실패'}")
            
            # 4. 긴 문서 처리 테스트
            print(f"  📄 긴 문서 처리 테스트...")
            long_doc = "\n\n".join(test_texts * 10)  # 긴 문서 생성
            
            start_time = time.time()
            long_embedding = await adapter.aembed_query(long_doc)
            long_time = time.time() - start_time
            
            results['metrics']['long_document'] = {
                'text_length': len(long_doc),
                'dimension': len(long_embedding),
                'time_seconds': round(long_time, 3)
            }
            
            print(f"    ✅ 문서 길이: {len(long_doc):,} 문자, 시간: {long_time:.3f}초")
            
            return results
            
        except Exception as e:
            print(f"    ❌ 에러 발생: {str(e)}")
            return {
                'provider': provider,
                'success': False,
                'error': str(e),
                'metrics': {}
            }
    
    async def test_all_providers(self) -> Dict[str, Any]:
        """모든 사용 가능한 provider를 테스트합니다."""
        print(f"🚀 Embedding 시스템 종합 테스트 시작")
        print(f"=" * 60)
        
        # 사용 가능한 provider 확인
        available_providers = embedding_factory.get_available_providers()
        print(f"📋 사용 가능한 Provider: {', '.join(available_providers)}")
        
        all_results = {
            'test_timestamp': time.strftime('%Y-%m-%d %H:%M:%S'),
            'available_providers': available_providers,
            'provider_results': {},
            'comparison': {}
        }
        
        # 각 provider 테스트
        for provider in available_providers:
            try:
                result = await self.test_embedding_adapter(provider)
                all_results['provider_results'][provider] = result
            except Exception as e:
                print(f"❌ {provider} 테스트 실패: {e}")
                all_results['provider_results'][provider] = {
                    'success': False,
                    'error': str(e)
                }
        
        # 결과 비교 분석
        self.analyze_results(all_results)
        
        return all_results
    
    def analyze_results(self, results: Dict[str, Any]):
        """테스트 결과를 분석하고 비교합니다."""
        print(f"\n📊 테스트 결과 분석")
        print(f"=" * 60)
        
        successful_providers = []
        for provider, result in results['provider_results'].items():
            if result.get('success', False):
                successful_providers.append(provider)
        
        print(f"✅ 성공한 Provider: {', '.join(successful_providers)}")
        
        if not successful_providers:
            print("❌ 모든 Provider 테스트 실패")
            return
        
        # 성능 비교
        print(f"\n🏃 성능 비교:")
        print(f"{'Provider':<10} {'Model':<20} {'단일 시간':<10} {'배치 시간':<10} {'차원':<8}")
        print(f"-" * 70)
        
        for provider in successful_providers:
            result = results['provider_results'][provider]
            metrics = result.get('metrics', {})
            
            single_time = metrics.get('single_embedding', {}).get('time_seconds', 0)
            batch_time = metrics.get('batch_embedding', {}).get('time_seconds', 0)
            dimension = metrics.get('single_embedding', {}).get('dimension', 0)
            model = result.get('model', '')
            
            print(f"{provider:<10} {model:<20} {single_time:<10.3f} {batch_time:<10.3f} {dimension:<8}")
        
        # 유사도 분석 비교
        print(f"\n🔍 의미적 분석 결과:")
        print(f"{'Provider':<10} {'기술-기술':<12} {'기술-비기술':<12} {'일관성':<8}")
        print(f"-" * 50)
        
        for provider in successful_providers:
            result = results['provider_results'][provider]
            similarity = result.get('metrics', {}).get('similarity_analysis', {})
            
            tech_sim = similarity.get('tech_to_tech', 0)
            cross_sim = similarity.get('tech_to_non_tech', 0)
            coherence = similarity.get('semantic_coherence', False)
            
            print(f"{provider:<10} {tech_sim:<12.4f} {cross_sim:<12.4f} {'✅' if coherence else '❌':<8}")
    
    def save_results(self, results: Dict[str, Any], filename: str = "embedding_test_results.json"):
        """테스트 결과를 JSON 파일로 저장합니다."""
        import json
        
        output_path = Path(__file__).parent / filename
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(results, f, indent=2, ensure_ascii=False)
        
        print(f"\n💾 테스트 결과 저장됨: {output_path}")


async def main():
    """메인 테스트 실행 함수"""
    print("🧪 Figure Backend Embedding 시스템 테스트")
    print("=" * 60)
    
    tester = EmbeddingTester()
    
    # 테스트 문서 로드
    print("\n📚 테스트 문서 로드 중...")
    test_docs = tester.load_test_documents()
    print(f"📄 총 {len(test_docs)}개 문서 로드 완료")
    
    # embedding 테스트 실행
    try:
        results = await tester.test_all_providers()
        
        # 결과 저장
        tester.save_results(results)
        
        print(f"\n🎉 모든 테스트 완료!")
        return True
        
    except Exception as e:
        print(f"\n❌ 테스트 실행 중 오류 발생: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    success = asyncio.run(main())
    sys.exit(0 if success else 1) 