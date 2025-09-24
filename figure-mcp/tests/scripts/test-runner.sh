#!/bin/bash

# MCP ↔ Backend 통신 테스트 실행 스크립트
# 모든 레벨의 테스트를 순차적으로 실행

set -e  # 에러 발생 시 즉시 종료

# 색상 출력을 위한 변수
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 로그 함수
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 환경 변수 설정
export NODE_ENV=test
export MCP_QUIET=true
export BACKEND_API_URL=http://localhost:8001/api
export TEST_RESULTS_DIR=./test-results
export COVERAGE_DIR=./coverage

# 테스트 결과 디렉토리 생성
mkdir -p $TEST_RESULTS_DIR
mkdir -p $COVERAGE_DIR

# 시작 시간 기록
START_TIME=$(date +%s)

log_info "🚀 MCP ↔ Backend 통신 테스트 시작"
log_info "테스트 환경: NODE_ENV=$NODE_ENV"
log_info "백엔드 URL: $BACKEND_API_URL"

# 1단계: 의존성 설치 및 빌드
log_info "📦 의존성 설치 및 빌드..."
npm ci
npm run build

if [ $? -ne 0 ]; then
    log_error "빌드 실패"
    exit 1
fi

log_success "빌드 완료"

# 2단계: Unit Tests (빠른 피드백)
log_info "🔧 Unit Tests 실행..."
npx jest --config tests/setup/jest.config.js --testPathPattern=tests/unit --coverage --coverageDirectory=$COVERAGE_DIR/unit 2>&1 | tee $TEST_RESULTS_DIR/unit-tests.log

UNIT_TEST_EXIT_CODE=$?
if [ $UNIT_TEST_EXIT_CODE -ne 0 ]; then
    log_error "Unit Tests 실패 (Exit Code: $UNIT_TEST_EXIT_CODE)"
    log_warning "Integration 및 E2E 테스트는 건너뜁니다."
    exit $UNIT_TEST_EXIT_CODE
fi

log_success "Unit Tests 통과"

# 3단계: 백엔드 서비스 상태 확인
log_info "🐳 백엔드 서비스 상태 확인..."

# 백엔드 API 헬스체크
check_backend() {
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        log_info "백엔드 API 연결 시도 ($attempt/$max_attempts)..."
        
        if curl -f -s $BACKEND_API_URL/health > /dev/null 2>&1; then
            log_success "백엔드 API 정상 응답 확인"
            return 0
        fi
        
        if [ $attempt -eq $max_attempts ]; then
            log_error "백엔드 API 연결 실패"
            log_warning "Integration 및 E2E 테스트를 건너뜁니다."
            log_warning "백엔드 서비스를 시작하려면: docker-compose up figure-backend"
            return 1
        fi
        
        sleep 2
        ((attempt++))
    done
}

if check_backend; then
    BACKEND_AVAILABLE=true
else
    BACKEND_AVAILABLE=false
fi

# 4단계: Integration Tests (백엔드 서비스가 있는 경우에만)
if [ "$BACKEND_AVAILABLE" = true ]; then
    log_info "🔗 Integration Tests 실행..."
    npx jest --config tests/setup/jest.config.js --testPathPattern=tests/integration --runInBand --forceExit --detectOpenHandles 2>&1 | tee $TEST_RESULTS_DIR/integration-tests.log
    
    INTEGRATION_TEST_EXIT_CODE=$?
    if [ $INTEGRATION_TEST_EXIT_CODE -ne 0 ]; then
        log_error "Integration Tests 실패 (Exit Code: $INTEGRATION_TEST_EXIT_CODE)"
        log_warning "E2E 테스트는 건너뜁니다."
    else
        log_success "Integration Tests 통과"
    fi
else
    log_warning "백엔드 서비스가 없어 Integration Tests를 건너뜁니다."
    INTEGRATION_TEST_EXIT_CODE=0
fi

