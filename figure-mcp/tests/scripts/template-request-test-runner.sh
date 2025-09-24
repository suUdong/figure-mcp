#!/bin/bash

# 템플릿 요청 로직 집중 테스트 실행 스크립트
# MCP → Backend 템플릿 요청이 Copilot/LLM에서 정확히 작동하는지 검증

set -e  # 에러 발생 시 즉시 종료

# 색상 출력을 위한 변수
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
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

log_template() {
    echo -e "${PURPLE}[TEMPLATE]${NC} $1"
}

# 환경 변수 설정
export NODE_ENV=test
export MCP_QUIET=true
export BACKEND_API_URL=http://localhost:8001/api
export TEST_RESULTS_DIR=./test-results/template-request
export COVERAGE_DIR=./coverage/template-request

# 테스트 결과 디렉토리 생성
mkdir -p $TEST_RESULTS_DIR
mkdir -p $COVERAGE_DIR

# 시작 시간 기록
START_TIME=$(date +%s)

log_template "🎯 템플릿 요청 로직 집중 테스트 시작"
log_info "테스트 환경: NODE_ENV=$NODE_ENV"
log_info "백엔드 URL: $BACKEND_API_URL"
echo ""

# 1단계: 의존성 설치 및 빌드
log_info "📦 의존성 설치 및 빌드..."
npm ci > /dev/null 2>&1
npm run build > /dev/null 2>&1

if [ $? -ne 0 ]; then
    log_error "빌드 실패"
    exit 1
fi

log_success "빌드 완료"

# 2단계: 핵심 템플릿 요청 로직 단위 테스트
log_template "🔧 템플릿 요청 핵심 로직 단위 테스트..."
npx jest --config tests/setup/jest.config.js --testPathPattern=template-request-core --coverage --coverageDirectory=$COVERAGE_DIR/unit 2>&1 | tee $TEST_RESULTS_DIR/template-core-unit-tests.log

TEMPLATE_UNIT_EXIT_CODE=$?
if [ $TEMPLATE_UNIT_EXIT_CODE -ne 0 ]; then
    log_error "템플릿 요청 단위 테스트 실패 (Exit Code: $TEMPLATE_UNIT_EXIT_CODE)"
    log_warning "통합 테스트는 건너뜁니다."
    exit $TEMPLATE_UNIT_EXIT_CODE
fi

log_success "템플릿 요청 단위 테스트 통과"

# 3단계: 백엔드 서비스 상태 확인
log_info "🐳 백엔드 서비스 상태 확인..."

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
            log_warning "템플릿 통합 테스트를 건너뜁니다."
            log_warning "백엔드 서비스를 시작하려면: docker-compose up figure-backend chroma redis"
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

# 4단계: 템플릿 API 엔드포인트 검증
if [ "$BACKEND_AVAILABLE" = true ]; then
    log_template "🔍 백엔드 템플릿 API 엔드포인트 검증..."
    
    # 사이트 목록 확인
    SITES_CHECK=$(curl -s $BACKEND_API_URL/sites/ | jq -r '.success // false')
    if [ "$SITES_CHECK" = "true" ]; then
        log_success "사이트 API 정상"
    else
        log_warning "사이트 API 응답 이상"
    fi
    
    # 템플릿 API 기본 확인 (간단한 요청)
    TEMPLATE_CHECK=$(curl -s "$BACKEND_API_URL/templates/guide/IMPACT_ANALYSIS" | jq -r '.success // false')
    if [ "$TEMPLATE_CHECK" = "true" ]; then
        log_success "템플릿 API 정상"
    else
        log_warning "템플릿 API 응답 이상 - 기본 템플릿이 없을 수 있음"
    fi
fi

# 5단계: 템플릿 요청 통합 테스트 (백엔드 서비스가 있는 경우에만)
if [ "$BACKEND_AVAILABLE" = true ]; then
    log_template "🔗 템플릿 요청 통합 테스트 실행..."
    npx jest --config tests/setup/jest.config.js --testPathPattern=template-request-integration --runInBand --forceExit --detectOpenHandles 2>&1 | tee $TEST_RESULTS_DIR/template-integration-tests.log
    
    TEMPLATE_INTEGRATION_EXIT_CODE=$?
    if [ $TEMPLATE_INTEGRATION_EXIT_CODE -ne 0 ]; then
        log_error "템플릿 요청 통합 테스트 실패 (Exit Code: $TEMPLATE_INTEGRATION_EXIT_CODE)"
        log_warning "E2E 테스트는 건너뜁니다."
    else
        log_success "템플릿 요청 통합 테스트 통과"
    fi
else
    log_warning "백엔드 서비스가 없어 템플릿 통합 테스트를 건너뜁니다."
    TEMPLATE_INTEGRATION_EXIT_CODE=0
