import re
from datetime import UTC, datetime
from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, StringConstraints, field_validator

Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=150)]
Password = Annotated[str, StringConstraints(min_length=8, max_length=128)]
Phone = Annotated[str, StringConstraints(pattern=r"^\+[1-9]\d{7,14}$")]
# Explicit small deny-list; never log submitted passwords.
COMMON_PASSWORDS = {
    "password",
    "12345678",
    "123456789",
    "qwerty12",
    "qwerty123",
    "abcdefgh",
    "letmein1",
    "admin123",
    "87654321",
    "welcome1",
    "password123",
    "password1234",
    "1234567890",
    "12345678901",
    "qwertyuiop",
    "letmein1234",
    "abcdefghij",
    "iloveyou123",
}


def strong_password(value: str):
    if value.casefold() in COMMON_PASSWORDS or re.fullmatch(r"(.)\1+", value):
        raise ValueError("Choose a less common password.")
    return value


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True, hide_input_in_errors=True)


class PolicyInput(StrictModel):
    type: Literal["terms", "privacy"]
    version: str = Field(min_length=1, max_length=20)


class Register(StrictModel):
    full_name: Name
    email: EmailStr = Field(max_length=254)
    phone: Phone
    password: Password
    accepted_policies: list[PolicyInput] = Field(min_length=2, max_length=2)
    _password = field_validator("password")(strong_password)


class Login(StrictModel):
    email: EmailStr = Field(max_length=254)
    password: str = Field(min_length=8, max_length=128)


class EmailInput(StrictModel):
    email: EmailStr = Field(max_length=254)


class TokenInput(StrictModel):
    token: str = Field(min_length=20, max_length=256)


class ResetConfirm(TokenInput):
    new_password: Password
    _password = field_validator("new_password")(strong_password)


class CreateStaff(StrictModel):
    full_name: Name
    email: EmailStr = Field(max_length=254)
    phone: Phone | None = None
    role: Literal["staff", "admin"]
    temporary_password: Password | None = None

    @field_validator("temporary_password")
    @classmethod
    def validate_password(cls, value):
        return strong_password(value) if value is not None else value


class UpdateUser(StrictModel):
    full_name: Name | None = None
    phone: Phone | None = None
    role: Literal["staff", "admin"] | None = None
    is_active: bool | None = None
    version: int = Field(ge=1)


class UserOut(BaseModel):
    id: UUID
    email: str
    full_name: str
    phone: str | None
    role: Literal["client", "staff", "admin"]
    is_email_verified: bool
    created_at: datetime


class AdminUserOut(UserOut):
    is_active: bool
    version: int


def user_out(user, *, admin=False):
    value = dict(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        phone=user.phone,
        role=user.role,
        is_email_verified=user.email_verified_at is not None,
        created_at=user.created_at.astimezone(UTC),
    )
    return (
        AdminUserOut(**value, is_active=user.is_active, version=user.row_version)
        if admin
        else UserOut(**value)
    )
