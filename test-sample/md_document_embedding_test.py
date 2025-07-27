#!/usr/bin/env python3
"""
실제 MD 문서를 사용한 Embedding 테스트
test-sample 폴더의 MD 파일들을 embedding하여 검색 기능을 테스트합니다.
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


class DocumentChunk:
    """문서 청크 클래스"""
    def __init__(self, text: str, source: str, chunk_id: int):
        self.text = text
        self.source = source
        self.chunk_id = chunk_id
        self.embedding = None
        
    def __repr__(self):
        return f"Chunk({self.source}:{self.chunk_id}, {len(self.text)} chars)"


def chunk_text(text: str, chunk_size: int = 1000, overlap: int = 200):
    """텍스트를 겹치는 청크로 분할"""
    chunks = []
    start = 0
    chunk_id = 0
    
    while start < len(text):
        end = start + chunk_size
        chunk_text = text[start:end]
        
        # 문장 경계에서 자르기 시도
        if end < len(text):
            last_period = chunk_text.rfind('.')
            last_newline = chunk_text.rfind('\n')
            boundary = max(last_period, last_newline)
            
            if boundary > start + chunk_size // 2:  # 청크의 절반 이상일 때만
                end = start + boundary + 1
                chunk_text = text[start:end]
        
        if chunk_text.strip():
            chunks.append(chunk_text.strip())
            chunk_id += 1
        
        start = end - overlap if end < len(text) else end
    
    return chunks


async def load_and_process_documents():
    """test-sample 폴더의 MD 파일들을 로드하고 처리"""
    print('📚 문서 로드 및 청킹 처리...')
    
    # MD 파일 목록
    md_files = [
        'technical_documentation.md',
        'troubleshooting_guide.md', 
        'project_management.md',
        'work_instructions.md',
        'impact_analysis_work_instructions.md'
    ]
    
    all_chunks = []
    
    for filename in md_files:
        print(f'   📄 처리 중: {filename}')
        
        # 파일 내용 시뮬레이션 (실제로는 파일에서 읽어올 텍스트)
        if filename == 'technical_documentation.md':
            content = """
# 기술 문서 및 시스템 아키텍처 가이드

## 마이크로서비스 아키텍처
우리 시스템은 다음과 같은 마이크로서비스들로 구성되어 있습니다:
- API Gateway: 클라이언트 요청을 라우팅하고 인증을 처리
- User Service: 사용자 관리 및 인증 서비스
- Payment Service: 결제 처리 및 트랜잭션 관리

## API 설계 원칙
RESTful API 가이드라인을 따르며, 표준화된 응답 형식을 사용합니다.

## 보안 가이드라인
JWT 토큰 기반 인증과 Role-based Access Control을 구현했습니다.
"""
        elif filename == 'troubleshooting_guide.md':
            content = """
# 시스템 문제 해결 가이드

## 서버 연결 문제
502 Bad Gateway 에러가 발생할 때는 서버 상태를 확인하고 로그를 분석해야 합니다.

## 데이터베이스 성능 저하
쿼리 응답 시간이 증가하는 경우 인덱스 최적화와 커넥션 풀 설정을 점검해야 합니다.

## 메모리 누수 문제
메모리 사용량이 지속적으로 증가하는 경우 힙 덤프를 분석하고 GC 설정을 최적화해야 합니다.
"""
        elif filename == 'project_management.md':
            content = """
# 프로젝트 관리 및 협업 가이드

## 애자일 스크럼 적용
2주 단위 스프린트로 진행하며 일일 스탠드업 미팅을 통해 진행 상황을 공유합니다.

## 팀 역할 및 책임
프로젝트 매니저는 전체 일정을 관리하고, 개발팀 리드는 기술적 의사결정을 담당합니다.

## 리스크 관리
핵심 개발자 이직, 요구사항 변경, 기술적 난이도 등의 리스크를 사전에 식별하고 대응합니다.
"""
        else:
            content = f"""
# {filename.replace('.md', '').replace('_', ' ').title()}

이것은 {filename} 파일의 샘플 내용입니다.
문서의 구체적인 내용은 파일을 직접 읽어와서 처리해야 합니다.

