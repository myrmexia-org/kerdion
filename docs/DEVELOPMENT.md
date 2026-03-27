# Kerdion v2 — Geliştirici Dokümantasyonu

Teknik hesaplama mantığı, API entegrasyonları, veritabanı şeması ve kurulum detayları.

---

## Proje Yapısı

```
cost-calculator-v2/
├── Dockerfile
├── docker-compose.yml
├── .env.example
├── backend/
│   ├── main.py
│   ├── config.py
│   ├── database.py
│   ├── models.py
│   ├── routers/
│   │   ├── auth.py
│   │   ├── users.py
│   │   ├── products.py
│   │   ├── costs.py
│   │   └── exchange.py
│   ├── services/
│   │   ├── aws_pricing.py
│   │   ├── aws_cost_explorer.py
│   │   └── tcmb.py
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── main.jsx
│   │   ├── App.jsx
│   │   ├── pages/
│   │   │   ├── Login.jsx
│   │   │   ├── Users.jsx
│   │   │   ├── UserSettings.jsx
│   │   │   ├── Products.jsx
│   │   │   ├── ProductDetail.jsx
│   │   │   └── CostCalculator.jsx
│   │   └── components/
│   │       ├── CostItemList.jsx
│   │       ├── ProfitSummary.jsx
│   │       └── SnapshotHistory.jsx
│   ├── package.json
│   └── vite.config.js
├── nginx/
│   └── nginx.conf
└── db/
    ├── schema.sql
    └── seed.sql
```

---

## Maliyet Kalemleri

### Altyapı (AWS Pricing API)

| Kalem | Birim | Formül |
|---|---|---|
| AWS EC2 | saat | birim_fiyat × 720 |
| AWS RDS (PostgreSQL) | saat | birim_fiyat × 720 |
| AWS S3 Storage | GB | birim_fiyat × gb |
| AWS S3 İstekler | 1000 istek | birim_fiyat × adet |
| AWS Bandwidth (Data Transfer) | GB | birim_fiyat × gb |
| AWS CloudFront (CDN) | GB | birim_fiyat × gb |
| AWS Route53 | hosted zone | birim_fiyat × adet |
| AWS CloudWatch | metrik | birim_fiyat × adet |
| AWS Backup - RDS Snapshot | GB | birim_fiyat × gb |
| AWS Backup - S3 Snapshot | GB | birim_fiyat × gb |
| AWS NAT Gateway | saat + GB | (birim_fiyat × 720) + (veri_fiyat × gb) |
| AWS Secrets Manager | secret | birim_fiyat × adet |
| AWS SES | 1000 email | birim_fiyat × adet |
| AWS Lambda | 1M istek | birim_fiyat × adet |
| AWS ElastiCache | saat | birim_fiyat × 720 |

### İletişim (Manuel)

| Kalem | Birim |
|---|---|
| SendGrid | 1000 email |
| Domain | aylık (yıllık ücret / 12) |

### Araçlar (Manuel)

| Kalem | Birim |
|---|---|
| GitHub | aylık |
| Sentry / Monitoring | aylık |
| Diğer SaaS Araçları | aylık |

### Vergi & Mali

| Kalem | Açıklama |
|---|---|
| KDV | %20 sabit, değiştirilemez |
| Gelir Vergisi Karşılığı | yıllık tahmini vergi / 12 (şahıs şirketi dilimleri) |
| SGK Bağ-Kur | aylık sabit tutar, manuel girilir |

---

## İşçilik Maliyeti Hesabı

### Maaşlı Çalışan

Girilen bilgiler: çalışan adı, aylık brüt maaş (TRY)

**Çalışandan kesilenler:**

| Kalem | Oran | Hesaplama |
|---|---|---|
| SGK İşçi Payı | %14 | brüt × 0.14 |
| İşsizlik Sigortası İşçi Payı | %1 | brüt × 0.01 |
| Damga Vergisi | %0.759 | brüt × 0.00759 |
| Gelir Vergisi | kümülatif, artan oranlı | aşağıdaki dilimler |
| **Net Maaş** | | brüt − tüm kesintiler |

**Şirketin ek maliyetleri:**

| Kalem | Oran | Hesaplama |
|---|---|---|
| SGK İşveren Payı | %20.5 | brüt × 0.205 |
| İşsizlik Sigortası İşveren Payı | %2 | brüt × 0.02 |
| **Şirkete Toplam Maliyet** | | brüt + işveren payları |

**Ücret Geliri Gelir Vergisi Dilimleri (2025):**

| Kümülatif Matrah | Oran |
|---|---|
| 0 - 158.000 TRY | %15 |
| 158.001 - 330.000 TRY | %20 |
| 330.001 - 800.000 TRY | %27 |
| 800.001 - 4.300.000 TRY | %35 |
| 4.300.001 TRY üzeri | %40 |

Gelir vergisi kümülatif matrah üzerinden hesaplanır. Her ay bir önceki ayın kümülatif matrahına o ayın brüt maaşı eklenerek ilerlenir. Yılın ilk ayında matrah sıfırdan başlar.

### Freelancer

Girilen bilgiler: ad, saatlik ücret (USD veya TRY), o ay çalışılan saat

```
Toplam = saatlik_ucret × calisilan_saat
```

Freelancer için SGK veya vergi kesintisi uygulanmaz.

---

## Vergi Hesabı (Şahıs Şirketi - Türkiye)

**KDV:** %20 sabit.

**Şahıs Şirketi Gelir Vergisi Dilimleri (2025):**

