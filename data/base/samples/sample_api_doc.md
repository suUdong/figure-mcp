# 사용자 관리 API 문서

## 개요
- **API 이름**: User Management API
- **버전**: v1.0
- **기본 URL**: https://api.example.com/v1
- **작성일**: 2024-08-13

## 인증
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json
```

## 엔드포인트

### 사용자 생성
- **메소드**: POST
- **URL**: `/users`
- **설명**: 새로운 사용자를 생성합니다.

#### 요청 파라미터
| 파라미터 | 타입 | 필수 | 설명 |
|---------|------|------|------|
| name | string | Y | 사용자 이름 |
| email | string | Y | 이메일 주소 |
| password | string | Y | 비밀번호 (8자 이상) |
| role | string | N | 사용자 역할 (기본값: user) |

#### 요청 예시
```json
{
  "name": "홍길동",
  "email": "hong@example.com",
  "password": "password123",
  "role": "user"
}
```

#### 응답 예시
```json
{
  "status": "success",
  "data": {
    "id": 12345,
    "name": "홍길동",
    "email": "hong@example.com",
    "role": "user",
    "created_at": "2024-08-13T10:30:00Z"
  },
  "message": "사용자가 성공적으로 생성되었습니다."
}
```

#### 에러 코드
| 코드 | 메시지 | 설명 |
|------|--------|------|
| 400 | Bad Request | 필수 파라미터 누락 또는 형식 오류 |
| 401 | Unauthorized | 인증 토큰이 유효하지 않음 |
| 409 | Conflict | 이미 존재하는 이메일 주소 |
| 500 | Internal Server Error | 서버 내부 오류 |

## 사용 예시
```javascript
// JavaScript 예시
const response = await fetch('https://api.example.com/v1/users', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    "name": "홍길동",
    "email": "hong@example.com",
    "password": "password123"
  })
});

const data = await response.json();
console.log(data);
```

## 주의사항
- 비밀번호는 최소 8자 이상이어야 합니다.
- 이메일 주소는 유효한 형식이어야 합니다.
- API 호출 시 반드시 유효한 JWT 토큰을 포함해야 합니다.
