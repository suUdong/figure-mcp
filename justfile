# Figure-MCP Development Environment Manager
# 로컬/클라우드 환경을 쉽게 전환하고 관리합니다.

# Windows PowerShell 설정
set shell := ["powershell.exe", "-c"]

# 기본 변수
export COMPOSE_FILE := "docker-compose.yml"

# 🚀 원클릭 설치 및 설정
install:
    @Write-Host "🚀 Figure-MCP 개발 환경 설치를 시작합니다..." -ForegroundColor Green
    @Write-Host ""
    just check-requirements
    just install-missing
    just local-setup
    @Write-Host ""
    @Write-Host "✅ 설치 완료! 이제 'just local-start'로 시작하세요." -ForegroundColor Green

# 🔍 사전 요구사항 확인
check-requirements:
    @Write-Host "🔍 사전 요구사항을 확인하는 중..." -ForegroundColor Yellow
    @Write-Host ""
    
    # Docker 확인
    @try { 
        $dockerVersion = docker --version
        Write-Host "✅ Docker: $dockerVersion" -ForegroundColor Green 
    } catch { 
        Write-Host "❌ Docker가 설치되지 않았습니다." -ForegroundColor Red
        $global:needsDocker = $true
    }
    
    # Docker Compose 확인  
    @try {
        $composeVersion = docker-compose --version
        Write-Host "✅ Docker Compose: $composeVersion" -ForegroundColor Green
    } catch {
        Write-Host "❌ Docker Compose가 설치되지 않았습니다." -ForegroundColor Red
        $global:needsDockerCompose = $true
    }
    
    # Node.js 확인
    @try {
        $nodeVersion = node --version  
        Write-Host "✅ Node.js: $nodeVersion" -ForegroundColor Green
    } catch {
        Write-Host "❌ Node.js가 설치되지 않았습니다." -ForegroundColor Red
        $global:needsNode = $true
    }
    
    # Just 확인 (자기 자신)
    @try {
        $justVersion = just --version
        Write-Host "✅ Just: $justVersion" -ForegroundColor Green
    } catch {
        Write-Host "✅ Just: 현재 실행 중 (설치됨)" -ForegroundColor Green
    }
    
    @Write-Host ""

# 🔧 누락된 도구 설치 가이드
install-missing:
    @Write-Host "🔧 누락된 도구 설치 가이드:" -ForegroundColor Yellow
    @Write-Host ""
    
    # Docker 설치 가이드
    @if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        Write-Host "📦 Docker 설치 필요:" -ForegroundColor Red
        Write-Host "   1. https://docs.docker.com/desktop/install/windows-install/" -ForegroundColor Cyan
        Write-Host "   2. Docker Desktop for Windows 다운로드 및 설치" -ForegroundColor Cyan  
        Write-Host "   3. 설치 후 시스템 재시작" -ForegroundColor Cyan
        Write-Host "   4. Docker Desktop 실행 및 WSL2 활성화" -ForegroundColor Cyan
        Write-Host ""
        
        # 자동 설치 시도 (winget 사용)
        Write-Host "🤖 자동 설치를 시도합니다..." -ForegroundColor Green
        try {
            winget install Docker.DockerDesktop
            Write-Host "✅ Docker Desktop 설치 완료! 시스템을 재시작하고 Docker Desktop을 실행하세요." -ForegroundColor Green
        } catch {
            Write-Host "⚠️  자동 설치 실패. 수동 설치를 진행하세요." -ForegroundColor Yellow
        }
        Write-Host ""
    }
    
    # Node.js 설치 가이드  
    @if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
        Write-Host "📦 Node.js 설치 필요:" -ForegroundColor Red
        Write-Host "   1. https://nodejs.org/en/download/" -ForegroundColor Cyan
        Write-Host "   2. Node.js LTS 버전 다운로드 및 설치" -ForegroundColor Cyan
        Write-Host "   3. 설치 확인: node --version" -ForegroundColor Cyan
        Write-Host ""
        
        # 자동 설치 시도
        Write-Host "🤖 자동 설치를 시도합니다..." -ForegroundColor Green
        try {
            winget install OpenJS.NodeJS.LTS
            Write-Host "✅ Node.js 설치 완료!" -ForegroundColor Green
        } catch {
            Write-Host "⚠️  자동 설치 실패. 수동 설치를 진행하세요." -ForegroundColor Yellow
        }
        Write-Host ""
    }
    
    @Write-Host "💡 모든 도구가 설치되면 새 터미널을 열고 'just check-requirements'로 다시 확인하세요." -ForegroundColor Green

