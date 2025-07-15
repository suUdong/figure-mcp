# ====================
# Build Stage
# ====================
FROM python:3.11-slim AS builder

# 빌드 의존성 설치
RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# 작업 디렉토리 설정
WORKDIR /app

# Python 의존성 설치
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

RUN pip install debugpy

# ====================
# Production Stage
# ====================
FROM python:3.11-slim AS production

# 런타임 의존성만 설치
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get autoremove -y \
    && apt-get clean

# 보안을 위한 non-root 사용자 생성
RUN adduser --system --no-create-home --shell /bin/false --group --disabled-password appuser

# 작업 디렉토리 설정
WORKDIR /app

# Python 패키지 복사
COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

# 애플리케이션 코드 복사
COPY app/ ./app/

# 데이터 디렉토리 생성 및 권한 설정
RUN mkdir -p /app/data/chroma /app/logs /app/storage && \
    chown -R appuser:appuser /app

# 사용자 전환
USER appuser

# 포트 노출
EXPOSE 8001

# 헬스체크 (사용자 권한으로 실행)
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8001/health')" || exit 1

# 애플리케이션 실행
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001"] 