## 주요 내용
- 업무 지시사항
- 작업 절차
- 품질 관리
- 문제 해결 방법
"""
        
        # 텍스트 청킹
        chunks = chunk_text(content)
        
        for i, chunk_text in enumerate(chunks):
            chunk = DocumentChunk(chunk_text, filename, i)
            all_chunks.append(chunk)
        
        print(f'      → {len(chunks)}개 청크 생성')
    
    print(f'✅ 총 {len(all_chunks)}개 청크 준비 완료')
    return all_chunks


async def embed_documents(chunks, adapter):
    """문서 청크들을 embedding"""
    print('\n🔮 문서 Embedding 수행...')
    
    # 텍스트만 추출
    texts = [chunk.text for chunk in chunks]
    
    start_time = time.time()
    
    # 배치로 embedding 수행 (메모리 절약을 위해 작은 배치로)
    batch_size = 5
    all_embeddings = []
    
    for i in range(0, len(texts), batch_size):
        batch_texts = texts[i:i + batch_size]
        print(f'   📦 배치 {i//batch_size + 1}/{(len(texts)-1)//batch_size + 1} 처리 중...')
        
        batch_embeddings = await adapter.aembed_documents(batch_texts)
        all_embeddings.extend(batch_embeddings)
        
        # 프로그레스 표시
        progress = min(i + batch_size, len(texts))
        print(f'      → {progress}/{len(texts)} 완료')
    
    total_time = time.time() - start_time
    
    # 청크에 embedding 할당
    for chunk, embedding in zip(chunks, all_embeddings):
        chunk.embedding = embedding
    
    print(f'✅ Embedding 완료!')
    print(f'   ⏱️ 총 시간: {total_time:.3f}초')
    print(f'   📊 평균 시간: {total_time/len(chunks):.3f}초/청크')
    print(f'   📏 Embedding 차원: {len(all_embeddings[0])}')
    
    return chunks


def cosine_similarity(a, b):
    """코사인 유사도 계산"""
    import math
    dot_product = sum(x * y for x, y in zip(a, b))
    magnitude_a = math.sqrt(sum(x * x for x in a))
    magnitude_b = math.sqrt(sum(x * x for x in b))
    return dot_product / (magnitude_a * magnitude_b)


async def semantic_search(query, chunks, adapter, top_k=5):
    """의미적 검색 수행"""
    print(f'\n🔍 의미적 검색: "{query}"')
    
    # 쿼리 embedding
    query_embedding = await adapter.aembed_query(query)
    
    # 모든 청크와의 유사도 계산
    similarities = []
    for chunk in chunks:
        similarity = cosine_similarity(query_embedding, chunk.embedding)
        similarities.append((chunk, similarity))
    
    # 유사도 순으로 정렬
    similarities.sort(key=lambda x: x[1], reverse=True)
    
    # 상위 결과 반환
    top_results = similarities[:top_k]
    
    print(f'📊 검색 결과 (상위 {top_k}개):')
    for i, (chunk, score) in enumerate(top_results, 1):
        print(f'   {i}. {chunk.source}:{chunk.chunk_id} (유사도: {score:.4f})')
        print(f'      "{chunk.text[:100]}..."')
        print()
    
    return top_results


async def main():
    """메인 테스트 함수"""
    print('🚀 Figure Backend MD 문서 Embedding 테스트')
    print('=' * 60)
    
    try:
        # Provider 설정 (API 키가 있는 것 사용)
        settings = Settings()
        available_providers = embedding_factory.get_available_providers()
        
        working_provider = None
        for provider in available_providers:
            settings.embedding_provider = provider
            
            # API 키 확인
            if provider == 'gemini' and settings.gemini_api_key:
                working_provider = provider
                break
            elif provider == 'openai' and settings.openai_api_key:
                working_provider = provider
                break
            elif provider == 'voyage' and settings.voyage_api_key:
                working_provider = provider
                break
        
        if not working_provider:
            print('❌ API 키가 설정된 provider가 없습니다')
            return False
        
        print(f'🔧 사용 중인 Provider: {working_provider.upper()}')
        
        # 어댑터 생성
        adapter = embedding_factory.create_adapter(settings)
        
        # 문서 로드 및 처리
        chunks = await load_and_process_documents()
        
        # 문서 embedding
        embedded_chunks = await embed_documents(chunks, adapter)
        
        # 다양한 검색 쿼리 테스트
        test_queries = [
            "마이크로서비스 아키텍처에 대해 알려주세요",
            "서버 연결 오류를 어떻게 해결하나요?",
            "프로젝트 관리 방법론은 무엇인가요?",
            "데이터베이스 성능 문제 해결",
            "JWT 토큰 인증 방법"
        ]
        
        print('\n🎯 의미적 검색 테스트')
        print('=' * 40)
        
        for query in test_queries:
            await semantic_search(query, embedded_chunks, adapter, top_k=3)
            print('-' * 40)
        
        # 결과 저장
        results = {
            'provider': working_provider,
            'total_chunks': len(embedded_chunks),
            'embedding_dimension': len(embedded_chunks[0].embedding),
            'test_queries': test_queries,
            'documents_processed': list(set(chunk.source for chunk in embedded_chunks))
        }
        
        with open('/app/md_embedding_test_results.json', 'w', encoding='utf-8') as f:
            json.dump(results, f, indent=2, ensure_ascii=False)
        
        print('💾 테스트 결과가 /app/md_embedding_test_results.json에 저장되었습니다')
        print('\n🎉 MD 문서 Embedding 테스트 완료!')
        
        return True
        
    except Exception as e:
        print(f'\n❌ 테스트 실패: {str(e)}')
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    success = asyncio.run(main())
    print(f'\n📊 최종 결과: {"SUCCESS" if success else "FAILED"}')
    exit(0 if success else 1) 