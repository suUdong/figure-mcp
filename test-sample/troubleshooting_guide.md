# 시스템 문제 해결 가이드

## 일반적인 문제 및 해결 방법

### 1. 서버 연결 문제

#### 증상
- 502 Bad Gateway 에러
- 연결 타임아웃 발생
- 간헐적인 서비스 중단

#### 해결 방법
1. **서버 상태 확인**
   ```bash
   systemctl status nginx
   systemctl status app-service
   ```

2. **로그 확인**
   ```bash
   tail -f /var/log/nginx/error.log
   tail -f /var/log/app/application.log
   ```

3. **프로세스 재시작**
   ```bash
   sudo systemctl restart nginx
   sudo systemctl restart app-service
   ```

### 2. 데이터베이스 성능 저하

#### 증상
- 쿼리 응답 시간 증가
- 커넥션 풀 고갈
- 데드락 발생

#### 해결 방법
1. **쿼리 성능 분석**
   ```sql
   EXPLAIN ANALYZE SELECT * FROM users WHERE email = 'user@example.com';
   ```

2. **인덱스 최적화**
   ```sql
   CREATE INDEX idx_users_email ON users(email);
   CREATE INDEX idx_orders_created_at ON orders(created_at);
   ```

3. **커넥션 풀 설정 조정**
   ```properties
   db.pool.initial-size=5
   db.pool.max-size=20
   db.pool.max-wait=30000
   ```

### 3. 메모리 누수 문제

#### 증상
- 메모리 사용량 지속적 증가
- OutOfMemoryError 발생
- 시스템 성능 저하

#### 해결 방법
1. **메모리 사용량 모니터링**
   ```bash
   free -h
   ps aux --sort=-%mem | head -10
   ```

2. **힙 덤프 분석**
   ```bash
   jmap -dump:format=b,file=heapdump.bin <pid>
   ```

3. **GC 설정 최적화**
   ```bash
   -XX:+UseG1GC -XX:MaxGCPauseMillis=200
   -Xms2g -Xmx4g
   ```

### 4. 네트워크 문제

#### 증상
- 패킷 손실 발생
- 높은 레이턴시
- 간헐적 연결 끊김

#### 해결 방법
1. **네트워크 연결성 테스트**
   ```bash
   ping -c 4 target-server.com
   traceroute target-server.com
   netstat -tuln
   ```

2. **방화벽 설정 확인**
   ```bash
   iptables -L -n
   ufw status
   ```

3. **DNS 문제 해결**
   ```bash
   nslookup target-server.com
   dig target-server.com
   ```

## 응급 상황 대응 절차

### 1. 서비스 장애 발생 시
1. **즉시 확인 사항**
   - 서비스 상태 페이지 확인
   - 모니터링 대시보드 체크
   - 최근 배포 이력 검토

2. **1차 대응**
   - 로드밸런서에서 문제 서버 제외
   - 백업 서버로 트래픽 라우팅
   - 관련 팀에 알림 발송

3. **문제 해결**
   - 로그 분석 및 원인 파악
   - 임시 해결책 적용
   - 서비스 복구 확인

### 2. 데이터 손실 발생 시
1. **즉시 조치**
   - 데이터베이스 백업 중단
   - 추가 손실 방지 조치
   - 백업 데이터 무결성 확인

2. **복구 작업**
   - 최신 백업에서 데이터 복원
   - 트랜잭션 로그 재적용
   - 데이터 일관성 검증

### 3. 보안 사고 발생 시
1. **초기 대응**
   - 의심스러운 활동 차단
   - 관련 계정 일시 정지
   - 보안팀에 즉시 보고

2. **조사 및 복구**
   - 로그 분석 및 침입 경로 파악
   - 취약점 패치 적용
   - 보안 정책 재검토

## 예방적 유지보수

### 정기 점검 항목
- [ ] 서버 리소스 사용률 확인
- [ ] 디스크 공간 확인 및 정리
- [ ] 로그 파일 순환 및 보관
- [ ] 보안 패치 적용
- [ ] 백업 데이터 검증
- [ ] 모니터링 시스템 점검

### 성능 최적화
- 쿼리 성능 분석 및 개선
- 캐시 적중률 향상
- 네트워크 대역폭 최적화
- 코드 프로파일링 및 최적화 