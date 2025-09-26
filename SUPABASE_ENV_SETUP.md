# 🔑 Supabase 환경변수 설정 가이드

## 📍 **1단계: Supabase에서 키 확인**

1. **Supabase Dashboard 접속**: https://supabase.com/dashboard
2. **프로젝트 선택** → **Settings** → **API**
3. **필요한 정보 복사**:
   ```bash
   Project URL: https://YOUR_PROJECT_ID.supabase.co
   anon/public key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.YOUR_ANON_KEY
   service_role key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.YOUR_SERVICE_ROLE_KEY
   ```

4. **Database 연결 정보**: **Settings** → **Database** → **Connection parameters**
   ```bash
   Host: aws-0-ap-northeast-1.pooler.supabase.com
   Database: postgres
   Username: postgres.YOUR_PROJECT_ID
   Password: [프로젝트 생성시 설정한 비밀번호]
   ```

## 🚀 **2단계: Railway 환경변수 설정**

Railway Dashboard → 프로젝트 → Variables에서 설정:

```bash
SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.YOUR_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.YOUR_SERVICE_ROLE_KEY
SUPABASE_DB_HOST=aws-0-ap-northeast-1.pooler.supabase.com
SUPABASE_DB_NAME=postgres
SUPABASE_DB_USER=postgres.YOUR_PROJECT_ID
SUPABASE_DB_PASSWORD=YOUR_DATABASE_PASSWORD

# 기타 필수 환경변수
JWT_SECRET=your-random-jwt-secret-key
CLAUDE_API_KEY=sk-ant-api03-your-claude-key
GEMINI_API_KEY=your-gemini-api-key
REDIS_URL=redis://redis.railway.internal:6379
```

## 🏠 **3단계: 로컬 개발용 설정**

### 옵션 1: PowerShell에서 임시 설정
```powershell
# 현재 세션에서만 유효
$env:SUPABASE_URL = "https://YOUR_PROJECT_ID.supabase.co"
$env:SUPABASE_ANON_KEY = "your-anon-key"
$env:SUPABASE_SERVICE_ROLE_KEY = "your-service-role-key"
$env:SUPABASE_DB_HOST = "aws-0-ap-northeast-1.pooler.supabase.com"
$env:SUPABASE_DB_NAME = "postgres"
$env:SUPABASE_DB_USER = "postgres.YOUR_PROJECT_ID"
$env:SUPABASE_DB_PASSWORD = "your-password"

# 환경 실행
just dev-start
```

### 옵션 2: .env 파일 생성
```bash
# figure-backend/.env 파일 생성 (실제 키로 교체)
cp figure-backend/env.dev figure-backend/.env

# .env 파일 수정하여 실제 키 입력
# ${SUPABASE_URL} → https://YOUR_PROJECT_ID.supabase.co
# ${SUPABASE_SERVICE_ROLE_KEY} → 실제 키
```

## ✅ **4단계: 연결 테스트**

```bash
# dev 환경 시작
just dev-start

# Supabase 연결 테스트
curl -H "apikey: YOUR_ANON_KEY" \
     -H "Authorization: Bearer YOUR_ANON_KEY" \
     https://YOUR_PROJECT_ID.supabase.co/rest/v1/

# 응답 예시: {"message":"The resource you requested could not be found."}
```

## 🛡️ **보안 주의사항**

- **Service Role Key**: 서버 전용, 절대 클라이언트에서 사용 금지
- **Anon Key**: 공개 가능하지만 Row Level Security 설정 필수
- **Database Password**: 절대 코드에 하드코딩 금지
- **환경변수**: .env 파일은 .gitignore에 포함되어 있음

## 🔧 **문제해결**

### 연결 오류 시
```bash
# 1. 키 유효성 확인
curl -H "apikey: YOUR_KEY" https://YOUR_PROJECT_ID.supabase.co/rest/v1/

# 2. DB 연결 확인  
psql "postgresql://postgres.PROJECT_ID:PASSWORD@HOST:5432/postgres"

# 3. 환경변수 확인
echo $SUPABASE_URL
echo $SUPABASE_SERVICE_ROLE_KEY
```



