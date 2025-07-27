#!/usr/bin/env python3
"""
Claude LLM 테스트 스크립트
새로 추가된 Claude LLM 어댑터를 테스트합니다.
"""

import sys
import asyncio
import time
from pathlib import Path

# 백엔드 경로 추가
sys.path.append('/app')

from app.config import Settings
from app.infrastructure.adapters.llm.factory import llm_factory


async def test_claude_llm():
    """Claude LLM 어댑터 테스트"""
    print('🚀 Figure Backend Claude LLM 테스트')
    print('=' * 60)

    try:
        # 설정 로드 (Claude 프로바이더로 설정)
        settings = Settings()
        settings.llm_provider = "claude"
        
        print(f'📝 LLM Provider: {settings.llm_provider}')
        print(f'🤖 Claude Model: {settings.claude_model}')
        print(f'🔧 Max Tokens: {settings.claude_max_tokens}')
        print(f'🌡️  Temperature: {settings.claude_temperature}')

        # 사용 가능한 provider 확인
        available_providers = llm_factory.get_available_providers()
        print(f'📋 사용 가능한 providers: {available_providers}')

        if 'claude' not in available_providers:
            print('❌ Claude provider가 사용 불가능합니다.')
            print('   - anthropic 패키지가 설치되어 있는지 확인하세요.')
            return False

        # Claude 어댑터 생성
        try:
            adapter = llm_factory.create_adapter(settings)
            print(f'✅ 어댑터 생성 성공: {type(adapter).__name__}')
            print(f'🏷️  Provider: {adapter.provider_name}')
            print(f'📛 Model: {adapter.model_name}')
        except Exception as e:
            print(f'❌ 어댑터 생성 실패: {e}')
            return False

        print('\n' + '='*60)

        # 테스트 1: 기본 텍스트 생성
        print('🔍 테스트 1: 기본 텍스트 생성')
        print('-' * 40)

        test_prompt = "마이크로서비스 아키텍처의 주요 장점 3가지를 간단히 설명해주세요."
        print(f'질문: {test_prompt}')

        try:
            start_time = time.time()
            response = await adapter.generate_response(test_prompt)
            duration = time.time() - start_time

            print(f'✅ 응답 생성 완료!')
            print(f'⏱️  응답 시간: {duration:.3f}초')
            print(f'📝 응답 길이: {len(response)} 문자')
            print(f'📄 응답 내용:\n{response[:200]}{"..." if len(response) > 200 else ""}')

            test1_success = True

        except Exception as e:
            print(f'❌ 기본 텍스트 생성 실패: {e}')
            test1_success = False

        print('\n' + '='*60)

        # 테스트 2: 컨텍스트가 있는 응답 생성
        if test1_success:
            print('🔍 테스트 2: 컨텍스트 기반 응답')
            print('-' * 40)

            context = """
Figure Backend는 RAG(Retrieval-Augmented Generation) 기반의 질의응답 시스템입니다.
주요 기능:
- 문서 업로드 및 벡터화
- 의미 기반 검색
- LLM을 통한 답변 생성
- 멀티 프로바이더 지원 (Claude, Gemini, OpenAI)
"""
            question = "Figure Backend의 주요 특징은 무엇인가요?"

            print(f'컨텍스트: {context.strip()}')
            print(f'질문: {question}')

            try:
                start_time = time.time()
                response = await adapter.generate_response(question, context)
                duration = time.time() - start_time

                print(f'✅ 컨텍스트 기반 응답 완료!')
                print(f'⏱️  응답 시간: {duration:.3f}초')
                print(f'📝 응답 길이: {len(response)} 문자')
                print(f'📄 응답 내용:\n{response}')

                test2_success = True

            except Exception as e:
                print(f'❌ 컨텍스트 기반 응답 실패: {e}')
                test2_success = False
        else:
            test2_success = False
            print('⏭️ 이전 테스트 실패로 컨텍스트 테스트 건너뜀')

        print('\n' + '='*60)

        # 테스트 3: 문서 요약
        if test1_success:
            print('🔍 테스트 3: 문서 요약')
            print('-' * 40)

            long_text = """
            헥사고날 아키텍처(Hexagonal Architecture)는 소프트웨어 설계 패턴 중 하나로, 
            포트와 어댑터 패턴이라고도 불립니다. 이 아키텍처의 핵심 아이디어는 애플리케이션의 
            비즈니스 로직을 외부 세계로부터 격리하는 것입니다.

            헥사고날 아키텍처의 주요 구성 요소:
            1. Domain Layer: 핵심 비즈니스 로직과 규칙을 포함
            2. Application Layer: 유스케이스와 응용 서비스를 구현
            3. Infrastructure Layer: 외부 시스템과의 연결을 담당
            4. Ports: 도메인과 외부 세계 간의 인터페이스 정의
            5. Adapters: 포트를 구현하여 실제 외부 시스템과 연결

            이러한 구조를 통해 테스트 가능성, 유지보수성, 확장성을 크게 향상시킬 수 있습니다.
            """

            print(f'원본 텍스트: {len(long_text)} 문자')

            try:
                start_time = time.time()
                summary = await adapter.summarize(long_text, max_length=100)
                duration = time.time() - start_time

                print(f'✅ 문서 요약 완료!')
                print(f'⏱️  요약 시간: {duration:.3f}초')
                print(f'📝 요약 길이: {len(summary)} 문자')
                print(f'📄 요약 내용:\n{summary}')

                test3_success = True

            except Exception as e:
                print(f'❌ 문서 요약 실패: {e}')
                test3_success = False
        else:
            test3_success = False
            print('⏭️ 이전 테스트 실패로 요약 테스트 건너뜀')

        print('\n' + '='*60)

        # 테스트 4: 사용량 통계
        if test1_success:
            print('🔍 테스트 4: 사용량 통계')
            print('-' * 40)

            usage_stats = adapter.get_usage_stats()
            print(f'📊 총 요청 수: {usage_stats.get("total_requests", 0)}')
            print(f'🔢 총 토큰 수: {usage_stats.get("total_tokens", 0)}')
            print(f'💰 총 비용: ${usage_stats.get("total_cost", 0):.6f}')
            print(f'🕐 마지막 요청: {usage_stats.get("last_request", "없음")}')

            test4_success = True
        else:
            test4_success = False
            print('⏭️ 이전 테스트 실패로 통계 테스트 건너뜀')

        # 최종 결과 요약
        print('\n' + '🎉 Claude LLM 테스트 결과 요약')
        print('=' * 60)

        tests = [
            ('기본 텍스트 생성', test1_success),
            ('컨텍스트 기반 응답', test2_success),
            ('문서 요약', test3_success),
            ('사용량 통계', test4_success)
        ]

        success_count = sum(1 for _, success in tests if success)
        total_tests = len(tests)

        print(f'📊 성공한 테스트: {success_count}/{total_tests}')
        print(f'📈 성공률: {success_count/total_tests*100:.1f}%')

        for test_name, success in tests:
            status = '✅ 성공' if success else '❌ 실패'
            print(f'   {test_name}: {status}')

        overall_success = success_count >= 3  # 최소 3개 테스트 성공

        if overall_success:
            print('\n🎉 Claude LLM이 정상적으로 작동합니다!')
            print('💡 이제 Figure Backend에서 Claude를 사용할 수 있습니다.')
        else:
            print('\n❌ Claude LLM 테스트에서 문제가 발생했습니다.')
            print('🔧 API 키 설정이나 네트워크 연결을 확인해주세요.')

        return overall_success

    except Exception as e:
        print(f'\n❌ 테스트 실행 중 치명적 오류: {e}')
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    success = asyncio.run(test_claude_llm())
    print(f'\n📊 최종 결과: {"SUCCESS" if success else "FAILED"}')
    exit(0 if success else 1) 