# 🏥 시스템 헬스 체크 (종합)
health-check:
    @Write-Host "🏥 시스템 종합 헬스 체크..." -ForegroundColor Green
    @Write-Host ""
    
    # 1. 사전 요구사항 확인
    @Write-Host "1️⃣ 사전 요구사항:" -ForegroundColor Yellow
    just check-requirements
    
    # 2. Docker 서비스 상태 확인
    @Write-Host "2️⃣ Docker 서비스 상태:" -ForegroundColor Yellow
    @try {
        docker system info | Select-Object -First 5
        Write-Host "✅ Docker 엔진 정상" -ForegroundColor Green
    } catch {
        Write-Host "❌ Docker 엔진 문제" -ForegroundColor Red
    }
    @Write-Host ""
    
    # 3. 환경 설정 파일 확인
    @Write-Host "3️⃣ 환경 설정 파일:" -ForegroundColor Yellow
    @if (Test-Path .env.json) { 
        Write-Host "✅ .env.json 존재" -ForegroundColor Green 
    } else { 
        Write-Host "⚠️  .env.json 없음 (just local-setup 실행 필요)" -ForegroundColor Yellow 
    }
    @if (Test-Path figure-backend/.env) { 
        Write-Host "✅ figure-backend/.env 존재" -ForegroundColor Green 
    } else { 
        Write-Host "⚠️  figure-backend/.env 없음" -ForegroundColor Yellow 
    }
    @if (Test-Path figure-mcp/.env) { 
        Write-Host "✅ figure-mcp/.env 존재" -ForegroundColor Green 
    } else { 
        Write-Host "⚠️  figure-mcp/.env 없음" -ForegroundColor Yellow 
    }
    @Write-Host ""
    
    # 4. 컨테이너 상태 확인
    @Write-Host "4️⃣ 컨테이너 상태:" -ForegroundColor Yellow
    @try {
        docker-compose ps
    } catch {
        Write-Host "❌ Docker Compose 서비스를 확인할 수 없습니다." -ForegroundColor Red
    }
    @Write-Host ""
    
    @Write-Host "💡 문제가 있다면 'just install'로 재설치하거나 'just local-start'로 서비스를 시작하세요." -ForegroundColor Green

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

# 🔧 재빌드 명령어들
rebuild:
    @Write-Host "🔧 전체 서비스 재빌드 중..." -ForegroundColor Green
    docker-compose down
    docker-compose up -d --build --force-recreate
    @Write-Host "✅ 재빌드 완료!" -ForegroundColor Green

rebuild-backend:
    @Write-Host "🔧 백엔드만 재빌드 중..." -ForegroundColor Green  
    docker-compose up -d --build figure-backend
    @Write-Host "✅ 백엔드 재빌드 완료!" -ForegroundColor Green

rebuild-office:
    @Write-Host "🔧 백오피스만 재빌드 중..." -ForegroundColor Green
    docker-compose up -d --build figure-backend-office  
    @Write-Host "✅ 백오피스 재빌드 완료!" -ForegroundColor Green

rebuild-clean:
    @Write-Host "🧹 캐시 제거하고 완전 재빌드..." -ForegroundColor Green
    docker-compose down
    docker-compose build --no-cache
    docker-compose up -d
    @Write-Host "✅ 완전 재빌드 완료!" -ForegroundColor Green

# 🌍 DEV 환경 (클라우드 서비스 연동)
dev-setup:
    @Write-Host "🌍 Dev 환경 설정 중..." -ForegroundColor Green
    Copy-Item data/environments/cloud.json .env.json -Force -ErrorAction SilentlyContinue
    Copy-Item figure-backend/env.dev figure-backend/.env -Force -ErrorAction SilentlyContinue
    @Write-Host "📝 클라우드 환경 변수 설정 완료!" -ForegroundColor Green

dev-start:
    @Write-Host "🚀 Dev 환경 시작 (하이브리드 모드)..." -ForegroundColor Green
    just dev-setup
    docker-compose up figure-backend-office chroma -d
    @Write-Host "🌐 하이브리드 클라우드 모드로 시작됨" -ForegroundColor Green
    @Write-Host "📋 서비스 구성:" -ForegroundColor Yellow
    @Write-Host "   - PostgreSQL: Supabase ☁️" -ForegroundColor Cyan
    @Write-Host "   - File Storage: Supabase Storage ☁️" -ForegroundColor Cyan
    @Write-Host "   - ChromaDB: 로컬 Docker 🏠" -ForegroundColor Cyan
    @Write-Host "   - Backend API: Railway ☁️" -ForegroundColor Cyan

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