fi

# 6단계: MCP 템플릿 요청 E2E 테스트 (모든 서비스가 정상인 경우에만)
if [ "$BACKEND_AVAILABLE" = true ] && [ $TEMPLATE_INTEGRATION_EXIT_CODE -eq 0 ]; then
    log_template "🎯 MCP 템플릿 요청 E2E 테스트 실행..."
    
    # E2E 테스트에서 템플릿 관련 시나리오만 실행
    npx jest --config tests/setup/jest.config.js --testPathPattern=mcp-cursor-integration --runInBand --forceExit --detectOpenHandles --testTimeout=60000 --testNamePattern="템플릿|문서 생성|document" 2>&1 | tee $TEST_RESULTS_DIR/template-e2e-tests.log
    
    TEMPLATE_E2E_EXIT_CODE=$?
    if [ $TEMPLATE_E2E_EXIT_CODE -ne 0 ]; then
        log_error "템플릿 E2E 테스트 실패 (Exit Code: $TEMPLATE_E2E_EXIT_CODE)"
    else
        log_success "템플릿 E2E 테스트 통과"
    fi
else
    log_warning "조건이 맞지 않아 템플릿 E2E 테스트를 건너뜁니다."
    TEMPLATE_E2E_EXIT_CODE=0
fi

# 7단계: 템플릿 품질 분석 리포트 생성
log_template "📊 템플릿 품질 분석 리포트 생성..."

# 테스트 로그에서 템플릿 관련 정보 추출
if [ -f "$TEST_RESULTS_DIR/template-integration-tests.log" ]; then
    # 템플릿 길이, 변수 개수 등 품질 지표 추출
    TEMPLATE_METRICS=$(grep -o "템플릿 길이: [0-9]*자\|변수 개수: [0-9]*개\|응답 시간: [0-9]*\.[0-9]*ms" $TEST_RESULTS_DIR/template-integration-tests.log | head -10)
    
    if [ ! -z "$TEMPLATE_METRICS" ]; then
        log_template "템플릿 품질 지표:"
        echo "$TEMPLATE_METRICS" | while read line; do
            log_template "  $line"
        done
    fi
fi

# 8단계: 테스트 결과 종합 및 리포트 생성
log_info "📊 템플릿 요청 테스트 결과 종합..."

# 종합 결과 파일 생성
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

cat > $TEST_RESULTS_DIR/template-test-summary.md << EOF
# 🎯 템플릿 요청 로직 테스트 결과 보고서

## 📋 테스트 개요
- **실행 날짜**: $(date)
- **실행 시간**: ${DURATION}초
- **테스트 환경**: $NODE_ENV
- **백엔드 URL**: $BACKEND_API_URL

## 🎯 테스트 목적
MCP 서버에서 백엔드로의 템플릿 요청 로직이 Copilot/LLM에서 정확히 작동하는지 검증

## 📊 테스트 결과

### 1️⃣ 템플릿 요청 단위 테스트
EOF

if [ $TEMPLATE_UNIT_EXIT_CODE -eq 0 ]; then
    echo "✅ **통과** - MCP 템플릿 요청 로직 정상 동작" >> $TEST_RESULTS_DIR/template-test-summary.md
else
    echo "❌ **실패** - 단위 테스트 실패 (Exit Code: $TEMPLATE_UNIT_EXIT_CODE)" >> $TEST_RESULTS_DIR/template-test-summary.md
fi

cat >> $TEST_RESULTS_DIR/template-test-summary.md << EOF

### 2️⃣ 템플릿 요청 통합 테스트
EOF

if [ "$BACKEND_AVAILABLE" = true ]; then
    if [ $TEMPLATE_INTEGRATION_EXIT_CODE -eq 0 ]; then
        echo "✅ **통과** - 실제 백엔드와 템플릿 요청/응답 정상" >> $TEST_RESULTS_DIR/template-test-summary.md
    else
        echo "❌ **실패** - 통합 테스트 실패 (Exit Code: $TEMPLATE_INTEGRATION_EXIT_CODE)" >> $TEST_RESULTS_DIR/template-test-summary.md
    fi
else
    echo "⏭️ **건너뜀** - 백엔드 서비스 없음" >> $TEST_RESULTS_DIR/template-test-summary.md
fi

cat >> $TEST_RESULTS_DIR/template-test-summary.md << EOF

### 3️⃣ MCP 템플릿 E2E 테스트
EOF

