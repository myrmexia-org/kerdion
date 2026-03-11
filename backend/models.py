"""
API istek/cevap ve veritabanı ile uyumlu Pydantic modelleri.
"""
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Optional

from pydantic import BaseModel, EmailStr, Field


# ----- Kullanıcı -----

class UserCreate(BaseModel):
    name: str = Field(..., max_length=255)
    email: EmailStr
    password: str = Field(..., min_length=1)


class UserUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=255)
    email: Optional[EmailStr] = None
    password: Optional[str] = Field(None, min_length=1)


class UserResponse(BaseModel):
    id: int
    name: str
    email: str
    mfa_enabled: bool = False
    must_change_password: bool = False
    last_login_at: Optional[datetime] = None
    last_login_ip: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ----- Ürün -----

class ProductCreate(BaseModel):
    name: str = Field(..., max_length=255)
    description: Optional[str] = None


class ProductUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = None


class ProductResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ----- Ürün fiyatı -----

class ProductPriceCreate(BaseModel):
    product_id: int
    price_usd: Decimal = Field(..., ge=0)
    price_try: Decimal = Field(..., ge=0)
    valid_from: date
    valid_until: Optional[date] = None


class ProductPriceResponse(BaseModel):
    id: int
    product_id: int
    price_usd: Decimal
    price_try: Decimal
    valid_from: date
    valid_until: Optional[date] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ----- Döviz kuru -----

class ExchangeRateResponse(BaseModel):
    id: int
    date: date
    usd_try: Decimal
    created_at: datetime

    class Config:
        from_attributes = True


# ----- Maliyet snapshot -----

class CostSnapshotCreate(BaseModel):
    product_id: int
    period: date
    usd_try_rate: Decimal = Field(..., ge=0)
    total_cost_usd: Decimal = Field(..., ge=0)
    total_cost_try: Decimal = Field(..., ge=0)
    profit_margin_pct: Decimal = Field(..., ge=0)
    sale_price_usd: Decimal = Field(..., ge=0)
    sale_price_try: Decimal = Field(..., ge=0)
    net_profit_usd: Decimal
    net_profit_try: Decimal = Field(..., ge=0)
    estimated_cost_usd: Optional[Decimal] = None
    actual_cost_usd: Optional[Decimal] = None
    snapshot_data: dict[str, Any]


class CostSnapshotResponse(BaseModel):
    id: int
    product_id: int
    created_by_user_id: Optional[int] = None
    created_by_name: Optional[str] = None
    period: date
    usd_try_rate: Decimal
    total_cost_usd: Decimal
    total_cost_try: Decimal
    profit_margin_pct: Decimal
    sale_price_usd: Decimal
    sale_price_try: Decimal
    net_profit_usd: Decimal
    net_profit_try: Decimal
    estimated_cost_usd: Optional[Decimal] = None
    actual_cost_usd: Optional[Decimal] = None
    snapshot_data: dict[str, Any]
    created_at: datetime

    class Config:
        from_attributes = True


# ----- Auth (login / token) -----

class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    """Login endpoint dönüşü. JWT token "access_token" alanında döner."""

    access_token: str  # Frontend bu alanı localStorage'a yazmalı
    token_type: str = "bearer"
    must_change_password: bool = False
