# Development Dockerfile for Figure Backend Office
FROM node:18-alpine

# 작업 디렉토리 설정
WORKDIR /app

# 패키지 관리자 설정
RUN npm config set registry https://registry.npmjs.org/ && \
    npm config set fetch-retry-mintimeout 20000 && \
    npm config set fetch-retry-maxtimeout 120000

# 환경 변수 설정
ENV NODE_ENV=development
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3001
ENV HOSTNAME="0.0.0.0"

# package.json 복사 및 의존성 설치
COPY package.json ./
RUN npm install

# 스크립트 디렉토리 복사 (존재하는 경우)
COPY scripts/ ./scripts/

# 엔트리포인트 스크립트 복사 및 권한 설정 (존재하는 경우)
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# 조건부 엔트리포인트 스크립트 생성 (중복 실행 방지)
RUN echo '#!/bin/sh' > /usr/local/bin/conditional-entrypoint.sh && \
    echo 'echo "🔍 엔트리포인트 파일 확인 중..."' >> /usr/local/bin/conditional-entrypoint.sh && \
    echo 'if [ -f "/usr/local/bin/docker-entrypoint.sh" ] && [ -x "/usr/local/bin/docker-entrypoint.sh" ]; then' >> /usr/local/bin/conditional-entrypoint.sh && \
    echo '  echo "🚀 docker-entrypoint.sh 파일을 찾았습니다. 실행합니다..."' >> /usr/local/bin/conditional-entrypoint.sh && \
    echo '  # Windows 줄바꿈 문자 제거 (CRLF → LF)' >> /usr/local/bin/conditional-entrypoint.sh && \
    echo '  sed -i "s/\r$//" /usr/local/bin/docker-entrypoint.sh' >> /usr/local/bin/conditional-entrypoint.sh && \
    echo '  exec /usr/local/bin/docker-entrypoint.sh "$@"' >> /usr/local/bin/conditional-entrypoint.sh && \
    echo 'else' >> /usr/local/bin/conditional-entrypoint.sh && \
    echo '  echo "⚠️  docker-entrypoint.sh 파일을 찾을 수 없습니다. 기본 모드로 시작합니다."' >> /usr/local/bin/conditional-entrypoint.sh && \
    echo '  echo "📦 기본 Next.js 개발 서버를 시작합니다..."' >> /usr/local/bin/conditional-entrypoint.sh && \
    echo '  trap '\''echo "🛑 서버 종료 중..."; kill $SERVER_PID 2>/dev/null; exit 0'\'' TERM INT' >> /usr/local/bin/conditional-entrypoint.sh && \
    echo '  npm run dev &' >> /usr/local/bin/conditional-entrypoint.sh && \
    echo '  SERVER_PID=$!' >> /usr/local/bin/conditional-entrypoint.sh && \
    echo '  wait $SERVER_PID' >> /usr/local/bin/conditional-entrypoint.sh && \
    echo 'fi' >> /usr/local/bin/conditional-entrypoint.sh && \
    chmod +x /usr/local/bin/conditional-entrypoint.sh

# 포트 노출
EXPOSE 3001

# 조건부 엔트리포인트 설정
ENTRYPOINT ["/usr/local/bin/conditional-entrypoint.sh"] 