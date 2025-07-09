#!/usr/bin/env pwsh

# Figure-MCP 통합 테스트 실행 스크립트 (Windows PowerShell)

param(
    [string]$Scenario = "all",
    [switch]$Verbose,
    [switch]$Setup,
    [switch]$Cleanup,
    [string]$Environment = "local"
)

# 색상 출력 함수
function Write-ColorOutput($ForegroundColor) {
    $fc = $host.UI.RawUI.ForegroundColor
    $host.UI.RawUI.ForegroundColor = $ForegroundColor
    if ($args) {
        Write-Output $args
    } else {
        $input | Write-Output
    }
    $host.UI.RawUI.ForegroundColor = $fc
}

function Write-Info($message) {
    Write-ColorOutput Cyan "🔵 INFO: $message"
}

function Write-Success($message) {
    Write-ColorOutput Green "✅ SUCCESS: $message"
}

function Write-Warning($message) {
    Write-ColorOutput Yellow "⚠️  WARNING: $message"
}

function Write-Error($message) {
    Write-ColorOutput Red "❌ ERROR: $message"
}

function Write-Header($message) {
    Write-ColorOutput Magenta ""
    Write-ColorOutput Magenta "=" * 50
    Write-ColorOutput Magenta $message
    Write-ColorOutput Magenta "=" * 50
}

# 환경 설정 함수
function Setup-Environment {
    Write-Header "🛠️  환경 설정 시작"
    
    # 현재 디렉토리 확인
    $currentDir = Get-Location
    Write-Info "현재 디렉토리: $currentDir"
    
    # 환경 변수 파일 확인
    if (-not (Test-Path ".env")) {
        if (Test-Path "env.template") {
            Write-Info "env.template에서 .env 파일을 생성합니다..."
            Copy-Item "env.template" ".env"
            Write-Warning ".env 파일에 실제 API 키를 설정해주세요!"
        } else {
            Write-Error ".env 파일과 env.template 파일이 없습니다!"
            exit 1
        }
    }
    
    # Node.js 버전 확인
    try {
        $nodeVersion = node --version
        Write-Info "Node.js 버전: $nodeVersion"
        
        if ([version]($nodeVersion -replace 'v', '') -lt [version]"18.0.0") {
            Write-Error "Node.js 18.0.0 이상이 필요합니다!"
            exit 1
        }
    } catch {
        Write-Error "Node.js가 설치되지 않았습니다!"
        exit 1
    }
    
    # 의존성 설치
    Write-Info "NPM 의존성을 설치합니다..."
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Error "NPM 의존성 설치 실패!"
        exit 1
    }
    
    # TypeScript 빌드
    Write-Info "TypeScript 코드를 빌드합니다..."
    npm run build
    if ($LASTEXITCODE -ne 0) {
        Write-Error "TypeScript 빌드 실패!"
        exit 1
    }
    
    Write-Success "환경 설정 완료!"
}

# 서비스 상태 확인 함수
function Check-Services {
    Write-Header "🔍 서비스 상태 확인"
    
    # 백엔드 상태 확인
    Write-Info "백엔드 서비스 상태를 확인합니다..."
    try {
        $backendUrl = if ($Environment -eq "docker") { "http://localhost:8000" } else { "http://localhost:8000" }
        $response = Invoke-WebRequest -Uri "$backendUrl/health" -TimeoutSec 5 -UseBasicParsing
        if ($response.StatusCode -eq 200) {
            Write-Success "백엔드 서비스 정상 동작"
        }
    } catch {
        Write-Error "백엔드 서비스에 연결할 수 없습니다. Docker Compose를 시작했는지 확인하세요."
        Write-Info "Docker Compose 시작: docker-compose up -d"
        exit 1
    }
    
    # MCP 서버 파일 확인
    $mcpServerPath = "../figure-mcp-server/dist/server.js"
    if ($Environment -eq "docker") {
        Write-Info "Docker 환경에서는 MCP 서버 파일 확인을 건너뜁니다."
    } elseif (-not (Test-Path $mcpServerPath)) {
        Write-Error "MCP 서버 파일을 찾을 수 없습니다: $mcpServerPath"
        Write-Info "MCP 서버를 빌드하세요: cd ../figure-mcp-server && npm run build"
        exit 1
    } else {
        Write-Success "MCP 서버 파일 확인됨"
    }
}

