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

# 엔트리포인트 스크립트 복사 및 실행 권한 부여
COPY docker-entrypoint.sh /usr/local/bin/
COPY scripts/ ./scripts/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# 포트 노출
EXPOSE 3001

# 엔트리포인트 설정 (워밍업 포함)
ENTRYPOINT ["docker-entrypoint.sh"] 