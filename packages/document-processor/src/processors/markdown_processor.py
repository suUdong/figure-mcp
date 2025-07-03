"""
Markdown 파일 프로세서
"""

from typing import Dict, Any, List
import markdown
from markdown.extensions import tables, codehilite, toc
import re
from pathlib import Path

from .base import BaseProcessor


class MarkdownProcessor(BaseProcessor):
    """Markdown 파일 처리기"""
    
    def __init__(self):
        super().__init__()
        self.supported_extensions = ['.md', '.markdown', '.mdown', '.mkd']
        self.supported_mime_types = [
            'text/markdown',
            'text/x-markdown'
        ]
        
        # Markdown 파서 설정
        self.md = markdown.Markdown(
            extensions=[
                'markdown.extensions.tables',
                'markdown.extensions.codehilite',
                'markdown.extensions.toc',
                'markdown.extensions.fenced_code',
                'markdown.extensions.def_list',
                'markdown.extensions.footnotes',
                'markdown.extensions.attr_list'
            ],
            extension_configs={
                'markdown.extensions.toc': {
                    'permalink': True,
                    'baselevel': 1
                },
                'markdown.extensions.codehilite': {
                    'css_class': 'highlight'
                }
            }
        )
    
    async def extract_text(self, file_path: str) -> str:
        """Markdown 파일에서 텍스트 추출"""
        try:
            with open(file_path, 'r', encoding='utf-8') as file:
                content = file.read()
            
            # 원본 마크다운 텍스트 반환 (구조 정보 포함)
            return self.clean_text(content)
            
        except UnicodeDecodeError:
            # UTF-8로 읽기 실패 시 다른 인코딩 시도
            try:
                with open(file_path, 'r', encoding='cp949') as file:
                    content = file.read()
                return self.clean_text(content)
            except Exception as e:
                raise ValueError(f"Markdown 파일 인코딩 오류: {str(e)}")
        except Exception as e:
            raise ValueError(f"Markdown 파일 텍스트 추출 실패: {str(e)}")
    
    async def extract_metadata(self, file_path: str) -> Dict[str, Any]:
        """Markdown 파일에서 메타데이터 추출"""
        try:
            with open(file_path, 'r', encoding='utf-8') as file:
                content = file.read()
            
            metadata = {
                'processor_type': 'markdown',
                'line_count': len(content.split('\n')),
                'word_count': len(content.split()),
                'character_count': len(content),
                'headings': [],
                'code_blocks': [],
                'links': [],
                'images': [],
                'tables': 0,
                'front_matter': {}
            }
            
            # Front Matter 추출 (YAML 헤더)
            front_matter = self._extract_front_matter(content)
            if front_matter:
                metadata['front_matter'] = front_matter
            
            # 제목 구조 분석
            headings = self._extract_headings(content)
            metadata['headings'] = headings
            
            # 코드 블록 분석
            code_blocks = self._extract_code_blocks(content)
            metadata['code_blocks'] = code_blocks
            
            # 링크 추출
            links = self._extract_links(content)
            metadata['links'] = links
            
            # 이미지 추출
            images = self._extract_images(content)
            metadata['images'] = images
            
            # 테이블 개수
            table_count = len(re.findall(r'\|.*\|', content))
            metadata['tables'] = table_count
            
            return metadata
            
        except Exception as e:
            raise ValueError(f"Markdown 메타데이터 추출 실패: {str(e)}")
    
    def _extract_front_matter(self, content: str) -> Dict[str, Any]:
        """Front Matter (YAML 헤더) 추출"""
        front_matter_pattern = r'^---\s*\n(.*?)\n---\s*\n'
        match = re.match(front_matter_pattern, content, re.DOTALL)
        
        if match:
            try:
                import yaml
                return yaml.safe_load(match.group(1))
            except ImportError:
                # YAML 라이브러리가 없으면 간단한 파싱
                lines = match.group(1).split('\n')
                result = {}
                for line in lines:
                    if ':' in line:
                        key, value = line.split(':', 1)
                        result[key.strip()] = value.strip()
                return result
            except Exception:
                return {}
        
        return {}
    
    def _extract_headings(self, content: str) -> List[Dict[str, Any]]:
        """헤딩 구조 추출"""
        headings = []
        lines = content.split('\n')
        
        for i, line in enumerate(lines):
            line = line.strip()
            
            # ATX 스타일 헤딩 (# ## ### 등)
            atx_match = re.match(r'^(#{1,6})\s+(.+)', line)
            if atx_match:
                level = len(atx_match.group(1))
                text = atx_match.group(2).strip()
                headings.append({
                    'level': level,
                    'text': text,
                    'line_number': i + 1,
                    'style': 'atx'
                })
                continue
            
            # Setext 스타일 헤딩 (= 또는 - 밑줄)
            if i + 1 < len(lines):
                next_line = lines[i + 1].strip()
                if next_line and all(c in '=' for c in next_line) and len(next_line) >= 3:
                    headings.append({
                        'level': 1,
                        'text': line,
                        'line_number': i + 1,
                        'style': 'setext'
                    })
                elif next_line and all(c in '-' for c in next_line) and len(next_line) >= 3:
                    headings.append({
                        'level': 2,
                        'text': line,
                        'line_number': i + 1,
                        'style': 'setext'
                    })
        
        return headings
    
    def _extract_code_blocks(self, content: str) -> List[Dict[str, Any]]:
        """코드 블록 추출"""
        code_blocks = []
        
        # 펜스드 코드 블록 (```)
        fenced_pattern = r'```(\w+)?\n(.*?)\n```'
        for match in re.finditer(fenced_pattern, content, re.DOTALL):
            language = match.group(1) or 'text'
            code = match.group(2)
            code_blocks.append({
                'type': 'fenced',
                'language': language,
                'code': code.strip(),
                'line_count': len(code.split('\n'))
            })
        
        # 인덴트 코드 블록 (4칸 들여쓰기)
        lines = content.split('\n')
        in_code_block = False
        current_code = []
        
        for line in lines:
            if line.startswith('    ') or line.startswith('\t'):
                if not in_code_block:
                    in_code_block = True
                    current_code = []
                current_code.append(line[4:] if line.startswith('    ') else line[1:])
            else:
                if in_code_block and current_code:
                    code_blocks.append({
                        'type': 'indented',
                        'language': 'text',
                        'code': '\n'.join(current_code).strip(),
                        'line_count': len(current_code)
                    })
                in_code_block = False
                current_code = []
        
        return code_blocks
    
    def _extract_links(self, content: str) -> List[Dict[str, Any]]:
        """링크 추출"""
        links = []
        
        # 인라인 링크 [text](url)
        inline_pattern = r'\[([^\]]+)\]\(([^)]+)\)'
        for match in re.finditer(inline_pattern, content):
            links.append({
                'type': 'inline',
                'text': match.group(1),
                'url': match.group(2),
                'is_external': match.group(2).startswith(('http://', 'https://'))
            })
        
        # 참조 링크 [text][ref]
        reference_pattern = r'\[([^\]]+)\]\[([^\]]+)\]'
        for match in re.finditer(reference_pattern, content):
            links.append({
                'type': 'reference',
                'text': match.group(1),
                'ref': match.group(2)
            })
        
        return links
    
    def _extract_images(self, content: str) -> List[Dict[str, Any]]:
        """이미지 추출"""
        images = []
        
        # 이미지 ![alt](src)
        image_pattern = r'!\[([^\]]*)\]\(([^)]+)\)'
        for match in re.finditer(image_pattern, content):
            images.append({
                'alt_text': match.group(1),
                'src': match.group(2),
                'is_external': match.group(2).startswith(('http://', 'https://'))
            })
        
        return images
    
    async def extract_structured_data(self, file_path: str) -> List[Dict[str, Any]]:
        """Markdown에서 구조화된 데이터 추출"""
        try:
            with open(file_path, 'r', encoding='utf-8') as file:
                content = file.read()
            
            structured_data = []
            
            # 문서 개요 (헤딩 구조)
            headings = self._extract_headings(content)
            if headings:
                structured_data.append({
                    'type': 'outline',
                    'title': '문서 구조',
                    'data': headings
                })
            
            # 테이블 추출
            tables = self._extract_tables(content)
            for i, table in enumerate(tables):
                table['table_index'] = i
                structured_data.append(table)
            
            # 코드 블록
            code_blocks = self._extract_code_blocks(content)
            if code_blocks:
                structured_data.append({
                    'type': 'code_blocks',
                    'title': '코드 블록',
                    'data': code_blocks
                })
            
            # 목록 구조
            lists = self._extract_lists(content)
            for i, list_data in enumerate(lists):
                list_data['list_index'] = i
                structured_data.append(list_data)
            
            return structured_data
            
        except Exception as e:
            raise ValueError(f"Markdown 구조화된 데이터 추출 실패: {str(e)}")
    
    def _extract_tables(self, content: str) -> List[Dict[str, Any]]:
        """테이블 추출"""
        tables = []
        lines = content.split('\n')
        
        i = 0
        while i < len(lines):
            line = lines[i].strip()
            
            # 테이블 라인 확인 (|가 포함된 라인)
            if '|' in line and line.startswith('|') and line.endswith('|'):
                table_lines = [line]
                i += 1
                
                # 다음 라인이 구분자인지 확인 (|---|---|)
                if i < len(lines) and re.match(r'^\|[\s\-:]+\|$', lines[i].strip()):
                    separator = lines[i].strip()
                    table_lines.append(separator)
                    i += 1
                    
                    # 나머지 테이블 라인들 수집
                    while i < len(lines):
                        next_line = lines[i].strip()
                        if '|' in next_line and next_line.startswith('|') and next_line.endswith('|'):
                            table_lines.append(next_line)
                            i += 1
                        else:
                            break
                    
                    # 테이블 파싱
                    if len(table_lines) >= 3:  # 헤더 + 구분자 + 최소 1개 데이터 행
                        table_data = self._parse_markdown_table(table_lines)
                        if table_data:
                            tables.append(table_data)
                else:
                    i += 1
            else:
                i += 1
        
        return tables
    
    def _parse_markdown_table(self, table_lines: List[str]) -> Dict[str, Any]:
        """마크다운 테이블 파싱"""
        if len(table_lines) < 3:
            return None
        
        # 헤더 파싱
        header_line = table_lines[0]
        headers = [cell.strip() for cell in header_line.split('|')[1:-1]]
        
        # 데이터 행 파싱
        data_rows = []
        for line in table_lines[2:]:  # 헤더와 구분자 제외
            cells = [cell.strip() for cell in line.split('|')[1:-1]]
            if len(cells) == len(headers):
                data_rows.append(cells)
        
        return {
            'type': 'table',
            'headers': headers,
            'rows': len(data_rows),
            'columns': len(headers),
            'data': data_rows
        }
    
    def _extract_lists(self, content: str) -> List[Dict[str, Any]]:
        """목록 구조 추출"""
        lists = []
        lines = content.split('\n')
        current_list = None
        
        for line in lines:
            stripped = line.strip()
            
            # 순서 없는 목록 (-, *, +)
            unordered_match = re.match(r'^([\-\*\+])\s+(.+)', stripped)
            if unordered_match:
                if current_list is None or current_list['type'] != 'unordered':
                    if current_list:
                        lists.append(current_list)
                    current_list = {
                        'type': 'unordered',
                        'items': []
                    }
                
                indent_level = (len(line) - len(line.lstrip())) // 2
                current_list['items'].append({
                    'text': unordered_match.group(2),
                    'level': indent_level,
                    'marker': unordered_match.group(1)
                })
                continue
            
            # 순서 있는 목록 (1., 2., 등)
            ordered_match = re.match(r'^(\d+)\.\s+(.+)', stripped)
            if ordered_match:
                if current_list is None or current_list['type'] != 'ordered':
                    if current_list:
                        lists.append(current_list)
                    current_list = {
                        'type': 'ordered',
                        'items': []
                    }
                
                indent_level = (len(line) - len(line.lstrip())) // 2
                current_list['items'].append({
                    'text': ordered_match.group(2),
                    'level': indent_level,
                    'number': int(ordered_match.group(1))
                })
                continue
            
            # 목록이 아닌 라인
            if current_list and stripped == '':
                continue  # 빈 라인은 무시
            elif current_list:
                lists.append(current_list)
                current_list = None
        
        # 마지막 목록 추가
        if current_list:
            lists.append(current_list)
        
        return lists 