"""
Ürün CRUD, ürün fiyatları ve ürüne ait maliyet hesaplama geçmişi (snapshots).
"""
from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from ..database import get_db
from ..models import (
    CostSnapshotResponse,
    ProductCreate,
    ProductPriceResponse,
    ProductResponse,
    ProductUpdate,
)

from .auth import get_current_user

router = APIRouter(prefix="/products", tags=["products"])


def _get_product_or_404(conn, product_id: int):
    """Ürünü getirir; yoksa 404 fırlatır."""
    with conn.cursor() as cur:
        cur.execute(
            "SELECT id, name, description, created_at FROM products WHERE id = %s",
            (product_id,),
        )
        row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Ürün bulunamadı")
    return row


# ----- Ürün CRUD -----

@router.get("", response_model=list[ProductResponse])
def list_products(
    current_user: dict = Depends(get_current_user),
    conn=Depends(get_db),
):
    """Tüm ürünleri listeler."""
    with conn.cursor() as cur:
        cur.execute(
            "SELECT id, name, description, created_at FROM products ORDER BY id"
        )
        rows = cur.fetchall()
    return [ProductResponse.model_validate(r) for r in rows]


@router.post("", response_model=ProductResponse, status_code=201)
def create_product(
    body: ProductCreate,
    current_user: dict = Depends(get_current_user),
    conn=Depends(get_db),
):
    """Yeni ürün ekler."""
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO products (name, description) VALUES (%s, %s) RETURNING id, name, description, created_at",
            (body.name, body.description),
        )
        row = cur.fetchone()
    return ProductResponse.model_validate(row)


@router.get("/{product_id}", response_model=ProductResponse)
def get_product(
    product_id: int,
    current_user: dict = Depends(get_current_user),
    conn=Depends(get_db),
):
    """Ürün detayı."""
    row = _get_product_or_404(conn, product_id)
    return ProductResponse.model_validate(row)


@router.patch("/{product_id}", response_model=ProductResponse)
def update_product(
    product_id: int,
    body: ProductUpdate,
    current_user: dict = Depends(get_current_user),
    conn=Depends(get_db),
):
    """Ürün adı veya açıklamasını günceller."""
    _get_product_or_404(conn, product_id)
    updates = []
    args = []
    if body.name is not None:
        updates.append("name = %s")
        args.append(body.name)
    if body.description is not None:
        updates.append("description = %s")
        args.append(body.description)
    if not updates:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, name, description, created_at FROM products WHERE id = %s",
                (product_id,),
            )
            row = cur.fetchone()
        return ProductResponse.model_validate(row)
    args.append(product_id)
    with conn.cursor() as cur:
        cur.execute(
            f"UPDATE products SET {', '.join(updates)} WHERE id = %s RETURNING id, name, description, created_at",
            args,
        )
        row = cur.fetchone()
    return ProductResponse.model_validate(row)


@router.delete("/{product_id}", status_code=204)
def delete_product(
    product_id: int,
    current_user: dict = Depends(get_current_user),
    conn=Depends(get_db),
):
    """Ürünü siler (fiyat ve snapshot kayıtları cascade silinir)."""
    with conn.cursor() as cur:
        cur.execute("DELETE FROM products WHERE id = %s", (product_id,))
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="Ürün bulunamadı")


# ----- Ürün fiyatları (geçmiş, güncel) -----

class ProductPriceSetBody(BaseModel):
    price_usd: float = Field(..., ge=0)
    price_try: float = Field(..., ge=0)


@router.get("/{product_id}/prices", response_model=list[ProductPriceResponse])
def list_product_prices(
    product_id: int,
    current_user: dict = Depends(get_current_user),
    conn=Depends(get_db),
):
    """Ürüne ait fiyat geçmişini listeler."""
    _get_product_or_404(conn, product_id)
    with conn.cursor() as cur:
        cur.execute(
            """SELECT id, product_id, price_usd, price_try, valid_from, valid_until, created_at
               FROM product_prices WHERE product_id = %s ORDER BY valid_from DESC""",
            (product_id,),
        )
        rows = cur.fetchall()
    return [ProductPriceResponse.model_validate(r) for r in rows]


