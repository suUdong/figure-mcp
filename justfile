# Figure-MCP Development Environment Manager
# 로컬/클라우드 환경을 쉽게 전환하고 관리합니다.

# Windows PowerShell 설정
set shell := ["powershell.exe", "-c"]

# 기본 변수
export COMPOSE_FILE := "docker-compose.yml"

# 🏠 LOCAL 환경 (모든 서비스 로컬 실행)
local-setup:
    @Write-Host "🏠 로컬 환경 설정 중..." -ForegroundColor Green
    Copy-Item data/environments/development.json .env.json -Force -ErrorAction SilentlyContinue
    Copy-Item figure-backend/env.example figure-backend/.env -Force -ErrorAction SilentlyContinue
    Copy-Item figure-mcp/env.example figure-mcp/.env -Force -ErrorAction SilentlyContinue

local-start:
    @Write-Host "🚀 로컬 환경 시작..." -ForegroundColor Green
    just local-setup
    docker-compose up -d
    @Write-Host "✅ 로컬 환경 실행 완료!" -ForegroundColor Green
    @Write-Host "📋 서비스 상태:" -ForegroundColor Yellow
    @Write-Host "   - Backend: http://localhost:8001" -ForegroundColor Cyan
    @Write-Host "   - Office: http://localhost:3001" -ForegroundColor Cyan
    @Write-Host "   - ChromaDB: http://localhost:8000" -ForegroundColor Cyan
    @Write-Host "   - Redis: localhost:6379" -ForegroundColor Cyan

local-stop:
    @Write-Host "🛑 로컬 환경 중지..." -ForegroundColor Yellow
    docker-compose down
    @Write-Host "✅ 로컬 환경 중지 완료!" -ForegroundColor Green

# 🌍 DEV 환경 (클라우드 서비스 연동)
dev-setup:
    @Write-Host "🌍 Dev 환경 설정 중..." -ForegroundColor Green
    Copy-Item data/environments/cloud.json .env.json -Force -ErrorAction SilentlyContinue
    Copy-Item figure-backend/env.dev figure-backend/.env -Force -ErrorAction SilentlyContinue
    @Write-Host "📝 클라우드 환경 변수 설정 완료!" -ForegroundColor Green

dev-start:
    @Write-Host "🚀 Dev 환경 시작..." -ForegroundColor Green
    just dev-setup
    docker-compose up figure-backend-office -d
    @Write-Host "🌐 클라우드 연동 모드로 시작됨" -ForegroundColor Green
    @Write-Host "📋 연동 서비스:" -ForegroundColor Yellow
    @Write-Host "   - PostgreSQL: Supabase" -ForegroundColor Cyan
    @Write-Host "   - File Storage: Supabase Storage" -ForegroundColor Cyan
    @Write-Host "   - ChromaDB: Render" -ForegroundColor Cyan
    @Write-Host "   - Backend API: Railway" -ForegroundColor Cyan

dev-stop:
    @Write-Host "🛑 Dev 환경 중지..." -ForegroundColor Yellow
    docker-compose down
    @Write-Host "✅ Dev 환경 중지 완료!" -ForegroundColor Green

# 📊 상태 확인
status:
    @Write-Host "📊 현재 환경 상태:" -ForegroundColor Yellow
    docker-compose ps
    @Write-Host ""
    @Write-Host "🔍 현재 환경 설정:" -ForegroundColor Yellow
    @if (Test-Path .env.json) { Get-Content .env.json | Select-String '"environment"' | Select-Object -First 1 }

# 🧪 테스트
test-local:
    @Write-Host "🧪 로컬 환경 테스트..." -ForegroundColor Green
    @try { Invoke-RestMethod -Uri http://localhost:8001/health -TimeoutSec 5 | Out-Null; Write-Host "✅ Backend 정상" -ForegroundColor Green } catch { Write-Host "❌ Backend 응답 없음" -ForegroundColor Red }
    @try { Invoke-WebRequest -Uri http://localhost:3001 -TimeoutSec 5 | Out-Null; Write-Host "✅ Office 정상" -ForegroundColor Green } catch { Write-Host "❌ Office 응답 없음" -ForegroundColor Red }
    @try { Invoke-RestMethod -Uri http://localhost:8000/api/v2/heartbeat -TimeoutSec 5 | Out-Null; Write-Host "✅ ChromaDB 정상" -ForegroundColor Green } catch { Write-Host "❌ ChromaDB 응답 없음" -ForegroundColor Red }

# 🔧 유틸리티
logs service="":
    @Write-Host "📋 {{service}} 로그 확인..." -ForegroundColor Yellow
    @if ("{{service}}" -ne "") { docker-compose logs -f {{service}} } else { docker-compose logs -f }

restart service="":
    @if ("{{service}}" -ne "") { Write-Host "🔄 {{service}} 재시작..." -ForegroundColor Yellow; docker-compose restart {{service}} } else { Write-Host "🔄 전체 서비스 재시작..." -ForegroundColor Yellow; docker-compose restart }

# 🧹 정리
clean:
    @Write-Host "🧹 Docker 리소스 정리..." -ForegroundColor Yellow
    docker-compose down -v
    docker system prune -f
    @Write-Host "✅ 정리 완료!" -ForegroundColor Green

# 📦 빌드
build:
    @Write-Host "📦 전체 서비스 빌드..." -ForegroundColor Green
    docker-compose build
    @Write-Host "✅ 빌드 완료!" -ForegroundColor Green

# ℹ️ 도움말
help:
    @Write-Host "🎯 Figure-MCP 환경 관리 명령어" -ForegroundColor Green
    @Write-Host ""
    @Write-Host "🏠 로컬 환경:" -ForegroundColor Yellow
    @Write-Host "  just local-start     # 로컬 환경 시작" -ForegroundColor White
    @Write-Host "  just local-stop      # 로컬 환경 중지" -ForegroundColor White
    @Write-Host ""
    @Write-Host "🌍 Dev 환경:" -ForegroundColor Yellow
    @Write-Host "  just dev-start       # Dev 환경 시작 (클라우드 연동)" -ForegroundColor White
    @Write-Host "  just dev-stop        # Dev 환경 중지" -ForegroundColor White
    @Write-Host ""
    @Write-Host "🔧 유틸리티:" -ForegroundColor Yellow
    @Write-Host "  just status          # 환경 상태 확인" -ForegroundColor White
    @Write-Host "  just test-local      # 로컬 환경 테스트" -ForegroundColor White
    @Write-Host "  just logs [service]  # 로그 확인" -ForegroundColor White
    @Write-Host "  just restart [service] # 서비스 재시작" -ForegroundColor White
    @Write-Host "  just build           # 서비스 빌드" -ForegroundColor White
    @Write-Host "  just clean           # 리소스 정리" -ForegroundColor White