"""
Kullanıcı listesi, ekleme, silme ve kullanıcı ayarları (şifre, MFA).
"""
import base64
import io

import bcrypt
import psycopg2
import pyotp
import qrcode
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr, Field

from ..database import get_db
from ..models import UserCreate, UserResponse, UserUpdate

from .auth import get_current_user

router = APIRouter(prefix="/users", tags=["users"])


def _hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


# ----- Liste, ekleme, silme -----

@router.get("", response_model=list[UserResponse])
def list_users(
    current_user: dict = Depends(get_current_user),
    conn=Depends(get_db),
):
    """Tüm kullanıcıları listeler (herkes eşit yetkili)."""
    with conn.cursor() as cur:
        cur.execute(
            """SELECT id, name, email, mfa_enabled, must_change_password,
                      last_login_at, last_login_ip, created_at
               FROM users ORDER BY id"""
        )
        rows = cur.fetchall()
    return [UserResponse.model_validate(r) for r in rows]


@router.post("", response_model=UserResponse, status_code=201)
def create_user(
    body: UserCreate,
    current_user: dict = Depends(get_current_user),
    conn=Depends(get_db),
):
    """Yeni kullanıcı ekler."""
    password_hash = _hash_password(body.password)
    with conn.cursor() as cur:
        try:
            cur.execute(
                """INSERT INTO users (name, email, password_hash, must_change_password)
                   VALUES (%s, %s, %s, TRUE)
                   RETURNING id, name, email, mfa_enabled, must_change_password,
                             last_login_at, last_login_ip, created_at""",
                (body.name, body.email, password_hash),
            )
            row = cur.fetchone()
        except psycopg2.IntegrityError:
            raise HTTPException(status_code=400, detail="Bu email zaten kayıtlı")
    return UserResponse.model_validate(row)