# 5단계: E2E Tests (모든 서비스가 정상인 경우에만)
if [ "$BACKEND_AVAILABLE" = true ] && [ $INTEGRATION_TEST_EXIT_CODE -eq 0 ]; then
    log_info "🎯 E2E Tests 실행..."
    npx jest --config tests/setup/jest.config.js --testPathPattern=tests/e2e --runInBand --forceExit --detectOpenHandles --testTimeout=60000 2>&1 | tee $TEST_RESULTS_DIR/e2e-tests.log
    
    E2E_TEST_EXIT_CODE=$?
    if [ $E2E_TEST_EXIT_CODE -ne 0 ]; then
        log_error "E2E Tests 실패 (Exit Code: $E2E_TEST_EXIT_CODE)"
    else
        log_success "E2E Tests 통과"
    fi
else
    log_warning "조건이 맞지 않아 E2E Tests를 건너뜁니다."
    E2E_TEST_EXIT_CODE=0
fi

# 6단계: 테스트 결과 통합 및 리포트 생성
log_info "📊 테스트 결과 통합..."

# 커버리지 리포트 통합 (가능한 경우)
if [ -d "$COVERAGE_DIR" ]; then
    log_info "커버리지 리포트 생성 중..."
    npx jest --config tests/setup/jest.config.js --coverage --coverageDirectory=$COVERAGE_DIR/combined --passWithNoTests || true
fi

# 테스트 결과 요약
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

echo ""
echo "=================================================================="
echo "🎯 테스트 결과 요약"
echo "=================================================================="
echo "실행 시간: ${DURATION}초"
echo ""

if [ $UNIT_TEST_EXIT_CODE -eq 0 ]; then
    echo -e "✅ Unit Tests: ${GREEN}통과${NC}"
else
    echo -e "❌ Unit Tests: ${RED}실패 (Exit Code: $UNIT_TEST_EXIT_CODE)${NC}"
fi

if [ "$BACKEND_AVAILABLE" = true ]; then
    if [ $INTEGRATION_TEST_EXIT_CODE -eq 0 ]; then
        echo -e "✅ Integration Tests: ${GREEN}통과${NC}"
    else
        echo -e "❌ Integration Tests: ${RED}실패 (Exit Code: $INTEGRATION_TEST_EXIT_CODE)${NC}"
    fi
    
    if [ $E2E_TEST_EXIT_CODE -eq 0 ]; then
        echo -e "✅ E2E Tests: ${GREEN}통과${NC}"
    else
        echo -e "❌ E2E Tests: ${RED}실패 (Exit Code: $E2E_TEST_EXIT_CODE)${NC}"
    fi
else
    echo -e "⏭️ Integration Tests: ${YELLOW}건너뜀 (백엔드 서비스 없음)${NC}"
    echo -e "⏭️ E2E Tests: ${YELLOW}건너뜀 (백엔드 서비스 없음)${NC}"
fi

echo ""
echo "📁 테스트 로그: $TEST_RESULTS_DIR/"
echo "📊 커버리지 리포트: $COVERAGE_DIR/"

# 전체 결과 코드 결정
OVERALL_EXIT_CODE=0

if [ $UNIT_TEST_EXIT_CODE -ne 0 ]; then
    OVERALL_EXIT_CODE=$UNIT_TEST_EXIT_CODE
elif [ "$BACKEND_AVAILABLE" = true ] && [ $INTEGRATION_TEST_EXIT_CODE -ne 0 ]; then
    OVERALL_EXIT_CODE=$INTEGRATION_TEST_EXIT_CODE
elif [ "$BACKEND_AVAILABLE" = true ] && [ $E2E_TEST_EXIT_CODE -ne 0 ]; then
    OVERALL_EXIT_CODE=$E2E_TEST_EXIT_CODE
fi

echo "=================================================================="

if [ $OVERALL_EXIT_CODE -eq 0 ]; then
    log_success "🎉 모든 테스트 성공!"
else
    log_error "💥 일부 테스트 실패 (Exit Code: $OVERALL_EXIT_CODE)"
fi

exit $OVERALL_EXIT_CODE
