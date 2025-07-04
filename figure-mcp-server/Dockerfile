# Node.js 18 Alpine 이미지 사용
FROM node:18-alpine

# 작업 디렉토리 설정
WORKDIR /app

# package.json과 package-lock.json 복사
COPY package*.json ./

# prepare 스크립트 실행 방지하고 의존성 설치
RUN npm ci --ignore-scripts

# 소스 코드와 설정 파일 복사
COPY src/ ./src/
COPY tsconfig.json ./

# TypeScript 빌드
RUN npm run build

# 불필요한 dev dependencies 제거
RUN npm prune --production

# 포트 노출
EXPOSE 3000

# 서버 실행
CMD ["npm", "start"] 