@router.delete("/{user_id}", status_code=204)
def delete_user(
    user_id: int,
    current_user: dict = Depends(get_current_user),
    conn=Depends(get_db),
):
    """Kullanıcı siler."""
    with conn.cursor() as cur:
        cur.execute("SELECT name FROM users WHERE id = %s", (user_id,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
        if str(row["name"]).strip().lower() == "myrmadmin":
            raise HTTPException(status_code=403, detail="MyrmAdmin kullanıcısı silinemez")
        cur.execute("DELETE FROM users WHERE id = %s", (user_id,))


# ----- Me (ayarlar) -----

@router.get("/me", response_model=UserResponse)
def get_me(current_user: dict = Depends(get_current_user)):
    """Giriş yapan kullanıcının bilgisi."""
    return UserResponse.model_validate(current_user)


class MfaVerifyBody(BaseModel):
    totp_code: str = Field(..., min_length=6, max_length=6)


class MfaDisableBody(BaseModel):
    password: str


class UserManageUpdate(BaseModel):
    email: EmailStr | None = None
    password: str | None = Field(default=None, min_length=1)


@router.patch("/manage/{user_id}", response_model=UserResponse)
def update_user(
    user_id: int,
    body: UserManageUpdate,
    current_user: dict = Depends(get_current_user),
    conn=Depends(get_db),
):
    """Kullanıcı email/parola günceller. Kullanıcı adı değiştirilemez."""
    updates = []
    args = []
    if body.email is not None:
        updates.append("email = %s")
        args.append(body.email)
    if body.password is not None:
        updates.append("password_hash = %s")
        args.append(_hash_password(body.password))
    if not updates:
        with conn.cursor() as cur:
            cur.execute(
                """SELECT id, name, email, mfa_enabled, must_change_password,
                          last_login_at, last_login_ip, created_at
                   FROM users WHERE id = %s""",
                (user_id,),
            )
            row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
        return UserResponse.model_validate(row)
    args.append(user_id)
    with conn.cursor() as cur:
        try:
            cur.execute(
                f"""UPDATE users SET {', '.join(updates)} WHERE id = %s
                    RETURNING id, name, email, mfa_enabled, must_change_password,
                              last_login_at, last_login_ip, created_at""",
                args,
            )
            row = cur.fetchone()
        except psycopg2.IntegrityError:
            raise HTTPException(status_code=400, detail="Bu email zaten kayıtlı")
    if not row:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
    return UserResponse.model_validate(row)


@router.patch("/me", response_model=UserResponse)
def update_me(
    body: UserUpdate,
    current_user: dict = Depends(get_current_user),
    conn=Depends(get_db),
):
    """Şifre veya email günceller (sadece kendi hesabı). Ad değiştirilemez."""
    user_id = current_user["id"]
    if current_user.get("must_change_password") and body.password is None:
        raise HTTPException(
            status_code=400,
            detail="İlk girişte yeni şifre belirlemeniz zorunludur",
        )
    if body.name is not None:
        raise HTTPException(status_code=400, detail="Kullanıcı adı değiştirilemez")
    updates = []
    args = []
    if body.email is not None:
        updates.append("email = %s")
        args.append(body.email)
    if body.password is not None:
        updates.append("password_hash = %s")
        args.append(_hash_password(body.password))
        updates.append("must_change_password = FALSE")
    if not updates:
        return UserResponse.model_validate(current_user)
    args.append(user_id)
    with conn.cursor() as cur:
        try:
            cur.execute(
                f"""UPDATE users SET {', '.join(updates)} WHERE id = %s
                    RETURNING id, name, email, mfa_enabled, must_change_password,
                              last_login_at, last_login_ip, created_at""",
                args,
            )
            row = cur.fetchone()
        except psycopg2.IntegrityError:
            raise HTTPException(status_code=400, detail="Bu email zaten kayıtlı")
    return UserResponse.model_validate(row)


@router.post("/me/mfa/setup")
def mfa_setup(
    current_user: dict = Depends(get_current_user),
    conn=Depends(get_db),
):
    """MFA için secret üretir, QR kod döndürür. Doğrulama sonrası MFA aktif olur."""
    user_id = current_user["id"]
    email = current_user["email"]
    secret = pyotp.random_base32()
    totp = pyotp.TOTP(secret)
    uri = totp.provisioning_uri(name=email, issuer_name="Maliyet App")
    img = qrcode.make(uri)
    buf = io.BytesIO()
    img.save(buf)
    qr_base64 = base64.b64encode(buf.getvalue()).decode("ascii")
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE users SET mfa_secret = %s, mfa_enabled = FALSE WHERE id = %s",
            (secret, user_id),
        )
    return {"secret": secret, "qr_image_base64": qr_base64}


@router.post("/me/mfa/verify")
def mfa_verify(
    body: MfaVerifyBody,
    current_user: dict = Depends(get_current_user),
    conn=Depends(get_db),
):
    """Girilen 6 haneli kodu doğrular; başarılıysa MFA aktif edilir."""
    user_id = current_user["id"]
    with conn.cursor() as cur:
        cur.execute("SELECT mfa_secret FROM users WHERE id = %s", (user_id,))
        row = cur.fetchone()
    if not row or not row["mfa_secret"]:
        raise HTTPException(status_code=400, detail="Önce MFA kurulumu yapın")
    totp = pyotp.TOTP(row["mfa_secret"])
    if not totp.verify(body.totp_code.strip(), valid_window=1):
        raise HTTPException(status_code=400, detail="Kod geçersiz")
    with conn.cursor() as cur:
        cur.execute("UPDATE users SET mfa_enabled = TRUE WHERE id = %s", (user_id,))
    return {"ok": True}


@router.post("/me/mfa/disable")
def mfa_disable(
    body: MfaDisableBody,
    current_user: dict = Depends(get_current_user),
    conn=Depends(get_db),
):
    """Şifre ile doğrulayıp MFA kapatır."""
    user_id = current_user["id"]
    with conn.cursor() as cur:
        cur.execute("SELECT password_hash FROM users WHERE id = %s", (user_id,))
        row = cur.fetchone()
    if not row or not bcrypt.checkpw(
        body.password.encode("utf-8"), row["password_hash"].encode("utf-8")
    ):
        raise HTTPException(status_code=401, detail="Şifre hatalı")
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE users SET mfa_secret = NULL, mfa_enabled = FALSE WHERE id = %s",
            (user_id,),
        )
    return {"ok": True}
