# ====================
# Dependencies Stage
# ====================
FROM node:18-alpine AS deps

# 작업 디렉토리 설정만 유지 (libc6-compat 제거)

# 작업 디렉토리 설정
WORKDIR /app

# 패키지 관리자 설정 최적화 (SSL 인증서 문제 해결)
RUN npm config set registry https://registry.npmjs.org/ && \
    npm config set fetch-retry-mintimeout 20000 && \
    npm config set fetch-retry-maxtimeout 120000 && \
    npm config set strict-ssl false

# package.json 복사 및 의존성 설치 (레이어 캐싱 최적화)
COPY package.json ./
RUN npm install --ignore-scripts && \
    npm cache clean --force

# ====================
# Build Stage
# ====================
FROM node:18-alpine AS builder

WORKDIR /app

# 의존성 복사
COPY --from=deps /app/node_modules ./node_modules

# 소스 코드 복사
COPY . .

# public 디렉토리가 없으면 생성
RUN mkdir -p ./public

# 환경 변수 설정
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Next.js 빌드
RUN npm run build

# ====================
# Production Stage
# ====================
FROM node:18-alpine AS production

# 보안을 위한 non-root 사용자 생성
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 --ingroup nodejs nextjs

# 작업 디렉토리 설정
WORKDIR /app

# 환경 변수 설정
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3001
ENV HOSTNAME="0.0.0.0"

# 필요한 파일들만 복사
COPY --from=builder /app/next.config.js ./
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json

# Next.js 빌드 결과물 복사
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# 사용자 전환
USER nextjs

# 포트 노출
EXPOSE 3001

# 헬스체크 추가
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3001', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) }).on('error', () => { process.exit(1) })" || exit 1

# 애플리케이션 실행
CMD ["node", "server.js"] 