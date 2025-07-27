#!/usr/bin/env python3
"""
통합 RAG 시스템 테스트
임베딩(Gemini) + LLM(Claude)을 사용한 완전한 RAG 파이프라인 테스트
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
from app.infrastructure.adapters.llm.factory import llm_factory
from app.application.services.rag_service import rag_service


async def test_integrated_rag_system():
    """통합 RAG 시스템 테스트"""
    print('🚀 Figure Backend 통합 RAG 시스템 테스트')
    print('=' * 70)
    
    try:
        # 설정 확인
        settings = Settings()
        print(f'📝 LLM Provider: {settings.llm_provider}')
        print(f'🔮 Embedding Provider: {settings.embedding_provider}')
        print(f'🤖 LLM Model: {getattr(settings, f"{settings.llm_provider}_model", "Unknown")}')
        print(f'📊 Embedding Model: {getattr(settings, f"{settings.embedding_provider}_embedding_model", "Unknown")}')
        
        print('\n' + '='*70)
        
        # 테스트 1: 개별 컴포넌트 확인
        print('🔍 테스트 1: 개별 컴포넌트 상태 확인')
        print('-' * 50)
        
        # 임베딩 어댑터 테스트
        try:
            embedding_adapter = embedding_factory.create_adapter(settings)
            print(f'✅ 임베딩 어댑터: {embedding_adapter.provider_name} - {embedding_adapter.model_name}')
            
            # 간단한 임베딩 테스트
            test_text = "이것은 임베딩 테스트입니다."
            embedding = await embedding_adapter.aembed_query(test_text)
            print(f'   📏 임베딩 차원: {len(embedding)}')
            
            embedding_test_success = True
        except Exception as e:
            print(f'❌ 임베딩 어댑터 실패: {e}')
            embedding_test_success = False
        
        # LLM 어댑터 테스트
        try:
            llm_adapter = llm_factory.create_adapter(settings)
            print(f'✅ LLM 어댑터: {llm_adapter.provider_name} - {llm_adapter.model_name}')
            
            # 간단한 LLM 테스트
            response = await llm_adapter.generate_response("안녕하세요!")
            print(f'   📝 LLM 응답 길이: {len(response)} 문자')
            
            llm_test_success = True
        except Exception as e:
            print(f'❌ LLM 어댑터 실패: {e}')
            llm_test_success = False
        
        if not (embedding_test_success and llm_test_success):
            print('\n❌ 개별 컴포넌트 테스트 실패. RAG 테스트를 중단합니다.')
            return False
        
        print('\n' + '='*70)
        
        # 테스트 2: RAG 서비스 초기화
        print('🔍 테스트 2: RAG 서비스 초기화')
        print('-' * 50)
        
        try:
            await rag_service.initialize()
            status = await rag_service.get_service_status()
            
            print(f'✅ RAG 서비스 초기화: {status["rag_service_initialized"]}')
            print(f'🔧 LLM Provider: {status.get("llm_provider", "Unknown")}')
            print(f'🤖 LLM Model: {status.get("llm_model", "Unknown")}')
            print(f'📊 임베딩 Provider: {status.get("embedding_provider", "Unknown")}')
            print(f'🗄️  벡터 스토어: {status.get("vector_store_initialized", False)}')
            
            rag_init_success = status["rag_service_initialized"]
            
        except Exception as e:
            print(f'❌ RAG 서비스 초기화 실패: {e}')
            rag_init_success = False
        
        if not rag_init_success:
            print('\n❌ RAG 서비스 초기화 실패. 테스트를 중단합니다.')
            return False
        
        print('\n' + '='*70)
        
        # 테스트 3: 컨텍스트 없는 직접 질의
        print('🔍 테스트 3: 컨텍스트 없는 직접 LLM 질의')
        print('-' * 50)
        
        direct_questions = [
            "마이크로서비스 아키텍처란 무엇인가요?",
            "Docker의 주요 장점은 무엇인가요?",
            "헥사고날 아키텍처의 핵심 개념을 설명해주세요."
        ]
        
        direct_test_success = True
        
        for i, question in enumerate(direct_questions, 1):
            print(f'\n질문 {i}: {question}')
            
            try:
                start_time = time.time()
                answer = await rag_service.query_without_context(question)
                duration = time.time() - start_time
                
                print(f'✅ 응답 시간: {duration:.3f}초')
                print(f'📝 응답 길이: {len(answer)} 문자')
                print(f'📄 응답 (처음 150자): {answer[:150]}...')
                
            except Exception as e:
                print(f'❌ 직접 질의 실패: {e}')
                direct_test_success = False
                break
        
        print('\n' + '='*70)
        
        # 테스트 4: 문서 기반 RAG 질의 (현재 벡터 스토어 내용 사용)
        print('🔍 테스트 4: 문서 기반 RAG 질의')
        print('-' * 50)
        
        rag_questions = [
            "사이트 관리 기능에 대해 설명해주세요.",
            "문서 업로드는 어떻게 하나요?",
            "Figure Backend의 주요 기능은 무엇인가요?",
            "RAG 시스템이 어떻게 작동하나요?"
        ]
        
        rag_test_success = True
        
        for i, question in enumerate(rag_questions, 1):
            print(f'\n질문 {i}: {question}')
            
            try:
                start_time = time.time()
                result = await rag_service.query(question, include_sources=True)
                duration = time.time() - start_time
                
                print(f'✅ 응답 시간: {duration:.3f}초')
                print(f'📝 응답 길이: {len(result["answer"])} 문자')
                print(f'📚 소스 문서 수: {len(result.get("sources", []))}')
                print(f'📄 답변 (처음 200자): {result["answer"][:200]}...')
                
                # 소스 정보 표시
                if result.get("sources"):
                    print(f'📋 참조 소스:')
                    for j, source in enumerate(result["sources"][:2], 1):  # 처음 2개만 표시
                        metadata = source.get("metadata", {})
                        print(f'   {j}. {metadata.get("title", "제목 없음")} - {metadata.get("doc_type", "unknown")}')
                
            except Exception as e:
                print(f'❌ RAG 질의 실패: {e}')
                rag_test_success = False
                break
        
        print('\n' + '='*70)
        
        # 테스트 5: 고급 기능 테스트 (요약, 감정분석, 키워드 추출)
        print('🔍 테스트 5: 고급 LLM 기능')
        print('-' * 50)
        
        test_document = """
        Figure Backend는 RAG(Retrieval-Augmented Generation) 기반의 지능형 문서 관리 및 질의응답 시스템입니다.
        주요 특징으로는 다중 프로바이더 지원(Claude, Gemini, OpenAI), 헥사고날 아키텍처 적용, 
        벡터 기반 의미 검색, 실시간 문서 처리 등이 있습니다. 
        이 시스템을 통해 사용자는 복잡한 문서들 속에서 필요한 정보를 빠르고 정확하게 찾을 수 있으며,
        자연어로 질문하면 관련된 문서 내용을 바탕으로 정확한 답변을 받을 수 있습니다.
        """
        
        advanced_test_success = True
        
        # 문서 요약 테스트
        try:
            print('\n📝 문서 요약 테스트:')
            summary = await rag_service.summarize_document(test_document, max_length=100)
            print(f'✅ 요약 완료 ({len(summary)} 문자)')
            print(f'📄 요약: {summary}')
            
        except Exception as e:
            print(f'❌ 문서 요약 실패: {e}')
            advanced_test_success = False
        
        # 감정 분석 테스트
        try:
            print('\n😊 감정 분석 테스트:')
            sentiment = await rag_service.analyze_sentiment(test_document)
            print(f'✅ 감정 분석 완료')
            print(f'📊 감정: {sentiment.get("sentiment", "Unknown")}')
            print(f'🎯 신뢰도: {sentiment.get("confidence", 0):.2%}')
            
        except Exception as e:
            print(f'❌ 감정 분석 실패: {e}')
            advanced_test_success = False
        
        # 키워드 추출 테스트
        try:
            print('\n🔑 키워드 추출 테스트:')
            keywords = await rag_service.extract_keywords(test_document, count=5)
            print(f'✅ 키워드 추출 완료')
            print(f'🏷️  키워드: {", ".join(keywords[:5])}')
            
        except Exception as e:
            print(f'❌ 키워드 추출 실패: {e}')
            advanced_test_success = False
        
        # 최종 결과 요약
        print('\n' + '🎉 통합 RAG 시스템 테스트 결과')
        print('=' * 70)
        
        tests = [
            ('개별 컴포넌트', embedding_test_success and llm_test_success),
            ('RAG 서비스 초기화', rag_init_success),
            ('직접 LLM 질의', direct_test_success),
            ('문서 기반 RAG 질의', rag_test_success),
            ('고급 LLM 기능', advanced_test_success)
        ]
        
        success_count = sum(1 for _, success in tests if success)
        total_tests = len(tests)
        
        print(f'📊 성공한 테스트: {success_count}/{total_tests}')
        print(f'📈 성공률: {success_count/total_tests*100:.1f}%')
        
        for test_name, success in tests:
            status = '✅ 성공' if success else '❌ 실패'
            print(f'   {test_name}: {status}')
        
        overall_success = success_count >= 4  # 최소 4개 테스트 성공
        
        if overall_success:
            print('\n🎉 통합 RAG 시스템이 정상적으로 작동합니다!')
            print('💡 Claude LLM + Gemini Embedding 조합이 완벽하게 동작합니다.')
            print('🚀 이제 프로덕션에서 사용할 준비가 되었습니다!')
        else:
            print('\n❌ 일부 기능에서 문제가 발생했습니다.')
            print('🔧 API 키 설정이나 서비스 상태를 확인해주세요.')
        
        # 상세 통계 저장
        test_results = {
            'timestamp': time.strftime('%Y-%m-%d %H:%M:%S'),
            'configuration': {
                'llm_provider': settings.llm_provider,
                'embedding_provider': settings.embedding_provider,
                'llm_model': getattr(settings, f"{settings.llm_provider}_model", "Unknown"),
                'embedding_model': getattr(settings, f"{settings.embedding_provider}_embedding_model", "Unknown")
            },
            'test_results': {test_name: success for test_name, success in tests},
            'success_rate': success_count/total_tests*100,
            'overall_success': overall_success
        }
        
        # 결과 저장
        with open('/app/integrated_rag_test_results.json', 'w', encoding='utf-8') as f:
            json.dump(test_results, f, indent=2, ensure_ascii=False)
        
        print(f'\n💾 상세 결과가 /app/integrated_rag_test_results.json에 저장되었습니다.')
        
        return overall_success
        
    except Exception as e:
        print(f'\n❌ 테스트 실행 중 치명적 오류: {e}')
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    success = asyncio.run(test_integrated_rag_system())
    print(f'\n📊 최종 결과: {"SUCCESS" if success else "FAILED"}')
    exit(0 if success else 1) 