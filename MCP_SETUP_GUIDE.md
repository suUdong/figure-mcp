# 🔧 Cursor IDE MCP 연동 가이드

## 📋 **1단계: 환경 확인**

### ✅ **준비 완료된 항목들**
- [x] Figure-MCP 서버 빌드 완료 (`figure-mcp-server/dist/server.js`)
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
cd figure-mcp-server
node dist/server.js
```

## 💬 **4단계: Cursor에서 MCP 도구 사용**

### **채팅에서 사용 가능한 명령어들:**

#### 🎯 **영향도 분석 템플릿 가져오기**
```
@figure-mcp use_design_figure sitename="backend" jiraTicketId="SHOP-123" format="documentation"
```

#### 🔍 **메서드 의존성 분석**
```
@figure-mcp method_dependency_matrix projectPath="C:\workspace\ds\figure-mcp\figure-mcp" language="python" targetClass="CodeAnalysisService"
```

#### 📊 **영향도 점수 계산**
```
@figure-mcp impact_score_calculation projectPath="C:\workspace\ds\figure-mcp\figure-mcp" targetFiles=["figure-backend/app/services/payment.py"] language="python" changeType="modify"
```

#### 📋 **종합 영향도 분석 리포트**
```
@figure-mcp comprehensive_impact_report projectPath="C:\workspace\ds\figure-mcp\figure-mcp" changeDescription="PaymentService 리팩토링" targetModules=["figure-backend/app/services/payment.py"] language="python" includeDatabase=true databaseType="sqlite"
```

#### 🗄️ **데이터베이스 스키마 분석**
```
@figure-mcp table_schema databaseType="sqlite" schemaFile="figure-backend/data/figure.db"
```

#### 🔄 **순환 의존성 탐지**
```
@figure-mcp circular_dependency_detection projectPath="C:\workspace\ds\figure-mcp\figure-mcp" language="python" maxDepth=10
```

## 🎭 **5단계: 실제 사용 시나리오**

### **시나리오: 결제 서비스 리팩토링 영향도 분석**

#### **1단계: JIRA 티켓 정보 입력**
```
JIRA 티켓: SHOP-456
제목: 결제 서비스 리팩토링  
설명: PaymentService 클래스 성능 최적화
대상 파일: payment_service.py, payment_model.py
```

#### **2단계: Cursor 채팅에서 명령 실행**
```
@figure-mcp comprehensive_impact_report 
projectPath="C:\workspace\ds\figure-mcp\figure-mcp" 
changeDescription="SHOP-456: PaymentService 클래스 성능 최적화" 
targetModules=["app/services/payment_service.py", "app/models/payment_model.py"] 
language="python" 
includeDatabase=true 
databaseType="sqlite"
```

#### **3단계: 자동 생성된 리포트 확인**
- 🎯 전체 위험도 평가
- 📊 영향 받는 컴포넌트 목록
- ⚠️ 식별된 리스크 요소
- 🧪 권장 테스트 범위
- 🚀 배포 권장사항

#### **4단계: 영향도 분석서 템플릿 적용**
```
@figure-mcp use_design_figure 
sitename="backend" 
jiraTicketId="SHOP-456" 
format="documentation"
```

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
2. 도구 목록에 6개 MCP 도구 표시:
   - `use_design_figure`
   - `method_dependency_matrix`
   - `table_schema`
   - `circular_dependency_detection`
   - `impact_score_calculation`
   - `comprehensive_impact_report`
3. 명령 실행 시 실제 분석 결과 반환

### **📊 예상 결과 예시:**
```
✅ 종합 영향도 분석 리포트

📊 변경 개요
- 프로젝트: C:\workspace\ds\figure-mcp\figure-mcp
- 변경 내용: SHOP-456: PaymentService 클래스 성능 최적화
- 대상 모듈: app/services/payment_service.py, app/models/payment_model.py
- 언어: python
- 분석 일시: 2025-08-04 15:56:27

🟡 종합 위험도: 보통

### 🔍 영향도 분석 결과:
- 📈 종합 점수: 65/100
- 🔗 의존성 영향: 중간
- 📏 복잡도 영향: 높음
- 👥 사용자 영향: 낮음

### 🎯 영향 받는 컴포넌트:
- PaymentProcessor: 높음 (핵심 결제 로직)
- OrderService: 보통 (결제 완료 후 처리)
- NotificationService: 낮음 (결제 알림)

### ⚠️ 주요 리스크:
1. 성능: 결제 처리 시간 변경으로 인한 타임아웃 (중간)
2. 호환성: 기존 API 호출 방식 변경 (낮음)
3. 데이터: 결제 로그 형식 변경 (낮음)

### 🧪 권장 테스트 범위:
- 결제 프로세스 전체 통합 테스트
- 성능 부하 테스트 (결제량 기준)
- API 호환성 테스트
- 장애 복구 시나리오 테스트

### 🚀 배포 권장사항:
- 단계적 배포 (10% → 50% → 100%)
- 실시간 모니터링 필수
- 즉시 롤백 계획 준비
- 피크 시간 외 배포 권장
```

---

## 💡 **팁 & 베스트 프랙티스**

### **🔥 자주 사용하는 조합 명령어:**
```
# 1. 먼저 종합 분석 수행
@figure-mcp comprehensive_impact_report ...

# 2. 세부 의존성 확인
@figure-mcp method_dependency_matrix ...

# 3. 최종 문서 템플릿 적용
@figure-mcp use_design_figure ...
```

### **📋 효율적인 워크플로우:**
1. **JIRA 티켓 정보 준비**
2. **종합 영향도 분석 실행**  
3. **세부 분석 도구로 심화 분석**
4. **템플릿 기반 문서 자동 생성**
5. **검토 및 승인 프로세스**

---

**🎊 축하합니다! 이제 Cursor IDE에서 완전 자동화된 영향도 분석을 사용할 수 있습니다!**