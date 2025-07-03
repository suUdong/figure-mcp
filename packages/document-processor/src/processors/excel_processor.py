"""
Excel 파일 프로세서
"""

from typing import Dict, Any, List
import pandas as pd
from pathlib import Path
import json

from .base import BaseProcessor


class ExcelProcessor(BaseProcessor):
    """Excel 파일 처리기"""
    
    def __init__(self):
        super().__init__()
        self.supported_extensions = ['.xlsx', '.xls', '.xlsm']
        self.supported_mime_types = [
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-excel',
            'application/vnd.ms-excel.sheet.macroEnabled.12'
        ]
    
    async def extract_text(self, file_path: str) -> str:
        """Excel 파일에서 텍스트 추출"""
        try:
            # 모든 시트 읽기
            excel_file = pd.ExcelFile(file_path)
            all_text = []
            
            for sheet_name in excel_file.sheet_names:
                # 시트별 처리
                df = pd.read_excel(file_path, sheet_name=sheet_name)
                
                # 시트 제목 추가
                all_text.append(f"=== {sheet_name} ===\n")
                
                # 데이터프레임을 텍스트로 변환
                sheet_text = self._dataframe_to_text(df)
                all_text.append(sheet_text)
                all_text.append("\n")
            
            return self.clean_text("\n".join(all_text))
            
        except Exception as e:
            raise ValueError(f"Excel 파일 텍스트 추출 실패: {str(e)}")
    
    async def extract_metadata(self, file_path: str) -> Dict[str, Any]:
        """Excel 파일에서 메타데이터 추출"""
        try:
            excel_file = pd.ExcelFile(file_path)
            
            metadata = {
                'processor_type': 'excel',
                'sheet_count': len(excel_file.sheet_names),
                'sheet_names': excel_file.sheet_names,
                'sheets_info': {}
            }
            
            # 각 시트 정보 수집
            total_rows = 0
            total_cols = 0
            
            for sheet_name in excel_file.sheet_names:
                df = pd.read_excel(file_path, sheet_name=sheet_name)
                
                sheet_info = {
                    'rows': len(df),
                    'columns': len(df.columns),
                    'column_names': df.columns.tolist(),
                    'has_data': not df.empty,
                    'null_count': df.isnull().sum().sum(),
                }
                
                metadata['sheets_info'][sheet_name] = sheet_info
                total_rows += len(df)
                total_cols = max(total_cols, len(df.columns))
            
            metadata['total_rows'] = total_rows
            metadata['max_columns'] = total_cols
            
            return metadata
            
        except Exception as e:
            raise ValueError(f"Excel 메타데이터 추출 실패: {str(e)}")
    
    def _dataframe_to_text(self, df: pd.DataFrame) -> str:
        """데이터프레임을 읽기 쉬운 텍스트로 변환"""
        if df.empty:
            return "빈 시트입니다."
        
        text_parts = []
        
        # 컬럼 헤더 추가
        if not df.columns.empty:
            headers = " | ".join(str(col) for col in df.columns)
            text_parts.append(f"컬럼: {headers}\n")
            text_parts.append("-" * min(80, len(headers)) + "\n")
        
        # 데이터 행 추가 (최대 100행)
        max_rows = min(100, len(df))
        for idx, row in df.head(max_rows).iterrows():
            row_text = " | ".join(str(val) if pd.notna(val) else "" for val in row)
            text_parts.append(f"행 {idx + 1}: {row_text}\n")
        
        if len(df) > max_rows:
            text_parts.append(f"... (총 {len(df)}행 중 {max_rows}행만 표시)\n")
        
        return "".join(text_parts)
    
    async def extract_structured_data(self, file_path: str) -> List[Dict[str, Any]]:
        """Excel에서 구조화된 데이터 추출"""
        try:
            excel_file = pd.ExcelFile(file_path)
            structured_data = []
            
            for sheet_name in excel_file.sheet_names:
                df = pd.read_excel(file_path, sheet_name=sheet_name)
                
                if df.empty:
                    continue
                
                # 시트를 딕셔너리 리스트로 변환
                sheet_data = {
                    'sheet_name': sheet_name,
                    'type': 'table',
                    'columns': df.columns.tolist(),
                    'data': []
                }
                
                # 최대 1000행까지만 처리
                max_rows = min(1000, len(df))
                for _, row in df.head(max_rows).iterrows():
                    row_dict = {}
                    for col in df.columns:
                        value = row[col]
                        if pd.notna(value):
                            # 숫자 타입 처리
                            if isinstance(value, (int, float)):
                                row_dict[col] = value
                            else:
                                row_dict[col] = str(value)
                        else:
                            row_dict[col] = None
                    sheet_data['data'].append(row_dict)
                
                structured_data.append(sheet_data)
            
            return structured_data
            
        except Exception as e:
            raise ValueError(f"Excel 구조화된 데이터 추출 실패: {str(e)}")
    
    def _detect_table_structure(self, df: pd.DataFrame) -> Dict[str, Any]:
        """테이블 구조 분석"""
        structure = {
            'has_header': True,  # 기본적으로 첫 행이 헤더라고 가정
            'data_types': {},
            'potential_keys': [],
            'relationships': []
        }
        
        # 컬럼별 데이터 타입 분석
        for col in df.columns:
            non_null_data = df[col].dropna()
            if len(non_null_data) > 0:
                # 숫자 타입 확인
                try:
                    pd.to_numeric(non_null_data)
                    structure['data_types'][col] = 'numeric'
                except:
                    # 날짜 타입 확인
                    try:
                        pd.to_datetime(non_null_data)
                        structure['data_types'][col] = 'datetime'
                    except:
                        structure['data_types'][col] = 'text'
                
                # 유니크한 값이 많으면 키 컬럼 후보
                unique_ratio = len(non_null_data.unique()) / len(non_null_data)
                if unique_ratio > 0.9:
                    structure['potential_keys'].append(col)
        
        return structure 