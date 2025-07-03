"""
텍스트 청킹 전략들
"""

from typing import List, Dict, Any, Optional
from abc import ABC, abstractmethod
import re
import logging
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class TextChunk:
    """텍스트 청크 데이터 클래스"""
    content: str
    start_index: int
    end_index: int
    chunk_index: int
    metadata: Dict[str, Any]
    
    def __len__(self):
        return len(self.content)
    
    def __str__(self):
        return f"Chunk {self.chunk_index}: {self.content[:100]}..."


class ChunkingStrategy(ABC):
    """청킹 전략 기본 클래스"""
    
    @abstractmethod
    async def chunk_text(self, text: str, metadata: Optional[Dict[str, Any]] = None) -> List[TextChunk]:
        """텍스트를 청크로 분할"""
        pass
    
    @abstractmethod
    def get_strategy_info(self) -> Dict[str, Any]:
        """전략 정보 반환"""
        pass


class FixedSizeChunker(ChunkingStrategy):
    """고정 크기 청킹 전략"""
    
    def __init__(self, chunk_size: int = 1000, overlap_size: int = 200):
        self.chunk_size = chunk_size
        self.overlap_size = overlap_size
        
        if overlap_size >= chunk_size:
            raise ValueError("overlap_size는 chunk_size보다 작아야 합니다")
    
    async def chunk_text(self, text: str, metadata: Optional[Dict[str, Any]] = None) -> List[TextChunk]:
        """고정 크기로 텍스트 청킹"""
        if not text:
            return []
        
        chunks = []
        chunk_index = 0
        start_index = 0
        
        while start_index < len(text):
            end_index = min(start_index + self.chunk_size, len(text))
            
            # 단어 경계에서 자르기 (완전한 단어만 포함)
            if end_index < len(text):
                # 마지막 공백 위치 찾기
                last_space = text.rfind(' ', start_index, end_index)
                if last_space > start_index:
                    end_index = last_space
            
            chunk_content = text[start_index:end_index].strip()
            
            if chunk_content:
                chunk_metadata = {
                    'strategy': 'fixed_size',
                    'chunk_size': self.chunk_size,
                    'overlap_size': self.overlap_size,
                    'word_count': len(chunk_content.split()),
                    'character_count': len(chunk_content)
                }
                
                if metadata:
                    chunk_metadata.update(metadata)
                
                chunks.append(TextChunk(
                    content=chunk_content,
                    start_index=start_index,
                    end_index=end_index,
                    chunk_index=chunk_index,
                    metadata=chunk_metadata
                ))
                
                chunk_index += 1
            
            # 다음 청크 시작 위치 (오버랩 고려)
            start_index = max(start_index + 1, end_index - self.overlap_size)
            
            # 무한 루프 방지
            if start_index >= end_index:
                break
        
        logger.info(f"고정 크기 청킹 완료: {len(chunks)}개 청크 생성")
        return chunks
    
    def get_strategy_info(self) -> Dict[str, Any]:
        return {
            'strategy_type': 'fixed_size',
            'chunk_size': self.chunk_size,
            'overlap_size': self.overlap_size
        }


