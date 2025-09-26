# Figure Backend Supabase 마이그레이션 가이드

Figure Backend를 SQLite에서 Supabase (PostgreSQL)로 마이그레이션하기 위한 완전한 가이드입니다.

## 📋 목차

1. [마이그레이션 개요](#마이그레이션-개요)
2. [사전 준비사항](#사전-준비사항)
3. [Supabase 프로젝트 설정](#supabase-프로젝트-설정)
4. [데이터베이스 스키마 생성](#데이터베이스-스키마-생성)
5. [백엔드 설정 업데이트](#백엔드-설정-업데이트)
6. [데이터 마이그레이션](#데이터-마이그레이션)
7. [테스트 및 검증](#테스트-및-검증)
8. [트러블슈팅](#트러블슈팅)

---

## 마이그레이션 개요

### 🎯 목표
- SQLite 기반 Figure Backend를 Supabase (PostgreSQL) 기반으로 변경
- 기존 데이터 보존 및 마이그레이션
- 성능 향상 및 확장성 확보
- Row Level Security (RLS) 적용

### 🔄 변경사항
- **데이터베이스**: SQLite → PostgreSQL (Supabase)
- **연결 풀**: StaticPool → QueuePool
- **보안**: 기본 접근 제어 → RLS 기반 보안
- **스키마**: SQLite DDL → PostgreSQL DDL

---

## 사전 준비사항

### 필수 요구사항
- [Supabase](https://supabase.com) 계정
- Node.js 18+ (선택사항, CLI용)
- Python 3.8+
- 기존 Figure Backend 백업

### 백업 생성
```bash
# 현재 SQLite 데이터베이스 백업
cd figure-backend
cp -r data/ data_backup_$(date +%Y%m%d_%H%M%S)/
```

---

## Supabase 프로젝트 설정

### 1. 새 프로젝트 생성

1. **Supabase Dashboard 접속**
   - https://supabase.com/dashboard 방문
   - "New project" 클릭

2. **프로젝트 정보 입력**
   ```
   Name: figure-backend
   Database Password: [강력한 비밀번호 생성]
   Region: Northeast Asia (ap-northeast-1) 또는 가까운 지역 선택
   ```

3. **프로젝트 생성 대기**
   - 약 2-3분 소요
   - 생성 완료 후 대시보드로 이동

### 2. 연결 정보 확인

프로젝트 생성 후 Settings > Database에서 다음 정보 확인:

```bash
# Connection string 예시
Host: db.xxxxxxxxxxxxxxxxxxxxx.supabase.co
Database name: postgres
Port: 5432
User: postgres
```

### 3. API 키 확인

Settings > API에서 다음 키들 확인 및 저장:
- **anon key**: 익명 접근용
- **service_role key**: 관리자 접근용 (보안 주의!)

---

## 데이터베이스 스키마 생성

### 1. SQL Editor 접속
1. Supabase Dashboard에서 "SQL Editor" 선택
2. "New query" 클릭

### 2. DDL 스크립트 실행
1. `postgresql_migration.sql` 파일 내용을 SQL Editor에 복사
2. "Run" 버튼 클릭하여 실행
3. 성공 메시지 확인:
   ```
   ✅ Figure Backend PostgreSQL 마이그레이션 DDL 스크립트 실행 완료!
   ```

### 3. 생성된 테이블 확인
Table Editor에서 다음 테이블들이 생성되었는지 확인:
- `sites`
- `documents`
- `usage_logs`
- `users`
- `template_matching_rules`

---

## 백엔드 설정 업데이트

### 1. 설정 업데이트 스크립트 실행

```bash
# figure-backend 디렉토리에서 실행
cd figure-backend
python ../figure-backend-supabase-config-update.py
```

스크립트 실행 후 다음 파일들이 업데이트됩니다:
- `app/config.py` - PostgreSQL 설정 추가
- `app/infrastructure/persistence/connection.py` - PostgreSQL 연결 지원
- `requirements.txt` - psycopg2-binary 추가
- `env.supabase.example` - 환경변수 예제 생성

### 2. 패키지 설치

```bash
# PostgreSQL 드라이버 설치
pip install psycopg2-binary==2.9.9

# 또는 전체 requirements.txt 재설치
pip install -r requirements.txt
```

### 3. 환경변수 설정

#### 개발환경 (.env 또는 env.dev)
```bash
# Supabase 연결 정보 (Settings > Database에서 확인)
FIGURE_DATABASE_URL=postgresql://postgres.[ref]:[password]@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres?sslmode=require

# 또는 개별 설정
FIGURE_POSTGRES_HOST=db.xxxxxxxxxxxxxxxxxxxxx.supabase.co
FIGURE_POSTGRES_PORT=5432
FIGURE_POSTGRES_DB=postgres
FIGURE_POSTGRES_USER=postgres
FIGURE_POSTGRES_PASSWORD=your_database_password
FIGURE_POSTGRES_SSL_MODE=require

# Supabase API 키 (선택사항)
FIGURE_SUPABASE_URL=https://xxxxxxxxxxxxxxxxxxxxx.supabase.co
FIGURE_SUPABASE_ANON_KEY=your_anon_key
FIGURE_SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

#### 프로덕션 환경
```bash
# 환경변수로 설정 (더 안전함)
export FIGURE_DATABASE_URL="postgresql://postgres.[ref]:[password]@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres?sslmode=require"
```

---

## 데이터 마이그레이션

### 1. 기존 데이터 추출

SQLite에서 데이터를 추출하여 CSV 또는 JSON 형태로 변환:

```python
# data_export.py
import sqlite3
import pandas as pd
import json
from datetime import datetime

def export_sqlite_data():
    """SQLite 데이터를 CSV로 추출"""
    
    # figure.db에서 데이터 추출
    conn = sqlite3.connect('data/figure.db')
    
    # 각 테이블 데이터 추출
    tables = ['sites', 'documents', 'usage_logs', 'users', 'template_matching_rules']
    
    for table in tables:
        try:
            df = pd.read_sql_query(f"SELECT * FROM {table}", conn)
            df.to_csv(f'migration_data/{table}.csv', index=False)
            print(f"✅ {table} 데이터 추출 완료: {len(df)} 행")
        except Exception as e:
            print(f"⚠️ {table} 테이블 추출 실패: {e}")
    
    conn.close()

if __name__ == "__main__":
    import os
    os.makedirs('migration_data', exist_ok=True)
    export_sqlite_data()
```

### 2. Supabase로 데이터 임포트

#### 방법 1: Table Editor 사용 (소량 데이터)
1. Supabase Dashboard > Table Editor
2. 해당 테이블 선택
3. "Insert" > "Import data from CSV"
4. 추출한 CSV 파일 업로드

#### 방법 2: SQL 스크립트 사용 (대량 데이터)
```python
# data_import.py
import psycopg2
import pandas as pd
import os
from sqlalchemy import create_engine

def import_data_to_supabase():
    """추출한 데이터를 Supabase로 임포트"""
    
    # Supabase 연결
    database_url = os.getenv("FIGURE_DATABASE_URL")
    engine = create_engine(database_url)
    
    tables = ['sites', 'documents', 'usage_logs', 'users', 'template_matching_rules']
    
    for table in tables:
        csv_file = f'migration_data/{table}.csv'
        if os.path.exists(csv_file):
            try:
                df = pd.read_csv(csv_file)
                df.to_sql(table, engine, if_exists='append', index=False)
                print(f"✅ {table} 데이터 임포트 완료: {len(df)} 행")
            except Exception as e:
                print(f"❌ {table} 데이터 임포트 실패: {e}")
        else:
            print(f"⚠️ {csv_file} 파일을 찾을 수 없습니다.")

if __name__ == "__main__":
    import_data_to_supabase()
```

---

## 테스트 및 검증

### 1. 연결 테스트

```bash
# 백엔드 서버 시작
cd figure-backend
python -m uvicorn app.main:app --reload --port 8001
```

로그에서 다음 메시지 확인:
```
✅ Supabase PostgreSQL 연결 설정 완료
✅ 데이터베이스 연결 테스트 성공
✅ Database tables created successfully
✅ Database migrations completed successfully
```

### 2. API 테스트

```bash
# Health check
curl http://localhost:8001/health

# Sites 조회
curl http://localhost:8001/api/v1/sites/

# Documents 조회  
curl http://localhost:8001/api/v1/documents/
```

### 3. 데이터 검증

```python
# verify_migration.py
import requests
import sqlite3
from sqlalchemy import create_engine
import pandas as pd
import os

def verify_data_migration():
    """데이터 마이그레이션 검증"""
    
    # SQLite 데이터 수
    sqlite_conn = sqlite3.connect('data/figure.db')
    
    # Supabase 데이터 수
    database_url = os.getenv("FIGURE_DATABASE_URL")
    pg_engine = create_engine(database_url)
    
    tables = ['sites', 'documents', 'usage_logs', 'users']
    
    for table in tables:
        try:
            # SQLite 카운트
            sqlite_count = pd.read_sql_query(f"SELECT COUNT(*) as count FROM {table}", sqlite_conn).iloc[0]['count']
            
            # PostgreSQL 카운트
            pg_count = pd.read_sql_query(f"SELECT COUNT(*) as count FROM {table}", pg_engine).iloc[0]['count']
            
            if sqlite_count == pg_count:
                print(f"✅ {table}: SQLite({sqlite_count}) == PostgreSQL({pg_count})")
            else:
                print(f"⚠️ {table}: SQLite({sqlite_count}) != PostgreSQL({pg_count})")
                
        except Exception as e:
            print(f"❌ {table} 검증 실패: {e}")
    
    sqlite_conn.close()

if __name__ == "__main__":
    verify_data_migration()
```

---

## 트러블슈팅

### 일반적인 문제

#### 1. 연결 실패
```
❌ 데이터베이스 연결 테스트 실패: connection failed
```

**해결방법:**
- 환경변수 `FIGURE_DATABASE_URL` 확인
- Supabase 프로젝트가 활성화되어 있는지 확인
- 비밀번호에 특수문자가 있다면 URL 인코딩 적용

#### 2. SSL 인증서 오류
```
❌ SSL 인증서 오류
```

**해결방법:**
```bash
# SSL 모드 변경
FIGURE_DATABASE_URL="postgresql://...?sslmode=require"
```

#### 3. 테이블 생성 실패
```
❌ Error creating database tables: relation already exists
```

**해결방법:**
- 이미 테이블이 존재하는 경우이므로 정상
- 필요시 SQL Editor에서 `DROP TABLE` 후 재생성

#### 4. 권한 오류
```
❌ permission denied for table
```

**해결방법:**
- RLS 정책 확인
- service_role 키 사용 시 권한 확인
- 필요시 RLS 임시 비활성화:
  ```sql
  ALTER TABLE table_name DISABLE ROW LEVEL SECURITY;
  ```

### 성능 최적화

#### 1. 연결 풀 설정
```python
# connection.py에서 조정
pool_size=10,
max_overflow=20,
pool_recycle=3600
```

#### 2. 쿼리 최적화
```sql
-- 자주 사용하는 쿼리에 인덱스 추가
CREATE INDEX idx_custom ON table_name(column_name);
```

#### 3. JSONB 필드 인덱스
```sql
-- JSONB 필드 검색 최적화
CREATE INDEX idx_jsonb_gin ON table_name USING GIN(jsonb_column);
```

---

## 마이그레이션 체크리스트

### 사전 준비
- [ ] 기존 데이터 백업 완료
- [ ] Supabase 계정 생성
- [ ] 프로젝트 생성 및 연결정보 확인

### 스키마 설정
- [ ] `postgresql_migration.sql` 실행
- [ ] 테이블 생성 확인
- [ ] 인덱스 및 제약조건 확인
- [ ] RLS 정책 설정 확인

### 코드 업데이트
- [ ] 설정 업데이트 스크립트 실행
- [ ] `requirements.txt` 업데이트
- [ ] 환경변수 설정
- [ ] 의존성 패키지 설치

### 데이터 마이그레이션
- [ ] 기존 데이터 추출
- [ ] Supabase로 데이터 임포트
- [ ] 데이터 무결성 검증

### 테스트
- [ ] 연결 테스트 성공
- [ ] API 엔드포인트 테스트
- [ ] 데이터 CRUD 작업 테스트
- [ ] 성능 테스트

### 배포
- [ ] 환경변수 설정 (프로덕션)
- [ ] 서버 재시작
- [ ] 모니터링 설정
- [ ] 백업 전략 수립

---

## 추가 리소스

- [Supabase 공식 문서](https://supabase.com/docs)
- [PostgreSQL 문서](https://www.postgresql.org/docs/)
- [SQLAlchemy PostgreSQL 가이드](https://docs.sqlalchemy.org/en/14/dialects/postgresql.html)
- [psycopg2 문서](https://www.psycopg.org/docs/)

---

## 지원

마이그레이션 중 문제가 발생하면:

1. **로그 확인**: 애플리케이션 로그에서 상세한 오류 메시지 확인
2. **연결 테스트**: `python -c "from app.infrastructure.persistence.connection import db_manager"`
3. **Supabase 대시보드**: Logs & Analytics에서 데이터베이스 로그 확인
4. **백업에서 복원**: 필요시 기존 SQLite로 롤백

마이그레이션 완료 후에는 정기적인 백업 및 모니터링을 설정하여 안정적인 운영을 보장하세요.

---

**마이그레이션 완료!** 🎉

이제 Figure Backend가 Supabase PostgreSQL 기반으로 성공적으로 마이그레이션되었습니다. 확장성과 성능이 크게 향상될 것입니다.

