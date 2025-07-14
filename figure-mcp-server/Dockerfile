# ====================
# Build Stage
# ====================
FROM node:18-alpine AS builder

# 작업 디렉토리 설정
WORKDIR /app

# 패키지 관리자 설정 최적화 (SSL 인증서 문제 해결)
RUN npm config set registry https://registry.npmjs.org/ && \
    npm config set fetch-retry-mintimeout 20000 && \
    npm config set fetch-retry-maxtimeout 120000 && \
    npm config set strict-ssl false

# package.json 복사 및 의존성 설치 (레이어 캐싱 최적화)
COPY package.json ./
RUN npm install --ignore-scripts

# 소스 코드 복사
COPY src/ ./src/
COPY tsconfig.json ./

# TypeScript 빌드
RUN npm run build

# ====================
# Production Stage
# ====================
FROM node:18-alpine AS production

# 보안을 위한 non-root 사용자 생성
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 --ingroup nodejs nodejs

# 작업 디렉토리 설정
WORKDIR /app

# 패키지 관리자 설정 최적화 (SSL 인증서 문제 해결)
RUN npm config set registry https://registry.npmjs.org/ && \
    npm config set strict-ssl false

# package.json 복사 및 프로덕션 의존성만 설치
COPY package.json ./
RUN npm install --omit=dev --ignore-scripts && \
    npm cache clean --force

# 빌드된 파일 복사
COPY --from=builder /app/dist ./dist

# 파일 소유권 변경
RUN chown -R nodejs:nodejs /app
USER nodejs

# 포트 노출
EXPOSE 3000

# 헬스체크 추가
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) }).on('error', () => { process.exit(1) })" || exit 1

# 서버 실행
CMD ["npm", "start"] 