test-dev:
    @Write-Host "🧪 Dev 환경 테스트..." -ForegroundColor Green
    @Write-Host "☁️ 클라우드 서비스:" -ForegroundColor Yellow
    @Write-Host "   - Supabase PostgreSQL 연결 확인 필요" -ForegroundColor Yellow
    @Write-Host "   - Supabase Storage 연결 확인 필요" -ForegroundColor Yellow
    @Write-Host "   - Railway Backend API 연결 확인 필요" -ForegroundColor Yellow
    @Write-Host "🏠 로컬 서비스:" -ForegroundColor Yellow
    @try { Invoke-RestMethod -Uri http://localhost:8000/api/v2/heartbeat -TimeoutSec 5 | Out-Null; Write-Host "✅ ChromaDB 정상" -ForegroundColor Green } catch { Write-Host "❌ ChromaDB 응답 없음" -ForegroundColor Red }
    @try { Invoke-WebRequest -Uri http://localhost:3001 -TimeoutSec 5 | Out-Null; Write-Host "✅ Office 정상" -ForegroundColor Green } catch { Write-Host "❌ Office 응답 없음" -ForegroundColor Red }

# 🔧 Supabase 설정
setup-supabase:
    @Write-Host "🔑 Supabase 환경변수 설정 도우미" -ForegroundColor Green
    @Write-Host ""
    @Write-Host "📋 필요한 정보를 Supabase Dashboard에서 확인하세요:" -ForegroundColor Yellow
    @Write-Host "   1. https://supabase.com/dashboard → 프로젝트 → Settings → API" -ForegroundColor Cyan
    @Write-Host "   2. Project URL, anon key, service_role key 복사" -ForegroundColor Cyan
    @Write-Host "   3. Settings → Database → Connection parameters 확인" -ForegroundColor Cyan
    @Write-Host ""
    @Write-Host "🚀 Railway 환경변수 설정:" -ForegroundColor Yellow
    @Write-Host "   railway login && railway variables set SUPABASE_URL=https://xxx.supabase.co" -ForegroundColor Cyan
    @Write-Host ""
    @Write-Host "📖 자세한 가이드: SUPABASE_ENV_SETUP.md 파일 참조" -ForegroundColor Green

check-supabase:
    @Write-Host "🔍 Supabase 환경변수 확인..." -ForegroundColor Green
    @if ($env:SUPABASE_URL) { Write-Host "✅ SUPABASE_URL: $env:SUPABASE_URL" -ForegroundColor Green } else { Write-Host "❌ SUPABASE_URL 없음" -ForegroundColor Red }
    @if ($env:SUPABASE_SERVICE_ROLE_KEY) { Write-Host "✅ SUPABASE_SERVICE_ROLE_KEY 설정됨" -ForegroundColor Green } else { Write-Host "❌ SUPABASE_SERVICE_ROLE_KEY 없음" -ForegroundColor Red }
    @if ($env:SUPABASE_DB_HOST) { Write-Host "✅ SUPABASE_DB_HOST: $env:SUPABASE_DB_HOST" -ForegroundColor Green } else { Write-Host "❌ SUPABASE_DB_HOST 없음" -ForegroundColor Red }

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
    @Write-Host "🌍 Dev 환경 (하이브리드):" -ForegroundColor Yellow
    @Write-Host "  just dev-start       # Dev 환경 시작 (Supabase + 로컬 ChromaDB)" -ForegroundColor White
    @Write-Host "  just dev-stop        # Dev 환경 중지" -ForegroundColor White
    @Write-Host ""
    @Write-Host "🔑 Supabase 설정:" -ForegroundColor Yellow
    @Write-Host "  just setup-supabase  # Supabase 설정 가이드" -ForegroundColor White
    @Write-Host "  just check-supabase  # Supabase 환경변수 확인" -ForegroundColor White
    @Write-Host ""
    @Write-Host "🧪 테스트:" -ForegroundColor Yellow
    @Write-Host "  just test-local      # 로컬 환경 테스트" -ForegroundColor White
    @Write-Host "  just test-dev        # Dev 환경 테스트" -ForegroundColor White
    @Write-Host ""
    @Write-Host "🔧 유틸리티:" -ForegroundColor Yellow
    @Write-Host "  just status          # 환경 상태 확인" -ForegroundColor White
    @Write-Host "  just logs [service]  # 로그 확인" -ForegroundColor White
    @Write-Host "  just restart [service] # 서비스 재시작" -ForegroundColor White
    @Write-Host "  just build           # 서비스 빌드" -ForegroundColor White
    @Write-Host "  just clean           # 리소스 정리" -ForegroundColor White