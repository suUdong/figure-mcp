# 테이블 명세서 템플릿

## 데이터베이스 정보
- **데이터베이스명**: {database_name}
- **버전**: {version}
- **DBMS**: {dbms_type}
- **작성일**: {date}
- **작성자**: {author}

## 테이블 개요

### {table_name_1}
**테이블 설명**: {table_description_1}

#### 컬럼 정의
| 컬럼명 | 데이터타입 | 길이 | NULL | 기본값 | 설명 |
|--------|-----------|------|------|--------|------|
| {column_1} | {data_type_1} | {length_1} | {nullable_1} | {default_1} | {description_1} |
| {column_2} | {data_type_2} | {length_2} | {nullable_2} | {default_2} | {description_2} |
| {column_3} | {data_type_3} | {length_3} | {nullable_3} | {default_3} | {description_3} |

#### 제약조건
- **Primary Key**: {primary_key}
- **Foreign Key**: {foreign_key}
- **Unique Key**: {unique_key}
- **Check Constraint**: {check_constraint}

#### 인덱스
| 인덱스명 | 타입 | 컬럼 | 설명 |
|----------|------|------|------|
| {index_1} | {index_type_1} | {index_columns_1} | {index_description_1} |
| {index_2} | {index_type_2} | {index_columns_2} | {index_description_2} |

#### DDL
```sql
CREATE TABLE {table_name_1} (
    {column_1} {data_type_1}({length_1}) {nullable_1} {default_1},
    {column_2} {data_type_2}({length_2}) {nullable_2} {default_2},
    {column_3} {data_type_3}({length_3}) {nullable_3} {default_3},
    
    CONSTRAINT PK_{table_name_1} PRIMARY KEY ({primary_key}),
    CONSTRAINT FK_{table_name_1}_{ref_table} FOREIGN KEY ({foreign_key}) REFERENCES {ref_table}({ref_column})
);

-- 인덱스 생성
CREATE INDEX {index_1} ON {table_name_1} ({index_columns_1});
```

### {table_name_2}
**테이블 설명**: {table_description_2}

#### 컬럼 정의
| 컬럼명 | 데이터타입 | 길이 | NULL | 기본값 | 설명 |
|--------|-----------|------|------|--------|------|
| {column_4} | {data_type_4} | {length_4} | {nullable_4} | {default_4} | {description_4} |
| {column_5} | {data_type_5} | {length_5} | {nullable_5} | {default_5} | {description_5} |
| {column_6} | {data_type_6} | {length_6} | {nullable_6} | {default_6} | {description_6} |

#### 제약조건
- **Primary Key**: {primary_key_2}
- **Foreign Key**: {foreign_key_2}
- **Unique Key**: {unique_key_2}

#### DDL
```sql
CREATE TABLE {table_name_2} (
    {column_4} {data_type_4}({length_4}) {nullable_4} {default_4},
    {column_5} {data_type_5}({length_5}) {nullable_5} {default_5},
    {column_6} {data_type_6}({length_6}) {nullable_6} {default_6},
    
    CONSTRAINT PK_{table_name_2} PRIMARY KEY ({primary_key_2})
);
```

## 테이블 관계도
```
{table_name_1} ||--o{ {table_name_2} : {relationship_description}
```

## 데이터 사전

### 공통 코드
| 코드 | 값 | 설명 |
|------|----|----- |
| {code_1} | {value_1} | {code_description_1} |
| {code_2} | {value_2} | {code_description_2} |
| {code_3} | {value_3} | {code_description_3} |

### 데이터 타입 정의
| 타입명 | 설명 | 예시 |
|--------|------|------|
| {custom_type_1} | {type_description_1} | {type_example_1} |
| {custom_type_2} | {type_description_2} | {type_example_2} |

## 샘플 데이터

### {table_name_1} 샘플
```sql
INSERT INTO {table_name_1} ({column_1}, {column_2}, {column_3}) VALUES
('{sample_value_1}', '{sample_value_2}', '{sample_value_3}'),
('{sample_value_4}', '{sample_value_5}', '{sample_value_6}');
```

### {table_name_2} 샘플
```sql
INSERT INTO {table_name_2} ({column_4}, {column_5}, {column_6}) VALUES
('{sample_value_7}', '{sample_value_8}', '{sample_value_9}'),
('{sample_value_10}', '{sample_value_11}', '{sample_value_12}');
```

## 주의사항
- {note_1}
- {note_2}
- {note_3}

## 변경 이력
| 버전 | 날짜 | 변경내용 | 작성자 |
|------|------|----------|--------|
| {version_1} | {date_1} | {change_1} | {author_1} |
| {version_2} | {date_2} | {change_2} | {author_2} |
