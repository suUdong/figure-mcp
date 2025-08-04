"""
코드 분석 서비스
소스 코드의 메서드 의존성 분석 기능 제공
"""
import ast
import os
import re
import logging
from typing import Dict, List, Optional, Any, Set
from pathlib import Path
from dataclasses import dataclass

logger = logging.getLogger(__name__)

@dataclass
class MethodInfo:
    """메서드 정보"""
    name: str
    class_name: str
    file_path: str
    line_number: int
    calls: Set[str]  # 호출하는 메서드들
    called_by: Set[str]  # 이 메서드를 호출하는 메서드들

class CodeAnalysisService:
    """코드 분석 서비스"""
    
    def __init__(self):
        self.supported_languages = {
            'python': ['.py'],
            'java': ['.java'],
            'javascript': ['.js', '.jsx'],
            'typescript': ['.ts', '.tsx'],
            'csharp': ['.cs']
        }
    
    def _convert_project_path(self, project_path: str) -> str:
        """Docker 컨테이너 환경에서 호스트 경로를 컨테이너 경로로 변환"""
        # Windows 경로 패턴 감지 (C:\workspace\figure-mcp)
        if project_path.startswith('C:\\workspace\\figure-mcp') or project_path.startswith('C:/workspace/figure-mcp'):
            # Docker 컨테이너 내부의 /workspace로 변환
            return '/workspace'
        
        # Linux 절대 경로인 경우 그대로 사용
        if project_path.startswith('/'):
            return project_path
        
        # 상대 경로인 경우 /workspace 기준으로 변환
        return os.path.join('/workspace', project_path.replace('\\', '/'))
    
    async def analyze_method_dependencies(
        self,
        project_path: str,
        language: str,
        target_class: Optional[str] = None
    ) -> Dict[str, Any]:
        """메서드 의존성 분석"""
        try:
            # Docker 컨테이너 환경에서 경로 변환
            converted_path = self._convert_project_path(project_path)
            logger.info(f"코드 분석 시작: {project_path} → {converted_path} ({language})")
            
            if language not in self.supported_languages:
                raise ValueError(f"지원하지 않는 언어: {language}")
            
            # 소스 파일 수집
            source_files = self._collect_source_files(converted_path, language, target_class)
            logger.info(f"분석할 파일 수: {len(source_files)}")
            
            if not source_files:
                return self._create_empty_result("분석할 소스 파일을 찾을 수 없습니다.")
            
            # 메서드 정보 추출
            methods = {}
            for file_path in source_files:
                file_methods = self._extract_methods_from_file(file_path, language)
                methods.update(file_methods)
            
            # 의존성 분석
            dependency_matrix = self._build_dependency_matrix(methods)
            
            # 복잡도 계산
            complexity_level = self._calculate_complexity(methods)
            
            result = {
                'total_dependencies': sum(len(method.calls) for method in methods.values()),
                'analyzed_files': len(source_files),
                'complexity_level': complexity_level,
                'dependency_matrix': dependency_matrix,
                'method_count': len(methods)
            }
            
            logger.info(f"코드 분석 완료: {result['method_count']}개 메서드, {result['total_dependencies']}개 의존성")
            return result
            
        except Exception as e:
            logger.error(f"코드 분석 오류: {e}")
            return self._create_empty_result(f"분석 중 오류 발생: {str(e)}")
    
    def _collect_source_files(self, project_path: str, language: str, target_class: Optional[str]) -> List[str]:
        """소스 파일 수집"""
        extensions = self.supported_languages[language]
        source_files = []
        
        for root, dirs, files in os.walk(project_path):
            # .git, node_modules, __pycache__ 등 제외
            dirs[:] = [d for d in dirs if not d.startswith('.') and d not in ['node_modules', '__pycache__', 'target', 'build']]
            
            for file in files:
                if any(file.endswith(ext) for ext in extensions):
                    file_path = os.path.join(root, file)
                    
                    # 특정 클래스가 지정된 경우 필터링
                    if target_class:
                        if self._file_contains_class(file_path, target_class, language):
                            source_files.append(file_path)
                    else:
                        source_files.append(file_path)
        
        return source_files
    
    def _file_contains_class(self, file_path: str, class_name: str, language: str) -> bool:
        """파일에 특정 클래스가 포함되어 있는지 확인"""
        try:
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
                
            if language == 'python':
                return f"class {class_name}" in content
            elif language == 'java':
                return re.search(rf'class\s+{class_name}\b', content) is not None
            elif language in ['javascript', 'typescript']:
                return (f"class {class_name}" in content or 
                       f"function {class_name}" in content or
                       f"const {class_name}" in content)
            elif language == 'csharp':
                return re.search(rf'class\s+{class_name}\b', content) is not None
                
        except Exception as e:
            logger.warning(f"파일 읽기 오류 ({file_path}): {e}")
            
        return False
    
    def _extract_methods_from_file(self, file_path: str, language: str) -> Dict[str, MethodInfo]:
        """파일에서 메서드 정보 추출"""
        methods = {}
        
        try:
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
            
            if language == 'python':
                methods = self._extract_python_methods(file_path, content)
            elif language == 'java':
                methods = self._extract_java_methods(file_path, content)
            elif language in ['javascript', 'typescript']:
                methods = self._extract_js_methods(file_path, content)
            elif language == 'csharp':
                methods = self._extract_csharp_methods(file_path, content)
                
        except Exception as e:
            logger.warning(f"메서드 추출 오류 ({file_path}): {e}")
            
        return methods
    
    def _extract_python_methods(self, file_path: str, content: str) -> Dict[str, MethodInfo]:
        """Python 메서드 추출"""
        methods = {}
        
        try:
            tree = ast.parse(content)
            
            for node in ast.walk(tree):
                if isinstance(node, ast.FunctionDef):
                    class_name = "global"
                    
                    # 클래스 내부 메서드인지 확인
                    for parent in ast.walk(tree):
                        if (isinstance(parent, ast.ClassDef) and 
                            any(n == node for n in ast.walk(parent))):
                            class_name = parent.name
                            break
                    
                    method_key = f"{class_name}.{node.name}"
                    calls = set()
                    
                    # 메서드 호출 분석
                    for child in ast.walk(node):
                        if isinstance(child, ast.Call):
                            if isinstance(child.func, ast.Name):
                                calls.add(child.func.id)
                            elif isinstance(child.func, ast.Attribute):
                                calls.add(child.func.attr)
                    
                    methods[method_key] = MethodInfo(
                        name=node.name,
                        class_name=class_name,
                        file_path=file_path,
                        line_number=node.lineno,
                        calls=calls,
                        called_by=set()
                    )
                    
        except SyntaxError as e:
            logger.warning(f"Python 구문 분석 오류 ({file_path}): {e}")
        except Exception as e:
            logger.warning(f"Python 메서드 추출 오류 ({file_path}): {e}")
            
        return methods
    
    def _extract_java_methods(self, file_path: str, content: str) -> Dict[str, MethodInfo]:
        """Java 메서드 추출 (정규식 기반)"""
        methods = {}
        
        try:
            # 클래스명 추출
            class_match = re.search(r'class\s+(\w+)', content)
            class_name = class_match.group(1) if class_match else "Unknown"
            
            # 메서드 추출
            method_pattern = r'(?:public|private|protected|static|\s)*\s+\w+\s+(\w+)\s*\([^)]*\)\s*\{'
            methods_found = re.finditer(method_pattern, content)
            
            for match in methods_found:
                method_name = match.group(1)
                line_number = content[:match.start()].count('\n') + 1
                method_key = f"{class_name}.{method_name}"
                
                # 메서드 본문에서 호출 분석 (간단한 버전)
                method_body_start = match.end()
                brace_count = 1
                method_body_end = method_body_start
                
                for i, char in enumerate(content[method_body_start:], method_body_start):
                    if char == '{':
                        brace_count += 1
                    elif char == '}':
                        brace_count -= 1
                        if brace_count == 0:
                            method_body_end = i
                            break
                
                method_body = content[method_body_start:method_body_end]
                calls = set(re.findall(r'(\w+)\s*\(', method_body))
                
                methods[method_key] = MethodInfo(
                    name=method_name,
                    class_name=class_name,
                    file_path=file_path,
                    line_number=line_number,
                    calls=calls,
                    called_by=set()
                )
                
        except Exception as e:
            logger.warning(f"Java 메서드 추출 오류 ({file_path}): {e}")
            
        return methods
    
    def _extract_js_methods(self, file_path: str, content: str) -> Dict[str, MethodInfo]:
        """JavaScript/TypeScript 메서드 추출 (정규식 기반)"""
        methods = {}
        
        try:
            # 함수 선언 패턴들
            patterns = [
                r'function\s+(\w+)\s*\([^)]*\)',  # function name()
                r'(\w+)\s*:\s*function\s*\([^)]*\)',  # name: function()
                r'(\w+)\s*\([^)]*\)\s*\{',  # name() { (메서드)
                r'const\s+(\w+)\s*=\s*\([^)]*\)\s*=>',  # const name = () =>
            ]
            
            for pattern in patterns:
                for match in re.finditer(pattern, content):
                    method_name = match.group(1)
                    line_number = content[:match.start()].count('\n') + 1
                    method_key = f"JS.{method_name}"
                    
                    # 간단한 호출 분석
                    calls = set(re.findall(r'(\w+)\s*\(', content))
                    
                    methods[method_key] = MethodInfo(
                        name=method_name,
                        class_name="JS",
                        file_path=file_path,
                        line_number=line_number,
                        calls=calls,
                        called_by=set()
                    )
                    
        except Exception as e:
            logger.warning(f"JS/TS 메서드 추출 오류 ({file_path}): {e}")
            
        return methods
    
    def _extract_csharp_methods(self, file_path: str, content: str) -> Dict[str, MethodInfo]:
        """C# 메서드 추출 (정규식 기반)"""
        methods = {}
        
        try:
            # 클래스명 추출
            class_match = re.search(r'class\s+(\w+)', content)
            class_name = class_match.group(1) if class_match else "Unknown"
            
            # 메서드 패턴
            method_pattern = r'(?:public|private|protected|internal|static|\s)*\s+\w+\s+(\w+)\s*\([^)]*\)'
            
            for match in re.finditer(method_pattern, content):
                method_name = match.group(1)
                line_number = content[:match.start()].count('\n') + 1
                method_key = f"{class_name}.{method_name}"
                
                # 간단한 호출 분석
                calls = set(re.findall(r'(\w+)\s*\(', content))
                
                methods[method_key] = MethodInfo(
                    name=method_name,
                    class_name=class_name,
                    file_path=file_path,
                    line_number=line_number,
                    calls=calls,
                    called_by=set()
                )
                
        except Exception as e:
            logger.warning(f"C# 메서드 추출 오류 ({file_path}): {e}")
            
        return methods
    
    def _build_dependency_matrix(self, methods: Dict[str, MethodInfo]) -> str:
        """의존성 매트릭스 생성"""
        if not methods:
            return "분석할 메서드가 없습니다."
        
        # called_by 관계 구축
        for method_key, method in methods.items():
            for called_method in method.calls:
                for other_key, other_method in methods.items():
                    if other_method.name == called_method:
                        other_method.called_by.add(method_key)
        
        # 매트릭스 문자열 생성
        matrix_lines = ["메서드 의존성 매트릭스:", "=" * 50]
        
        for method_key, method in methods.items():
            if method.calls:
                calls_str = ", ".join(sorted(method.calls))
                matrix_lines.append(f"{method_key} → {calls_str}")
            
            if method.called_by:
                called_by_str = ", ".join(sorted(method.called_by))
                matrix_lines.append(f"{method_key} ← {called_by_str}")
        
        if len(matrix_lines) <= 2:
            matrix_lines.append("의존성 관계가 발견되지 않았습니다.")
        
        return "\n".join(matrix_lines)
    
    def _calculate_complexity(self, methods: Dict[str, MethodInfo]) -> str:
        """복잡도 계산"""
        if not methods:
            return "없음"
        
        total_dependencies = sum(len(method.calls) for method in methods.values())
        method_count = len(methods)
        avg_dependencies = total_dependencies / method_count if method_count > 0 else 0
        
        if avg_dependencies < 2:
            return "낮음"
        elif avg_dependencies < 5:
            return "보통"
        else:
            return "높음"
    
    def _create_empty_result(self, message: str) -> Dict[str, Any]:
        """빈 결과 생성"""
        return {
            'total_dependencies': 0,
            'analyzed_files': 0,
            'complexity_level': '없음',
            'dependency_matrix': f"분석 실패: {message}",
            'method_count': 0
        }