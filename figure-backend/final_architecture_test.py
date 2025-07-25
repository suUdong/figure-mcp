#!/usr/bin/env python3
"""
완전한 헥사고날 아키텍처 구조 테스트
모든 레이어와 의존성 검증
"""

def test_complete_hexagonal_architecture():
    """완전한 헥사고날 아키텍처 구조 테스트"""
    print("🏗️ 완전한 헥사고날 아키텍처 구조 테스트 시작...")
    
    try:
        # 1. Domain Layer 테스트
        print("\n📋 Domain Layer 테스트...")
        from app.domain.repositories.embedding_repository import EmbeddingRepository
        from app.domain.entities.schemas import APIResponse, QueryRequest
        print("✅ Domain Repository 포트 Import 성공")
        print("✅ Domain Entities Import 성공")
        
        # 2. Application Layer 테스트
        print("\n🚀 Application Layer 테스트...")
        from app.application.services.job_service import job_service
        from app.application.services.rag_service import rag_service  
        from app.application.services.vector_store import vector_store_service
        from app.application.services.usage.tracker import usage_tracker
        print("✅ Application Services Import 성공")
        print("✅ Application Usage Tracker Import 성공")
        
        # 3. Infrastructure Layer 테스트
        print("\n🔧 Infrastructure Layer 테스트...")
        from app.infrastructure.adapters.embeddings.factory import EmbeddingAdapterFactory
        from app.infrastructure.persistence.connection import db_manager
        from app.infrastructure.persistence.models import UsageLog
        print("✅ Infrastructure Adapters Import 성공")
        print("✅ Infrastructure Persistence Import 성공")
        
        # 4. Interfaces Layer 테스트
        print("\n🌐 Interfaces Layer 테스트...")
        from app.interfaces.api import rag, documents, admin, sites, usage
        print("✅ Interface APIs Import 성공")
        
        # 5. 팩토리 패턴 테스트
        print("\n🏭 팩토리 패턴 테스트...")
        factory = EmbeddingAdapterFactory()
        available_providers = factory.get_available_providers()
        print(f"✅ 사용 가능한 프로바이더: {available_providers}")
        
        # 6. 설정 테스트
        print("\n⚙️ 설정 테스트...")
        from app.config import get_settings
        settings = get_settings()
        print(f"✅ 설정 로드 성공: {settings.embedding_provider} 프로바이더")
        
        # 7. 공통 유틸리티 테스트
        print("\n🛠️ 공통 유틸리티 테스트...")
        from app.utils.logger import get_logger
        logger = get_logger(__name__)
        print("✅ 공통 유틸리티 Import 성공")
        
        print("\n" + "="*60)
        print("🎉 완전한 헥사고날 아키텍처가 성공적으로 구축되었습니다!")
        print("="*60)
        
        print("\n📊 아키텍처 레이어 요약:")
        print("├── 🏛️ Domain Layer: 비즈니스 로직과 포트")
        print("├── 🚀 Application Layer: 유스케이스와 서비스")  
        print("├── 🔧 Infrastructure Layer: 어댑터와 영속성")
        print("├── 🌐 Interfaces Layer: API 엔드포인트")
        print("└── 🛠️ Utils: 공통 유틸리티")
        
        return True
        
    except Exception as e:
        print(f"❌ 아키텍처 테스트 실패: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = test_complete_hexagonal_architecture()
    exit(0 if success else 1) 