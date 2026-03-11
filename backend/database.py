"""
PostgreSQL bağlantı yönetimi. config.DATABASE_URL kullanılır.
"""
import psycopg2
from psycopg2.extras import RealDictCursor

from .config import DATABASE_URL


def get_connection():
    """Yeni bir veritabanı bağlantısı döndürür. Çağıran kapatmalıdır."""
    return psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)


def get_db():
    """
    FastAPI dependency: istek sonunda bağlantıyı kapatır.
    Başarılı ise commit, hata ise rollback yapar.
    """
    conn = get_connection()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
