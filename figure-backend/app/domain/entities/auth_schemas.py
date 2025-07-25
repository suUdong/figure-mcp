"""
Authentication Domain Entities
인증과 관련된 도메인 엔티티 및 스키마
"""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, EmailStr, validator
from enum import Enum

class UserRole(str, Enum):
    """사용자 역할"""
    ADMIN = "admin"
    USER = "user"

class LoginRequest(BaseModel):
    """로그인 요청 스키마"""
    username: str = Field(..., min_length=3, max_length=50, description="사용자명")
    password: str = Field(..., min_length=6, description="비밀번호")

class LoginResponse(BaseModel):
    """로그인 응답 스키마"""
    access_token: str = Field(..., description="액세스 토큰")
    refresh_token: str = Field(..., description="리프레시 토큰")
    token_type: str = Field(default="bearer", description="토큰 타입")
    expires_in: int = Field(..., description="토큰 만료 시간(초)")
    user: 'UserInfo' = Field(..., description="사용자 정보")

class RefreshTokenRequest(BaseModel):
    """토큰 갱신 요청 스키마"""
    refresh_token: str = Field(..., description="리프레시 토큰")

class UserInfo(BaseModel):
    """사용자 정보 스키마"""
    id: int = Field(..., description="사용자 ID")
    username: str = Field(..., description="사용자명")
    email: Optional[str] = Field(None, description="이메일")
    full_name: Optional[str] = Field(None, description="전체 이름")
    role: UserRole = Field(default=UserRole.USER, description="사용자 역할")
    is_active: bool = Field(default=True, description="활성 상태")
    created_at: datetime = Field(..., description="생성 시간")
    last_login: Optional[datetime] = Field(None, description="마지막 로그인")

class UserCreate(BaseModel):
    """사용자 생성 스키마"""
    username: str = Field(..., min_length=3, max_length=50, description="사용자명")
    password: str = Field(..., min_length=6, description="비밀번호")
    email: Optional[str] = Field(None, description="이메일")
    full_name: Optional[str] = Field(None, description="전체 이름")
    role: UserRole = Field(default=UserRole.USER, description="사용자 역할")

class UserUpdate(BaseModel):
    """사용자 업데이트 스키마"""
    email: Optional[str] = Field(None, description="이메일")
    full_name: Optional[str] = Field(None, description="전체 이름")
    role: Optional[UserRole] = Field(None, description="사용자 역할")
    is_active: Optional[bool] = Field(None, description="활성 상태")

class PasswordChange(BaseModel):
    """비밀번호 변경 스키마"""
    current_password: str = Field(..., description="현재 비밀번호")
    new_password: str = Field(..., min_length=6, description="새 비밀번호")

class TokenPayload(BaseModel):
    """JWT 토큰 페이로드"""
    sub: str = Field(..., description="사용자 ID (subject)")
    username: str = Field(..., description="사용자명")
    role: UserRole = Field(..., description="사용자 역할")
    exp: Optional[int] = Field(None, description="만료 시간")
    iat: Optional[int] = Field(None, description="발행 시간")
    type: str = Field(..., description="토큰 타입 (access/refresh)")

# Forward reference 해결
LoginResponse.model_rebuild() 