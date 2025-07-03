"""
임베딩 서비스 - 텍스트를 벡터로 변환
"""

from typing import List, Dict, Any, Optional, Union
import numpy as np
from abc import ABC, abstractmethod
import asyncio
import logging

logger = logging.getLogger(__name__)


class BaseEmbeddingProvider(ABC):
    """임베딩 제공자 기본 클래스"""
    
    @abstractmethod
    async def embed_text(self, text: str) -> List[float]:
        """단일 텍스트 임베딩"""
        pass
    
    @abstractmethod
    async def embed_batch(self, texts: List[str]) -> List[List[float]]:
        """배치 텍스트 임베딩"""
        pass
    
    @abstractmethod
    def get_dimension(self) -> int:
        """임베딩 차원 수 반환"""
        pass


class SentenceTransformerProvider(BaseEmbeddingProvider):
    """Sentence Transformers 기반 임베딩 제공자"""
    
    def __init__(self, model_name: str = "sentence-transformers/all-MiniLM-L6-v2"):
        try:
            from sentence_transformers import SentenceTransformer
            self.model = SentenceTransformer(model_name)
            self.model_name = model_name
            self.dimension = self.model.get_sentence_embedding_dimension()
            logger.info(f"SentenceTransformer 모델 로드 완료: {model_name} (차원: {self.dimension})")
        except ImportError:
            raise ImportError("sentence-transformers 패키지가 필요합니다: pip install sentence-transformers")
        except Exception as e:
            raise ValueError(f"SentenceTransformer 모델 로드 실패: {str(e)}")
    
    async def embed_text(self, text: str) -> List[float]:
        """단일 텍스트 임베딩"""
        try:
            embedding = self.model.encode(text, convert_to_tensor=False)
            return embedding.tolist() if hasattr(embedding, 'tolist') else list(embedding)
        except Exception as e:
            logger.error(f"텍스트 임베딩 실패: {str(e)}")
            raise ValueError(f"임베딩 생성 실패: {str(e)}")
    
    async def embed_batch(self, texts: List[str]) -> List[List[float]]:
        """배치 텍스트 임베딩"""
        try:
            embeddings = self.model.encode(texts, convert_to_tensor=False)
            return [emb.tolist() if hasattr(emb, 'tolist') else list(emb) for emb in embeddings]
        except Exception as e:
            logger.error(f"배치 임베딩 실패: {str(e)}")
            raise ValueError(f"배치 임베딩 생성 실패: {str(e)}")
    
    def get_dimension(self) -> int:
        return self.dimension


class OpenAIEmbeddingProvider(BaseEmbeddingProvider):
    """OpenAI 임베딩 제공자"""
    
    def __init__(self, api_key: str, model: str = "text-embedding-ada-002"):
        try:
            import openai
            self.client = openai.OpenAI(api_key=api_key)
            self.model = model
            # text-embedding-ada-002의 차원은 1536
            self.dimension = 1536 if model == "text-embedding-ada-002" else 1536
            logger.info(f"OpenAI 임베딩 모델 설정 완료: {model}")
        except ImportError:
            raise ImportError("openai 패키지가 필요합니다: pip install openai")
    
    async def embed_text(self, text: str) -> List[float]:
        """단일 텍스트 임베딩"""
        try:
            response = self.client.embeddings.create(
                input=text,
                model=self.model
            )
            return response.data[0].embedding
        except Exception as e:
            logger.error(f"OpenAI 임베딩 실패: {str(e)}")
            raise ValueError(f"OpenAI 임베딩 생성 실패: {str(e)}")
    
    async def embed_batch(self, texts: List[str]) -> List[List[float]]:
        """배치 텍스트 임베딩"""
        try:
            response = self.client.embeddings.create(
                input=texts,
                model=self.model
            )
            return [data.embedding for data in response.data]
        except Exception as e:
            logger.error(f"OpenAI 배치 임베딩 실패: {str(e)}")
            raise ValueError(f"OpenAI 배치 임베딩 생성 실패: {str(e)}")
    
    def get_dimension(self) -> int:
        return self.dimension


