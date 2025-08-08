#!/usr/bin/env python3
"""
figure.db 내용 확인 스크립트
"""
import sqlite3
import json

def check_figure_db():
    # Docker 컨테이너 내부의 DB 파일 경로
    db_path = "data/figure.db"  # 로컬에서 마운트된 경로
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # 테이블 목록 확인
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = cursor.fetchall()
        print("📋 테이블 목록:")
        for table in tables:
            print(f"   - {table[0]}")
        
        # documents 테이블 스키마 확인
        print("\n📊 documents 테이블 스키마:")
        cursor.execute("PRAGMA table_info(documents);")
        columns = cursor.fetchall()
        for col in columns:
            print(f"   - {col[1]} ({col[2]})")
        
        # 최근 문서 확인
        print("\n📄 최근 문서 (5개):")
        cursor.execute("""
            SELECT id, title, is_template, template_type, template_name, created_at 
            FROM documents 
            ORDER BY created_at DESC 
            LIMIT 5
        """)
        documents = cursor.fetchall()
        
        for doc in documents:
            print(f"   🔹 ID: {doc[0]}")
            print(f"      제목: {doc[1]}")
            print(f"      템플릿: {doc[2]} ({doc[3]})")
            print(f"      템플릿명: {doc[4]}")
            print(f"      생성일: {doc[5]}")
            print()
        
        conn.close()
        
    except Exception as e:
        print(f"💥 오류 발생: {e}")

if __name__ == "__main__":
    check_figure_db()
