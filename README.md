# SaaS Maliyet Hesaplama Uygulaması

Kişisel kullanım için geliştirilmiş, AWS API entegrasyonlu SaaS ürün maliyet hesaplama uygulaması.

---

## Teknoloji Stack

- **Backend:** Python + FastAPI + boto3
- **Frontend:** React + Vite + shadcn/ui + Tailwind CSS
- **Veritabanı:** PostgreSQL (EC2 üzerinde)
- **Deployment:** Tek EC2 instance (t3.small, Ubuntu 22.04)
  - FastAPI → uvicorn, port 8000
  - PostgreSQL → port 5432, dışarıya kapalı
  - Nginx → port 80/443, /api/* backend'e, /* frontend'e yönlendirir

---

## Proje Yapısı

```
maliyet-app/
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

## Sayfalar

### 1. Kullanıcılar Sayfası
- Tüm kullanıcılar listelenir
- Kullanıcı eklenip silinebilir
- Tüm kullanıcılar diğer kullanıcıları görebilir ve yönetebilir (rol yok, herkes eşit yetkili)

### 2. Kullanıcı Ayarları Sayfası
- Her kullanıcıya özel, diğer kullanıcılar tarafından görülemez
- Şifre değiştirme
- MFA aktif etme / deaktif etme (TOTP tabanlı, Microsoft Authenticator ve Google Authenticator ile uyumlu)

### 3. Ürünler Sayfası
- Ürün eklenip silinebilir
- Her ürüne tıklandığında o ürüne ait geçmiş maliyet hesaplamaları listelenir
- Geçmiş hesaplamalar istenirse silinebilir

### 4. Maliyet Hesaplama Sayfası
- Ürün seçilir
- Sayfanın üstünde güncel TCMB kuru gösterilir ("Güncel kur: 1 USD = 32.45 TRY" gibi)
- Maliyet kalemleri kategori başlıkları altında gruplandırılmış şekilde listelenir
- Her kalem işaretlendiğinde yanında miktar/adet giriş alanı açılır
- AWS kalemleri için AWS Pricing API'den birim fiyat otomatik çekilir, girilen miktar ile çarpılarak maliyet hesaplanır
- AWS Cost Explorer'dan gerçek harcama ayrıca gösterilir, tahmini ile karşılaştırılır (Cost Explorer verisi 24 saat gecikmeli olabilir, kullanıcıya gösterilmeli)
- KDV kalemi işaretlendiğinde %20 sabit olarak uygulanır, başka değer girilemez
- Tüm maliyetler hem USD hem TRY olarak gösterilir
- Sağ panelde sabit özet kartı: toplam maliyet USD/TRY, kar yüzdesi girişi, önerilen satış fiyatı USD/TRY, net kar USD/TRY
- Hesaplama kaydedilir, kaydedilen geçmiş hesaplamalarda hangi kurla yapıldığı gösterilir ("Bu hesaplama 1 USD = 32.45 TRY kuruyla yapılmıştır")

---

## Maliyet Kalemleri (Sabit Liste)

Tüm kalemler her hesaplamada listelenir. Kullanıcı istediği kalemleri işaretler, işaretlenmeyen kalemler hesaba dahil edilmez.

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
| AWS Certificate Manager (private CA) | adet | birim_fiyat × adet |

### İletişim (Manuel)

| Kalem | Birim |
|---|---|
| SendGrid | 1000 email |
| Domain | aylık (yıllık ücret / 12) |

### İnsan Kaynağı (Manuel)

Maaşlı çalışan ve freelancer olarak iki ayrı tip vardır. Detay için İşçilik Maliyeti Hesabı bölümüne bakınız.

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
| **Net Maaş (ele geçen)** | | brüt − tüm kesintiler |

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

Girilen bilgiler: ad, saatlik ücret (USD veya TRY seçilebilir), o ay çalışılan saat

```
Toplam = saatlik_ucret × calisilan_saat
```

Freelancer için SGK veya vergi kesintisi uygulanmaz. Şirkete maliyeti girilen tutar kadardır.

---

## Vergi Hesabı (Şahıs Şirketi - Türkiye)

**KDV:** %20 sabit. Müşteriden tahsil edilip devlete ödenir, net maliyete dahil edilmez ancak faturada gösterilir.

**Şahıs Şirketi Gelir Vergisi Dilimleri (2025):**

| Dilim | Oran |
|---|---|
| 0 - 110.000 TRY | %15 |
| 110.001 - 230.000 TRY | %20 |
| 230.001 - 870.000 TRY | %27 |
| 870.001 - 3.000.000 TRY | %35 |
| 3.000.001 TRY üzeri | %40 |

**Geçici Vergi:** Yıllık gelir vergisinin peşin ödenmesidir. Yılda 4 kez ödenir. Aynı matrah ve oranlar geçerlidir. Aylık karşılık ayırmak için yıllık tahmini vergiyi 12'ye böl.

**SGK Bağ-Kur:** Aylık sabit tutar, kullanıcı tarafından manuel girilir.

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

AWS Servis Kodları:

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
| Lambda | AWSLambda |
| ElastiCache | AmazonElastiCache |
| Backup | AWSBackup |

### AWS Cost Explorer API

Gerçek harcama verisini çekmek için kullanılır. Veri 24 saat gecikmeli güncellenir.

```python
import boto3

client = boto3.client('ce', region_name='us-east-1')

response = client.get_cost_and_usage(
    TimePeriod={'Start': '2024-01-01', 'End': '2024-02-01'},
    Granularity='MONTHLY',
    GroupBy=[{'Type': 'DIMENSION', 'Key': 'SERVICE'}],
    Metrics=['UnblendedCost']
)
```

---

## TCMB Döviz Kuru

Günlük güncellenir. Hafta sonu ve resmi tatillerde güncellenmez, son iş günü kuru kullanılır.

```python
import requests
import xml.etree.ElementTree as ET

response = requests.get('https://www.tcmb.gov.tr/kurlar/today.xml')
root = ET.fromstring(response.content)
for currency in root.findall('Currency'):
    if currency.get('CurrencyCode') == 'USD':
        usd_try = float(currency.find('ForexSelling').text)
```

---

## MFA (TOTP)

Microsoft Authenticator ve Google Authenticator ile uyumlu TOTP tabanlı MFA.

Kullanılan kütüphaneler: `pyotp`, `qrcode`

Akış:
1. Kullanıcı MFA aktif etmek istediğinde backend `pyotp.random_base32()` ile secret üretir
2. Secret QR kod olarak gösterilir, kullanıcı authenticator uygulamasıyla tarar
3. Kullanıcı 6 haneli kodu girer, backend doğrular
4. Doğrulama başarılıysa secret DB'ye kaydedilir, MFA aktif olur
5. Sonraki girişlerde şifre + 6 haneli kod istenir

---

## Veritabanı Şeması (PostgreSQL)

```sql
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
```

Güncel ürün fiyatını çekmek için:
```sql
SELECT * FROM product_prices
WHERE product_id = $1 AND valid_until IS NULL;
```

Fiyat güncellenirken eskisi kapatılır, yenisi eklenir:
```sql
UPDATE product_prices SET valid_until = NOW() WHERE product_id = $1 AND valid_until IS NULL;
INSERT INTO product_prices (product_id, price_usd, price_try, valid_from) VALUES ($1, $2, $3, NOW());
```

`snapshot_data` JSONB örneği:
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
    },
    {
      "name": "SendGrid",
      "category": "İletişim",
      "quantity": 50000,
      "unit": "email",
      "unit_price_usd": 0.00001,
      "total_usd": 0.50,
      "source": "manuel"
    }
  ]
}
```

---

## Frontend Tasarım

- **UI Kütüphanesi:** shadcn/ui (Tailwind CSS üzerine)
- **Tema:** Dark mode, açık tema yok
- **Stil:** Modern ve şık
- **Mobil uyumluluk gerekmez**, sadece desktop

### Renk Paleti

```
Arka plan:    #0f1117
Kart:         #1a1d27
Border:       #2e3347
Vurgu:        #6366f1  (indigo)
Başarı:       #22c55e  (yeşil)
Uyarı:        #f59e0b  (amber)
Hata:         #ef4444  (kırmızı)
Metin:        #f1f5f9
Soluk metin:  #94a3b8
Sayısal veri: font-mono
```

### Sayfa Düzeni

```
┌──────────────┬─────────────────────────────┐
│  Sidebar     │  Ana İçerik                 │
│  (w-64)      │                             │
│              │  Sayfa Başlığı              │
│  Logo        │  ──────────────────────     │
│  ─────────   │  İçerik kartları            │
│  Kullanıcı   │                             │
│  Ürünler     │                             │
│  Maliyet     │                             │
│  ─────────   │                             │
│  Ayarlar     │                             │
└──────────────┴─────────────────────────────┘
```

### Sayısal Veri Gösterimi

- USD: `$1,234.56` formatında
- TRY: `₺1.234,56` formatında
- Kar: yeşil renk, zarar: kırmızı renk
- Döviz kuru: sayfanın üstünde badge olarak `1 USD = 32.45 ₺`

### Maliyet Hesaplama Sayfası Düzeni

```
┌─────────────────────────────┬──────────────────┐
│  Kalemler (sol, scrollable) │  Özet (sağ, sabit│
│                             │                  │
│  [Altyapı]                  │  Toplam: $xxx    │
│  ☑ AWS EC2   720  $14.98    │  TRY: ₺xxx       │
│  ☐ AWS RDS                  │                  │
│                             │  Kar: [  30  ]%  │
│  [İletişim]                 │                  │
│  ☑ SendGrid  50k  $0.50     │  Satış: $xxx     │
│                             │  TRY: ₺xxx       │
│  [İnsan Kaynağı]            │                  │
│  ☑ Geliştirici → form açılır│  Net Kar: $xxx   │
│                             │                  │
│  [Kaydet]                   │                  │
└─────────────────────────────┴──────────────────┘
```

---

## Ortam Değişkenleri

```env
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=us-east-1
DATABASE_URL=postgresql://user:password@localhost:5432/maliyet_db
SECRET_KEY=your_jwt_secret_key
```

---

## Teknik Notlar

- Şifreler `bcrypt` ile hashlenir
- JWT token ile session yönetimi yapılır
- MFA için `pyotp`, QR kod için `qrcode` kütüphanesi kullanılır
- AWS Pricing API sadece `us-east-1` region'ından sorgulanır
- Cost Explorer verisi 24 saat gecikmeli olabilir, arayüzde belirtilmeli
- KDV %20 sabit, kullanıcı tarafından değiştirilemez
- Tüm tutarlar USD cinsinden hesaplanır, TRY dönüşümü TCMB kuruyla yapılır
- Ücret geliri gelir vergisi dilimleri ile şahıs şirketi gelir vergisi dilimleri farklıdır, karıştırılmamalıdır

---

## EC2 Kurulum Sırası

```
1. EC2 instance aç (t3.small, Ubuntu 22.04)
2. Security group: 80 ve 443 aç, 22 sadece kendi IP'ne
3. PostgreSQL kur ve yapılandır
4. Python bağımlılıklarını yükle (pip install -r requirements.txt)
5. React build al (npm run build), dist klasörünü Nginx'e bağla
6. FastAPI'yi systemd servisi olarak çalıştır
7. Nginx yapılandır (/api/* → backend, /* → frontend)
8. SSL için certbot (Let's Encrypt) kur
```

---

## Docker

Tüm servisler Docker ile ayağa kaldırılır. EC2'da ayrı kurulum gerekmez.

### Dosyalar

```
maliyet-app/
├── Dockerfile
├── docker-compose.yml
├── .env.example
└── nginx/
    └── nginx.conf
```

### docker-compose.yml yapısı

3 servis çalışır:
- **backend** — FastAPI uygulaması (port 8000)
- **db** — PostgreSQL (port 5432, dışarıya kapalı)
- **nginx** — Reverse proxy (port 80/443)

### EC2'da kurulum

```
1. EC2 instance aç (t3.small, Ubuntu 22.04)
2. Security group: 80 ve 443 aç, 22 sadece kendi IP'ne
3. Docker ve Docker Compose kur
4. Repo'yu çek
5. .env.example dosyasını .env olarak kopyala, değerleri doldur
6. docker-compose up -d
7. SSL için certbot kur
```

---

## Kimlik Doğrulama & Erişim Kontrolü

- Login sayfası dışındaki tüm sayfalara erişim için oturum açmış olmak zorunludur
- Oturum açılmadan erişim denendiğinde login sayfasına yönlendirilir
- Kayıt (register) sayfası yoktur, yeni hesap oluşturma özelliği yoktur
- Şifre sıfırlama özelliği yoktur
- İlk kullanıcı (admin) uygulama ilk kurulurken DB'ye seed scripti ile eklenir
- Admin kullanıcısı ile giriş yapılıp şifre ve diğer bilgiler kullanıcı ayarları sayfasından değiştirilebilir
- Tüm kullanıcılar eşit yetkilidir, rol ayrımı yoktur

---

## Varsayılan Admin Hesabı

Uygulama ilk kurulumunda db/seed.sql ile otomatik oluşturulur.

```
Kullanıcı Adı: MyrmAdmin
Şifre: M@yrm06!Ank!
```

Giriş yaptıktan sonra Kullanıcı Ayarları sayfasından değiştirilebilir.
