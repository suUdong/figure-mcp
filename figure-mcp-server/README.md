# Figure-MCP Server

개발 표준 기반 자동 산출물 생성을 위한 **Model Context Protocol (MCP) 서버**입니다.

## 🚀 개요

Figure-MCP Server는 Cursor, Claude Desktop 등의 AI 도구와 연동하여 개발 표준을 기반으로 한 산출물을 자동으로 생성합니다.

### 주요 기능

- 🎯 **use_design_figure**: Jira 티켓 기반 산출물 생성
- 📋 **list_sites**: 등록된 사이트 목록 조회  
- 📄 **upload_document**: 개발 표준 문서 업로드
- ⏳ **get_job_status**: 작업 진행상태 조회

## 📦 설치 및 실행

### 사전 요구사항

- Node.js 18+

### 1. 설치

```bash
npm install
```

### 2. 빌드

```bash
npm run build
```

### 3. 실행

```bash
npm start
```

## 🔧 AI 도구 연동

### Cursor에서 사용

Cursor 설정에서 MCP 서버 추가:
```json
{
  "mcpServers": {
    "figure-mcp": {
      "command": "node",
      "args": ["/path/to/figure-mcp-server/dist/server.js"]
    }
  }
}
```

### Claude Desktop에서 사용

`claude_desktop_config.json` 설정:
```json
{
  "mcpServers": {
    "figure-mcp": {
      "command": "node",
      "args": ["/path/to/figure-mcp-server/dist/server.js"]
    }
  }
}
```

## 🛠️ 개발

### 개발 서버 실행

```bash
npm run dev
```

### 빌드 정리

```bash
npm run clean
```

## 📋 환경 변수

| 변수명 | 설명 | 기본값 |
|--------|------|--------|
| `LOG_LEVEL` | 로그 레벨 | `info` |
| `NODE_ENV` | 실행 환경 | `development` |

## 📄 라이선스

MIT License

## 🔗 관련 링크

- [MCP Specification](https://modelcontextprotocol.io/)
- [Cursor MCP Guide](https://docs.cursor.com/mcp) 