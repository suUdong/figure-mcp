#!/bin/sh

echo "🚀 Figure Backend Office 시작..."

# Next.js 개발 서버를 백그라운드에서 시작
echo "📦 Next.js 개발 서버 시작 중..."
npm run dev &
SERVER_PID=$!

# 워밍업 스크립트 조건부 실행 (메모리 절약)
if [ "$ENABLE_WARMUP" = "true" ]; then
    echo "🔥 페이지 워밍업 스크립트 백그라운드 실행..."
    (sleep 3 && npm run warmup) &
    WARMUP_PID=$!
else
    echo "⚡ 워밍업 스크립트 비활성화 (메모리 절약 모드)"
    WARMUP_PID=""
fi

# 시그널 핸들러 설정 (graceful shutdown)
trap 'echo "🛑 서버 종료 중..."; kill $SERVER_PID 2>/dev/null; [ -n "$WARMUP_PID" ] && kill $WARMUP_PID 2>/dev/null; exit 0' TERM INT

# 서버 프로세스가 실행 중인 동안 대기
wait $SERVER_PID 