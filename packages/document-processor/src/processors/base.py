"""
기본 문서 프로세서 인터페이스
"""

from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional
from dataclasses import dataclass
from pathlib import Path
import os
import mimetypes


@dataclass
class ProcessedDocument:
    """처리된 문서 정보"""
    content: str
    metadata: Dict[str, Any]
    chunks: List[str]
    file_type: str
    file_size: int
    processing_time: float


@dataclass 
class DocumentChunk:
    """문서 청크 정보"""
    content: str
    chunk_index: int
    metadata: Dict[str, Any]
    start_position: Optional[int] = None
    end_position: Optional[int] = None


class BaseProcessor(ABC):
    """문서 프로세서 기본 클래스"""
    
    def __init__(self):
        self.supported_extensions: List[str] = []
        self.supported_mime_types: List[str] = []
        
    def can_process(self, file_path: str) -> bool:
        """파일을 처리할 수 있는지 확인"""
        file_path = Path(file_path)
        
        # 확장자 확인
        if file_path.suffix.lower() in self.supported_extensions:
            return True
            
        # MIME 타입 확인
        mime_type, _ = mimetypes.guess_type(str(file_path))
        if mime_type and mime_type in self.supported_mime_types:
            return True
            
        return False
    
    def validate_file(self, file_path: str) -> bool:
        """파일 유효성 검사"""
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"파일을 찾을 수 없습니다: {file_path}")
            
        if not os.path.isfile(file_path):
            raise ValueError(f"디렉토리는 처리할 수 없습니다: {file_path}")
            
        file_size = os.path.getsize(file_path)
        max_size = 100 * 1024 * 1024  # 100MB
        if file_size > max_size:
            raise ValueError(f"파일 크기가 너무 큽니다: {file_size} bytes (최대: {max_size} bytes)")
            
        return True
    
    @abstractmethod
    async def extract_text(self, file_path: str) -> str:
        """파일에서 텍스트 추출"""
        pass
    
    @abstractmethod
    async def extract_metadata(self, file_path: str) -> Dict[str, Any]:
        """파일에서 메타데이터 추출"""
        pass
    
    async def process_document(
        self, 
        file_path: str,
        chunk_size: int = 1000,
        chunk_overlap: int = 200
    ) -> ProcessedDocument:
        """문서 전체 처리 파이프라인"""
        import time
        
        start_time = time.time()
        
        # 파일 유효성 검사
        self.validate_file(file_path)
        
        if not self.can_process(file_path):
            raise ValueError(f"지원하지 않는 파일 형식입니다: {file_path}")
        
        # 텍스트 및 메타데이터 추출
        content = await self.extract_text(file_path)
        metadata = await self.extract_metadata(file_path)
        
        # 텍스트 청킹
        chunks = await self.chunk_text(content, chunk_size, chunk_overlap)
        
        # 파일 정보 추가
        file_info = self.get_file_info(file_path)
        metadata.update(file_info)
        
        processing_time = time.time() - start_time
        
        return ProcessedDocument(
            content=content,
            metadata=metadata,
            chunks=chunks,
            file_type=file_info['file_type'],
            file_size=file_info['file_size'],
            processing_time=processing_time
        )
    
    async def chunk_text(
        self, 
        text: str, 
        chunk_size: int = 1000, 
        chunk_overlap: int = 200
    ) -> List[str]:
        """텍스트를 청크로 분할"""
        if not text.strip():
            return []
            
        chunks = []
        start = 0
        
        while start < len(text):
            end = start + chunk_size
            
            # 청크 끝이 텍스트 끝을 넘어가지 않도록 조정
            if end > len(text):
                end = len(text)
            
            # 단어 경계에서 자르기 시도
            if end < len(text) and not text[end].isspace():
                # 마지막 공백까지 뒤로 이동
                last_space = text.rfind(' ', start, end)
                if last_space > start:
                    end = last_space
            
            chunk = text[start:end].strip()
            if chunk:
                chunks.append(chunk)
            
            # 다음 시작점 설정 (오버랩 고려)
            start = max(start + 1, end - chunk_overlap)
            
            # 무한 루프 방지
            if start >= len(text):
                break
                
        return chunks
    
    def get_file_info(self, file_path: str) -> Dict[str, Any]:
        """파일 기본 정보 추출"""
        file_path = Path(file_path)
        stat = file_path.stat()
        
        mime_type, encoding = mimetypes.guess_type(str(file_path))
        
        return {
            'file_name': file_path.name,
            'file_path': str(file_path.absolute()),
            'file_size': stat.st_size,
            'file_type': file_path.suffix.lower(),
            'mime_type': mime_type,
            'encoding': encoding,
            'created_at': stat.st_ctime,
            'modified_at': stat.st_mtime,
        }
    
    def clean_text(self, text: str) -> str:
        """텍스트 정리"""
        if not text:
            return ""
            
        # 과도한 공백 제거
        import re
        text = re.sub(r'\s+', ' ', text)
        
        # 앞뒤 공백 제거
        text = text.strip()
        
        return text
    
    async def extract_structured_data(self, file_path: str) -> List[Dict[str, Any]]:
        """구조화된 데이터 추출 (표, 목록 등)"""
        # 기본 구현은 빈 리스트 반환
        # 서브클래스에서 필요에 따라 오버라이드
        return [] 