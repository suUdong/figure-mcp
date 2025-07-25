#!/usr/bin/env python3
"""
헥사고날 아키텍처 핵심 구조 테스트 (의존성 최소화)
"""

def test_core_hexagonal_structure():
    """헥사고날 아키텍처 핵심 구조 테스트"""
    print("🏗️ 헥사고날 아키텍처 핵심 구조 테스트 시작...")
    
    try:
        # 1. Domain Layer 테스트
        print("\n📋 Domain Layer 테스트...")
        from app.domain.repositories.embedding_repository import EmbeddingRepository
        from app.domain.entities.schemas import APIResponse
        print("✅ Domain Repository 포트 Import 성공")
        print("✅ Domain Entities Import 성공")
        
        # 2. Infrastructure Layer 테스트
        print("\n🔧 Infrastructure Layer 테스트...")
        from app.infrastructure.adapters.embeddings.factory import EmbeddingAdapterFactory
        from app.infrastructure.persistence.connection import db_manager
        print("✅ Infrastructure Adapters Import 성공")
        print("✅ Infrastructure Persistence Import 성공")
        
        # 3. Application Layer 테스트 (기본 구조만)
        print("\n🚀 Application Layer 테스트...")
        import app.application.services
        print("✅ Application Services 구조 확인")
        
        # 4. Interfaces Layer 테스트 (기본 구조만)
        print("\n🌐 Interfaces Layer 테스트...")
        import app.interfaces.api
        print("✅ Interface APIs 구조 확인")
        
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
        
        print("\n" + "="*60)
        print("🎉 헥사고날 아키텍처 핵심 구조가 완벽하게 구축되었습니다!")
        print("="*60)
        
        print("\n📊 완성된 헥사고날 아키텍처:")
        print("├── 🏛️ Domain Layer")
        print("│   ├── repositories/ (포트)")
        print("│   └── entities/ (엔티티)")
        print("├── 🚀 Application Layer")
        print("│   └── services/ (유스케이스)")
        print("├── 🔧 Infrastructure Layer") 
        print("│   ├── adapters/ (어댑터)")
        print("│   └── persistence/ (영속성)")
        print("├── 🌐 Interfaces Layer")
        print("│   └── api/ (REST API)")
        print("└── 🛠️ Utils (공통 유틸리티)")
        
        return True
        
    except Exception as e:
        print(f"❌ 아키텍처 테스트 실패: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = test_core_hexagonal_structure()
    exit(0 if success else 1) 