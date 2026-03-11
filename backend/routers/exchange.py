"""
TCMB döviz kuru: güncel kur ve geçmiş.
"""
from datetime import date

from fastapi import APIRouter, Depends, HTTPException

from ..database import get_db
from ..models import ExchangeRateResponse
from ..services.tcmb import get_usd_try as fetch_tcmb_usd_try

from .auth import get_current_user

router = APIRouter(prefix="/exchange", tags=["exchange"])


@router.get("/current", response_model=ExchangeRateResponse)
def get_current_rate(
    current_user: dict = Depends(get_current_user),
    conn=Depends(get_db),
):
    """
    Güncel USD/TRY kurunu döndürür.
    Önce TCMB'den çeker, exchange_rates tablosuna yazar/günceller; TCMB başarısızsa DB'deki son kuru kullanır.
    """
    today = date.today()
    rate = fetch_tcmb_usd_try()
    if rate is not None:
        with conn.cursor() as cur:
            cur.execute(
                """INSERT INTO exchange_rates (date, usd_try) VALUES (%s, %s)
                   ON CONFLICT (date) DO UPDATE SET usd_try = EXCLUDED.usd_try""",
                (today, rate),
            )
    with conn.cursor() as cur:
        cur.execute(
            """SELECT id, date, usd_try, created_at FROM exchange_rates
               ORDER BY date DESC LIMIT 1"""
        )
        row = cur.fetchone()
    if not row:
        raise HTTPException(
            status_code=503,
            detail="Döviz kuru alınamadı ve veritabanında kayıt yok",
        )
    return ExchangeRateResponse.model_validate(row)


@router.get("/rates", response_model=list[ExchangeRateResponse])
def list_rates(
    current_user: dict = Depends(get_current_user),
    conn=Depends(get_db),
):
    """Döviz kuru geçmişini tarihe göre (en yeni önce) listeler."""
    with conn.cursor() as cur:
        cur.execute(
            "SELECT id, date, usd_try, created_at FROM exchange_rates ORDER BY date DESC"
        )
        rows = cur.fetchall()
    return [ExchangeRateResponse.model_validate(r) for r in rows]
