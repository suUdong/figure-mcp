@echo off
chcp 65001 > nul

:: Figure-MCP 개발 환경 시작 스크립트 (Windows)

echo 🚀 Figure-MCP 개발 환경을 시작합니다...

:: 환경 변수 파일 체크
if not exist ".env" (
    echo ⚠️  .env 파일이 없습니다. env.example을 복사하여 .env 파일을 생성하세요.
    copy env.example .env > nul
    echo ✅ .env 파일이 생성되었습니다. 필요한 환경 변수를 설정하세요.
)

:: Docker Compose로 개발 환경 시작
echo 🐳 Docker 컨테이너를 시작합니다...
docker-compose -f docker-compose.yml -f docker-compose.override.yml up -d

echo ⏳ 서비스가 시작될 때까지 대기합니다...
timeout /t 10 /nobreak > nul

:: 헬스체크
echo 🔍 서비스 상태를 확인합니다...
docker-compose ps

echo.
echo ✅ 개발 환경이 시작되었습니다!
echo.
echo 🌐 웹 UI: http://localhost:5173
echo 🔌 MCP 서버: http://localhost:3000
echo 📊 ChromaDB: http://localhost:8000
echo 🗄️  PostgreSQL: localhost:5432
echo 🔧 Redis: localhost:6379
echo.
echo 로그를 확인하려면: docker-compose logs -f
echo 중지하려면: docker-compose down
echo.
pause 