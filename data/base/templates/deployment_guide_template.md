# 배포 가이드 템플릿

## 프로젝트 정보
- **프로젝트명**: {project_name}
- **버전**: {version}
- **환경**: {environment}
- **작성일**: {date}

## 사전 요구사항
- [ ] {requirement_1}
- [ ] {requirement_2}
- [ ] {requirement_3}

## 배포 환경 설정

### 1. 환경 변수 설정
```bash
# 환경 변수 파일 (.env)
{env_var_1}={env_value_1}
{env_var_2}={env_value_2}
{env_var_3}={env_value_3}
```

### 2. 의존성 설치
```bash
# Node.js 프로젝트
npm install

# Python 프로젝트
pip install -r requirements.txt

# Docker 환경
docker-compose build
```

## 배포 단계

### 단계 1: 코드 준비
```bash
# 1. 최신 코드 가져오기
git pull origin {branch_name}

# 2. 빌드 실행
{build_command}

# 3. 테스트 실행
{test_command}
```

### 단계 2: 배포 실행
```bash
# 배포 명령어
{deploy_command}

# 서비스 시작
{start_command}

# 상태 확인
{status_command}
```

### 단계 3: 배포 검증
- [ ] 서비스 상태 확인: `{health_check_url}`
- [ ] 로그 확인: `{log_command}`
- [ ] 기능 테스트: {functional_test}

## 롤백 절차
```bash
# 1. 이전 버전으로 롤백
{rollback_command}

# 2. 서비스 재시작
{restart_command}

# 3. 상태 확인
{verify_command}
```

## 모니터링
- **로그 위치**: {log_path}
- **메트릭 대시보드**: {monitoring_url}
- **알림 설정**: {alert_config}

## 트러블슈팅

### 일반적인 문제
1. **{problem_1}**
   - 원인: {cause_1}
   - 해결: {solution_1}

2. **{problem_2}**
   - 원인: {cause_2}
   - 해결: {solution_2}

### 긴급 연락처
- **개발팀**: {dev_contact}
- **운영팀**: {ops_contact}
- **매니저**: {manager_contact}
