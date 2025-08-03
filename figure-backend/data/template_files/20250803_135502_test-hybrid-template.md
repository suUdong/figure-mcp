# {{service_name}} API 설계서

## 1. 개요
**서비스명**: {{service_name}}  
**담당자**: {{developer}}  
**작성일**: {{current_date}}

## 2. API 엔드포인트

### 2.1 {{entity_name}} 관리
- **GET /api/{{endpoint_path}}** - {{entity_name}} 목록 조회
- **POST /api/{{endpoint_path}}** - {{entity_name}} 생성
- **GET /api/{{endpoint_path}}/{id}** - {{entity_name}} 상세 조회
- **PUT /api/{{endpoint_path}}/{id}** - {{entity_name}} 수정
- **DELETE /api/{{endpoint_path}}/{id}** - {{entity_name}} 삭제

## 3. 데이터 모델
```json
{
  "id": "{{data_type}}",
  "name": "string",
  "description": "string",
  "status": "{{status_options}}",
  "created_at": "datetime",
  "updated_at": "datetime"
}
```

## 4. 에러 처리
- **400**: 잘못된 요청
- **401**: 인증 실패  
- **403**: 권한 없음
- **404**: 리소스 없음
- **500**: 서버 오류

## 5. 보안 고려사항
{{security_notes}}

---
**템플릿 버전**: 1.0  
**최종 수정**: {{last_modified}}