class SemanticChunker(ChunkingStrategy):
    """의미적 청킹 전략 (문장/단락 단위)"""
    
    def __init__(self, max_chunk_size: int = 1500, min_chunk_size: int = 100):
        self.max_chunk_size = max_chunk_size
        self.min_chunk_size = min_chunk_size
    
    async def chunk_text(self, text: str, metadata: Optional[Dict[str, Any]] = None) -> List[TextChunk]:
        """의미 단위로 텍스트 청킹"""
        if not text:
            return []
        
        # 먼저 단락으로 분할
        paragraphs = self._split_into_paragraphs(text)
        
        # 단락을 청크로 그룹화
        chunks = []
        chunk_index = 0
        current_chunk = ""
        current_start = 0
        text_position = 0
        
        for paragraph in paragraphs:
            paragraph_text = paragraph['text']
            paragraph_start = paragraph['start']
            
            # 현재 청크에 단락을 추가했을 때 크기 확인
            potential_chunk = current_chunk + "\n\n" + paragraph_text if current_chunk else paragraph_text
            
            if len(potential_chunk) <= self.max_chunk_size:
                # 청크에 추가
                if not current_chunk:
                    current_start = paragraph_start
                current_chunk = potential_chunk
            else:
                # 현재 청크를 완료하고 새 청크 시작
                if current_chunk and len(current_chunk) >= self.min_chunk_size:
                    chunks.append(self._create_semantic_chunk(
                        current_chunk, current_start, text_position, chunk_index, metadata
                    ))
                    chunk_index += 1
                
                # 단락이 너무 큰 경우 문장으로 분할
                if len(paragraph_text) > self.max_chunk_size:
                    sentence_chunks = await self._chunk_long_paragraph(
                        paragraph_text, paragraph_start, chunk_index, metadata
                    )
                    chunks.extend(sentence_chunks)
                    chunk_index += len(sentence_chunks)
                    current_chunk = ""
                else:
                    current_chunk = paragraph_text
                    current_start = paragraph_start
            
            text_position = paragraph['end']
        
        # 마지막 청크 추가
        if current_chunk and len(current_chunk) >= self.min_chunk_size:
            chunks.append(self._create_semantic_chunk(
                current_chunk, current_start, text_position, chunk_index, metadata
            ))
        
        logger.info(f"의미적 청킹 완료: {len(chunks)}개 청크 생성")
        return chunks
    
    def _split_into_paragraphs(self, text: str) -> List[Dict[str, Any]]:
        """텍스트를 단락으로 분할"""
        paragraphs = []
        
        # 두 개 이상의 연속된 줄바꿈으로 단락 분할
        paragraph_splits = re.split(r'\n\s*\n', text)
        
        current_position = 0
        for para_text in paragraph_splits:
            para_text = para_text.strip()
            if para_text:
                start_pos = text.find(para_text, current_position)
                end_pos = start_pos + len(para_text)
                
                paragraphs.append({
                    'text': para_text,
                    'start': start_pos,
                    'end': end_pos
                })
                
                current_position = end_pos
        
        return paragraphs
    
    async def _chunk_long_paragraph(self, paragraph: str, start_pos: int, 
                                  start_chunk_index: int, metadata: Optional[Dict[str, Any]]) -> List[TextChunk]:
        """긴 단락을 문장으로 분할하여 청킹"""
        sentences = self._split_into_sentences(paragraph)
        chunks = []
        
        current_chunk = ""
        current_start = start_pos
        chunk_index = start_chunk_index
        
        for sentence in sentences:
            potential_chunk = current_chunk + " " + sentence if current_chunk else sentence
            
            if len(potential_chunk) <= self.max_chunk_size:
                current_chunk = potential_chunk
            else:
                if current_chunk:
                    chunks.append(self._create_semantic_chunk(
                        current_chunk, current_start, current_start + len(current_chunk), 
                        chunk_index, metadata
                    ))
                    chunk_index += 1
                
                current_chunk = sentence
                current_start = start_pos + paragraph.find(sentence)
        
        # 마지막 청크 추가
        if current_chunk:
            chunks.append(self._create_semantic_chunk(
                current_chunk, current_start, current_start + len(current_chunk), 
                chunk_index, metadata
            ))
        
        return chunks
    
    def _split_into_sentences(self, text: str) -> List[str]:
        """텍스트를 문장으로 분할"""
        # 간단한 문장 분할 (한국어와 영어 모두 고려)
        sentence_endings = r'[.!?]'
        sentences = re.split(sentence_endings, text)
        
        result = []
        for i, sentence in enumerate(sentences):
            sentence = sentence.strip()
            if sentence:
                # 마지막 문장이 아니면 구두점 추가
                if i < len(sentences) - 1:
                    sentence += '.'
                result.append(sentence)
        
        return result
    
    def _create_semantic_chunk(self, content: str, start: int, end: int, 
                             chunk_index: int, metadata: Optional[Dict[str, Any]]) -> TextChunk:
        """의미적 청크 생성"""
        chunk_metadata = {
            'strategy': 'semantic',
            'max_chunk_size': self.max_chunk_size,
            'min_chunk_size': self.min_chunk_size,
            'word_count': len(content.split()),
            'character_count': len(content),
            'sentence_count': len(self._split_into_sentences(content))
        }
        
        if metadata:
            chunk_metadata.update(metadata)
        
        return TextChunk(
            content=content,
            start_index=start,
            end_index=end,
            chunk_index=chunk_index,
            metadata=chunk_metadata
        )
    
    def get_strategy_info(self) -> Dict[str, Any]:
        return {
            'strategy_type': 'semantic',
            'max_chunk_size': self.max_chunk_size,
            'min_chunk_size': self.min_chunk_size
        }


