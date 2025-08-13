# 웹 애플리케이션 배포 가이드

## 프로젝트 정보
- **프로젝트명**: E-Commerce Web Application
- **버전**: v2.1.0
- **환경**: Production
- **작성일**: 2024-08-13

## 사전 요구사항
- [ ] Node.js 18.x 이상
- [ ] Docker & Docker Compose
- [ ] PostgreSQL 14.x
- [ ] Redis 7.x

## 배포 환경 설정

### 1. 환경 변수 설정
```bash
# 환경 변수 파일 (.env)
NODE_ENV=production
DATABASE_URL=postgresql://user:password@localhost:5432/ecommerce
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-super-secret-jwt-key
API_PORT=3000
```

### 2. 의존성 설치
```bash
# Node.js 프로젝트
npm install --production

# Docker 환경
docker-compose build
```

## 배포 단계

### 단계 1: 코드 준비
```bash
# 1. 최신 코드 가져오기
git pull origin main

# 2. 빌드 실행
npm run build

# 3. 테스트 실행
npm run test:prod
```

### 단계 2: 배포 실행
```bash
# 배포 명령어
docker-compose up -d

# 서비스 시작
systemctl start ecommerce-app

# 상태 확인
docker-compose ps
```

### 단계 3: 배포 검증
- [ ] 서비스 상태 확인: `https://api.ecommerce.com/health`
- [ ] 로그 확인: `docker-compose logs -f app`
- [ ] 기능 테스트: 주요 API 엔드포인트 테스트

## 롤백 절차
```bash
# 1. 이전 버전으로 롤백
git checkout v2.0.0
docker-compose down
docker-compose up -d

# 2. 서비스 재시작
systemctl restart ecommerce-app

# 3. 상태 확인
curl -f https://api.ecommerce.com/health
```

## 모니터링
- **로그 위치**: `/var/log/ecommerce/app.log`
- **메트릭 대시보드**: https://monitoring.ecommerce.com/grafana
- **알림 설정**: Slack #alerts 채널

## 트러블슈팅

### 일반적인 문제
1. **데이터베이스 연결 실패**
   - 원인: 잘못된 데이터베이스 URL 또는 네트워크 문제
   - 해결: 환경변수 확인 및 네트워크 연결 상태 점검

2. **메모리 부족 오류**
   - 원인: 높은 트래픽으로 인한 메모리 사용량 증가
   - 해결: 인스턴스 스케일업 또는 로드밸런서 설정

### 긴급 연락처
- **개발팀**: dev-team@company.com
- **운영팀**: ops-team@company.com
- **매니저**: manager@company.com
