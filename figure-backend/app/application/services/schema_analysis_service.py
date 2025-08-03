"""
스키마 분석 서비스
데이터베이스 스키마 분석 및 관계 추출 기능 제공
"""
import re
import os
import logging
from typing import Dict, List, Optional, Any, Set, Tuple
from dataclasses import dataclass

logger = logging.getLogger(__name__)

@dataclass
class TableInfo:
    """테이블 정보"""
    name: str
    columns: List[Dict[str, str]]
    primary_keys: List[str]
    foreign_keys: List[Dict[str, str]]
    indexes: List[str]
    constraints: List[str]

@dataclass
class RelationshipInfo:
    """관계 정보"""
    from_table: str
    to_table: str
    from_column: str
    to_column: str
    relationship_type: str  # one-to-one, one-to-many, many-to-many

class SchemaAnalysisService:
    """스키마 분석 서비스"""
    
    def __init__(self):
        self.supported_databases = {
            'mysql': self._parse_mysql_ddl,
            'postgresql': self._parse_postgresql_ddl,
            'oracle': self._parse_oracle_ddl,
            'mssql': self._parse_mssql_ddl,
            'sqlite': self._parse_sqlite_ddl
        }
    
    async def analyze_database_schema(
        self,
        database_type: str,
        connection_string: Optional[str] = None,
        schema_file: Optional[str] = None,
        target_tables: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """데이터베이스 스키마 분석"""
        try:
            logger.info(f"스키마 분석 시작: {database_type}")
            
            if database_type not in self.supported_databases:
                raise ValueError(f"지원하지 않는 데이터베이스: {database_type}")
            
            # DDL 문자열 가져오기
            ddl_content = ""
            if schema_file:
                ddl_content = self._read_schema_file(schema_file)
            elif connection_string:
                ddl_content = await self._extract_ddl_from_connection(connection_string, database_type)
            else:
                raise ValueError("연결 문자열 또는 스키마 파일이 필요합니다.")
            
            if not ddl_content.strip():
                return self._create_empty_result("DDL 내용이 비어있습니다.")
            
            # DDL 파싱
            parser_func = self.supported_databases[database_type]
            tables = parser_func(ddl_content)
            
            # 특정 테이블만 필터링
            if target_tables:
                tables = {name: table for name, table in tables.items() 
                         if name.lower() in [t.lower() for t in target_tables]}
            
            if not tables:
                return self._create_empty_result("분석할 테이블을 찾을 수 없습니다.")
            
            # 관계 분석
            relationships = self._analyze_relationships(tables)
            
            # 결과 생성
            schema_definition = self._generate_schema_definition(tables)
            relationship_diagram = self._generate_relationship_diagram(relationships)
            
            # 통계 계산
            total_foreign_keys = sum(len(table.foreign_keys) for table in tables.values())
            total_indexes = sum(len(table.indexes) for table in tables.values())
            total_constraints = sum(len(table.constraints) for table in tables.values())
            
            result = {
                'total_tables': len(tables),
                'foreign_key_count': total_foreign_keys,
                'index_count': total_indexes,
                'constraint_count': total_constraints,
                'schema_definition': schema_definition,
                'relationship_diagram': relationship_diagram,
                'tables': list(tables.keys())
            }
            
            logger.info(f"스키마 분석 완료: {result['total_tables']}개 테이블, {result['foreign_key_count']}개 외래키")
            return result
            
        except Exception as e:
            logger.error(f"스키마 분석 오류: {e}")
            return self._create_empty_result(f"분석 중 오류 발생: {str(e)}")
    
    def _read_schema_file(self, schema_file: str) -> str:
        """스키마 파일 읽기"""
        try:
            with open(schema_file, 'r', encoding='utf-8', errors='ignore') as f:
                return f.read()
        except Exception as e:
            logger.error(f"스키마 파일 읽기 오류: {e}")
            return ""
    
    async def _extract_ddl_from_connection(self, connection_string: str, database_type: str) -> str:
        """데이터베이스 연결에서 DDL 추출 (현재는 시뮬레이션)"""
        # 실제 구현에서는 데이터베이스 연결을 통해 스키마 정보를 추출
        logger.info(f"데이터베이스 연결 시뮬레이션: {database_type}")
        
        # 시뮬레이션용 샘플 DDL 반환
        return self._get_sample_ddl(database_type)
    
    def _get_sample_ddl(self, database_type: str) -> str:
        """샘플 DDL 생성 (테스트용)"""
        if database_type == 'mysql':
            return """
CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_username (username),
    INDEX idx_email (email)
);

CREATE TABLE orders (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    total_amount DECIMAL(10,2) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    INDEX idx_user_id (user_id),
    INDEX idx_status (status)
);

CREATE TABLE order_items (
    id INT PRIMARY KEY AUTO_INCREMENT,
    order_id INT NOT NULL,
    product_name VARCHAR(100) NOT NULL,
    quantity INT NOT NULL,
    price DECIMAL(8,2) NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id),
    INDEX idx_order_id (order_id)
);
"""
        else:
            return "-- Sample DDL for testing"
    
    def _parse_mysql_ddl(self, ddl_content: str) -> Dict[str, TableInfo]:
        """MySQL DDL 파싱"""
        tables = {}
        
        # CREATE TABLE 문 추출
        table_pattern = r'CREATE\s+TABLE\s+(\w+)\s*\((.*?)\);'
        table_matches = re.finditer(table_pattern, ddl_content, re.DOTALL | re.IGNORECASE)
        
        for match in table_matches:
            table_name = match.group(1)
            table_body = match.group(2)
            
            columns = []
            primary_keys = []
            foreign_keys = []
            indexes = []
            constraints = []
            
            # 컬럼 및 제약조건 파싱
            lines = [line.strip().rstrip(',') for line in table_body.split('\n') if line.strip()]
            
            for line in lines:
                if re.match(r'\w+\s+\w+', line):  # 컬럼 정의
                    parts = line.split()
                    if len(parts) >= 2:
                        col_name = parts[0]
                        col_type = parts[1]
                        col_options = ' '.join(parts[2:]) if len(parts) > 2 else ''
                        
                        columns.append({
                            'name': col_name,
                            'type': col_type,
                            'options': col_options
                        })
                        
                        if 'PRIMARY KEY' in line.upper():
                            primary_keys.append(col_name)
                
                elif 'PRIMARY KEY' in line.upper():
                    pk_match = re.search(r'PRIMARY KEY\s*\(([^)]+)\)', line, re.IGNORECASE)
                    if pk_match:
                        pk_cols = [col.strip() for col in pk_match.group(1).split(',')]
                        primary_keys.extend(pk_cols)
                
                elif 'FOREIGN KEY' in line.upper():
                    fk_match = re.search(r'FOREIGN KEY\s*\(([^)]+)\)\s*REFERENCES\s+(\w+)\s*\(([^)]+)\)', line, re.IGNORECASE)
                    if fk_match:
                        foreign_keys.append({
                            'column': fk_match.group(1).strip(),
                            'references_table': fk_match.group(2),
                            'references_column': fk_match.group(3).strip()
                        })
                
                elif 'INDEX' in line.upper():
                    idx_match = re.search(r'INDEX\s+(\w+)', line, re.IGNORECASE)
                    if idx_match:
                        indexes.append(idx_match.group(1))
            
            tables[table_name] = TableInfo(
                name=table_name,
                columns=columns,
                primary_keys=primary_keys,
                foreign_keys=foreign_keys,
                indexes=indexes,
                constraints=constraints
            )
        
        return tables
    
    def _parse_postgresql_ddl(self, ddl_content: str) -> Dict[str, TableInfo]:
        """PostgreSQL DDL 파싱 (MySQL과 유사)"""
        return self._parse_mysql_ddl(ddl_content)
    
    def _parse_oracle_ddl(self, ddl_content: str) -> Dict[str, TableInfo]:
        """Oracle DDL 파싱 (기본적인 구현)"""
        return self._parse_mysql_ddl(ddl_content)
    
    def _parse_mssql_ddl(self, ddl_content: str) -> Dict[str, TableInfo]:
        """SQL Server DDL 파싱 (기본적인 구현)"""
        return self._parse_mysql_ddl(ddl_content)
    
    def _parse_sqlite_ddl(self, ddl_content: str) -> Dict[str, TableInfo]:
        """SQLite DDL 파싱 (기본적인 구현)"""
        return self._parse_mysql_ddl(ddl_content)
    
    def _analyze_relationships(self, tables: Dict[str, TableInfo]) -> List[RelationshipInfo]:
        """테이블 간 관계 분석"""
        relationships = []
        
        for table_name, table in tables.items():
            for fk in table.foreign_keys:
                ref_table = fk['references_table']
                if ref_table in tables:
                    relationships.append(RelationshipInfo(
                        from_table=table_name,
                        to_table=ref_table,
                        from_column=fk['column'],
                        to_column=fk['references_column'],
                        relationship_type='many-to-one'  # 기본적으로 many-to-one으로 가정
                    ))
        
        return relationships
    
    def _generate_schema_definition(self, tables: Dict[str, TableInfo]) -> str:
        """스키마 정의 문자열 생성"""
        if not tables:
            return "테이블이 없습니다."
        
        schema_lines = ["데이터베이스 스키마 정의:", "=" * 50]
        
        for table_name, table in tables.items():
            schema_lines.append(f"\n📋 테이블: {table_name}")
            schema_lines.append("─" * 30)
            
            # 컬럼 정보
            schema_lines.append("컬럼:")
            for col in table.columns:
                pk_mark = " 🔑" if col['name'] in table.primary_keys else ""
                schema_lines.append(f"  • {col['name']} {col['type']} {col.get('options', '')}{pk_mark}")
            
            # 외래키 정보
            if table.foreign_keys:
                schema_lines.append("외래키:")
                for fk in table.foreign_keys:
                    schema_lines.append(f"  🔗 {fk['column']} → {fk['references_table']}.{fk['references_column']}")
            
            # 인덱스 정보
            if table.indexes:
                schema_lines.append("인덱스:")
                for idx in table.indexes:
                    schema_lines.append(f"  📇 {idx}")
        
        return "\n".join(schema_lines)
    
    def _generate_relationship_diagram(self, relationships: List[RelationshipInfo]) -> str:
        """관계 다이어그램 생성"""
        if not relationships:
            return "테이블 간 관계가 없습니다."
        
        diagram_lines = ["테이블 관계 다이어그램:", "=" * 50]
        
        for rel in relationships:
            arrow = "──>" if rel.relationship_type == 'one-to-many' else "←──" if rel.relationship_type == 'many-to-one' else "←──>"
            diagram_lines.append(f"{rel.from_table}.{rel.from_column} {arrow} {rel.to_table}.{rel.to_column}")
        
        return "\n".join(diagram_lines)
    
    def _create_empty_result(self, message: str) -> Dict[str, Any]:
        """빈 결과 생성"""
        return {
            'total_tables': 0,
            'foreign_key_count': 0,
            'index_count': 0,
            'constraint_count': 0,
            'schema_definition': f"분석 실패: {message}",
            'relationship_diagram': f"분석 실패: {message}",
            'tables': []
        }