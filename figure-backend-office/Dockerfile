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

# 포트 노출
EXPOSE 3001

# 개발 서버 실행
CMD ["npm", "run", "dev"] 