class StructuredChunker(ChunkingStrategy):
    """구조화된 문서용 청킹 전략 (헤딩, 섹션 기반)"""
    
    def __init__(self, max_chunk_size: int = 2000, preserve_structure: bool = True):
        self.max_chunk_size = max_chunk_size
        self.preserve_structure = preserve_structure
    
    async def chunk_text(self, text: str, metadata: Optional[Dict[str, Any]] = None) -> List[TextChunk]:
        """구조를 고려한 텍스트 청킹"""
        if not text:
            return []
        
        # 문서 유형에 따른 구조 분석
        doc_type = metadata.get('processor_type', 'text') if metadata else 'text'
        
        if doc_type == 'markdown':
            return await self._chunk_markdown(text, metadata)
        elif doc_type in ['word', 'docx']:
            return await self._chunk_word(text, metadata)
        else:
            return await self._chunk_generic_structured(text, metadata)
    
    async def _chunk_markdown(self, text: str, metadata: Optional[Dict[str, Any]]) -> List[TextChunk]:
        """마크다운 구조 기반 청킹"""
        chunks = []
        chunk_index = 0
        
        # 헤딩으로 섹션 분할
        sections = self._extract_markdown_sections(text)
        
        for section in sections:
            section_content = section['content']
            
            if len(section_content) <= self.max_chunk_size:
                # 섹션이 크기 내에 있으면 하나의 청크로
                chunk_metadata = {
                    'strategy': 'structured_markdown',
                    'section_title': section['title'],
                    'heading_level': section['level'],
                    'section_type': 'complete_section'
                }
                if metadata:
                    chunk_metadata.update(metadata)
                
                chunks.append(TextChunk(
                    content=section_content,
                    start_index=section['start'],
                    end_index=section['end'],
                    chunk_index=chunk_index,
                    metadata=chunk_metadata
                ))
                chunk_index += 1
            else:
                # 섹션이 너무 크면 하위 분할
                sub_chunks = await self._chunk_large_section(
                    section_content, section['start'], chunk_index, section, metadata
                )
                chunks.extend(sub_chunks)
                chunk_index += len(sub_chunks)
        
        logger.info(f"마크다운 구조적 청킹 완료: {len(chunks)}개 청크 생성")
        return chunks
    
    async def _chunk_word(self, text: str, metadata: Optional[Dict[str, Any]]) -> List[TextChunk]:
        """Word 문서 구조 기반 청킹"""
        # Word 문서의 헤딩 정보 활용
        headings = metadata.get('headings', []) if metadata else []
        
        if not headings:
            # 헤딩 정보가 없으면 일반적인 의미적 청킹 사용
            semantic_chunker = SemanticChunker(self.max_chunk_size)
            return await semantic_chunker.chunk_text(text, metadata)
        
        chunks = []
        chunk_index = 0
        
        # 헤딩 기반으로 섹션 추출
        sections = self._extract_word_sections(text, headings)
        
        for section in sections:
            if len(section['content']) <= self.max_chunk_size:
                chunk_metadata = {
                    'strategy': 'structured_word',
                    'section_title': section['title'],
                    'heading_style': section.get('style'),
                    'section_type': 'complete_section'
                }
                if metadata:
                    chunk_metadata.update(metadata)
                
                chunks.append(TextChunk(
                    content=section['content'],
                    start_index=section['start'],
                    end_index=section['end'],
                    chunk_index=chunk_index,
                    metadata=chunk_metadata
                ))
                chunk_index += 1
            else:
                sub_chunks = await self._chunk_large_section(
                    section['content'], section['start'], chunk_index, section, metadata
                )
                chunks.extend(sub_chunks)
                chunk_index += len(sub_chunks)
        
        logger.info(f"Word 구조적 청킹 완료: {len(chunks)}개 청크 생성")
        return chunks
    
    async def _chunk_generic_structured(self, text: str, metadata: Optional[Dict[str, Any]]) -> List[TextChunk]:
        """일반적인 구조화된 텍스트 청킹"""
        # 번호 매겨진 섹션이나 특별한 구조 패턴 찾기
        sections = self._find_text_sections(text)
        
        if not sections:
            # 구조가 명확하지 않으면 의미적 청킹 사용
            semantic_chunker = SemanticChunker(self.max_chunk_size)
            return await semantic_chunker.chunk_text(text, metadata)
        
        chunks = []
        chunk_index = 0
        
        for section in sections:
            if len(section['content']) <= self.max_chunk_size:
                chunk_metadata = {
                    'strategy': 'structured_generic',
                    'section_title': section.get('title', f"섹션 {section['index']}"),
                    'section_type': section.get('type', 'generic_section')
                }
                if metadata:
                    chunk_metadata.update(metadata)
                
                chunks.append(TextChunk(
                    content=section['content'],
                    start_index=section['start'],
                    end_index=section['end'],
                    chunk_index=chunk_index,
                    metadata=chunk_metadata
                ))
                chunk_index += 1
            else:
                sub_chunks = await self._chunk_large_section(
                    section['content'], section['start'], chunk_index, section, metadata
                )
                chunks.extend(sub_chunks)
                chunk_index += len(sub_chunks)
        
        logger.info(f"일반 구조적 청킹 완료: {len(chunks)}개 청크 생성")
        return chunks
    
    def _extract_markdown_sections(self, text: str) -> List[Dict[str, Any]]:
        """마크다운에서 섹션 추출"""
        sections = []
        lines = text.split('\n')
        
        current_section = None
        current_content = []
        current_start = 0
        position = 0
        
        for line in lines:
            line_start = position
            position += len(line) + 1  # +1 for newline
            
            # ATX 스타일 헤딩 확인 (# ## ### 등)
            heading_match = re.match(r'^(#{1,6})\s+(.+)', line.strip())
            
            if heading_match:
                # 이전 섹션 완료
                if current_section is not None:
                    current_section['content'] = '\n'.join(current_content).strip()
                    current_section['end'] = line_start
                    if current_section['content']:
                        sections.append(current_section)
                
                # 새 섹션 시작
                level = len(heading_match.group(1))
                title = heading_match.group(2).strip()
                
                current_section = {
                    'title': title,
                    'level': level,
                    'start': line_start,
                    'end': position
                }
                current_content = [line]
                current_start = line_start
            else:
                if current_section is not None:
                    current_content.append(line)
                else:
                    # 첫 번째 헤딩 이전의 내용
                    if not sections:
                        current_section = {
                            'title': '서문',
                            'level': 0,
                            'start': 0,
                            'end': position
                        }
                        current_content = [line]
        
        # 마지막 섹션 추가
        if current_section is not None:
            current_section['content'] = '\n'.join(current_content).strip()
            current_section['end'] = position
            if current_section['content']:
                sections.append(current_section)
        
        return sections
    
    def _extract_word_sections(self, text: str, headings: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Word 문서에서 섹션 추출"""
        sections = []
        
        # 헤딩 위치 기반으로 섹션 분할
        sorted_headings = sorted(headings, key=lambda x: x.get('position', 0))
        
        for i, heading in enumerate(sorted_headings):
            start_pos = heading.get('position', 0)
            end_pos = sorted_headings[i + 1].get('position', len(text)) if i + 1 < len(sorted_headings) else len(text)
            
            section_content = text[start_pos:end_pos].strip()
            
            sections.append({
                'title': heading.get('text', f"헤딩 {i + 1}"),
                'style': heading.get('style'),
                'start': start_pos,
                'end': end_pos,
                'content': section_content
            })
        
        return sections
    
    def _find_text_sections(self, text: str) -> List[Dict[str, Any]]:
        """일반 텍스트에서 섹션 패턴 찾기"""
        sections = []
        
        # 번호 매겨진 섹션 패턴 (1. 2. 3. 또는 1) 2) 3))
        numbered_pattern = r'^(\d+[\.\)])\s+(.+)$'
        
        lines = text.split('\n')
        current_section = None
        current_content = []
        position = 0
        
        for line in lines:
            line_start = position
            position += len(line) + 1
            
            match = re.match(numbered_pattern, line.strip())
            
            if match:
                # 이전 섹션 완료
                if current_section is not None:
                    current_section['content'] = '\n'.join(current_content).strip()
                    current_section['end'] = line_start
                    if current_section['content']:
                        sections.append(current_section)
                
                # 새 섹션 시작
                section_num = match.group(1)
                section_title = match.group(2)
                
                current_section = {
                    'index': section_num,
                    'title': section_title,
                    'type': 'numbered_section',
                    'start': line_start,
                    'end': position
                }
                current_content = [line]
            else:
                if current_section is not None:
                    current_content.append(line)
        
        # 마지막 섹션 추가
        if current_section is not None:
            current_section['content'] = '\n'.join(current_content).strip()
            current_section['end'] = position
            if current_section['content']:
                sections.append(current_section)
        
        return sections
    
    async def _chunk_large_section(self, content: str, start_pos: int, start_chunk_index: int, 
                                 section_info: Dict[str, Any], metadata: Optional[Dict[str, Any]]) -> List[TextChunk]:
        """큰 섹션을 하위 청크로 분할"""
        # 의미적 청킹으로 하위 분할
        semantic_chunker = SemanticChunker(self.max_chunk_size)
        sub_chunks = await semantic_chunker.chunk_text(content, metadata)
        
        # 섹션 정보를 메타데이터에 추가
        result_chunks = []
        for i, chunk in enumerate(sub_chunks):
            chunk.chunk_index = start_chunk_index + i
            chunk.start_index = start_pos + chunk.start_index
            chunk.end_index = start_pos + chunk.end_index
            
            # 메타데이터에 섹션 정보 추가
            chunk.metadata.update({
                'strategy': 'structured_subdivided',
                'parent_section_title': section_info.get('title', ''),
                'parent_section_type': section_info.get('type', ''),
                'sub_chunk_index': i,
                'total_sub_chunks': len(sub_chunks)
            })
            
            result_chunks.append(chunk)
        
        return result_chunks
    
    def get_strategy_info(self) -> Dict[str, Any]:
        return {
            'strategy_type': 'structured',
            'max_chunk_size': self.max_chunk_size,
            'preserve_structure': self.preserve_structure
        } 