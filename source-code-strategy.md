# 소스코드 처리 전략

## 🎯 문제 정의
사용자가 개발 산출물 생성을 요청할 때, 어떻게 소스코드 정보를 효과적으로 수집하고 분석할 것인가?

## 🔄 하이브리드 접근법 (추천)

### 1단계: 사용자 입력 방식 다양화
```typescript
// MCP 도구 확장
interface CreateDeliverableRequest {
  site_id: string;
  deliverable_type: string;
  
  // 방법 1: 직접 코드 입력 (작은 코드용)
  source_code?: string;
  
  // 방법 2: Git 저장소 연동 (전체 프로젝트용)
  git_info?: {
    repository_url: string;
    branch?: string;
    commit_hash?: string;
    target_paths?: string[];  // 특정 파일/폴더만
  };
  
  // 방법 3: 프로젝트 메타데이터 (구조 파악용)
  project_metadata?: {
    package_json?: object;
    directory_structure?: string[];
    api_endpoints?: ApiEndpoint[];
    database_schema?: object;
  };
  
  // 방법 4: 파일 업로드 (중간 크기용)
  uploaded_files?: {
    file_name: string;
    content: string;
    file_type: string;
  }[];
}
```

### 2단계: figure-backend에서 지능적 분석
```python
class CodeAnalysisService:
    async def analyze_deliverable_request(self, request: CreateDeliverableRequest):
        analysis_context = {}
        
        # 1. 직접 코드가 있는 경우
        if request.source_code:
            analysis_context["direct_code"] = await self.analyze_code_snippet(
                request.source_code
            )
        
        # 2. Git 정보가 있는 경우
        if request.git_info:
            analysis_context["project_structure"] = await self.analyze_git_repository(
                request.git_info
            )
        
        # 3. 메타데이터가 있는 경우
        if request.project_metadata:
            analysis_context["project_metadata"] = await self.analyze_metadata(
                request.project_metadata
            )
        
        # 4. 업로드된 파일들이 있는 경우
        if request.uploaded_files:
            analysis_context["uploaded_files"] = await self.analyze_uploaded_files(
                request.uploaded_files
            )
        
        return await self.create_comprehensive_analysis(analysis_context)
```

## 🔧 구체적 구현 방안

### 방안 1: 선택적 코드 전송 (간단한 경우)
```typescript
// Cursor에서 사용자가 코드 선택 후 MCP 호출
const selectedCode = `
function calculateTotal(items) {
  return items.reduce((sum, item) => sum + item.price, 0);
}
`;

// MCP 호출
await mcp.call('create_deliverable', {
  site_id: 'ecommerce',
  deliverable_type: 'api_doc',
  source_code: selectedCode
});
```

**장점**: 간단하고 빠름
**단점**: 컨텍스트 부족, 의존성 파악 어려움
**적용**: 단일 함수, 작은 모듈 문서화

### 방안 2: Git 저장소 연동 (전체 프로젝트)
```typescript
// 사용자가 Git 정보 제공
await mcp.call('create_deliverable', {
  site_id: 'ecommerce',
  deliverable_type: 'system_architecture',
  git_info: {
    repository_url: 'https://github.com/company/ecommerce-api',
    branch: 'feature/payment-v2',
    target_paths: ['src/payment/', 'src/api/payment.ts']
  }
});
```

**백엔드 처리**:
```python
async def analyze_git_repository(self, git_info):
    # 임시 디렉토리에 clone
    repo_path = await self.clone_repository(
        git_info.repository_url, 
        git_info.branch
    )
    
    # 대상 파일들 분석
    analysis = {}
    for path in git_info.target_paths:
        files = await self.scan_directory(repo_path / path)
        analysis[path] = await self.analyze_code_files(files)
    
    # 프로젝트 구조 파악
    analysis["structure"] = await self.analyze_project_structure(repo_path)
    analysis["dependencies"] = await self.analyze_dependencies(repo_path)
    
    # 정리
    await self.cleanup_repository(repo_path)
    
    return analysis
```

**장점**: 전체 컨텍스트, 의존성 파악 가능
**단점**: 보안 이슈, 처리 시간 증가
**적용**: 시스템 아키텍처, 전체 API 문서