# 테스트 실행 함수
function Run-Tests {
    param([string]$TestScenario)
    
    Write-Header "🧪 테스트 실행: $TestScenario"
    
    $verboseFlag = if ($Verbose) { "--verbose" } else { "" }
    
    switch ($TestScenario.ToLower()) {
        "basic" {
            Write-Info "기본 워크플로우 테스트를 실행합니다..."
            node dist/basic-workflow.js $verboseFlag
        }
        "error" {
            Write-Info "에러 처리 테스트를 실행합니다..."
            node dist/error-handling.js $verboseFlag
        }
        "all" {
            Write-Info "모든 테스트를 실행합니다..."
            
            Write-Info "1. 기본 워크플로우 테스트"
            node dist/basic-workflow.js $verboseFlag
            $basicResult = $LASTEXITCODE
            
            Write-Info "2. 에러 처리 테스트"
            node dist/error-handling.js $verboseFlag
            $errorResult = $LASTEXITCODE
            
            if ($basicResult -eq 0 -and $errorResult -eq 0) {
                Write-Success "모든 테스트가 성공적으로 완료되었습니다!"
                exit 0
            } else {
                Write-Error "일부 테스트가 실패했습니다."
                exit 1
            }
        }
        default {
            Write-Error "알 수 없는 테스트 시나리오: $TestScenario"
            Write-Info "사용 가능한 시나리오: basic, error, all"
            exit 1
        }
    }
}

# 정리 함수
function Cleanup-Environment {
    Write-Header "🧹 환경 정리"
    
    # 빌드 파일 정리
    if (Test-Path "dist") {
        Write-Info "빌드 파일을 정리합니다..."
        Remove-Item -Recurse -Force "dist"
    }
    
    # Docker 컨테이너 정리 (선택사항)
    if ($Environment -eq "docker") {
        Write-Info "Docker 컨테이너를 정리합니다..."
        docker-compose down
    }
    
    Write-Success "환경 정리 완료!"
}

# 도움말 출력
function Show-Help {
    Write-ColorOutput White @"

🧪 Figure-MCP 통합 테스트 실행 스크립트

사용법:
    .\run-tests.ps1 [옵션]

옵션:
    -Scenario <scenario>   실행할 테스트 시나리오 (basic, error, all)
    -Verbose              상세 출력 모드
    -Setup                환경 설정만 수행
    -Cleanup              환경 정리만 수행
    -Environment <env>    실행 환경 (local, docker)

예시:
    .\run-tests.ps1 -Setup                      # 환경 설정
    .\run-tests.ps1 -Scenario basic            # 기본 테스트만 실행
    .\run-tests.ps1 -Scenario all -Verbose     # 모든 테스트를 상세 모드로 실행
    .\run-tests.ps1 -Cleanup                   # 환경 정리

전제 조건:
    - Node.js 18.0.0 이상
    - Docker & Docker Compose (docker 환경 사용 시)
    - OpenAI API 키 (.env 파일에 설정)

"@
}

# 메인 실행 로직
Write-Header "🚀 Figure-MCP 통합 테스트"

# 도움말 요청 확인
if ($args -contains "-h" -or $args -contains "--help" -or $args -contains "help") {
    Show-Help
    exit 0
}

try {
    if ($Setup) {
        Setup-Environment
        exit 0
    }
    
    if ($Cleanup) {
        Cleanup-Environment
        exit 0
    }
    
    # 기본 실행 flow
    Setup-Environment
    Check-Services
    Run-Tests -TestScenario $Scenario
    
    Write-Success "통합 테스트가 성공적으로 완료되었습니다!"
    
} catch {
    Write-Error "테스트 실행 중 오류 발생: $($_.Exception.Message)"
    exit 1
} 