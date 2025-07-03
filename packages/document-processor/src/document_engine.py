"""
문서 처리 엔진 - 모든 컴포넌트를 통합하는 메인 엔진
"""

from typing import List, Dict, Any, Optional, Union
import logging
import asyncio
import time
from pathlib import Path

from .processors.base import BaseProcessor, ProcessedDocument
from .processors.excel_processor import ExcelProcessor
from .processors.word_processor import WordProcessor
from .processors.markdown_processor import MarkdownProcessor
from .processors.text_processor import TextProcessor
from .embedding.embedding_service import EmbeddingService
from .embedding.chunking_strategy import ChunkingStrategy, FixedSizeChunker, SemanticChunker, StructuredChunker
from .embedding.vector_store import VectorStore

logger = logging.getLogger(__name__)


class DocumentProcessingEngine:
    """문서 처리 메인 엔진"""
    
    def __init__(self, 
                 embedding_service: EmbeddingService,
                 vector_store: VectorStore,
                 chunking_strategy: Optional[ChunkingStrategy] = None):
        """
        엔진 초기화
        
        Args:
            embedding_service: 임베딩 서비스
            vector_store: 벡터 스토어
            chunking_strategy: 청킹 전략 (기본값: SemanticChunker)
        """
        self.embedding_service = embedding_service
        self.vector_store = vector_store
        self.chunking_strategy = chunking_strategy or SemanticChunker()
        
        # 프로세서들 초기화
        self.processors = {
            'excel': ExcelProcessor(),
            'word': WordProcessor(),
            'markdown': MarkdownProcessor(),
            'text': TextProcessor()
        }
        
        logger.info("문서 처리 엔진 초기화 완료")
    
    @classmethod
    async def create(cls, 
                    embedding_model: str = "sentence-transformers/all-MiniLM-L6-v2",
                    vector_store_type: str = "chroma",
                    chunking_strategy: str = "semantic",
                    **kwargs):
        """엔진 생성 팩토리 메서드"""
        
        # 임베딩 서비스 생성
        if embedding_model.startswith("sentence-transformers/"):
            embedding_service = EmbeddingService.create_sentence_transformer(embedding_model)
        elif "openai" in embedding_model.lower():
            api_key = kwargs.get('openai_api_key')
            if not api_key:
                raise ValueError("OpenAI 모델 사용시 openai_api_key가 필요합니다")
            embedding_service = EmbeddingService.create_openai(api_key, embedding_model)
        else:
            embedding_service = EmbeddingService.create_huggingface(embedding_model)
        
        # 벡터 스토어 생성
        if vector_store_type == "chroma":
            vector_store = VectorStore.create_chroma(
                kwargs.get('collection_name', 'figure_mcp_documents'),
                kwargs.get('persist_directory', './chroma_db')
            )
        elif vector_store_type == "pinecone":
            api_key = kwargs.get('pinecone_api_key')
            environment = kwargs.get('pinecone_environment')
            if not api_key or not environment:
                raise ValueError("Pinecone 사용시 pinecone_api_key와 pinecone_environment가 필요합니다")
            vector_store = VectorStore.create_pinecone(api_key, environment)
        else:
            raise ValueError(f"지원하지 않는 벡터 스토어 타입: {vector_store_type}")
        
        # 청킹 전략 생성
        if chunking_strategy == "fixed":
            chunker = FixedSizeChunker(
                kwargs.get('chunk_size', 1000),
                kwargs.get('overlap_size', 200)
            )
        elif chunking_strategy == "semantic":
            chunker = SemanticChunker(
                kwargs.get('max_chunk_size', 1500),
                kwargs.get('min_chunk_size', 100)
            )
        elif chunking_strategy == "structured":
            chunker = StructuredChunker(
                kwargs.get('max_chunk_size', 2000),
                kwargs.get('preserve_structure', True)
            )
        else:
            raise ValueError(f"지원하지 않는 청킹 전략: {chunking_strategy}")
        
        return cls(embedding_service, vector_store, chunker)
    
    def get_processor(self, file_path: str) -> Optional[BaseProcessor]:
        """파일 확장자에 따른 적절한 프로세서 반환"""
        file_ext = Path(file_path).suffix.lower()
        
        # Excel 파일
        if file_ext in ['.xlsx', '.xls']:
            return self.processors['excel']
        
        # Word 파일  
        elif file_ext in ['.docx', '.doc']:
            return self.processors['word']
        
        # Markdown 파일
        elif file_ext in ['.md', '.markdown', '.mdown', '.mkd']:
            return self.processors['markdown']
        
        # 텍스트 파일
        elif file_ext in ['.txt', '.text', '.log', '.csv', '.json', '.xml', '.yaml', '.yml']:
            return self.processors['text']
        
        else:
            logger.warning(f"지원하지 않는 파일 형식: {file_ext}")
            return None
    
    async def process_single_document(self, 
                                    file_path: str, 
                                    site_name: Optional[str] = None,
                                    category: Optional[str] = None,
                                    additional_metadata: Optional[Dict[str, Any]] = None) -> ProcessedDocument:
        """단일 문서 처리"""
        try:
            start_time = time.time()
            
            # 프로세서 선택
            processor = self.get_processor(file_path)
            if not processor:
                raise ValueError(f"지원하지 않는 파일 형식: {file_path}")
            
            logger.info(f"문서 처리 시작: {file_path}")
            
            # 파일 유효성 검사
            if not processor.is_valid_file(file_path):
                raise ValueError(f"유효하지 않은 파일: {file_path}")
            
            # 문서 처리
            processed_doc = await processor.process_document(file_path)
            
            # 추가 메타데이터 설정
            if site_name:
                processed_doc.metadata['site_name'] = site_name
            if category:
                processed_doc.metadata['category'] = category
            if additional_metadata:
                processed_doc.metadata.update(additional_metadata)
            
            # 처리 시간 기록
            processing_time = time.time() - start_time
            processed_doc.metadata['processing_time'] = processing_time
            
            logger.info(f"문서 처리 완료: {file_path} ({processing_time:.2f}초)")
            return processed_doc
            
        except Exception as e:
            logger.error(f"문서 처리 실패: {file_path} - {str(e)}")
            raise ValueError(f"문서 처리 실패: {str(e)}")
    
    async def process_and_embed_document(self, 
                                       file_path: str,
                                       site_name: Optional[str] = None,
                                       category: Optional[str] = None,
                                       additional_metadata: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """문서 처리 및 임베딩, 벡터 스토어 저장"""
        try:
            # 1. 문서 처리
            processed_doc = await self.process_single_document(
                file_path, site_name, category, additional_metadata
            )
            
            # 2. 텍스트 청킹
            chunks = await self.chunking_strategy.chunk_text(
                processed_doc.text, 
                processed_doc.metadata
            )
            
            logger.info(f"텍스트 청킹 완료: {len(chunks)}개 청크")
            
            # 3. 청크별 임베딩 생성
            chunk_documents = []
            for chunk in chunks:
                chunk_doc = {
                    'content': chunk.content,
                    'chunk_index': chunk.chunk_index,
                    'start_index': chunk.start_index,
                    'end_index': chunk.end_index,
                    'file_path': file_path,
                    'file_name': Path(file_path).name,
                    'document_id': processed_doc.metadata.get('document_id', Path(file_path).stem),
                    **processed_doc.metadata,
                    **chunk.metadata
                }
                chunk_documents.append(chunk_doc)
            
            # 배치로 임베딩 생성
            embedded_chunks = await self.embedding_service.embed_documents(chunk_documents)
            
            logger.info(f"임베딩 생성 완료: {len(embedded_chunks)}개")
            
            # 4. 벡터 스토어에 저장
            chunk_ids = await self.vector_store.add_documents(embedded_chunks)
            
            logger.info(f"벡터 스토어 저장 완료: {len(chunk_ids)}개 청크")
            
            # 5. 전체 문서 메타데이터도 저장 (검색용)
            document_summary = {
                'content': processed_doc.text[:2000],  # 처음 2000자만
                'document_type': 'summary',
                'total_chunks': len(chunks),
                'chunk_ids': chunk_ids,
                'file_path': file_path,
                'file_name': Path(file_path).name,
                'document_id': processed_doc.metadata.get('document_id', Path(file_path).stem),
                **processed_doc.metadata
            }
            
            # 문서 요약 임베딩
            summary_embedded = await self.embedding_service.embed_documents([document_summary])
            summary_id = await self.vector_store.add_documents(summary_embedded)
            
            return {
                'success': True,
                'document_id': processed_doc.metadata.get('document_id', Path(file_path).stem),
                'file_path': file_path,
                'total_chunks': len(chunks),
                'chunk_ids': chunk_ids,
                'summary_id': summary_id[0],
                'metadata': processed_doc.metadata,
                'processing_stats': {
                    'original_length': len(processed_doc.text),
                    'chunks_created': len(chunks),
                    'embedding_dimension': self.embedding_service.dimension,
                    'chunking_strategy': self.chunking_strategy.get_strategy_info()
                }
            }
            
        except Exception as e:
            logger.error(f"문서 처리 및 임베딩 실패: {file_path} - {str(e)}")
            return {
                'success': False,
                'file_path': file_path,
                'error': str(e)
            }
    
    async def process_multiple_documents(self, 
                                       file_paths: List[str],
                                       site_name: Optional[str] = None,
                                       category: Optional[str] = None,
                                       max_concurrent: int = 3) -> List[Dict[str, Any]]:
        """여러 문서 동시 처리"""
        try:
            semaphore = asyncio.Semaphore(max_concurrent)
            
            async def process_single(file_path: str):
                async with semaphore:
                    return await self.process_and_embed_document(
                        file_path, site_name, category
                    )
            
            tasks = [process_single(fp) for fp in file_paths]
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
            # 결과 정리
            processed_results = []
            for i, result in enumerate(results):
                if isinstance(result, Exception):
                    processed_results.append({
                        'success': False,
                        'file_path': file_paths[i],
                        'error': str(result)
                    })
                else:
                    processed_results.append(result)
            
            logger.info(f"다중 문서 처리 완료: {len(file_paths)}개 파일")
            return processed_results
            
        except Exception as e:
            logger.error(f"다중 문서 처리 실패: {str(e)}")
            raise ValueError(f"다중 문서 처리 실패: {str(e)}")
    
    async def search_documents(self, 
                             query: str, 
                             top_k: int = 10,
                             site_name: Optional[str] = None,
                             category: Optional[str] = None,
                             document_type: Optional[str] = None) -> List[Dict[str, Any]]:
        """문서 검색"""
        try:
            # 필터 조건 설정
            filters = {}
            if site_name:
                filters['site_name'] = site_name
            if category:
                filters['category'] = category
            if document_type:
                filters['document_type'] = document_type
            
            # 벡터 검색 수행
            results = await self.vector_store.search_by_text(
                query, self.embedding_service, top_k, filters
            )
            
            # 결과 후처리
            processed_results = []
            for result in results:
                processed_result = {
                    'content': result.get('content', ''),
                    'similarity_score': result.get('similarity_score', 0),
                    'file_name': result.get('metadata', {}).get('file_name', ''),
                    'document_id': result.get('metadata', {}).get('document_id', ''),
                    'chunk_index': result.get('metadata', {}).get('chunk_index'),
                    'site_name': result.get('metadata', {}).get('site_name', ''),
                    'category': result.get('metadata', {}).get('category', ''),
                    'metadata': result.get('metadata', {})
                }
                processed_results.append(processed_result)
            
            logger.info(f"문서 검색 완료: 쿼리='{query}', 결과={len(results)}개")
            return processed_results
            
        except Exception as e:
            logger.error(f"문서 검색 실패: {str(e)}")
            raise ValueError(f"문서 검색 실패: {str(e)}")
    
    async def get_document_chunks(self, document_id: str) -> List[Dict[str, Any]]:
        """특정 문서의 모든 청크 조회"""
        try:
            # 문서 ID로 청크들 검색
            results = await self.vector_store.search_similar(
                query_embedding=[0] * self.embedding_service.dimension,  # 더미 쿼리
                top_k=1000,  # 충분히 큰 수
                filters={'document_id': document_id}
            )
            
            # 청크 인덱스로 정렬
            chunks = sorted(results, key=lambda x: x.get('metadata', {}).get('chunk_index', 0))
            
            logger.info(f"문서 청크 조회 완료: {document_id} - {len(chunks)}개 청크")
            return chunks
            
        except Exception as e:
            logger.error(f"문서 청크 조회 실패: {str(e)}")
            raise ValueError(f"문서 청크 조회 실패: {str(e)}")
    
    async def delete_document(self, document_id: str) -> Dict[str, Any]:
        """문서 및 관련 청크들 삭제"""
        try:
            # 문서의 모든 청크 조회
            chunks = await self.get_document_chunks(document_id)
            
            # 각 청크 삭제
            deleted_count = 0
            for chunk in chunks:
                chunk_id = chunk.get('id')
                if chunk_id:
                    success = await self.vector_store.delete_document(chunk_id)
                    if success:
                        deleted_count += 1
            
            logger.info(f"문서 삭제 완료: {document_id} - {deleted_count}개 청크 삭제")
            
            return {
                'success': True,
                'document_id': document_id,
                'deleted_chunks': deleted_count
            }
            
        except Exception as e:
            logger.error(f"문서 삭제 실패: {str(e)}")
            return {
                'success': False,
                'document_id': document_id,
                'error': str(e)
            }
    
    def get_engine_info(self) -> Dict[str, Any]:
        """엔진 정보 반환"""
        return {
            'embedding_service': self.embedding_service.get_embedding_info(),
            'vector_store': self.vector_store.get_store_info(),
            'chunking_strategy': self.chunking_strategy.get_strategy_info(),
            'supported_formats': {
                'excel': ['.xlsx', '.xls'],
                'word': ['.docx', '.doc'],
                'markdown': ['.md', '.markdown', '.mdown', '.mkd'],
                'text': ['.txt', '.text', '.log', '.csv', '.json', '.xml', '.yaml', '.yml']
            }
        } 