### 방안 3: 프로젝트 메타데이터 (구조 중심)
```typescript
// package.json, 디렉토리 구조 등 메타데이터만 전송
await mcp.call('create_deliverable', {
  site_id: 'ecommerce',
  deliverable_type: 'deployment_guide',
  project_metadata: {
    package_json: {
      name: 'ecommerce-api',
      dependencies: { express: '^4.18.0', prisma: '^4.0.0' },
      scripts: { start: 'node server.js', build: 'tsc' }
    },
    directory_structure: [
      'src/controllers/',
      'src/services/',
      'src/models/',
      'prisma/schema.prisma',
      'docker-compose.yml'
    ],
    api_endpoints: [
      { method: 'POST', path: '/api/payment', description: '결제 처리' },
      { method: 'GET', path: '/api/orders', description: '주문 조회' }
    ]
  }
});
```

**장점**: 보안 안전, 빠른 처리, 구조 파악 가능
**단점**: 실제 구현 로직 파악 어려움
**적용**: 배포 가이드, 설치 매뉴얼, 시스템 개요

### 방안 4: 파일 업로드 (중간 크기)
```typescript
// 핵심 파일들만 업로드
await mcp.call('create_deliverable', {
  site_id: 'ecommerce',
  deliverable_type: 'api_doc',
  uploaded_files: [
    {
      file_name: 'payment.controller.ts',
      content: '...',
      file_type: 'typescript'
    },
    {
      file_name: 'payment.service.ts', 
      content: '...',
      file_type: 'typescript'
    }
  ]
});
```

**장점**: 필요한 파일만 선택적 전송
**단점**: 사용자가 수동으로 파일 선택해야 함
**적용**: 특정 모듈 문서화, 코드 리뷰 문서

## 🎯 산출물 타입별 최적 전략

### API 문서
- **1순위**: 선택적 코드 전송 (컨트롤러, 라우터)
- **2순위**: 파일 업로드 (관련 서비스 파일들)
- **보완**: 프로젝트 메타데이터 (API 엔드포인트 목록)

### 시스템 아키텍처 문서
- **1순위**: Git 저장소 연동 (전체 구조 파악)
- **2순위**: 프로젝트 메타데이터 (의존성, 구조)
- **보완**: 핵심 설정 파일 업로드

### 배포 가이드
- **1순위**: 프로젝트 메타데이터 (package.json, 환경설정)
- **2순위**: 파일 업로드 (docker, 설정 파일)
- **보완**: Git 정보 (배포 스크립트)

### 코드 리뷰 문서
- **1순위**: 선택적 코드 전송 (리뷰 대상 코드)
- **2순위**: Git 정보 (변경 이력, diff)
- **보완**: 관련 테스트 파일 업로드

## 🔐 보안 고려사항

### Git 저장소 접근
```python
class SecureGitAccess:
    async def clone_repository(self, repo_url: str, branch: str):
        # 1. 허용된 저장소인지 확인
        if not await self.is_allowed_repository(repo_url):
            raise SecurityError("허용되지 않은 저장소입니다")
        
        # 2. 임시 디렉토리에 shallow clone
        temp_dir = await self.create_secure_temp_dir()
        await git.clone(repo_url, temp_dir, depth=1, branch=branch)
        
        # 3. 민감한 파일 제외
        await self.remove_sensitive_files(temp_dir)
        
        return temp_dir
    
    async def remove_sensitive_files(self, repo_path: Path):
        sensitive_patterns = [
            '*.env', '*.key', '*.pem', 
            'secrets/', 'credentials/',
            '.aws/', '.ssh/'
        ]
        
        for pattern in sensitive_patterns:
            for file_path in repo_path.glob(pattern):
                file_path.unlink()
```

### 코드 스캐닝
```python
class CodeSecurityScanner:
    async def scan_code_for_secrets(self, code: str) -> bool:
        """코드에서 민감 정보 검출"""
        secret_patterns = [
            r'api[_-]?key[_-]?=',
            r'password[_-]?=',
            r'secret[_-]?=',
            r'token[_-]?=',
            r'[A-Za-z0-9]{32,}',  # 긴 해시값
        ]
        
        for pattern in secret_patterns:
            if re.search(pattern, code, re.IGNORECASE):
                return True
        return False
```

## 🚀 구현 우선순위

1. **1단계**: 선택적 코드 전송 구현 (간단한 케이스)
2. **2단계**: 프로젝트 메타데이터 처리 (구조 파악)
3. **3단계**: 파일 업로드 기능 (중간 크기)
4. **4단계**: Git 저장소 연동 (전체 프로젝트)

이렇게 단계적으로 구현하면 다양한 상황에 대응할 수 있는 유연한 시스템을 만들 수 있습니다. 