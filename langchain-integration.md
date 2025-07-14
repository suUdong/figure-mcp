# LangChain 기반 figure-backend 설계

## 🎯 LangChain 통합 목적
- 다양한 LLM 제공자를 유연하게 활용
- RAG 파이프라인의 체계적 구성
- 복잡한 워크플로우를 체인으로 관리
- 도구와 에이전트의 통합 관리

## 🔗 주요 LangChain 컴포넌트

### 1. LLM 프로바이더 관리
```python
from langchain.llms import OpenAI, AzureOpenAI
from langchain.chat_models import ChatOpenAI, ChatAnthropic
from langchain.llms import Ollama  # 로컬 LLM

class LLMManager:
    def __init__(self):
        self.providers = {
            "openai": ChatOpenAI(model="gpt-4"),
            "claude": ChatAnthropic(model="claude-3-sonnet-20240229"),
            "azure": AzureOpenAI(deployment_name="gpt-4"),
            "local": Ollama(model="llama2")  # 로컬 LLM
        }
    
    def get_llm(self, provider: str, task_type: str):
        """작업 타입에 따라 최적의 LLM 선택"""
        if task_type == "requirements_analysis":
            return self.providers["claude"]  # 긴 문서 분석에 좋음
        elif task_type == "code_analysis":
            return self.providers["openai"]   # 코드 이해에 좋음
        elif task_type == "summarization":
            return self.providers["local"]    # 비용 절약
        else:
            return self.providers["openai"]   # 기본값
```

### 2. 커스텀 도구 (Tools) 구현
```python
from langchain.tools import BaseTool
from typing import Optional, Type
from pydantic import BaseModel, Field

class JiraTicketTool(BaseTool):
    name = "jira_ticket_fetcher"
    description = "JIRA 티켓 정보를 가져오는 도구"
    
    def _run(self, ticket_id: str) -> str:
        """JIRA API를 통해 티켓 정보 수집"""
        ticket_info = fetch_jira_ticket(ticket_id)
        return f"티켓 {ticket_id}: {ticket_info['summary']}\n설명: {ticket_info['description']}"

class VectorSearchTool(BaseTool):
    name = "vector_search"
    description = "사이트별 표준문서에서 관련 내용을 검색하는 도구"
    
    def _run(self, query: str, site_id: str, top_k: int = 5) -> str:
        """Vector DB에서 유사도 검색"""
        results = vector_search(site_id, query, top_k)
        return format_search_results(results)

class TemplateTool(BaseTool):
    name = "template_fetcher"
    description = "문서 타입별 템플릿을 가져오는 도구"
    
    def _run(self, site_id: str, doc_type: str) -> str:
        """템플릿 데이터베이스에서 템플릿 조회"""
        template = get_template(site_id, doc_type)
        return template["content"]
```

### 3. 체인 (Chains) 구현

#### 요구사항 정의서 체인
```python
from langchain.chains import LLMChain
from langchain.prompts import PromptTemplate
from langchain.agents import initialize_agent, AgentType

class RequirementsChain:
    def __init__(self, llm_manager: LLMManager):
        self.llm = llm_manager.get_llm("claude", "requirements_analysis")
        self.tools = [
            JiraTicketTool(),
            VectorSearchTool(),
            TemplateTool()
        ]
        
        # 에이전트 초기화
        self.agent = initialize_agent(
            tools=self.tools,
            llm=self.llm,
            agent=AgentType.STRUCTURED_CHAT_ZERO_SHOT_REACT_DESCRIPTION,
            verbose=True
        )
    
    async def generate_requirements_guide(self, site_id: str, ticket_id: str):
        prompt = f"""
        사이트 {site_id}의 JIRA 티켓 {ticket_id}에 대한 요구사항 정의서 작성 가이드를 생성하세요.
        
        다음 단계를 따라 진행하세요:
        1. JIRA 티켓 정보를 가져오세요
        2. 관련된 사이트 표준문서를 검색하세요
        3. 해당 문서 타입의 템플릿을 가져오세요
        4. 위 정보를 종합하여 구체적인 작성 가이드를 생성하세요
        
        최종 결과는 다음 형식으로 제공하세요:
        - 템플릿 구조
        - 작성 가이드라인
        - 체크리스트
        - 주의사항
        """
        
        result = await self.agent.arun(prompt)
        return self.parse_result(result)
```

#### 개발 산출물 체인
```python
class DeliverableChain:
    def __init__(self, llm_manager: LLMManager):
        self.llm = llm_manager.get_llm("openai", "code_analysis")
        self.tools = [VectorSearchTool(), TemplateTool()]
        
        self.agent = initialize_agent(
            tools=self.tools,
            llm=self.llm,
            agent=AgentType.STRUCTURED_CHAT_ZERO_SHOT_REACT_DESCRIPTION
        )
    
    async def generate_deliverable_guide(self, site_id: str, deliverable_type: str, source_code: str):
        prompt = f"""
        사이트 {site_id}에서 {deliverable_type} 타입의 개발 산출물 작성 가이드를 생성하세요.
        
        제공된 소스 코드:
        ```
        {source_code}
        ```
        
        단계:
        1. 코드를 분석하여 주요 기능과 구조를 파악하세요
        2. 해당 사이트의 {deliverable_type} 관련 표준문서를 검색하세요
        3. 적절한 템플릿을 가져오세요
        4. 코드 분석 결과와 표준을 결합하여 맞춤형 가이드를 생성하세요
        """
        
        result = await self.agent.arun(prompt)
        return self.parse_result(result)
```