@router.get("/{product_id}/prices/current", response_model=ProductPriceResponse)
def get_current_product_price(
    product_id: int,
    current_user: dict = Depends(get_current_user),
    conn=Depends(get_db),
):
    """Ürünün güncel fiyatını döndürür (valid_until IS NULL)."""
    _get_product_or_404(conn, product_id)
    with conn.cursor() as cur:
        cur.execute(
            """SELECT id, product_id, price_usd, price_try, valid_from, valid_until, created_at
               FROM product_prices WHERE product_id = %s AND valid_until IS NULL""",
            (product_id,),
        )
        row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Bu ürün için kayıtlı güncel fiyat yok")
    return ProductPriceResponse.model_validate(row)


@router.post("/{product_id}/prices", response_model=ProductPriceResponse, status_code=201)
def set_product_price(
    product_id: int,
    body: ProductPriceSetBody,
    current_user: dict = Depends(get_current_user),
    conn=Depends(get_db),
):
    """Yeni fiyat ekler; varsa güncel fiyat valid_until ile kapatılır."""
    _get_product_or_404(conn, product_id)
    today = date.today()
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE product_prices SET valid_until = %s WHERE product_id = %s AND valid_until IS NULL",
            (today, product_id),
        )
        cur.execute(
            """INSERT INTO product_prices (product_id, price_usd, price_try, valid_from, valid_until)
               VALUES (%s, %s, %s, %s, NULL) RETURNING id, product_id, price_usd, price_try, valid_from, valid_until, created_at""",
            (product_id, body.price_usd, body.price_try, today),
        )
        row = cur.fetchone()
    return ProductPriceResponse.model_validate(row)


# ----- Maliyet hesaplama geçmişi (snapshots) -----

@router.get("/{product_id}/snapshots", response_model=list[CostSnapshotResponse])
def list_product_snapshots(
    product_id: int,
    current_user: dict = Depends(get_current_user),
    conn=Depends(get_db),
):
    """Ürüne ait geçmiş maliyet hesaplamalarını listeler."""
    _get_product_or_404(conn, product_id)
    with conn.cursor() as cur:
        cur.execute(
            """SELECT cs.id, cs.product_id, cs.created_by_user_id, u.name AS created_by_name,
                      cs.period, cs.usd_try_rate, cs.total_cost_usd, cs.total_cost_try,
                      cs.profit_margin_pct, cs.sale_price_usd, cs.sale_price_try, cs.net_profit_usd, cs.net_profit_try,
                      cs.estimated_cost_usd, cs.actual_cost_usd, cs.snapshot_data, cs.created_at
               FROM cost_snapshots cs
               LEFT JOIN users u ON u.id = cs.created_by_user_id
               WHERE cs.product_id = %s
               ORDER BY cs.period DESC, cs.created_at DESC""",
            (product_id,),
        )
        rows = cur.fetchall()
    return [CostSnapshotResponse.model_validate(r) for r in rows]


@router.delete("/{product_id}/snapshots/{snapshot_id}", status_code=204)
def delete_product_snapshot(
    product_id: int,
    snapshot_id: int,
    current_user: dict = Depends(get_current_user),
    conn=Depends(get_db),
):
    """Belirtilen maliyet hesaplama kaydını siler (sadece ilgili ürüne aitse)."""
    _get_product_or_404(conn, product_id)
    with conn.cursor() as cur:
        cur.execute(
            "DELETE FROM cost_snapshots WHERE id = %s AND product_id = %s",
            (snapshot_id, product_id),
        )
        if cur.rowcount == 0:
            raise HTTPException(
                status_code=404,
                detail="Maliyet kaydı bulunamadı veya bu ürüne ait değil",
            )
