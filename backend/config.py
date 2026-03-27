"""
Uygulama yapılandırması. Ortam değişkenlerinden okunur.
"""
import os


# AWS
AWS_ACCESS_KEY_ID = os.getenv("AWS_ACCESS_KEY_ID", "")
AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY", "")
AWS_REGION = os.getenv("AWS_REGION", "us-east-1")

# Veritabanı
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://user:password@localhost:5432/kerdion_db",
)

# JWT (oturum)
SECRET_KEY = os.getenv("SECRET_KEY", "")
