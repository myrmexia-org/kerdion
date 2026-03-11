"""
Giriş (kullanıcı adı + şifre, isteğe bağlı TOTP) ve JWT doğrulama.
"""
from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import uuid4

import bcrypt
import jwt
import pyotp
from fastapi import APIRouter, Depends, Header, HTTPException, Request
from pydantic import BaseModel

from ..config import SECRET_KEY
from ..database import get_db
from ..models import TokenResponse

router = APIRouter(prefix="/auth", tags=["auth"])

# JWT süresi
ACCESS_TOKEN_EXPIRE_MINUTES = 30


class LoginBody(BaseModel):
    username: str
    password: str
    totp_code: Optional[str] = None


def _create_token(user_id: int, email: str, session_id: str) -> str:
    payload = {
        # PyJWT "sub" claim'ini string bekler.
        "sub": str(user_id),
        "email": email,
        "sid": session_id,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm="HS256")


def _get_bearer_token(authorization: Optional[str] = Header(None)) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Yetkilendirme gerekli")
    return authorization[7:].strip()


def get_current_user(
    token: str = Depends(_get_bearer_token),
    request: Request = None,
    conn=Depends(get_db),
):
    """JWT doğrular, kullanıcıyı DB'den döndürür. Diğer router'larda Depends(get_current_user) ile kullanılır."""
    if not SECRET_KEY:
        raise HTTPException(status_code=500, detail="SECRET_KEY yapılandırılmamış")
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        user_id_raw = payload.get("sub")
        token_session_id = payload.get("sid")
        if user_id_raw is None:
            raise HTTPException(status_code=401, detail="Geçersiz token")
        if not token_session_id:
            raise HTTPException(status_code=401, detail="Geçersiz token")
        user_id = int(user_id_raw)
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Geçersiz token")
    except (TypeError, ValueError):
        raise HTTPException(status_code=401, detail="Geçersiz token")
    with conn.cursor() as cur:
        cur.execute(
            """SELECT id, name, email, mfa_enabled, must_change_password,
                      last_login_at, last_login_ip, current_session_id, created_at
               FROM users WHERE id = %s""",
            (user_id,),
        )
        row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=401, detail="Kullanıcı bulunamadı")
    if row.get("current_session_id") != token_session_id:
        raise HTTPException(status_code=401, detail="Oturumunuz başka bir cihazda açıldığı için kapatıldı")
    if (
        row.get("must_change_password")
        and request is not None
        and not (request.url.path.endswith("/users/me") and request.method in {"GET", "PATCH"})
    ):
        raise HTTPException(
            status_code=403,
            detail="İlk girişte şifre değiştirmeniz gerekiyor",
        )
    return dict(row)


@router.post("/login", response_model=TokenResponse)
def login(body: LoginBody, request: Request, conn=Depends(get_db)):
    """Kullanıcı adı + şifre ile giriş. MFA açıksa totp_code gerekir.

    Response: TokenResponse → JSON'da token "access_token" alanında döner.
    Örnek: {"access_token": "<jwt>", "token_type": "bearer"}
    """
    with conn.cursor() as cur:
        cur.execute(
            """SELECT id, name, email, password_hash, mfa_secret, mfa_enabled, must_change_password
               FROM users WHERE name = %s""",
            (body.username.strip(),),
        )
        row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=401, detail="Kullanıcı adı veya şifre hatalı")
    if not bcrypt.checkpw(body.password.encode("utf-8"), row["password_hash"].encode("utf-8")):
        raise HTTPException(status_code=401, detail="Kullanıcı adı veya şifre hatalı")
    if row["mfa_enabled"]:
        if not body.totp_code or len(body.totp_code.strip()) != 6:
            raise HTTPException(
                status_code=400,
                detail="MFA kodu gerekli",
                headers={"X-Mfa-Required": "true"},
            )
        totp = pyotp.TOTP(row["mfa_secret"])
        if not totp.verify(body.totp_code.strip(), valid_window=1):
            raise HTTPException(status_code=401, detail="MFA kodu geçersiz")
    session_id = uuid4().hex
    access_token = _create_token(row["id"], row["email"], session_id)
    client_ip = request.client.host if request and request.client else None
    with conn.cursor() as cur:
        cur.execute(
            """UPDATE users
               SET last_login_at = NOW(), last_login_ip = %s, current_session_id = %s
               WHERE id = %s""",
            (client_ip, session_id, row["id"]),
        )
    return TokenResponse(
        access_token=access_token,
        must_change_password=bool(row.get("must_change_password")),
    )
