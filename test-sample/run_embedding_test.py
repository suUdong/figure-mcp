#!/usr/bin/env python3
"""
Embedding 테스트 실행 스크립트
Docker 환경에서 embedding 테스트를 실행합니다.
"""

import asyncio
import subprocess
import sys
import time
from pathlib import Path


class EmbeddingTestRunner:
    """Embedding 테스트 실행기"""
    
    def __init__(self):
        self.project_root = Path(__file__).parent.parent
        self.backend_path = self.project_root / "figure-backend"
        
    def check_docker_services(self):
        """Docker 서비스 상태 확인"""
        print("🐳 Docker 서비스 상태 확인...")
        
        try:
            # Docker 컨테이너 상태 확인
            result = subprocess.run(
                ["docker", "ps", "--format", "table {{.Names}}\t{{.Status}}"],
                capture_output=True,
                text=True,
                cwd=self.project_root
            )
            
            if result.returncode == 0:
                print("Docker 컨테이너 상태:")
                print(result.stdout)
                
                # figure-backend 컨테이너가 실행 중인지 확인
                if "figure-mcp-figure-backend-1" in result.stdout and "healthy" in result.stdout:
                    print("✅ Figure Backend 컨테이너 정상 실행 중")
                    return True
                else:
                    print("❌ Figure Backend 컨테이너가 정상 실행되지 않음")
                    return False
            else:
                print(f"❌ Docker 명령 실행 실패: {result.stderr}")
                return False
                
        except FileNotFoundError:
            print("❌ Docker가 설치되지 않았거나 PATH에 없습니다")
            return False
        except Exception as e:
            print(f"❌ Docker 상태 확인 중 오류: {e}")
            return False
    
    def run_test_in_container(self):
        """Docker 컨테이너 내에서 테스트 실행"""
        print("\n🧪 Docker 컨테이너에서 embedding 테스트 실행...")
        
        # 컨테이너 내에서 테스트 실행
        docker_cmd = [
            "docker", "exec", "-it",
            "figure-mcp-figure-backend-1",
            "python", "-c", """
import sys
sys.path.append('/app')

import asyncio
from app.config import Settings
from app.infrastructure.adapters.embeddings.factory import embedding_factory

async def quick_test():
    print('🔍 Quick Embedding Test in Container')
    print('=' * 50)
    
    settings = Settings()
    print(f'Current embedding provider: {settings.embedding_provider}')
    
    try:
        available_providers = embedding_factory.get_available_providers()
        print(f'Available providers: {available_providers}')
        
        adapter = embedding_factory.create_adapter(settings)
        print(f'Adapter created successfully: {type(adapter).__name__}')
        
        # 간단한 embedding 테스트
        test_text = '이것은 embedding 테스트 문장입니다.'
        embedding = await adapter.aembed_query(test_text)
        
        print(f'✅ Embedding successful!')
        print(f'   Text: {test_text}')
        print(f'   Embedding dimension: {len(embedding)}')
        print(f'   First 5 values: {embedding[:5]}')
        
        return True
        
    except Exception as e:
        print(f'❌ Test failed: {e}')
        import traceback
        traceback.print_exc()
        return False

success = asyncio.run(quick_test())
print(f'Test result: {"SUCCESS" if success else "FAILED"}')
"""
        ]
        
        try:
            result = subprocess.run(
                docker_cmd,
                cwd=self.project_root,
                timeout=120  # 2분 타임아웃
            )
            
            return result.returncode == 0
            
        except subprocess.TimeoutExpired:
            print("❌ 테스트 실행 시간 초과 (2분)")
            return False
        except Exception as e:
            print(f"❌ 컨테이너 테스트 실행 중 오류: {e}")
            return False
    
    def run_local_test(self):
        """로컬에서 embedding 테스트 실행"""  
        print("\n🏠 로컬 환경에서 embedding 테스트 실행...")
        
        test_script = Path(__file__).parent / "embedding_test.py"
        
        try:
            result = subprocess.run(
                [sys.executable, str(test_script)],
                cwd=str(test_script.parent),
                timeout=300  # 5분 타임아웃
            )
            
            return result.returncode == 0
            
        except subprocess.TimeoutExpired:
            print("❌ 로컬 테스트 실행 시간 초과 (5분)")
            return False
        except Exception as e:
            print(f"❌ 로컬 테스트 실행 중 오류: {e}")
            return False
    
    def check_api_endpoint(self):
        """백엔드 API 엔드포인트 확인"""
        print("\n🌐 백엔드 API 상태 확인...")
        
        try:
            import requests
            
            # 헬스체크 엔드포인트 확인
            response = requests.get("http://localhost:8001/health", timeout=10)
            
            if response.status_code == 200:
                print("✅ 백엔드 API 정상 응답")
                return True
            else:
                print(f"❌ 백엔드 API 비정상 응답: {response.status_code}")
                return False
                
        except requests.exceptions.ConnectionError:
            print("❌ 백엔드 API 연결 실패")
            return False
        except Exception as e:
            print(f"❌ API 확인 중 오류: {e}")
            return False
    
    def run_comprehensive_test(self):
        """종합 테스트 실행"""
        print("🚀 Figure Backend Embedding 종합 테스트 시작")
        print("=" * 60)
        
        success_count = 0
        total_tests = 4
        
        # 1. Docker 서비스 확인
        if self.check_docker_services():
            success_count += 1
        
        # 2. API 엔드포인트 확인
        if self.check_api_endpoint():
            success_count += 1
        
        # 3. 컨테이너 내 테스트
        if self.run_test_in_container():
            success_count += 1
        
        # 4. 로컬 테스트 (optional)
        print("\n📝 로컬 테스트는 선택사항입니다...")
        try:
            if self.run_local_test():
                success_count += 1
        except Exception as e:
            print(f"⚠️  로컬 테스트 건너뜀: {e}")
            total_tests -= 1  # 로컬 테스트를 전체 테스트에서 제외
        
        # 결과 요약
        print(f"\n📊 테스트 결과 요약")
        print(f"=" * 60)
        print(f"성공: {success_count}/{total_tests}")
        print(f"성공률: {success_count/total_tests*100:.1f}%")
        
        if success_count == total_tests:
            print("🎉 모든 테스트 통과!")
            return True
        else:
            print("⚠️  일부 테스트 실패")
            return False


def main():
    """메인 실행 함수"""
    runner = EmbeddingTestRunner()
    success = runner.run_comprehensive_test()
    
    if success:
        print("\n✅ Embedding 테스트 완료 - 시스템 정상!")
    else:
        print("\n❌ Embedding 테스트 실패 - 시스템 점검 필요")
    
    return success


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1) 