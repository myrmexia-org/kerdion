-- Veritabanı Şeması (PostgreSQL)
-- SaaS Maliyet Hesaplama Uygulaması

-- Kullanıcılar
CREATE TABLE users (
    id            SERIAL PRIMARY KEY,
    name          VARCHAR(255) NOT NULL,
    email         VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    mfa_secret    VARCHAR(255),
    mfa_enabled   BOOLEAN DEFAULT FALSE,
    created_at    TIMESTAMP DEFAULT NOW()
);

-- Ürünler
CREATE TABLE products (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(255) NOT NULL,
    description TEXT,
    created_at  TIMESTAMP DEFAULT NOW()
);

-- Ürün satış fiyatları (geçmiş tutulur, silinmez)
CREATE TABLE product_prices (
    id          SERIAL PRIMARY KEY,
    product_id  INTEGER REFERENCES products(id) ON DELETE CASCADE,
    price_usd   NUMERIC(10,2) NOT NULL,
    price_try   NUMERIC(10,2) NOT NULL,
    valid_from  DATE NOT NULL,
    valid_until DATE,           -- NULL ise güncel fiyat
    created_at  TIMESTAMP DEFAULT NOW()
);

-- Döviz kuru geçmişi
CREATE TABLE exchange_rates (
    id         SERIAL PRIMARY KEY,
    date       DATE UNIQUE NOT NULL,
    usd_try    NUMERIC(10,4) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Maliyet hesaplama kayıtları
CREATE TABLE cost_snapshots (
    id                  SERIAL PRIMARY KEY,
    product_id          INTEGER REFERENCES products(id) ON DELETE CASCADE,
    period              DATE NOT NULL,
    usd_try_rate        NUMERIC(10,4) NOT NULL,
    total_cost_usd      NUMERIC(10,2) NOT NULL,
    total_cost_try      NUMERIC(10,2) NOT NULL,
    profit_margin_pct   NUMERIC(5,2) NOT NULL,
    sale_price_usd      NUMERIC(10,2) NOT NULL,
    sale_price_try      NUMERIC(10,2) NOT NULL,
    net_profit_usd      NUMERIC(10,2) NOT NULL,
    net_profit_try      NUMERIC(10,2) NOT NULL,
    estimated_cost_usd  NUMERIC(10,2),
    actual_cost_usd     NUMERIC(10,2),
    snapshot_data       JSONB NOT NULL,
    created_at          TIMESTAMP DEFAULT NOW()
);
