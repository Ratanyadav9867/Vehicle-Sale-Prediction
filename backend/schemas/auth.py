"""
backend/schemas/auth.py
=======================
Pydantic v2 schemas for Authentication, User Management, and Activity Logs.
"""

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field, field_validator

import re

EMAIL_REGEX = r"^[^@\s]+@[^@\s]+\.[^@\s]+$"
COMMON_PASSWORDS = {
    "password123!", "password123", "admin12345!", "welcome123!",
    "carworth123!", "12345678a!", "qwerty12345!", "password@123"
}


class RegisterRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=60, description="Full Name (2-60 chars)")
    email: str = Field(..., pattern=EMAIL_REGEX, description="Email address")
    password: str = Field(..., min_length=8, max_length=72, description="Password (8-72 chars)")
    confirm_password: str = Field(..., min_length=8, max_length=72, description="Confirm Password")

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        v_stripped = v.strip()
        if len(v_stripped) < 2 or len(v_stripped) > 60:
            raise ValueError("Full name must be between 2 and 60 characters.")
        return v_stripped

    @field_validator("email")
    @classmethod
    def normalize_email(cls, v: str) -> str:
        return v.strip().lower()

    @field_validator("password")
    @classmethod
    def validate_password_complexity(cls, v: str) -> str:
        if len(v) < 8 or len(v) > 72:
            raise ValueError("Password must be between 8 and 72 characters.")
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain at least one uppercase letter.")
        if not re.search(r"[a-z]", v):
            raise ValueError("Password must contain at least one lowercase letter.")
        if not re.search(r"[0-9]", v):
            raise ValueError("Password must contain at least one number.")
        if not re.search(r"[!@#$%^&*(),.?\":{}|<>\-_=+/\\\[\]~`]", v):
            raise ValueError("Password must contain at least one special character.")
        if v.lower() in COMMON_PASSWORDS:
            raise ValueError("This password is too common and easily guessed. Please choose a stronger password.")
        return v

    @field_validator("confirm_password")
    @classmethod
    def passwords_match(cls, v: str, info) -> str:
        if "password" in info.data and v != info.data["password"]:
            raise ValueError("Passwords do not match.")
        return v


class LoginRequest(BaseModel):
    email: str = Field(..., pattern=EMAIL_REGEX, description="Email address")
    password: str = Field(..., min_length=1, description="Password")
    remember_me: bool = Field(default=False, description="Remember login session")

    @field_validator("email")
    @classmethod
    def normalize_email(cls, v: str) -> str:
        return v.strip().lower()


class AdminLoginRequest(BaseModel):
    email: str = Field(..., pattern=EMAIL_REGEX, description="Administrator email address")
    password: str = Field(..., min_length=1, description="Password")
    remember_me: bool = Field(default=False, description="Remember login session")

    @field_validator("email")
    @classmethod
    def normalize_email(cls, v: str) -> str:
        return v.strip().lower()


class UpdateProfileRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=100, description="Updated Full Name")


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(..., min_length=1, max_length=128, description="Current account password")
    new_password: str = Field(..., min_length=1, max_length=128, description="New secure password")
    confirm_new_password: str = Field(..., min_length=1, max_length=128, description="Confirm new password")


class UserResponse(BaseModel):
    id: int
    name: str
    email: str
    role: str
    status: str
    created_at: str
    updated_at: str
    last_login_at: Optional[str] = None


class CurrentUserResponse(UserResponse):
    user: Optional[UserResponse] = None

    def model_post_init(self, __context: Any) -> None:
        if self.user is None:
            self.user = UserResponse(
                id=self.id,
                name=self.name,
                email=self.email,
                role=self.role,
                status=self.status,
                created_at=self.created_at,
                updated_at=self.updated_at,
                last_login_at=self.last_login_at,
            )


class AuthResponse(BaseModel):
    token: Optional[str] = None
    user: UserResponse
    message: str = "Authentication successful"


class UserStatusUpdateRequest(BaseModel):
    status: str = Field(..., pattern="^(active|inactive)$")


class UserRoleUpdateRequest(BaseModel):
    role: str = Field(..., pattern="^(user|admin)$")


class UserListResponse(BaseModel):
    items: List[UserResponse]
    total: int
    page: int
    limit: int
    total_pages: int


class LogEntryResponse(BaseModel):
    id: int
    timestamp: str
    user_id: Optional[int] = None
    user_name: str
    email: str
    role: str
    action_type: str
    category: str
    description: str
    status: str
    ip_address: str
    user_agent: str
    metadata: Dict[str, Any] = {}


class LogListResponse(BaseModel):
    items: List[LogEntryResponse]
    total: int
    page: int
    limit: int
    total_pages: int


class ClientLogEventRequest(BaseModel):
    action_type: str
    category: str
    description: str
    metadata: Optional[Dict[str, Any]] = None


class BatchLogEventsRequest(BaseModel):
    events: List[ClientLogEventRequest]


class AdminDashboardStatsResponse(BaseModel):
    total_users: int
    active_users: int
    new_registrations_today: int
    failed_logins_today: int
    total_predictions: int = 0
    total_logs: int = 0
    suspicious_ips: List[Dict[str, Any]]
    recent_activity: List[Dict[str, Any]]
    category_breakdown: Dict[str, int]


class PredictionRecordResponse(BaseModel):
    id: int
    user_id: int
    user_name: str
    email: str
    brand: str
    year: int
    present_price: float
    kms_driven: int
    fuel_type: str
    seller_type: str
    transmission: str
    owner: int
    predicted_price: float
    currency: str
    car_age: int
    created_at: str


class PredictionListResponse(BaseModel):
    items: List[PredictionRecordResponse]
    total: int
    limit: int = 50
    offset: int = 0