class HuggingFaceEmbeddingProvider(BaseEmbeddingProvider):
    """HuggingFace Transformers 기반 임베딩 제공자"""
    
    def __init__(self, model_name: str = "sentence-transformers/all-MiniLM-L6-v2"):
        try:
            from transformers import AutoTokenizer, AutoModel
            import torch
            
            self.tokenizer = AutoTokenizer.from_pretrained(model_name)
            self.model = AutoModel.from_pretrained(model_name)
            self.model_name = model_name
            self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
            self.model.to(self.device)
            
            # 차원 추정 (일반적으로 hidden_size)
            self.dimension = self.model.config.hidden_size
            logger.info(f"HuggingFace 모델 로드 완료: {model_name} (차원: {self.dimension})")
        except ImportError:
            raise ImportError("transformers와 torch 패키지가 필요합니다")
        except Exception as e:
            raise ValueError(f"HuggingFace 모델 로드 실패: {str(e)}")
    
    async def embed_text(self, text: str) -> List[float]:
        """단일 텍스트 임베딩"""
        try:
            import torch
            
            inputs = self.tokenizer(text, return_tensors='pt', truncation=True, padding=True, max_length=512)
            inputs = {k: v.to(self.device) for k, v in inputs.items()}
            
            with torch.no_grad():
                outputs = self.model(**inputs)
                # 평균 풀링
                embeddings = outputs.last_hidden_state.mean(dim=1)
                
            return embeddings.cpu().numpy()[0].tolist()
        except Exception as e:
            logger.error(f"HuggingFace 임베딩 실패: {str(e)}")
            raise ValueError(f"HuggingFace 임베딩 생성 실패: {str(e)}")
    
    async def embed_batch(self, texts: List[str]) -> List[List[float]]:
        """배치 텍스트 임베딩"""
        try:
            import torch
            
            inputs = self.tokenizer(texts, return_tensors='pt', truncation=True, padding=True, max_length=512)
            inputs = {k: v.to(self.device) for k, v in inputs.items()}
            
            with torch.no_grad():
                outputs = self.model(**inputs)
                # 평균 풀링
                embeddings = outputs.last_hidden_state.mean(dim=1)
                
            return embeddings.cpu().numpy().tolist()
        except Exception as e:
            logger.error(f"HuggingFace 배치 임베딩 실패: {str(e)}")
            raise ValueError(f"HuggingFace 배치 임베딩 생성 실패: {str(e)}")
    
    def get_dimension(self) -> int:
        return self.dimension


