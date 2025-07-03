"""
Figure-MCP Document Processor

다양한 형식의 개발 표준 문서를 처리하고 벡터화하는 서비스
"""

__version__ = "1.0.0"
__author__ = "Figure-MCP Team"

from .document_engine import DocumentProcessingEngine
from .processors.base import BaseProcessor, ProcessedDocument, DocumentChunk
from .processors.excel_processor import ExcelProcessor
from .processors.word_processor import WordProcessor
from .processors.markdown_processor import MarkdownProcessor
from .processors.text_processor import TextProcessor

from .embedding.embedding_service import EmbeddingService
from .embedding.chunking_strategy import (
    ChunkingStrategy,
    FixedSizeChunker,
    SemanticChunker,
    StructuredChunker
)
from .embedding.vector_store import VectorStore

__all__ = [
    "DocumentProcessingEngine",
    "BaseProcessor",
    "ProcessedDocument",
    "DocumentChunk",
    "ExcelProcessor", 
    "WordProcessor",
    "MarkdownProcessor",
    "TextProcessor",
    "EmbeddingService",
    "ChunkingStrategy",
    "FixedSizeChunker",
    "SemanticChunker",
    "StructuredChunker",
    "VectorStore",
] 