### 4. 메모리 및 컨텍스트 관리
```python
from langchain.memory import ConversationBufferWindowMemory
from langchain.memory.chat_message_histories import RedisChatMessageHistory

class ContextManager:
    def __init__(self, redis_client):
        self.redis_client = redis_client
    
    def get_memory(self, session_id: str):
        """세션별 대화 메모리 관리"""
        message_history = RedisChatMessageHistory(
            session_id=session_id,
            url="redis://localhost:6379"
        )
        
        return ConversationBufferWindowMemory(
            k=10,  # 최근 10개 메시지 유지
            chat_memory=message_history,
            return_messages=True
        )
```

### 5. 프롬프트 템플릿 관리
```python
from langchain.prompts import PromptTemplate, ChatPromptTemplate

class PromptManager:
    def __init__(self):
        self.templates = {
            "requirements_analysis": ChatPromptTemplate.from_messages([
                ("system", """당신은 소프트웨어 요구사항 분석 전문가입니다. 
                사이트별 개발 표준에 맞는 요구사항 정의서 작성을 도와주세요."""),
                ("human", "{input}")
            ]),
            
            "api_documentation": PromptTemplate(
                input_variables=["code", "standards", "template"],
                template="""
                다음 코드를 분석하여 API 문서를 작성하세요:
                
                코드:
                {code}
                
                표준 가이드라인:
                {standards}
                
                템플릿:
                {template}
                
                위 정보를 바탕으로 완전한 API 문서 작성 가이드를 제공하세요.
                """
            )
        }
    
    def get_template(self, template_name: str):
        return self.templates.get(template_name)
```

## 🔧 FastAPI와 LangChain 통합

### API 엔드포인트 구현
```python
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

app = FastAPI()

# LangChain 컴포넌트 초기화
llm_manager = LLMManager()
requirements_chain = RequirementsChain(llm_manager)
deliverable_chain = DeliverableChain(llm_manager)
context_manager = ContextManager(redis_client)

class RequirementsRequest(BaseModel):
    site_id: str
    ticket_id: str
    session_id: Optional[str] = None

@app.post("/api/rag/requirements")
async def generate_requirements_guide(request: RequirementsRequest):
    try:
        # 세션 메모리 설정
        if request.session_id:
            memory = context_manager.get_memory(request.session_id)
            requirements_chain.agent.memory = memory
        
        # 요구사항 가이드 생성
        result = await requirements_chain.generate_requirements_guide(
            request.site_id, 
            request.ticket_id
        )
        
        return {"success": True, "data": result}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class DeliverableRequest(BaseModel):
    site_id: str
    deliverable_type: str
    source_code: str
    session_id: Optional[str] = None

@app.post("/api/rag/deliverable")
async def generate_deliverable_guide(request: DeliverableRequest):
    try:
        result = await deliverable_chain.generate_deliverable_guide(
            request.site_id,
            request.deliverable_type,
            request.source_code
        )
        
        return {"success": True, "data": result}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
```

## 📊 설정 및 환경 관리
```python
# config.py
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # LLM API 키
    openai_api_key: str
    anthropic_api_key: str
    azure_openai_key: str
    
    # 데이터베이스
    database_url: str
    redis_url: str
    chroma_host: str
    
    # LangChain 설정
    langchain_tracing: bool = True
    langchain_project: str = "figure-backend"
    
    class Config:
        env_file = ".env"

settings = Settings()
```

## 🚀 배포 고려사항

### Docker 설정
```dockerfile
# Dockerfile for figure-backend
FROM python:3.11-slim

WORKDIR /app

# LangChain 및 의존성 설치
COPY requirements.txt .
RUN pip install -r requirements.txt

# 애플리케이션 코드 복사
COPY . .

# 환경 변수 설정
ENV PYTHONPATH=/app
ENV LANGCHAIN_TRACING_V2=true

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### requirements.txt
```
fastapi==0.104.1
uvicorn[standard]==0.24.0
langchain==0.1.0
langchain-openai==0.0.2
langchain-anthropic==0.0.1
langchain-community==0.0.10
chromadb==0.4.18
redis==5.0.1
sqlalchemy==2.0.23
pydantic-settings==2.1.0
python-multipart==0.0.6
```

이렇게 LangChain을 통합하면 더 강력하고 유연한 RAG 시스템을 구축할 수 있습니다. 어떻게 보시나요? 