class EmbeddingService:
    """임베딩 서비스 메인 클래스"""
    
    def __init__(self, provider: BaseEmbeddingProvider, batch_size: int = 32):
        self.provider = provider
        self.batch_size = batch_size
        self.dimension = provider.get_dimension()
        logger.info(f"임베딩 서비스 초기화 완료 - 차원: {self.dimension}, 배치 크기: {batch_size}")
    
    @classmethod
    def create_sentence_transformer(cls, model_name: str = "sentence-transformers/all-MiniLM-L6-v2", **kwargs):
        """SentenceTransformer 기반 서비스 생성"""
        provider = SentenceTransformerProvider(model_name)
        return cls(provider, **kwargs)
    
    @classmethod
    def create_openai(cls, api_key: str, model: str = "text-embedding-ada-002", **kwargs):
        """OpenAI 기반 서비스 생성"""
        provider = OpenAIEmbeddingProvider(api_key, model)
        return cls(provider, **kwargs)
    
    @classmethod
    def create_huggingface(cls, model_name: str = "sentence-transformers/all-MiniLM-L6-v2", **kwargs):
        """HuggingFace 기반 서비스 생성"""
        provider = HuggingFaceEmbeddingProvider(model_name)
        return cls(provider, **kwargs)
    
    async def embed_text(self, text: str) -> List[float]:
        """단일 텍스트 임베딩"""
        if not text or not text.strip():
            return [0.0] * self.dimension
        
        return await self.provider.embed_text(text.strip())
    
    async def embed_batch(self, texts: List[str]) -> List[List[float]]:
        """배치 텍스트 임베딩"""
        if not texts:
            return []
        
        # 빈 텍스트 필터링
        filtered_texts = [text.strip() for text in texts if text and text.strip()]
        if not filtered_texts:
            return [[0.0] * self.dimension] * len(texts)
        
        # 배치 크기로 분할하여 처리
        results = []
        for i in range(0, len(filtered_texts), self.batch_size):
            batch = filtered_texts[i:i + self.batch_size]
            batch_embeddings = await self.provider.embed_batch(batch)
            results.extend(batch_embeddings)
        
        return results
    
    async def embed_documents(self, documents: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """문서들의 임베딩 생성"""
        try:
            # 문서에서 텍스트 추출
            texts = []
            for doc in documents:
                if 'content' in doc:
                    texts.append(doc['content'])
                elif 'text' in doc:
                    texts.append(doc['text'])
                else:
                    texts.append(str(doc))
            
            # 임베딩 생성
            embeddings = await self.embed_batch(texts)
            
            # 문서에 임베딩 추가
            result_documents = []
            for i, doc in enumerate(documents):
                doc_with_embedding = doc.copy()
                doc_with_embedding['embedding'] = embeddings[i]
                doc_with_embedding['embedding_model'] = getattr(self.provider, 'model_name', 'unknown')
                doc_with_embedding['embedding_dimension'] = self.dimension
                result_documents.append(doc_with_embedding)
            
            return result_documents
            
        except Exception as e:
            logger.error(f"문서 임베딩 생성 실패: {str(e)}")
            raise ValueError(f"문서 임베딩 생성 실패: {str(e)}")
    
    def calculate_similarity(self, embedding1: List[float], embedding2: List[float]) -> float:
        """코사인 유사도 계산"""
        try:
            # NumPy 배열로 변환
            vec1 = np.array(embedding1)
            vec2 = np.array(embedding2)
            
            # 코사인 유사도 계산
            dot_product = np.dot(vec1, vec2)
            norm1 = np.linalg.norm(vec1)
            norm2 = np.linalg.norm(vec2)
            
            if norm1 == 0 or norm2 == 0:
                return 0.0
            
            return float(dot_product / (norm1 * norm2))
            
        except Exception as e:
            logger.error(f"유사도 계산 실패: {str(e)}")
            return 0.0
    
    def find_most_similar(self, query_embedding: List[float], 
                         document_embeddings: List[List[float]], 
                         top_k: int = 5) -> List[Dict[str, Any]]:
        """가장 유사한 문서들 찾기"""
        try:
            similarities = []
            
            for i, doc_embedding in enumerate(document_embeddings):
                similarity = self.calculate_similarity(query_embedding, doc_embedding)
                similarities.append({
                    'index': i,
                    'similarity': similarity
                })
            
            # 유사도 순으로 정렬
            similarities.sort(key=lambda x: x['similarity'], reverse=True)
            
            return similarities[:top_k]
            
        except Exception as e:
            logger.error(f"유사 문서 검색 실패: {str(e)}")
            return []
    
    async def search_similar_documents(self, query: str, 
                                     documents: List[Dict[str, Any]], 
                                     top_k: int = 5) -> List[Dict[str, Any]]:
        """쿼리와 유사한 문서 검색"""
        try:
            # 쿼리 임베딩 생성
            query_embedding = await self.embed_text(query)
            
            # 문서 임베딩 추출
            document_embeddings = []
            for doc in documents:
                if 'embedding' in doc:
                    document_embeddings.append(doc['embedding'])
                else:
                    # 임베딩이 없으면 생성
                    text = doc.get('content', doc.get('text', str(doc)))
                    embedding = await self.embed_text(text)
                    document_embeddings.append(embedding)
            
            # 유사한 문서 찾기
            similar_indices = self.find_most_similar(query_embedding, document_embeddings, top_k)
            
            # 결과 문서 반환
            results = []
            for item in similar_indices:
                doc = documents[item['index']].copy()
                doc['similarity_score'] = item['similarity']
                results.append(doc)
            
            return results
            
        except Exception as e:
            logger.error(f"유사 문서 검색 실패: {str(e)}")
            raise ValueError(f"유사 문서 검색 실패: {str(e)}")
    
    def get_embedding_info(self) -> Dict[str, Any]:
        """임베딩 서비스 정보 반환"""
        return {
            'provider_type': type(self.provider).__name__,
            'model_name': getattr(self.provider, 'model_name', 'unknown'),
            'dimension': self.dimension,
            'batch_size': self.batch_size
        } 