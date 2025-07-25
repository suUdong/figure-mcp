#!/usr/bin/env python3
"""
헥사고날 아키텍처 구조 테스트
의존성 없이 import만 테스트
"""

def test_hexagonal_architecture():
    """헥사고날 아키텍처 구조 테스트"""
    print("🏗️ 헥사고날 아키텍처 구조 테스트 시작...")
    
    try:
        # 1. Domain Layer 테스트
        print("📋 Domain Layer 테스트...")
        from app.domain.repositories.embedding_repository import EmbeddingRepository
        print("✅ Domain Repository 포트 Import 성공")
        
        # 2. Infrastructure Layer 테스트
        print("🔧 Infrastructure Layer 테스트...")
        from app.infrastructure.adapters.embeddings.factory import EmbeddingAdapterFactory
        print("✅ Infrastructure Factory Import 성공")
        
        # 3. 설정 테스트
        print("⚙️  설정 테스트...")
        from app.config import get_settings
        settings = get_settings()
        print(f"✅ 설정 로드 성공: {settings.embedding_provider} 프로바이더")
        
        # 4. Application Layer 테스트  
        print("🚀 Application Layer 테스트...")
        import app.application
        print("✅ Application Layer 구조 확인")
        
        # 5. 팩토리 인스턴스 테스트
        print("🏭 팩토리 인스턴스 테스트...")
        factory = EmbeddingAdapterFactory()
        available_providers = factory.get_available_providers()
        print(f"✅ 사용 가능한 프로바이더: {available_providers}")
        
        print("\n🎉 헥사고날 아키텍처 구조가 완벽하게 구성되었습니다!")
        return True
        
    except Exception as e:
        print(f"❌ 아키텍처 테스트 실패: {e}")
        return False

if __name__ == "__main__":
    success = test_hexagonal_architecture()
    exit(0 if success else 1) 