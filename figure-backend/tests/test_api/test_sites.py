"""
Sites API 엔드포인트 테스트
"""
import pytest
from unittest.mock import Mock, patch
from fastapi.testclient import TestClient


pytestmark = pytest.mark.api


class TestSitesAPI:
    """Sites API 테스트"""
    
    def test_create_site_success(self, client, sample_site_data):
        """사이트 생성 성공 테스트"""
        response = client.post("/api/sites/", json=sample_site_data)
        
        assert response.status_code == 200
        data = response.json()
        
        assert "id" in data
        assert data["name"] == sample_site_data["name"]
        assert data["description"] == sample_site_data["description"]
        assert data["url"] == sample_site_data["url"]
        assert data["is_active"] == sample_site_data["is_active"]
        assert "created_at" in data
        assert "updated_at" in data
    
    def test_create_site_invalid_data(self, client):
        """잘못된 사이트 데이터로 생성 테스트"""
        invalid_data = {
            "name": "",  # 빈 이름
            "description": "테스트 설명",
            "url": "invalid-url",  # 잘못된 URL
            "is_active": True
        }
        
        response = client.post("/api/sites/", json=invalid_data)
        
        assert response.status_code == 422  # Validation Error
    
    def test_get_site_success(self, client, sample_site_data):
        """사이트 조회 성공 테스트"""
        # 먼저 사이트 생성
        create_response = client.post("/api/sites/", json=sample_site_data)
        site_id = create_response.json()["id"]
        
        # 사이트 조회
        response = client.get(f"/api/sites/{site_id}")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["id"] == site_id
        assert data["name"] == sample_site_data["name"]
    
    def test_get_site_not_found(self, client):
        """존재하지 않는 사이트 조회 테스트"""
        response = client.get("/api/sites/nonexistent-id")
        
        assert response.status_code == 404
        data = response.json()
        assert "detail" in data
    
    def test_list_sites_success(self, client, sample_site_data):
        """사이트 목록 조회 성공 테스트"""
        # 테스트 사이트 생성
        client.post("/api/sites/", json=sample_site_data)
        
        response = client.get("/api/sites/")
        
        assert response.status_code == 200
        data = response.json()
        
        assert "sites" in data
        assert "total" in data
        assert len(data["sites"]) >= 1
        assert data["total"] >= 1
    
    def test_list_sites_with_pagination(self, client):
        """페이지네이션이 적용된 사이트 목록 조회 테스트"""
        response = client.get("/api/sites/?skip=0&limit=10")
        
        assert response.status_code == 200
        data = response.json()
        
        assert "sites" in data
        assert "total" in data
        assert len(data["sites"]) <= 10
    
    def test_list_sites_active_only(self, client, sample_site_data):
        """활성 사이트만 목록 조회 테스트"""
        # 활성 사이트 생성
        active_site = sample_site_data.copy()
        active_site["name"] = "활성 사이트"
        client.post("/api/sites/", json=active_site)
        
        # 비활성 사이트 생성
        inactive_site = sample_site_data.copy()
        inactive_site["name"] = "비활성 사이트"
        inactive_site["is_active"] = False
        client.post("/api/sites/", json=inactive_site)
        
        response = client.get("/api/sites/?active_only=true")
        
        assert response.status_code == 200
        data = response.json()
        
        # 모든 반환된 사이트가 활성 상태인지 확인
        assert all(site["is_active"] for site in data["sites"])
    
    def test_update_site_success(self, client, sample_site_data):
        """사이트 업데이트 성공 테스트"""
        # 먼저 사이트 생성
        create_response = client.post("/api/sites/", json=sample_site_data)
        site_id = create_response.json()["id"]
        
        # 업데이트 데이터
        update_data = {
            "name": "업데이트된 사이트 이름",
            "description": "업데이트된 설명"
        }
        
        response = client.put(f"/api/sites/{site_id}", json=update_data)
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["name"] == update_data["name"]
        assert data["description"] == update_data["description"]
        assert data["url"] == sample_site_data["url"]  # 변경되지 않은 필드
    
    def test_update_site_not_found(self, client):
        """존재하지 않는 사이트 업데이트 테스트"""
        update_data = {
            "name": "업데이트된 이름"
        }
        
        response = client.put("/api/sites/nonexistent-id", json=update_data)
        
        assert response.status_code == 404
        data = response.json()
        assert "detail" in data
    
    def test_delete_site_success(self, client, sample_site_data):
        """사이트 삭제 성공 테스트"""
        # 먼저 사이트 생성
        create_response = client.post("/api/sites/", json=sample_site_data)
        site_id = create_response.json()["id"]
        
        response = client.delete(f"/api/sites/{site_id}")
        
        assert response.status_code == 200
        data = response.json()
        
        assert "message" in data
        assert "success" in data["message"]
        
        # 삭제된 사이트 조회 시 404 에러 확인
        get_response = client.get(f"/api/sites/{site_id}")
        assert get_response.status_code == 404
    
    def test_delete_site_not_found(self, client):
        """존재하지 않는 사이트 삭제 테스트"""
        response = client.delete("/api/sites/nonexistent-id")
        
        assert response.status_code == 404
        data = response.json()
        assert "detail" in data
    
    def test_get_site_document_count(self, client, sample_site_data):
        """사이트의 문서 개수 조회 테스트"""
        # 먼저 사이트 생성
        create_response = client.post("/api/sites/", json=sample_site_data)
        site_id = create_response.json()["id"]
        
        response = client.get(f"/api/sites/{site_id}/documents/count")
        
        assert response.status_code == 200
        data = response.json()
        
        assert "site_id" in data
        assert "document_count" in data
        assert data["site_id"] == site_id
        assert isinstance(data["document_count"], int)


class TestSitesAPIValidation:
    """Sites API 입력 검증 테스트"""
    
    def test_create_site_missing_required_fields(self, client):
        """필수 필드 누락 테스트"""
        incomplete_data = {
            "description": "설명만 있는 데이터"
            # name, url 누락
        }
        
        response = client.post("/api/sites/", json=incomplete_data)
        
        assert response.status_code == 422
    
    def test_create_site_invalid_url_format(self, client):
        """잘못된 URL 형식 테스트"""
        invalid_data = {
            "name": "테스트 사이트",
            "description": "테스트 설명",
            "url": "not-a-valid-url",
            "is_active": True
        }
        
        response = client.post("/api/sites/", json=invalid_data)
        
        assert response.status_code == 422
    
    def test_create_site_name_too_long(self, client):
        """너무 긴 사이트 이름 테스트"""
        invalid_data = {
            "name": "a" * 201,  # 200자 초과
            "description": "테스트 설명",
            "url": "https://example.com",
            "is_active": True
        }
        
        response = client.post("/api/sites/", json=invalid_data)
        
        assert response.status_code == 422
    
    def test_list_sites_invalid_pagination(self, client):
        """잘못된 페이지네이션 파라미터 테스트"""
        response = client.get("/api/sites/?skip=-1&limit=0")
        
        assert response.status_code == 422 