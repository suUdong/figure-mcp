"""
ChromaDB Vector Store Service
헥사고날 아키텍처 기반 멀티 프로바이더 임베딩을 지원하는 벡터 저장소 서비스
"""
import uuid
import logging
import asyncio
from typing import List, Dict, Any, Optional
from datetime import datetime

import chromadb
from chromadb.config import Settings as ChromaSettings
from langchain_text_splitters import RecursiveCharacterTextSplitter

from app.config import settings
from app.domain.entities.schemas import Document, DocumentType

logger = logging.getLogger(__name__)


class VectorStoreService:
    """ChromaDB를 이용한 벡터 저장소 서비스"""
    
    def __init__(self):
        """서비스 초기화"""
        self._client = None
        self._collection = None
        self._embeddings = None
        self._text_splitter = None
        
    async def initialize(self) -> None:
        """비동기 초기화"""
        try:
            # SSL 검증 비활성화 (전역 설정)
            import os
            import ssl
            import urllib3
            import requests
            from requests.adapters import HTTPAdapter
            from urllib3.util.retry import Retry
            
            # SSL 관련 환경 변수 설정
            os.environ["PYTHONHTTPSVERIFY"] = "0"
            os.environ["CURL_CA_BUNDLE"] = ""
            os.environ["REQUESTS_CA_BUNDLE"] = ""
            os.environ["SSL_VERIFY"] = "false"
            
            # urllib3 SSL 경고 비활성화
            urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
            urllib3.disable_warnings()
            
            # SSL 기본 컨텍스트 설정
            ssl._create_default_https_context = ssl._create_unverified_context
            
            # requests 세션에 SSL 검증 비활성화 적용
            session = requests.Session()
            session.verify = False
            
            # requests 모듈의 기본 세션 설정
            requests.Session.verify = False
            requests.packages.urllib3.disable_warnings()
            
            logger.info("SSL 검증 비활성화 설정 완료 (전역 적용)")
            
            # ChromaDB 클라이언트 초기화 (persistent 모드 사용)
            logger.info("ChromaDB persistent 모드로 초기화 중...")
            
            # ChromaDB telemetry 완전 비활성화
            os.environ["ANONYMIZED_TELEMETRY"] = "False"
            os.environ["CHROMA_TELEMETRY"] = "False"
            
            persist_directory = settings.chroma_persist_directory
            os.makedirs(persist_directory, exist_ok=True)
            
            # telemetry 비활성화 설정
            chroma_settings = ChromaSettings(
                anonymized_telemetry=False,
                allow_reset=True
            )
            
            self._client = chromadb.PersistentClient(
                path=persist_directory,
                settings=chroma_settings
            )
            
            # 임베딩 프로바이더에 따라 임베딩 함수 초기화
            from app.infrastructure.adapters.embeddings.factory import embedding_factory
            from app.infrastructure.adapters.embeddings.langchain_wrapper import LangChainEmbeddingWrapper
            
            # 팩토리를 통해 적절한 어댑터 생성
            self._embedding_adapter = embedding_factory.create_adapter(settings)
            logger.info(f"임베딩 어댑터 초기화 완료: {self._embedding_adapter.provider_name} - {self._embedding_adapter.model_name}")
            
            # LangChain 호환성을 위한 래퍼 생성
            self._embeddings = LangChainEmbeddingWrapper(self._embedding_adapter)
            
            # 컬렉션 생성 또는 가져오기 
            self._collection = self._client.get_or_create_collection(
                name=settings.chroma_collection_name,
                metadata={"created_at": datetime.now().isoformat()}
            )
            
            # 텍스트 분할기 초기화
            self._text_splitter = RecursiveCharacterTextSplitter(
                chunk_size=1000,
                chunk_overlap=200,
                length_function=len,
                separators=["\n\n", "\n", " ", ""]
            )
            
            logger.info(f"VectorStore 초기화 완료: {self._collection.count()}개 문서")
            
        except Exception as e:
            logger.error(f"VectorStore 초기화 실패: {e}")
            raise
    
    async def add_document(self, document: Document) -> str:
        """문서를 벡터 저장소에 추가"""
        if not self._collection or not self._embeddings:
            await self.initialize()
        
        try:
            # 텍스트 분할
            chunks = self._text_splitter.split_text(document.content)
            
            if not chunks:
                raise ValueError("문서 내용이 너무 짧아 분할할 수 없습니다")
            
            # 각 청크에 대한 ID와 메타데이터 생성
            doc_id = document.id or str(uuid.uuid4())
            chunk_ids = []
            chunk_metadatas = []
            
            for i, chunk in enumerate(chunks):
                chunk_id = f"{doc_id}_chunk_{i}"
                chunk_ids.append(chunk_id)
                
                chunk_metadata = {
                    "document_id": doc_id,
                    "title": document.title,
                    "doc_type": document.doc_type.value,
                    "chunk_index": i,
                    "total_chunks": len(chunks),
                    "created_at": document.created_at.isoformat() if document.created_at else datetime.now().isoformat(),
                    **document.metadata
                }
                
                if document.source_url:
                    chunk_metadata["source_url"] = document.source_url
                if document.site_id:
                    chunk_metadata["site_id"] = document.site_id
                    
                chunk_metadatas.append(chunk_metadata)
                    
            # 임베딩 생성 (Gemini 사용)
            try:
                embeddings = await asyncio.get_event_loop().run_in_executor(
                    None, self._embeddings.embed_documents, chunks
                )
            except Exception as e:
                logger.error(f"임베딩 생성 실패: {e}")
                raise Exception(f"임베딩 생성 실패: {e}")
            
            # ChromaDB에 추가 (항상 Gemini 임베딩 사용)
            self._collection.add(
                documents=chunks,
                metadatas=chunk_metadatas,
                ids=chunk_ids,
                embeddings=embeddings
            )
            
            logger.info(f"문서 추가 완료: {doc_id} ({len(chunks)}개 청크)")
            return doc_id
            
        except Exception as e:
            logger.error(f"문서 추가 실패: {e}")
            raise
    
    async def search_similar(
        self, 
                             query: str, 
        max_results: int = 5,
        site_ids: Optional[List[str]] = None,
        similarity_threshold: float = 0.7
    ) -> List[Dict[str, Any]]:
        """유사 문서 검색"""
        if not self._collection:
            await self.initialize()
        
        try:
            # 메타데이터 필터 구성
            where_filter = {}
            if site_ids:
                where_filter["site_id"] = {"$in": site_ids}
            
            # 쿼리를 Gemini로 임베딩 생성 (문서와 동일한 방식 사용)
            query_embedding = await asyncio.get_event_loop().run_in_executor(
                None, self._embeddings.embed_documents, [query]
            )
            query_embedding = query_embedding[0]  # 첫 번째 결과 사용
            
            # 검색 실행 (Gemini 임베딩 사용)
            query_filter = {"where": where_filter} if where_filter else {}
            
            results = self._collection.query(
                query_embeddings=[query_embedding],
                n_results=max_results,
                include=["documents", "metadatas", "distances"],
                **query_filter
            )
            
            # 결과 처리
            search_results = []
            if results["documents"] and results["documents"][0]:
                for i, (doc, metadata, distance) in enumerate(zip(
                    results["documents"][0],
                    results["metadatas"][0], 
                    results["distances"][0]
                )):
                    # 유사도 계산 (거리를 유사도로 변환)
                    similarity = 1 - distance
                    
                    # 모든 검색 결과의 유사도를 로그로 출력
                    logger.info(f"검색 결과 {i+1}: 유사도={similarity:.3f}, 임계값={similarity_threshold}")
                    
                    if similarity >= similarity_threshold:
                        search_results.append({
                            "content": doc,
                            "metadata": metadata,
                            "similarity": similarity,
                            "rank": i + 1
                        })
            
            logger.info(f"검색 완료: {len(search_results)}개 결과 (임계값: {similarity_threshold})")
            return search_results
            
        except Exception as e:
            logger.error(f"검색 실패: {e}")
            raise
    
    async def delete_document(self, document_id: str) -> bool:
        """문서 삭제"""
        if not self._collection:
            await self.initialize()
        
        try:
            # 해당 문서의 모든 청크 찾기
            results = self._collection.get(
                where={"document_id": document_id},
                include=["metadatas"]
            )
            
            if results["ids"]:
                # 청크 삭제
                self._collection.delete(ids=results["ids"])
                logger.info(f"문서 삭제 완료: {document_id} ({len(results['ids'])}개 청크)")
                return True
            else:
                logger.warning(f"삭제할 문서를 찾을 수 없음: {document_id}")
                return False
                
        except Exception as e:
            logger.error(f"문서 삭제 실패: {e}")
            raise
    
    async def get_collection_info(self) -> Dict[str, Any]:
        """컬렉션 정보 조회"""
        if not self._collection:
            await self.initialize()
        
        try:
            count = self._collection.count()
            
            # 최근 문서 조회
            recent_results = self._collection.get(
                limit=5,
                include=["metadatas"]
            )
            
            # 문서 타입별 통계
            all_results = self._collection.get(include=["metadatas"])
            doc_types = {}
            sites = set()
            
            for metadata in all_results["metadatas"]:
                doc_type = metadata.get("doc_type", "unknown")
                doc_types[doc_type] = doc_types.get(doc_type, 0) + 1
                
                if "site_id" in metadata:
                    sites.add(metadata["site_id"])
            
            return {
                "total_chunks": count,
                "total_sites": len(sites),
                "document_types": doc_types,
                "recent_documents": [
                    {
                        "id": metadata.get("document_id"),
                        "title": metadata.get("title"),
                        "type": metadata.get("doc_type"),
                        "created_at": metadata.get("created_at")
                    }
                    for metadata in recent_results["metadatas"][:5]
                ] if recent_results["metadatas"] else []
            }
            
        except Exception as e:
            logger.error(f"컬렉션 정보 조회 실패: {e}")
            raise


# 글로벌 인스턴스
vector_store_service = VectorStoreService() 