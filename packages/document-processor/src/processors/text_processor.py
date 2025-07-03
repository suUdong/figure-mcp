"""
일반 텍스트 파일 프로세서
"""

from typing import Dict, Any, List
import re
import unicodedata
from pathlib import Path

from .base import BaseProcessor


class TextProcessor(BaseProcessor):
    """일반 텍스트 파일 처리기"""
    
    def __init__(self):
        super().__init__()
        self.supported_extensions = ['.txt', '.text', '.log', '.csv', '.tsv', '.json', '.xml', '.yaml', '.yml']
        self.supported_mime_types = [
            'text/plain',
            'text/csv',
            'application/json',
            'application/xml',
            'text/xml',
            'application/yaml',
            'text/yaml'
        ]
    
    async def extract_text(self, file_path: str) -> str:
        """텍스트 파일에서 텍스트 추출"""
        try:
            # 먼저 UTF-8로 시도
            try:
                with open(file_path, 'r', encoding='utf-8') as file:
                    content = file.read()
            except UnicodeDecodeError:
                # UTF-8 실패 시 다른 인코딩들 시도
                encodings = ['cp949', 'euc-kr', 'latin1', 'ascii']
                content = None
                
                for encoding in encodings:
                    try:
                        with open(file_path, 'r', encoding=encoding) as file:
                            content = file.read()
                        break
                    except UnicodeDecodeError:
                        continue
                
                if content is None:
                    # 바이너리 모드로 읽고 강제 디코딩
                    with open(file_path, 'rb') as file:
                        raw_content = file.read()
                    content = raw_content.decode('utf-8', errors='ignore')
            
            return self.clean_text(content)
            
        except Exception as e:
            raise ValueError(f"텍스트 파일 읽기 실패: {str(e)}")
    
    async def extract_metadata(self, file_path: str) -> Dict[str, Any]:
        """텍스트 파일에서 메타데이터 추출"""
        try:
            content = await self.extract_text(file_path)
            
            # 기본 통계
            lines = content.split('\n')
            words = content.split()
            
            metadata = {
                'processor_type': 'text',
                'line_count': len(lines),
                'word_count': len(words),
                'character_count': len(content),
                'character_count_no_spaces': len(content.replace(' ', '')),
                'paragraph_count': len([p for p in content.split('\n\n') if p.strip()]),
                'average_line_length': sum(len(line) for line in lines) / len(lines) if lines else 0,
                'average_word_length': sum(len(word) for word in words) / len(words) if words else 0,
                'encoding_detected': self._detect_encoding(file_path),
                'file_extension': Path(file_path).suffix.lower(),
                'language_stats': self._analyze_language(content),
                'structure_analysis': self._analyze_structure(content)
            }
            
            # 파일 확장자별 특별한 분석
            file_ext = Path(file_path).suffix.lower()
            if file_ext == '.csv':
                metadata.update(self._analyze_csv(content))
            elif file_ext == '.json':
                metadata.update(self._analyze_json(content))
            elif file_ext == '.xml':
                metadata.update(self._analyze_xml(content))
            elif file_ext in ['.yaml', '.yml']:
                metadata.update(self._analyze_yaml(content))
            elif file_ext == '.log':
                metadata.update(self._analyze_log(content))
            
            return metadata
            
        except Exception as e:
            raise ValueError(f"텍스트 메타데이터 추출 실패: {str(e)}")
    
    def _detect_encoding(self, file_path: str) -> str:
        """파일 인코딩 감지"""
        try:
            import chardet
            with open(file_path, 'rb') as file:
                raw_data = file.read(10000)  # 처음 10KB만 읽어서 감지
            result = chardet.detect(raw_data)
            return result['encoding'] if result['encoding'] else 'unknown'
        except ImportError:
            # chardet가 없으면 간단한 감지
            try:
                with open(file_path, 'r', encoding='utf-8') as file:
                    file.read(100)
                return 'utf-8'
            except UnicodeDecodeError:
                try:
                    with open(file_path, 'r', encoding='cp949') as file:
                        file.read(100)
                    return 'cp949'
                except UnicodeDecodeError:
                    return 'unknown'
        except Exception:
            return 'unknown'
    
    def _analyze_language(self, content: str) -> Dict[str, Any]:
        """언어 분석 (한글, 영어, 숫자 등 비율)"""
        if not content:
            return {}
        
        # 문자 유형별 카운트
        korean_count = 0
        english_count = 0
        number_count = 0
        punctuation_count = 0
        space_count = 0
        other_count = 0
        
        for char in content:
            if '\uac00' <= char <= '\ud7af':  # 한글
                korean_count += 1
            elif char.isalpha() and ord(char) < 128:  # 영어
                english_count += 1
            elif char.isdigit():  # 숫자
                number_count += 1
            elif char in '.,!?;:"\'()[]{}':  # 구두점
                punctuation_count += 1
            elif char.isspace():  # 공백
                space_count += 1
            else:
                other_count += 1
        
        total_chars = len(content)
        
        return {
            'korean_ratio': korean_count / total_chars if total_chars > 0 else 0,
            'english_ratio': english_count / total_chars if total_chars > 0 else 0,
            'number_ratio': number_count / total_chars if total_chars > 0 else 0,
            'punctuation_ratio': punctuation_count / total_chars if total_chars > 0 else 0,
            'space_ratio': space_count / total_chars if total_chars > 0 else 0,
            'other_ratio': other_count / total_chars if total_chars > 0 else 0,
            'dominant_language': self._get_dominant_language(korean_count, english_count, other_count)
        }
    
    def _get_dominant_language(self, korean: int, english: int, other: int) -> str:
        """주요 언어 결정"""
        max_count = max(korean, english, other)
        if max_count == 0:
            return 'unknown'
        elif max_count == korean:
            return 'korean'
        elif max_count == english:
            return 'english'
        else:
            return 'mixed'
    
    def _analyze_structure(self, content: str) -> Dict[str, Any]:
        """텍스트 구조 분석"""
        lines = content.split('\n')
        
        # 빈 줄 분석
        empty_lines = sum(1 for line in lines if not line.strip())
        
        # 들여쓰기 분석
        indented_lines = sum(1 for line in lines if line.startswith(' ') or line.startswith('\t'))
        
        # 긴 줄 분석 (80자 이상)
        long_lines = sum(1 for line in lines if len(line) > 80)
        
        # 대문자로 시작하는 줄 (제목 가능성)
        title_like_lines = sum(1 for line in lines if line.strip() and line.strip()[0].isupper())
        
        # 숫자로 시작하는 줄 (번호 매긴 목록 가능성)
        numbered_lines = sum(1 for line in lines if re.match(r'^\s*\d+', line))
        
        # 특수 문자로 시작하는 줄 (목록 가능성)
        bullet_lines = sum(1 for line in lines if re.match(r'^\s*[-*+]', line))
        
        return {
            'empty_line_ratio': empty_lines / len(lines) if lines else 0,
            'indented_line_ratio': indented_lines / len(lines) if lines else 0,
            'long_line_ratio': long_lines / len(lines) if lines else 0,
            'title_like_ratio': title_like_lines / len(lines) if lines else 0,
            'numbered_line_ratio': numbered_lines / len(lines) if lines else 0,
            'bullet_line_ratio': bullet_lines / len(lines) if lines else 0,
            'avg_line_length': sum(len(line) for line in lines) / len(lines) if lines else 0,
            'max_line_length': max(len(line) for line in lines) if lines else 0
        }
    
    def _analyze_csv(self, content: str) -> Dict[str, Any]:
        """CSV 파일 분석"""
        lines = content.strip().split('\n')
        if not lines:
            return {'csv_analysis': {}}
        
        # 구분자 감지
        first_line = lines[0]
        comma_count = first_line.count(',')
        tab_count = first_line.count('\t')
        semicolon_count = first_line.count(';')
        
        delimiter = ','
        if tab_count > comma_count and tab_count > semicolon_count:
            delimiter = '\t'
        elif semicolon_count > comma_count:
            delimiter = ';'
        
        # 열 개수 분석
        columns = len(first_line.split(delimiter))
        
        return {
            'csv_analysis': {
                'delimiter': delimiter,
                'estimated_columns': columns,
                'estimated_rows': len(lines),
                'has_header': self._has_csv_header(lines, delimiter)
            }
        }
    
    def _has_csv_header(self, lines: List[str], delimiter: str) -> bool:
        """CSV에 헤더가 있는지 추정"""
        if len(lines) < 2:
            return False
        
        first_row = lines[0].split(delimiter)
        second_row = lines[1].split(delimiter) if len(lines) > 1 else []
        
        # 첫 번째 행이 모두 문자이고 두 번째 행에 숫자가 있으면 헤더일 가능성
        first_all_text = all(not cell.strip().replace('.', '').replace('-', '').isdigit() 
                           for cell in first_row if cell.strip())
        second_has_numbers = any(cell.strip().replace('.', '').replace('-', '').isdigit() 
                               for cell in second_row if cell.strip())
        
        return first_all_text and second_has_numbers
    
    def _analyze_json(self, content: str) -> Dict[str, Any]:
        """JSON 파일 분석"""
        try:
            import json
            data = json.loads(content)
            
            def count_elements(obj, depth=0):
                if isinstance(obj, dict):
                    return {
                        'type': 'object',
                        'keys': len(obj),
                        'depth': depth,
                        'nested_objects': sum(1 for v in obj.values() if isinstance(v, dict)),
                        'nested_arrays': sum(1 for v in obj.values() if isinstance(v, list))
                    }
                elif isinstance(obj, list):
                    return {
                        'type': 'array',
                        'length': len(obj),
                        'depth': depth,
                        'item_types': list(set(type(item).__name__ for item in obj))
                    }
                else:
                    return {'type': type(obj).__name__, 'depth': depth}
            
            analysis = count_elements(data)
            
            return {
                'json_analysis': {
                    'is_valid_json': True,
                    'root_type': analysis['type'],
                    'structure': analysis
                }
            }
        
        except json.JSONDecodeError as e:
            return {
                'json_analysis': {
                    'is_valid_json': False,
                    'error': str(e)
                }
            }
    
    def _analyze_xml(self, content: str) -> Dict[str, Any]:
        """XML 파일 분석"""
        # 태그 개수 세기
        tag_pattern = r'<[^>]+>'
        tags = re.findall(tag_pattern, content)
        
        # 루트 엘리먼트 찾기
        root_pattern = r'<([a-zA-Z][a-zA-Z0-9]*)[^>]*>'
        root_match = re.search(root_pattern, content)
        root_element = root_match.group(1) if root_match else None
        
        return {
            'xml_analysis': {
                'tag_count': len(tags),
                'unique_tags': len(set(tag.split()[0].strip('<>') for tag in tags if tag.strip('<>/'))),
                'root_element': root_element,
                'has_xml_declaration': content.strip().startswith('<?xml'),
                'estimated_depth': content.count('<') // 2
            }
        }
    
    def _analyze_yaml(self, content: str) -> Dict[str, Any]:
        """YAML 파일 분석"""
        lines = content.split('\n')
        
        # 들여쓰기 레벨 분석
        indent_levels = []
        for line in lines:
            if line.strip() and not line.strip().startswith('#'):
                leading_spaces = len(line) - len(line.lstrip())
                if leading_spaces > 0:
                    indent_levels.append(leading_spaces)
        
        # 키-값 쌍 개수
        key_value_pairs = sum(1 for line in lines if ':' in line and not line.strip().startswith('#'))
        
        # 리스트 아이템 개수
        list_items = sum(1 for line in lines if line.strip().startswith('-'))
        
        return {
            'yaml_analysis': {
                'key_value_pairs': key_value_pairs,
                'list_items': list_items,
                'max_indent_level': max(indent_levels) if indent_levels else 0,
                'comment_lines': sum(1 for line in lines if line.strip().startswith('#'))
            }
        }
    
    def _analyze_log(self, content: str) -> Dict[str, Any]:
        """로그 파일 분석"""
        lines = content.split('\n')
        
        # 로그 레벨 감지
        log_levels = ['ERROR', 'WARN', 'INFO', 'DEBUG', 'TRACE', 'FATAL']
        level_counts = {}
        
        for level in log_levels:
            level_counts[level.lower()] = sum(1 for line in lines if level in line.upper())
        
        # 타임스탬프 패턴 감지
        timestamp_patterns = [
            r'\d{4}-\d{2}-\d{2}',  # YYYY-MM-DD
            r'\d{2}/\d{2}/\d{4}',  # MM/DD/YYYY
            r'\d{2}:\d{2}:\d{2}',  # HH:MM:SS
        ]
        
        timestamp_count = 0
        for pattern in timestamp_patterns:
            timestamp_count += len(re.findall(pattern, content))
        
        return {
            'log_analysis': {
                'log_level_counts': level_counts,
                'estimated_log_entries': timestamp_count,
                'has_timestamps': timestamp_count > 0,
                'avg_line_length': sum(len(line) for line in lines) / len(lines) if lines else 0
            }
        }
    
    async def extract_structured_data(self, file_path: str) -> List[Dict[str, Any]]:
        """텍스트에서 구조화된 데이터 추출"""
        try:
            content = await self.extract_text(file_path)
            structured_data = []
            
            file_ext = Path(file_path).suffix.lower()
            
            if file_ext == '.csv':
                structured_data.extend(self._extract_csv_data(content))
            elif file_ext == '.json':
                structured_data.extend(self._extract_json_data(content))
            elif file_ext == '.xml':
                structured_data.extend(self._extract_xml_data(content))
            elif file_ext in ['.yaml', '.yml']:
                structured_data.extend(self._extract_yaml_data(content))
            else:
                # 일반 텍스트에서 패턴 추출
                structured_data.extend(self._extract_text_patterns(content))
            
            return structured_data
            
        except Exception as e:
            raise ValueError(f"구조화된 데이터 추출 실패: {str(e)}")
    
    def _extract_csv_data(self, content: str) -> List[Dict[str, Any]]:
        """CSV 데이터 추출"""
        lines = content.strip().split('\n')
        if not lines:
            return []
        
        # 구분자 감지
        delimiter = ','
        if lines[0].count('\t') > lines[0].count(','):
            delimiter = '\t'
        
        # 첫 번째 줄을 헤더로 가정
        headers = [col.strip() for col in lines[0].split(delimiter)]
        data_rows = []
        
        for line in lines[1:]:
            if line.strip():
                row = [cell.strip() for cell in line.split(delimiter)]
                if len(row) == len(headers):
                    data_rows.append(dict(zip(headers, row)))
        
        return [{
            'type': 'csv_table',
            'headers': headers,
            'rows': len(data_rows),
            'data': data_rows[:100]  # 처음 100개 행만
        }]
    
    def _extract_json_data(self, content: str) -> List[Dict[str, Any]]:
        """JSON 데이터 추출"""
        try:
            import json
            data = json.loads(content)
            return [{
                'type': 'json_data',
                'root_type': type(data).__name__,
                'data': data if len(str(data)) < 10000 else {'truncated': True, 'size': len(str(data))}
            }]
        except json.JSONDecodeError:
            return []
    
    def _extract_xml_data(self, content: str) -> List[Dict[str, Any]]:
        """XML 데이터 추출 (간단한 파싱)"""
        # XML 파싱은 복잡하므로 기본적인 태그 정보만 추출
        tag_pattern = r'<([a-zA-Z][a-zA-Z0-9]*)[^>]*>(.*?)</\1>'
        matches = re.findall(tag_pattern, content, re.DOTALL)
        
        elements = []
        for tag_name, tag_content in matches[:50]:  # 처음 50개만
            elements.append({
                'tag': tag_name,
                'content': tag_content.strip()[:500]  # 처음 500자만
            })
        
        return [{
            'type': 'xml_elements',
            'elements': elements
        }] if elements else []
    
    def _extract_yaml_data(self, content: str) -> List[Dict[str, Any]]:
        """YAML 데이터 추출"""
        try:
            import yaml
            data = yaml.safe_load(content)
            return [{
                'type': 'yaml_data',
                'root_type': type(data).__name__,
                'data': data if len(str(data)) < 10000 else {'truncated': True, 'size': len(str(data))}
            }]
        except ImportError:
            return []
        except yaml.YAMLError:
            return []
    
    def _extract_text_patterns(self, content: str) -> List[Dict[str, Any]]:
        """일반 텍스트에서 패턴 추출"""
        patterns = []
        
        # 이메일 주소
        email_pattern = r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'
        emails = re.findall(email_pattern, content)
        if emails:
            patterns.append({
                'type': 'email_addresses',
                'count': len(emails),
                'examples': list(set(emails))[:10]
            })
        
        # URL
        url_pattern = r'https?://[^\s<>"{}|\\^`\[\]]+'
        urls = re.findall(url_pattern, content)
        if urls:
            patterns.append({
                'type': 'urls',
                'count': len(urls),
                'examples': list(set(urls))[:10]
            })
        
        # 전화번호 (한국 형식)
        phone_pattern = r'0\d{1,2}-\d{3,4}-\d{4}'
        phones = re.findall(phone_pattern, content)
        if phones:
            patterns.append({
                'type': 'phone_numbers',
                'count': len(phones),
                'examples': list(set(phones))[:10]
            })
        
        # 날짜 패턴
        date_patterns = [
            r'\d{4}-\d{2}-\d{2}',  # YYYY-MM-DD
            r'\d{2}/\d{2}/\d{4}',  # MM/DD/YYYY
            r'\d{4}\.\d{2}\.\d{2}' # YYYY.MM.DD
        ]
        
        all_dates = []
        for pattern in date_patterns:
            dates = re.findall(pattern, content)
            all_dates.extend(dates)
        
        if all_dates:
            patterns.append({
                'type': 'dates',
                'count': len(all_dates),
                'examples': list(set(all_dates))[:10]
            })
        
        return patterns 