| Dilim | Oran |
|---|---|
| 0 - 110.000 TRY | %15 |
| 110.001 - 230.000 TRY | %20 |
| 230.001 - 870.000 TRY | %27 |
| 870.001 - 3.000.000 TRY | %35 |
| 3.000.001 TRY üzeri | %40 |

**Geçici Vergi:** Yıllık gelir vergisinin peşin ödenmesidir. Yılda 4 kez ödenir. Aylık karşılık: yıllık tahmini vergi / 12.

---

## Kar Hesabı

```
Toplam Maliyet (USD) = tüm işaretli kalemler toplamı
Toplam Maliyet (TRY) = Toplam Maliyet (USD) × TCMB kuru

Önerilen Satış Fiyatı (USD) = Toplam Maliyet (USD) × (1 + kar_yuzdesi / 100)
Önerilen Satış Fiyatı (TRY) = Önerilen Satış Fiyatı (USD) × TCMB kuru

Net Kar (USD) = Önerilen Satış Fiyatı (USD) − Toplam Maliyet (USD)
Net Kar (TRY) = Net Kar (USD) × TCMB kuru
```

---

## AWS Entegrasyonu

### IAM Gereksinimleri

IAM kullanıcısına şu policy'ler atanmalı:
- `AWSBillingReadOnlyAccess`
- `AmazonEC2ReadOnlyAccess`

### AWS Pricing API

Birim fiyatları çekmek için kullanılır. Ücretsizdir. Sadece `us-east-1` region'ından sorgulanır.

```python
import boto3

client = boto3.client('pricing', region_name='us-east-1')

response = client.get_products(
    ServiceCode='AmazonEC2',
    Filters=[
        {'Type': 'TERM_MATCH', 'Field': 'instanceType', 'Value': 't3.small'},
        {'Type': 'TERM_MATCH', 'Field': 'location', 'Value': 'US East (N. Virginia)'},
        {'Type': 'TERM_MATCH', 'Field': 'operatingSystem', 'Value': 'Linux'},
        {'Type': 'TERM_MATCH', 'Field': 'tenancy', 'Value': 'Shared'},
        {'Type': 'TERM_MATCH', 'Field': 'preInstalledSw', 'Value': 'NA'},
        {'Type': 'TERM_MATCH', 'Field': 'capacitystatus', 'Value': 'Used'},
    ]
)
```

**AWS Servis Kodları:**

| Servis | ServiceCode |
|---|---|
| EC2 | AmazonEC2 |
| RDS | AmazonRDS |
| S3 | AmazonS3 |
| CloudFront | AmazonCloudFront |
| Route53 | AmazonRoute53 |
| NAT Gateway | AmazonEC2 (VPC filter) |
| Secrets Manager | AWSSecretsManager |
| SES | AmazonSES |

---

## Veritabanı Şeması

```sql
CREATE TABLE users (
    id            SERIAL PRIMARY KEY,
    name          VARCHAR(255) NOT NULL,
    email         VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    mfa_secret    VARCHAR(255),
    mfa_enabled   BOOLEAN DEFAULT FALSE,
    created_at    TIMESTAMP DEFAULT NOW()
);

CREATE TABLE products (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(255) NOT NULL,
    description TEXT,
    created_at  TIMESTAMP DEFAULT NOW()
);

CREATE TABLE product_prices (
    id          SERIAL PRIMARY KEY,
    product_id  INTEGER REFERENCES products(id) ON DELETE CASCADE,
    price_usd   NUMERIC(10,2) NOT NULL,
    price_try   NUMERIC(10,2) NOT NULL,
    valid_from  DATE NOT NULL,
    valid_until DATE,
    created_at  TIMESTAMP DEFAULT NOW()
);

CREATE TABLE exchange_rates (
    id         SERIAL PRIMARY KEY,
    date       DATE UNIQUE NOT NULL,
    usd_try    NUMERIC(10,4) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

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
```

**snapshot_data JSONB örneği:**

```json
{
  "items": [
    {
      "name": "AWS EC2",
      "category": "Altyapı",
      "quantity": 720,
      "unit": "saat",
      "unit_price_usd": 0.0208,
      "total_usd": 14.98,
      "source": "aws_pricing"
    },
    {
      "name": "Geliştirici (Maaşlı)",
      "category": "İnsan Kaynağı",
      "gross_salary_try": 50000,
      "employer_cost_try": 61250,
      "net_salary_try": 39500,
      "source": "manuel"
    }
  ]
}
```

---

## Teknik Notlar

- Şifreler `bcrypt` ile hashlenir
- JWT token ile session yönetimi yapılır
- MFA için `pyotp`, QR kod için `qrcode` kullanılır
- AWS Pricing API sadece `us-east-1` region'ından sorgulanır
- Cost Explorer verisi 24 saat gecikmeli olabilir, arayüzde belirtilmeli
- KDV %20 sabit, kullanıcı tarafından değiştirilemez
- Tüm tutarlar USD cinsinden hesaplanır, TRY dönüşümü TCMB kuruyla yapılır
- Ücret geliri gelir vergisi dilimleri ile şahıs şirketi gelir vergisi dilimleri farklıdır

---

## Ortam Değişkenleri

```env
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=us-east-1
DATABASE_URL=postgresql://user:password@localhost:5432/kerdion_db
SECRET_KEY=your_jwt_secret_key
```

---

## Kimlik Doğrulama

- Login dışındaki tüm sayfalara erişim için oturum zorunludur
- Kayıt sayfası yoktur, yeni hesap DB üzerinden oluşturulur
- Şifre sıfırlama özelliği yoktur
- İlk kullanıcı `db/seed.sql` ile oluşturulur
