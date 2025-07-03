"""
벡터 스토어 - 임베딩된 문서 저장 및 검색
"""

from typing import List, Dict, Any, Optional, Tuple
from abc import ABC, abstractmethod
import json
import logging
import uuid
from datetime import datetime

logger = logging.getLogger(__name__)


class BaseVectorStore(ABC):
    """벡터 스토어 기본 클래스"""
    
    @abstractmethod
    async def add_documents(self, documents: List[Dict[str, Any]]) -> List[str]:
        """문서들을 벡터 스토어에 추가"""
        pass
    
    @abstractmethod
    async def search_similar(self, query_embedding: List[float], top_k: int = 5, 
                           filters: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        """유사한 문서 검색"""
        pass
    
    @abstractmethod
    async def get_document(self, document_id: str) -> Optional[Dict[str, Any]]:
        """문서 ID로 문서 조회"""
        pass
    
    @abstractmethod
    async def delete_document(self, document_id: str) -> bool:
        """문서 삭제"""
        pass
    
    @abstractmethod
    async def update_document(self, document_id: str, document: Dict[str, Any]) -> bool:
        """문서 업데이트"""
        pass


class ChromaVectorStore(BaseVectorStore):
    """ChromaDB 벡터 스토어"""
    
    def __init__(self, collection_name: str = "figure_mcp_documents", persist_directory: str = "./chroma_db"):
        try:
            import chromadb
            from chromadb.config import Settings
            
            self.client = chromadb.PersistentClient(
                path=persist_directory,
                settings=Settings(anonymized_telemetry=False)
            )
            
            self.collection_name = collection_name
            self.collection = self.client.get_or_create_collection(
                name=collection_name,
                metadata={"description": "Figure MCP 문서 임베딩 저장소"}
            )
            
            logger.info(f"ChromaDB 연결 완료: {collection_name}")
            
        except ImportError:
            raise ImportError("chromadb 패키지가 필요합니다: pip install chromadb")
        except Exception as e:
            raise ValueError(f"ChromaDB 초기화 실패: {str(e)}")
    
    async def add_documents(self, documents: List[Dict[str, Any]]) -> List[str]:
        """문서들을 ChromaDB에 추가"""
        try:
            if not documents:
                return []
            
            # 문서 ID 생성 또는 기존 ID 사용
            document_ids = []
            embeddings = []
            metadatas = []
            contents = []
            
            for doc in documents:
                # 문서 ID
                doc_id = doc.get('id', str(uuid.uuid4()))
                document_ids.append(doc_id)
                
                # 임베딩
                embedding = doc.get('embedding')
                if not embedding:
                    raise ValueError(f"문서 {doc_id}에 임베딩이 없습니다")
                embeddings.append(embedding)
                
                # 메타데이터 (ChromaDB는 문자열, 숫자만 지원)
                metadata = self._prepare_metadata(doc)
                metadatas.append(metadata)
                
                # 콘텐츠
                content = doc.get('content', doc.get('text', ''))
                contents.append(content)
            
            # ChromaDB에 추가
            self.collection.add(
                ids=document_ids,
                embeddings=embeddings,
                metadatas=metadatas,
                documents=contents
            )
            
            logger.info(f"ChromaDB에 {len(documents)}개 문서 추가 완료")
            return document_ids
            
        except Exception as e:
            logger.error(f"ChromaDB 문서 추가 실패: {str(e)}")
            raise ValueError(f"문서 추가 실패: {str(e)}")
    
    async def search_similar(self, query_embedding: List[float], top_k: int = 5, 
                           filters: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        """ChromaDB에서 유사한 문서 검색"""
        try:
            # 필터 조건 준비
            where_clause = None
            if filters:
                where_clause = self._prepare_filters(filters)
            
            # 검색 수행
            results = self.collection.query(
                query_embeddings=[query_embedding],
                n_results=top_k,
                where=where_clause,
                include=["documents", "metadatas", "distances"]
            )
            
            # 결과 형식 변환
            documents = []
            if results['ids'] and results['ids'][0]:
                for i in range(len(results['ids'][0])):
                    doc = {
                        'id': results['ids'][0][i],
                        'content': results['documents'][0][i],
                        'metadata': results['metadatas'][0][i],
                        'similarity_score': 1 - results['distances'][0][i],  # distance를 similarity로 변환
                        'distance': results['distances'][0][i]
                    }
                    documents.append(doc)
            
            logger.info(f"ChromaDB 검색 완료: {len(documents)}개 문서 반환")
            return documents
            
        except Exception as e:
            logger.error(f"ChromaDB 검색 실패: {str(e)}")
            raise ValueError(f"검색 실패: {str(e)}")
    
    async def get_document(self, document_id: str) -> Optional[Dict[str, Any]]:
        """ChromaDB에서 문서 조회"""
        try:
            results = self.collection.get(
                ids=[document_id],
                include=["documents", "metadatas"]
            )
            
            if results['ids'] and results['ids'][0]:
                return {
                    'id': results['ids'][0],
                    'content': results['documents'][0],
                    'metadata': results['metadatas'][0]
                }
            
            return None
            
        except Exception as e:
            logger.error(f"ChromaDB 문서 조회 실패: {str(e)}")
            return None
    
    async def delete_document(self, document_id: str) -> bool:
        """ChromaDB에서 문서 삭제"""
        try:
            self.collection.delete(ids=[document_id])
            logger.info(f"ChromaDB 문서 삭제 완료: {document_id}")
            return True
            
        except Exception as e:
            logger.error(f"ChromaDB 문서 삭제 실패: {str(e)}")
            return False
    
    async def update_document(self, document_id: str, document: Dict[str, Any]) -> bool:
        """ChromaDB에서 문서 업데이트"""
        try:
            # ChromaDB는 직접 업데이트를 지원하지 않으므로 삭제 후 재추가
            await self.delete_document(document_id)
            
            # 문서 ID 설정
            document['id'] = document_id
            
            # 재추가
            await self.add_documents([document])
            
            logger.info(f"ChromaDB 문서 업데이트 완료: {document_id}")
            return True
            
        except Exception as e:
            logger.error(f"ChromaDB 문서 업데이트 실패: {str(e)}")
            return False
    
    def _prepare_metadata(self, doc: Dict[str, Any]) -> Dict[str, Any]:
        """ChromaDB용 메타데이터 준비 (문자열, 숫자만 지원)"""
        metadata = {}
        
        for key, value in doc.items():
            if key in ['id', 'content', 'text', 'embedding']:
                continue
            
            if isinstance(value, (str, int, float, bool)):
                metadata[key] = value
            elif isinstance(value, dict):
                # 딕셔너리는 JSON 문자열로 변환
                metadata[f"{key}_json"] = json.dumps(value, ensure_ascii=False)
            elif isinstance(value, list):
                # 리스트는 JSON 문자열로 변환 (임베딩 제외)
                if key != 'embedding':
                    metadata[f"{key}_json"] = json.dumps(value, ensure_ascii=False)
            elif value is not None:
                metadata[key] = str(value)
        
        # 기본 메타데이터 추가
        metadata['created_at'] = metadata.get('created_at', datetime.now().isoformat())
        metadata['updated_at'] = datetime.now().isoformat()
        
        return metadata
    
    def _prepare_filters(self, filters: Dict[str, Any]) -> Dict[str, Any]:
        """ChromaDB용 필터 조건 준비"""
        where_clause = {}
        
        for key, value in filters.items():
            if isinstance(value, (str, int, float, bool)):
                where_clause[key] = value
            elif isinstance(value, dict):
                # 범위 조건 등 복잡한 필터링
                if '$gte' in value:
                    where_clause[key] = {"$gte": value['$gte']}
                elif '$lte' in value:
                    where_clause[key] = {"$lte": value['$lte']}
                elif '$in' in value:
                    where_clause[key] = {"$in": value['$in']}
        
        return where_clause


class PineconeVectorStore(BaseVectorStore):
    """Pinecone 벡터 스토어"""
    
    def __init__(self, api_key: str, environment: str, index_name: str = "figure-mcp-documents"):
        try:
            import pinecone
            
            pinecone.init(api_key=api_key, environment=environment)
            
            self.index_name = index_name
            self.index = pinecone.Index(index_name)
            
            logger.info(f"Pinecone 연결 완료: {index_name}")
            
        except ImportError:
            raise ImportError("pinecone-client 패키지가 필요합니다: pip install pinecone-client")
        except Exception as e:
            raise ValueError(f"Pinecone 초기화 실패: {str(e)}")
    
    async def add_documents(self, documents: List[Dict[str, Any]]) -> List[str]:
        """문서들을 Pinecone에 추가"""
        try:
            if not documents:
                return []
            
            vectors = []
            document_ids = []
            
            for doc in documents:
                doc_id = doc.get('id', str(uuid.uuid4()))
                document_ids.append(doc_id)
                
                embedding = doc.get('embedding')
                if not embedding:
                    raise ValueError(f"문서 {doc_id}에 임베딩이 없습니다")
                
                # 메타데이터 준비
                metadata = self._prepare_pinecone_metadata(doc)
                
                vectors.append({
                    'id': doc_id,
                    'values': embedding,
                    'metadata': metadata
                })
            
            # Pinecone에 업서트
            self.index.upsert(vectors=vectors)
            
            logger.info(f"Pinecone에 {len(documents)}개 문서 추가 완료")
            return document_ids
            
        except Exception as e:
            logger.error(f"Pinecone 문서 추가 실패: {str(e)}")
            raise ValueError(f"문서 추가 실패: {str(e)}")
    
    async def search_similar(self, query_embedding: List[float], top_k: int = 5, 
                           filters: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        """Pinecone에서 유사한 문서 검색"""
        try:
            # 검색 수행
            query_response = self.index.query(
                vector=query_embedding,
                top_k=top_k,
                filter=filters,
                include_metadata=True
            )
            
            # 결과 형식 변환
            documents = []
            for match in query_response['matches']:
                doc = {
                    'id': match['id'],
                    'similarity_score': match['score'],
                    'metadata': match.get('metadata', {})
                }
                
                # 콘텐츠 복원
                if 'content' in match['metadata']:
                    doc['content'] = match['metadata']['content']
                
                documents.append(doc)
            
            logger.info(f"Pinecone 검색 완료: {len(documents)}개 문서 반환")
            return documents
            
        except Exception as e:
            logger.error(f"Pinecone 검색 실패: {str(e)}")
            raise ValueError(f"검색 실패: {str(e)}")
    
    async def get_document(self, document_id: str) -> Optional[Dict[str, Any]]:
        """Pinecone에서 문서 조회"""
        try:
            response = self.index.fetch(ids=[document_id])
            
            if document_id in response['vectors']:
                vector_data = response['vectors'][document_id]
                return {
                    'id': document_id,
                    'metadata': vector_data.get('metadata', {})
                }
            
            return None
            
        except Exception as e:
            logger.error(f"Pinecone 문서 조회 실패: {str(e)}")
            return None
    
    async def delete_document(self, document_id: str) -> bool:
        """Pinecone에서 문서 삭제"""
        try:
            self.index.delete(ids=[document_id])
            logger.info(f"Pinecone 문서 삭제 완료: {document_id}")
            return True
            
        except Exception as e:
            logger.error(f"Pinecone 문서 삭제 실패: {str(e)}")
            return False
    
    async def update_document(self, document_id: str, document: Dict[str, Any]) -> bool:
        """Pinecone에서 문서 업데이트"""
        try:
            # 문서 ID 설정
            document['id'] = document_id
            
            # 업서트 (존재하면 업데이트, 없으면 생성)
            await self.add_documents([document])
            
            logger.info(f"Pinecone 문서 업데이트 완료: {document_id}")
            return True
            
        except Exception as e:
            logger.error(f"Pinecone 문서 업데이트 실패: {str(e)}")
            return False
    
    def _prepare_pinecone_metadata(self, doc: Dict[str, Any]) -> Dict[str, Any]:
        """Pinecone용 메타데이터 준비"""
        metadata = {}
        
        for key, value in doc.items():
            if key in ['id', 'embedding']:
                continue
            
            # Pinecone은 메타데이터 크기 제한이 있으므로 주요 정보만 저장
            if isinstance(value, (str, int, float, bool)):
                if key == 'content':
                    # 콘텐츠는 길이 제한
                    metadata[key] = value[:8000] if isinstance(value, str) else value
                else:
                    metadata[key] = value
            elif isinstance(value, dict) and key == 'metadata':
                # 중첩된 메타데이터 펼치기
                for sub_key, sub_value in value.items():
                    if isinstance(sub_value, (str, int, float, bool)):
                        metadata[f"meta_{sub_key}"] = sub_value
        
        # 기본 메타데이터 추가
        metadata['created_at'] = metadata.get('created_at', datetime.now().isoformat())
        metadata['updated_at'] = datetime.now().isoformat()
        
        return metadata


class VectorStore:
    """통합 벡터 스토어 인터페이스"""
    
    def __init__(self, store: BaseVectorStore):
        self.store = store
        logger.info(f"벡터 스토어 초기화 완료: {type(store).__name__}")
    
    @classmethod
    def create_chroma(cls, collection_name: str = "figure_mcp_documents", 
                     persist_directory: str = "./chroma_db"):
        """ChromaDB 벡터 스토어 생성"""
        store = ChromaVectorStore(collection_name, persist_directory)
        return cls(store)
    
    @classmethod
    def create_pinecone(cls, api_key: str, environment: str, 
                       index_name: str = "figure-mcp-documents"):
        """Pinecone 벡터 스토어 생성"""
        store = PineconeVectorStore(api_key, environment, index_name)
        return cls(store)
    
    async def add_documents(self, documents: List[Dict[str, Any]]) -> List[str]:
        """문서들을 벡터 스토어에 추가"""
        return await self.store.add_documents(documents)
    
    async def search_similar(self, query_embedding: List[float], top_k: int = 5, 
                           filters: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        """유사한 문서 검색"""
        return await self.store.search_similar(query_embedding, top_k, filters)
    
    async def search_by_text(self, query_text: str, embedding_service, top_k: int = 5, 
                           filters: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        """텍스트 쿼리로 유사한 문서 검색"""
        try:
            # 쿼리 텍스트를 임베딩으로 변환
            query_embedding = await embedding_service.embed_text(query_text)
            
            # 유사한 문서 검색
            return await self.search_similar(query_embedding, top_k, filters)
            
        except Exception as e:
            logger.error(f"텍스트 검색 실패: {str(e)}")
            raise ValueError(f"텍스트 검색 실패: {str(e)}")
    
    async def get_document(self, document_id: str) -> Optional[Dict[str, Any]]:
        """문서 ID로 문서 조회"""
        return await self.store.get_document(document_id)
    
    async def delete_document(self, document_id: str) -> bool:
        """문서 삭제"""
        return await self.store.delete_document(document_id)
    
    async def update_document(self, document_id: str, document: Dict[str, Any]) -> bool:
        """문서 업데이트"""
        return await self.store.update_document(document_id, document)
    
    async def add_document_chunks(self, chunks: List[Dict[str, Any]], 
                                document_metadata: Dict[str, Any]) -> List[str]:
        """문서 청크들을 벡터 스토어에 추가"""
        try:
            # 청크에 문서 메타데이터 추가
            enhanced_chunks = []
            for i, chunk in enumerate(chunks):
                enhanced_chunk = chunk.copy()
                enhanced_chunk.update(document_metadata)
                enhanced_chunk['chunk_index'] = i
                enhanced_chunk['total_chunks'] = len(chunks)
                enhanced_chunks.append(enhanced_chunk)
            
            return await self.add_documents(enhanced_chunks)
            
        except Exception as e:
            logger.error(f"문서 청크 추가 실패: {str(e)}")
            raise ValueError(f"문서 청크 추가 실패: {str(e)}")
    
    async def search_document_chunks(self, query: str, embedding_service, 
                                   document_id: Optional[str] = None, 
                                   top_k: int = 5) -> List[Dict[str, Any]]:
        """특정 문서의 청크들에서 검색"""
        try:
            filters = {}
            if document_id:
                filters['document_id'] = document_id
            
            return await self.search_by_text(query, embedding_service, top_k, filters)
            
        except Exception as e:
            logger.error(f"문서 청크 검색 실패: {str(e)}")
            raise ValueError(f"문서 청크 검색 실패: {str(e)}")
    
    def get_store_info(self) -> Dict[str, Any]:
        """벡터 스토어 정보 반환"""
        return {
            'store_type': type(self.store).__name__,
            'supports_filters': True,
            'supports_metadata': True
        } 