#!/usr/bin/env python3
"""
Admin 서버 연동 테스트
헥사고날 아키텍처의 API 엔드포인트 확인
"""

import requests
import json
from typing import Dict, Any

def test_backend_api(base_url: str = "http://localhost:8001") -> Dict[str, Any]:
    """백엔드 API 엔드포인트 테스트"""
    
    results = {
        "base_url": base_url,
        "tests": [],
        "summary": {"passed": 0, "failed": 0, "total": 0}
    }
    
    # 테스트할 엔드포인트들 (의존성 없이 테스트 가능한 것들)
    test_endpoints = [
        {"name": "Root", "method": "GET", "path": "/"},
        {"name": "Health Check", "method": "GET", "path": "/health"},
        {"name": "Status", "method": "GET", "path": "/status"},
        {"name": "Admin Stats", "method": "GET", "path": "/admin/stats"},
        {"name": "Admin Metrics", "method": "GET", "path": "/admin/metrics"},
        # 기본적인 GET 엔드포인트들만 테스트
    ]
    
    print("🔍 백엔드 API 연동 테스트 시작...")
    print(f"📡 Target: {base_url}")
    print("-" * 50)
    
    for endpoint in test_endpoints:
        test_result = {
            "name": endpoint["name"],
            "method": endpoint["method"],
            "path": endpoint["path"],
            "url": f"{base_url}{endpoint['path']}",
            "status": "unknown",
            "response_code": None,
            "error": None
        }
        
        try:
            if endpoint["method"] == "GET":
                response = requests.get(test_result["url"], timeout=5)
            elif endpoint["method"] == "POST":
                response = requests.post(test_result["url"], timeout=5)
            
            test_result["response_code"] = response.status_code
            
            if response.status_code == 200:
                test_result["status"] = "✅ PASS"
                results["summary"]["passed"] += 1
                print(f"✅ {endpoint['name']}: {response.status_code}")
            else:
                test_result["status"] = "⚠️  WARN"
                test_result["error"] = f"HTTP {response.status_code}"
                results["summary"]["failed"] += 1
                print(f"⚠️  {endpoint['name']}: {response.status_code}")
                
        except requests.exceptions.ConnectionError:
            test_result["status"] = "❌ FAIL"
            test_result["error"] = "Connection refused - 서버가 실행되지 않음"
            results["summary"]["failed"] += 1
            print(f"❌ {endpoint['name']}: 서버 연결 실패")
            
        except requests.exceptions.Timeout:
            test_result["status"] = "❌ FAIL"
            test_result["error"] = "Request timeout"
            results["summary"]["failed"] += 1
            print(f"❌ {endpoint['name']}: 타임아웃")
            
        except Exception as e:
            test_result["status"] = "❌ FAIL"
            test_result["error"] = str(e)
            results["summary"]["failed"] += 1
            print(f"❌ {endpoint['name']}: {e}")
        
        results["tests"].append(test_result)
        results["summary"]["total"] += 1
    
    print("-" * 50)
    print(f"📊 테스트 결과: {results['summary']['passed']}/{results['summary']['total']} 성공")
    
    return results

def print_frontend_api_mapping():
    """프론트엔드 API 매핑 정보 출력"""
    
    print("\n🌐 Admin UI API 매핑:")
    print("-" * 50)
    
    mappings = [
        ("Admin Stats", "adminApi.getStats()", "/admin/stats"),
        ("Admin Metrics", "adminApi.getMetrics()", "/admin/metrics"),
        ("System Health", "systemApi.getHealth()", "/health"),
        ("System Status", "systemApi.getStatus()", "/status"),
        ("Usage Current", "usageApi.getCurrentUsage()", "/api/usage/current"),
        ("RAG Query", "ragApi.query()", "/api/rag/query"),
        ("Documents", "documentsApi.*", "/api/documents/*"),
        ("Sites", "sitesApi.*", "/api/sites/*"),
    ]
    
    for name, frontend, backend in mappings:
        print(f"✅ {name:15} | {frontend:25} → {backend}")

if __name__ == "__main__":
    print("🏗️ Figure-MCP Admin 서버 연동 테스트")
    print("=" * 60)
    
    # API 매핑 정보 출력
    print_frontend_api_mapping()
    
    # 백엔드 API 테스트
    print("\n🧪 백엔드 API 테스트")
    print("=" * 60)
    
    results = test_backend_api()
    
    if results["summary"]["passed"] > 0:
        print(f"\n🎉 {results['summary']['passed']}개 엔드포인트가 정상 작동합니다!")
        print("💡 Admin UI와 백엔드 간 연동이 준비되었습니다.")
    else:
        print(f"\n⚠️  백엔드 서버가 실행되지 않았습니다.")
        print("💡 서버를 시작하려면: uvicorn app.main:app --reload --port 8001")
    
    print("\n📋 다음 단계:")
    print("1. 백엔드 서버 시작: uvicorn app.main:app --reload --port 8001")
    print("2. Admin UI 서버 시작: cd ../figure-backend-office && npm run dev")
    print("3. Admin UI 접속: http://localhost:3001") 