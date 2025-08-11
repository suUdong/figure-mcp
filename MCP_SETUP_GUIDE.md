# 🔧 Figure MCP 설정 가이드

## 📋 **1단계: 환경 확인**

### ✅ **준비 완료된 항목들**
- [x] Figure MCP 서버 빌드 완료 (`figure-mcp/dist/figure-mcp-server.js`)
- [x] 백엔드 서비스 실행 중 (http://localhost:8001)
- [x] MCP 설정 파일 준비 완료 (`.cursor/mcp_servers.json`)
- [x] 영향도 분석 템플릿 등록 완료

## 🎯 **2단계: Cursor IDE MCP 활성화**

### **Cursor IDE에서 다음 단계를 따르세요:**

#### 1️⃣ **Cursor 설정 열기**
```
Ctrl + , (또는 Cmd + ,) → Settings
```

#### 2️⃣ **MCP 기능 활성화**
- **Settings** → **Extensions** → **MCP** 검색
- **"Model Context Protocol"** 확장 설치 및 활성화

#### 3️⃣ **MCP 서버 설정 적용**
- **Settings** → **MCP Servers**에서 설정 파일 경로 지정:
```
C:\workspace\ds\figure-mcp\figure-mcp\.cursor\mcp_servers.json
```

## 🚀 **3단계: MCP 서버 실행 확인**

### **백엔드 서비스 상태 확인:**
```powershell
# 현재 디렉토리에서 실행
docker-compose ps
```

**예상 결과:**
```
figure-mcp-figure-backend-1          Up (healthy)    0.0.0.0:8001->8001/tcp
figure-mcp-chroma-1                  Up              0.0.0.0:8000->8000/tcp  
figure-mcp-figure-backend-office-1   Up (healthy)    0.0.0.0:3001->3001/tcp
```

### **MCP 서버 수동 테스트:**
```powershell
# MCP 서버 직접 실행 테스트
cd figure-mcp
node dist/figure-mcp-server.js
```

## 💬 **4단계: Cursor에서 MCP 도구 사용**

### **채팅에서 사용 가능한 명령어들:**

#### 🎯 **영향도 분석서 생성 (핵심 기능)**
```
@figure-mcp create_impact_analysis featureName="ABC 기능" analysisType="full"
```

#### 📋 **템플릿만 필요한 경우**
```
@figure-mcp create_impact_analysis featureName="XYZ 기능" analysisType="template-only"
```

#### 🏢 **사용 가능한 사이트 조회**
```
@figure-mcp list_available_sites
```

## 🎭 **5단계: 실제 사용 시나리오**

### **시나리오: 결제 서비스 리팩토링 영향도 분석**

#### **1단계: Cursor 채팅에서 명령 실행**
```
@figure-mcp create_impact_analysis 
featureName="결제 서비스 리팩토링" 
siteName="KT알파" 
analysisType="full"
```

#### **2단계: 자동 생성된 리포트 확인**
- 🎯 전체 위험도 평가
- 📊 영향 받는 컴포넌트 목록
- ⚠️ 식별된 리스크 요소
- 🧪 권장 테스트 범위
- 🚀 배포 권장사항

## ⚡ **6단계: 트러블슈팅**

### **문제 1: MCP 서버 연결 실패**
```powershell
# 백엔드 서비스 재시작
docker-compose restart figure-backend

# MCP 서버 설정 확인
type .cursor\mcp_servers.json
```

### **문제 2: Node.js 경로 문제**
```powershell
# Node.js 설치 확인
node --version
npm --version

# 경로 확인
where node
```

### **문제 3: 포트 충돌**
```powershell
# 포트 사용 상태 확인
netstat -an | findstr 8001
```

## 🎉 **성공 확인 방법**

### **✅ MCP 연동 성공 신호들:**
1. Cursor 채팅에서 `@figure-mcp` 자동완성 표시
2. 도구 목록에 2개 MCP 도구 표시:
   - `create_impact_analysis`
   - `list_available_sites`
3. 명령 실행 시 실제 분석 결과 반환

### **📊 예상 결과 예시:**
```
✅ ABC 기능 - 영향도 분석서 (자동 생성)

📋 분석 개요
- 🏢 대상 사이트: KT알파
- 📁 프로젝트: C:\workspace\ds\figure-mcp\figure-mcp
- ⏰ 분석 시간: 2025-08-11 16:45:30
- 🚀 처리 시간: 1250ms
- 📊 분석 타입: 완전 분석

🟡 종합 위험도: 보통

🔍 프로젝트 분석 결과
- 📄 분석된 파일: 45개
- 🔄 순환 의존성: ✅ 없음
- 📈 복잡도 지수: 중간

🐳 서비스 상태
- figure-backend: ✅ running (Port 8001)
- figure-backend-office: ✅ running (Port 3001)
- redis: ✅ running (Port 6379)
- chroma: ⚠️ unhealthy (Port 8000)
```

---

## 💡 **팁 & 베스트 프랙티스**

### **🔥 자주 사용하는 명령어:**
```
# 1. 완전한 영향도 분석
@figure-mcp create_impact_analysis featureName="새로운 기능" analysisType="full"

# 2. 빠른 템플릿 조회
@figure-mcp create_impact_analysis featureName="기능명" analysisType="template-only"

# 3. 사이트 목록 확인
@figure-mcp list_available_sites
```

### **📋 효율적인 워크플로우:**
1. **기능명 준비**: 분석하고자 하는 기능의 명확한 이름
2. **완전 분석 실행**: `analysisType="full"`로 종합 분석
3. **템플릿 활용**: 필요시 `template-only`로 빠른 템플릿 조회
4. **결과 검토**: 자동 생성된 분석서 내용 확인 및 보완

---

**🎊 축하합니다! 이제 Cursor IDE에서 간단한 명령어로 완전한 영향도 분석서를 생성할 수 있습니다!**