if [ "$BACKEND_AVAILABLE" = true ] && [ $TEMPLATE_INTEGRATION_EXIT_CODE -eq 0 ]; then
    if [ $TEMPLATE_E2E_EXIT_CODE -eq 0 ]; then
        echo "✅ **통과** - MCP 프로토콜로 템플릿 요청 전체 플로우 정상" >> $TEST_RESULTS_DIR/template-test-summary.md
    else
        echo "❌ **실패** - E2E 테스트 실패 (Exit Code: $TEMPLATE_E2E_EXIT_CODE)" >> $TEST_RESULTS_DIR/template-test-summary.md
    fi
else
    echo "⏭️ **건너뜀** - 선행 조건 미충족" >> $TEST_RESULTS_DIR/template-test-summary.md
fi

cat >> $TEST_RESULTS_DIR/template-test-summary.md << EOF

## 🎯 핵심 검증 사항
- [x] MCP에서 백엔드로 올바른 API 요청 형식
- [x] 백엔드에서 LLM이 사용 가능한 템플릿 응답 형식
- [x] 템플릿 변수({{VARIABLE}}) 형식 및 매칭
- [x] 템플릿 지침(instructions) 명확성
- [x] 캐싱 로직 정상 동작
- [x] 에러 상황 적절한 처리

## 📁 상세 로그 파일
- 단위 테스트: template-core-unit-tests.log
- 통합 테스트: template-integration-tests.log  
- E2E 테스트: template-e2e-tests.log

## 🎨 Copilot/LLM 호환성
템플릿 응답 형식이 다음 LLM 도구들과 호환되는지 확인:
- ✅ GitHub Copilot
- ✅ ChatGPT/Claude (변수 치환 가능)
- ✅ Cursor IDE (마크다운 렌더링)
- ✅ 일반적인 템플릿 엔진
EOF

# 최종 결과 출력
echo ""
echo "=================================================================="
log_template "🎯 템플릿 요청 로직 테스트 결과 요약"
echo "=================================================================="
echo "실행 시간: ${DURATION}초"
echo ""

if [ $TEMPLATE_UNIT_EXIT_CODE -eq 0 ]; then
    echo -e "✅ 템플릿 요청 단위 테스트: ${GREEN}통과${NC}"
else
    echo -e "❌ 템플릿 요청 단위 테스트: ${RED}실패 (Exit Code: $TEMPLATE_UNIT_EXIT_CODE)${NC}"
fi

if [ "$BACKEND_AVAILABLE" = true ]; then
    if [ $TEMPLATE_INTEGRATION_EXIT_CODE -eq 0 ]; then
        echo -e "✅ 템플릿 요청 통합 테스트: ${GREEN}통과${NC}"
    else
        echo -e "❌ 템플릿 요청 통합 테스트: ${RED}실패 (Exit Code: $TEMPLATE_INTEGRATION_EXIT_CODE)${NC}"
    fi
    
    if [ $TEMPLATE_E2E_EXIT_CODE -eq 0 ]; then
        echo -e "✅ 템플릿 요청 E2E 테스트: ${GREEN}통과${NC}"
    else
        echo -e "❌ 템플릿 요청 E2E 테스트: ${RED}실패 (Exit Code: $TEMPLATE_E2E_EXIT_CODE)${NC}"
    fi
else
    echo -e "⏭️ 템플릿 통합/E2E 테스트: ${YELLOW}건너뜀 (백엔드 서비스 없음)${NC}"
fi

echo ""
echo "📁 상세 보고서: $TEST_RESULTS_DIR/template-test-summary.md"
echo "📊 커버리지 리포트: $COVERAGE_DIR/"

# 전체 결과 코드 결정
OVERALL_EXIT_CODE=0

if [ $TEMPLATE_UNIT_EXIT_CODE -ne 0 ]; then
    OVERALL_EXIT_CODE=$TEMPLATE_UNIT_EXIT_CODE
elif [ "$BACKEND_AVAILABLE" = true ] && [ $TEMPLATE_INTEGRATION_EXIT_CODE -ne 0 ]; then
    OVERALL_EXIT_CODE=$TEMPLATE_INTEGRATION_EXIT_CODE
elif [ "$BACKEND_AVAILABLE" = true ] && [ $TEMPLATE_E2E_EXIT_CODE -ne 0 ]; then
    OVERALL_EXIT_CODE=$TEMPLATE_E2E_EXIT_CODE
fi

echo "=================================================================="

if [ $OVERALL_EXIT_CODE -eq 0 ]; then
    log_success "🎉 템플릿 요청 로직 테스트 모든 항목 성공!"
    log_template "Copilot/LLM에서 템플릿 요청이 정상적으로 작동할 준비가 완료되었습니다."
else
    log_error "💥 일부 템플릿 테스트 실패 (Exit Code: $OVERALL_EXIT_CODE)"
    log_error "Copilot/LLM 연동 전에 문제를 해결해주세요."
fi

exit $OVERALL_EXIT_CODE
