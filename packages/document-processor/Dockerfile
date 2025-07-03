FROM python:3.11-slim

# 작업 디렉토리 설정
WORKDIR /app

# 시스템 의존성 설치
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Python 의존성 설치
COPY packages/document-processor/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# 소스 코드 복사
COPY packages/document-processor/ ./

# 권한 설정
RUN chmod +x *.py

# 포트 노출
EXPOSE 8080

# 헬스체크 추가
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1

# 애플리케이션 실행
CMD ["python", "app.py"] 