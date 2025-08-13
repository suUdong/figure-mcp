# API 문서 템플릿

## 개요
- **API 이름**: {api_name}
- **버전**: {version}
- **기본 URL**: {base_url}
- **작성일**: {date}

## 인증
```
Authorization: Bearer {token}
Content-Type: application/json
```

## 엔드포인트

### {endpoint_name}
- **메소드**: {method}
- **URL**: `{endpoint_url}`
- **설명**: {description}

#### 요청 파라미터
| 파라미터 | 타입 | 필수 | 설명 |
|---------|------|------|------|
| {param_name} | {param_type} | {required} | {param_description} |

#### 요청 예시
```json
{
  "{field_name}": "{field_value}",
  "{field_name2}": "{field_value2}"
}
```

#### 응답 예시
```json
{
  "status": "success",
  "data": {
    "{response_field}": "{response_value}"
  },
  "message": "{response_message}"
}
```

#### 에러 코드
| 코드 | 메시지 | 설명 |
|------|--------|------|
| 400 | Bad Request | 잘못된 요청 |
| 401 | Unauthorized | 인증 실패 |
| 404 | Not Found | 리소스를 찾을 수 없음 |
| 500 | Internal Server Error | 서버 내부 오류 |

## 사용 예시
```javascript
// JavaScript 예시
const response = await fetch('{base_url}{endpoint_url}', {
  method: '{method}',
  headers: {
    'Authorization': 'Bearer {token}',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    "{field_name}": "{field_value}"
  })
});

const data = await response.json();
console.log(data);
```

## 주의사항
- {note_1}
- {note_2}
- {note_3}
