FROM node:18-alpine AS builder

# 작업 디렉토리 설정
WORKDIR /app

# 의존성 설치를 위한 package.json 복사
COPY package.json ./
COPY lerna.json ./
COPY packages/web-ui/package.json ./packages/web-ui/

# 의존성 설치
RUN npm install --frozen-lockfile

# 소스 코드 복사
COPY tsconfig.json ./
COPY packages/web-ui/ ./packages/web-ui/

# 빌드
WORKDIR /app/packages/web-ui
RUN npm run build

# 프로덕션 단계
FROM nginx:alpine

# 빌드된 파일 복사
COPY --from=builder /app/packages/web-ui/dist /usr/share/nginx/html

# Nginx 설정 복사
COPY packages/web-ui/nginx.conf /etc/nginx/nginx.conf

# 포트 노출
EXPOSE 80

# 헬스체크 추가
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost/ || exit 1

# Nginx 실행
CMD ["nginx", "-g", "daemon off;"] 