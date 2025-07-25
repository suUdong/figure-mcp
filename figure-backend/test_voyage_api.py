#!/usr/bin/env python3
"""
헥사고날 아키텍처 임베딩 어댑터 테스트 스크립트
"""
import os
import sys
from pathlib import Path

# 프로젝트 루트 경로를 Python path에 추가
sys.path.append(str(Path(__file__).parent))

from app.config import get_settings
from app.infrastructure.adapters.embeddings.factory import embedding_factory

async def test_embedding_adapters():
    """임베딩 어댑터 테스트"""
    try:
        print("🔧 헥사고날 아키텍처 임베딩 어댑터 테스트 시작...")
        
        # 설정 로드
        settings = get_settings()
        print(f"📝 임베딩 프로바이더: {settings.embedding_provider}")
        
        # 사용 가능한 프로바이더 확인
        available_providers = embedding_factory.get_available_providers()
        print(f"🔧 사용 가능한 프로바이더: {available_providers}")
        
        # 어댑터 생성
        try:
            adapter = embedding_factory.create_adapter(settings)
            print(f"✅ 어댑터 생성 성공: {adapter.provider_name} - {adapter.model_name}")
        except Exception as e:
            print(f"❌ 어댑터 생성 실패: {e}")
            return False
        
        # 테스트 쿼리
        test_query = "Python FastAPI 개발 가이드"
        print(f"🔍 테스트 쿼리: {test_query}")
        
        # 쿼리 임베딩 테스트
        try:
            result = adapter.embed_query(test_query)
            print(f"✅ 쿼리 임베딩 성공! 차원: {len(result)}")
            print(f"📊 첫 5개 값: {result[:5]}")
        except Exception as e:
            print(f"❌ 쿼리 임베딩 실패: {e}")
            return False
        
        # 문서 임베딩 테스트
        test_docs = [
            "FastAPI는 Python 웹 프레임워크입니다.",
            "ChromaDB는 벡터 데이터베이스입니다."
        ]
        try:
            doc_embeddings = adapter.embed_documents(test_docs)
            print(f"✅ 문서 임베딩 성공! 문서 수: {len(doc_embeddings)}")
            print(f"📊 각 문서의 임베딩 차원: {[len(emb) for emb in doc_embeddings]}")
        except Exception as e:
            print(f"❌ 문서 임베딩 실패: {e}")
            return False
        
        print("🎉 모든 테스트 통과!")
        return True
        
    except Exception as e:
        print(f"❌ 테스트 실패: {e}")
        return False

if __name__ == "__main__":
    import asyncio
    success = asyncio.run(test_embedding_adapters())
    sys.exit(0 if success else 1) 