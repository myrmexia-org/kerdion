"""
SaaS Maliyet Hesaplama API. Nginx /api/* isteklerini bu uygulamaya yönlendirir.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import get_connection
from .routers import auth, costs, exchange, products, users

app = FastAPI(
    title="Maliyet Hesaplama API",
    description="AWS entegrasyonlu SaaS ürün maliyet hesaplama",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

API_PREFIX = "/api"

app.include_router(auth.router, prefix=API_PREFIX)
app.include_router(users.router, prefix=API_PREFIX)
app.include_router(products.router, prefix=API_PREFIX)
app.include_router(costs.router, prefix=API_PREFIX)
app.include_router(exchange.router, prefix=API_PREFIX)


@app.on_event("startup")
def ensure_user_columns():
    """Backfill-safe startup migration for users table."""
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                ALTER TABLE users
                  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT FALSE,
                  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP,
                  ADD COLUMN IF NOT EXISTS last_login_ip VARCHAR(64),
                  ADD COLUMN IF NOT EXISTS current_session_id VARCHAR(64)
                """
            )
            # Existing users should not be forced unexpectedly.
            cur.execute(
                """
                UPDATE users
                SET must_change_password = FALSE
                WHERE must_change_password IS NULL
                """
            )
        conn.commit()
    finally:
        conn.close()


@app.on_event("startup")
def ensure_snapshot_columns():
    """Backfill-safe startup migration for cost_snapshots table."""
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                ALTER TABLE cost_snapshots
                  ADD COLUMN IF NOT EXISTS created_by_user_id INTEGER
                """
            )
        conn.commit()
    finally:
        conn.close()


@app.get("/")
def root():
    """Sağlık kontrolü; Nginx yönlendirmesi için."""
    return {"status": "ok", "service": "maliyet-api"}
