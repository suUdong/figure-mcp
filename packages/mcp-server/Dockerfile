FROM node:18-alpine

# 작업 디렉토리 설정
WORKDIR /app

# 의존성 설치를 위한 package.json 복사
COPY package.json ./
COPY lerna.json ./
COPY packages/mcp-server/package.json ./packages/mcp-server/
COPY packages/rag-engine/package.json ./packages/rag-engine/
COPY packages/integrations/package.json ./packages/integrations/

# 의존성 설치
RUN npm install --frozen-lockfile

# 소스 코드 복사
COPY tsconfig.json ./
COPY packages/mcp-server/ ./packages/mcp-server/
COPY packages/rag-engine/ ./packages/rag-engine/
COPY packages/integrations/ ./packages/integrations/

# TypeScript 컴파일
RUN npm run build

# 포트 노출
EXPOSE 3000

# 헬스체크 추가
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# 애플리케이션 실행
CMD ["npm", "start"] 