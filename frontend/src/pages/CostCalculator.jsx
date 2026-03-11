import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../App'
import { api } from '../api'

const COST_ITEMS = [
  { id: 'ec2', name: 'AWS EC2', category: 'Altyapı', unit: 'saat', isAws: true },
  { id: 'rds', name: 'AWS RDS (PostgreSQL)', category: 'Altyapı', unit: 'saat', isAws: true },
  { id: 's3-storage', name: 'AWS S3 Storage', category: 'Altyapı', unit: 'GB', isAws: true },
  { id: 's3-requests', name: 'AWS S3 İstekler', category: 'Altyapı', unit: '1000 istek', isAws: true, noDefaultQty: true },
  { id: 'bandwidth', name: 'AWS Bandwidth (Data Transfer)', category: 'Altyapı', unit: 'GB', isAws: true },
  { id: 'cloudfront', name: 'AWS CloudFront (CDN)', category: 'Altyapı', unit: 'GB', isAws: true },
  { id: 'route53', name: 'AWS Route53', category: 'Altyapı', unit: 'hosted zone', isAws: true },
  { id: 'cloudwatch', name: 'AWS CloudWatch', category: 'Altyapı', unit: 'metrik', isAws: true },
  { id: 'backup-rds', name: 'AWS Backup - RDS Snapshot', category: 'Altyapı', unit: 'GB', isAws: true },
  { id: 'backup-s3', name: 'AWS Backup - S3 Snapshot', category: 'Altyapı', unit: 'GB', isAws: true },
  { id: 'nat', name: 'AWS NAT Gateway', category: 'Altyapı', unit: 'saat', isAws: true },
  { id: 'elastic-ip', name: 'AWS Elastic IP', category: 'Altyapı', unit: 'saat', isAws: true },
  { id: 'secrets', name: 'AWS Secrets Manager', category: 'Altyapı', unit: 'secret', isAws: true },
  { id: 'ses', name: 'AWS SES', category: 'Altyapı', unit: '1000 email', isAws: true },
  { id: 'lambda', name: 'AWS Lambda', category: 'Altyapı', unit: '1M istek', isAws: true },
  { id: 'elasticache', name: 'AWS ElastiCache', category: 'Altyapı', unit: 'saat', isAws: true },
  { id: 'acm', name: 'AWS Certificate Manager (private CA)', category: 'Altyapı', unit: 'adet', isAws: true },
  { id: 'sendgrid', name: 'SendGrid', category: 'İletişim', unit: '1000 email' },
  { id: 'domain', name: 'Domain', category: 'İletişim', unit: 'aylık' },
  { id: 'maasli', name: 'Maaşlı çalışan (brüt maaş)', category: 'İnsan Kaynağı', unit: 'TRY/ay', isTry: true },
  { id: 'freelancer', name: 'Freelancer', category: 'İnsan Kaynağı', unit: 'saat' },
  { id: 'github', name: 'GitHub', category: 'Araçlar', unit: 'aylık' },
  { id: 'sentry', name: 'Sentry / Monitoring', category: 'Araçlar', unit: 'aylık' },
  { id: 'diger-saas', name: 'Diğer SaaS Araçları', category: 'Araçlar', unit: 'aylık' },
  { id: 'kdv', name: 'KDV', category: 'Vergi & Mali', unit: '%20 sabit', isTax: true, taxRate: 0.2 },
  { id: 'gelir-vergisi', name: 'Gelir Vergisi Karşılığı', category: 'Vergi & Mali', unit: 'kademeli (%15/%20)', isTax: true, isProgressiveIncomeTax: true },
  { id: 'ssk', name: 'SSK + İşsizlik (işveren)', category: 'Vergi & Mali', unit: 'oran %', defaultQty: 23.75, isSskRate: true },
]

function formatUsd(n) {
  if (n == null || Number.isNaN(n)) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(n)
}

function formatTry(n) {
  if (n == null || Number.isNaN(n)) return '—'
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', minimumFractionDigits: 2 }).format(n)
}

function calculateIncomeTaxTry(totalIncomeTry) {
  const income = Number(totalIncomeTry) || 0
  if (income <= 0) return 0
  if (income <= 190000) {
    return income * 0.15
  }
  if (income <= 400000) {
    return 28500 + (income - 190000) * 0.2
  }
  if (income <= 1500000) {
    return 70500 + (income - 400000) * 0.27
  }
  if (income <= 5300000) {
    return 367500 + (income - 1500000) * 0.35
  }
  return 1697500 + (income - 5300000) * 0.4
}

function parseDecimal(value) {
  return parseFloat(String(value ?? '').replace(',', '.')) || 0
}

function formatUsdPerMtok(value) {
  if (value == null || Number.isNaN(Number(value))) return null
  return `$${Number(value).toFixed(2)} / 1M token`
}

function formatDisplayDate(value) {
  if (!value) return ''
  const text = String(value)
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text)
  if (m) {
    return `${m[3]}.${m[2]}.${m[1]}`
  }
  const date = new Date(text)
  if (Number.isNaN(date.getTime())) return text
  return date.toLocaleDateString('tr-TR')
}

function toPriceNumber(value) {
  const n = Number(value)
  return Number.isNaN(n) ? Number.POSITIVE_INFINITY : n
}

const categoriesOrder = ['Altyapı', 'İletişim', 'İnsan Kaynağı', 'Araçlar', 'Vergi & Mali']

export default function CostCalculator() {
  const { token } = useAuth()
  const [products, setProducts] = useState([])
  const [selectedProductId, setSelectedProductId] = useState('')
  const [rate, setRate] = useState(null)
  const [rateDate, setRateDate] = useState('')
  const [rateSyncedTime, setRateSyncedTime] = useState('')
  const [rateLoading, setRateLoading] = useState(true)
  const [items, setItems] = useState(() =>
    COST_ITEMS.map((c) => ({
      ...c,
      checked: false,
      quantity: c.isAiFixed ? '1' : (c.noDefaultQty ? '' : (c.defaultQty ?? '')),
      unitPriceUsd: '',
      amountTry: '',
    }))
  )
  const [profitMarginPct, setProfitMarginPct] = useState('30')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saveSuccessModalOpen, setSaveSuccessModalOpen] = useState(false)
  const [awsPriceError, setAwsPriceError] = useState('')
  const [awsPriceSyncedTime, setAwsPriceSyncedTime] = useState('')
  const [toolsTab, setToolsTab] = useState('all')
  const [toolsSearch, setToolsSearch] = useState('')
  const [aiDetailsOpen, setAiDetailsOpen] = useState({})
  const [openCategory, setOpenCategory] = useState('')

  const getMonthlySalaryTry = (sourceItems = items) => {
    const salaryItem = sourceItems.find((i) => i.id === 'maasli')
    return parseDecimal(salaryItem?.amountTry)
  }

  const getSskAmountTry = (sskItem, sourceItems = items) => {
    const salaryTry = getMonthlySalaryTry(sourceItems)
    const ratePct = parseDecimal(sskItem?.quantity)
    return salaryTry * ratePct / 100
  }

  useEffect(() => {
    async function fetchProducts() {
      try {
        const { data } = await api.get('/products')
        setProducts(data)
        if (data.length > 0 && !selectedProductId) setSelectedProductId(String(data[0].id))
      } catch {
        setProducts([])
      }
    }
    fetchProducts()
  }, [token])

  useEffect(() => {
    async function fetchAiPackages() {
      try {
        const { data } = await api.get('/costs/ai-packages')
        setItems((prev) => {
          const dynamicPrevById = new Map(
            prev.filter((i) => i.isAiDynamic).map((i) => [i.id, i])
          )
          const baseItems = prev.filter((i) => !i.isAiDynamic)
          const aiItems = (Array.isArray(data) ? data : []).map((pkg) => {
            const existing = dynamicPrevById.get(pkg.id)
            return {
              id: pkg.id,
              name: `${pkg.provider_label} API (${pkg.model_name} input)`,
              category: 'Araçlar',
              aiProvider: pkg.provider,
              aiModelId: pkg.model_id,
              aiDescription: pkg.description || '',
              aiInputPriceUsd: pkg.input_price_usd,
              aiOutputPriceUsd: pkg.output_price_usd,
              aiCacheReadPriceUsd: pkg.cache_read_price_usd,
              aiCacheWrite5mPriceUsd: pkg.cache_write_5m_price_usd,
              aiCacheWrite1hPriceUsd: pkg.cache_write_1h_price_usd,
              unit: pkg.unit || '1M input token',
              isAws: true,
              isAiFixed: true,
              isAiDynamic: true,
              checked: existing?.checked || false,
              quantity: '1',
              unitPriceUsd: pkg.unit_price_usd != null ? String(pkg.unit_price_usd) : (existing?.unitPriceUsd || ''),
              amountTry: '',
            }
          })
          return [...baseItems, ...aiItems]
        })
      } catch {
        // Paket listesi alınamazsa mevcut kalemler ile devam eder.
      }
    }
    fetchAiPackages()
  }, [token])

  useEffect(() => {
    async function fetchAwsUnitPrices() {
      try {
        const { data } = await api.get('/costs/aws-prices')
        setAwsPriceError(data?.__error || '')
        setItems((prev) =>
          prev.map((item) => {
            if (!item.isAws) return item
            const awsPrice = data?.[item.id]
            if (awsPrice == null) return item
            if (item.isAiFixed) {
              return { ...item, quantity: '1', unitPriceUsd: String(awsPrice) }
            }
            return { ...item, unitPriceUsd: String(awsPrice) }
          })
        )
        setAwsPriceSyncedTime(
          new Date().toLocaleTimeString('tr-TR', {
            hour: '2-digit',
            minute: '2-digit',
          })
        )
      } catch {
        // AWS fiyatı alınamazsa mevcut manuel giriş akışı devam eder.
        setAwsPriceError('AWS/AI fiyatları alınamadı.')
      }
    }
    fetchAwsUnitPrices()
    const timer = setInterval(fetchAwsUnitPrices, 15 * 60 * 1000)
    return () => clearInterval(timer)
  }, [token])

  useEffect(() => {
    async function fetchRate() {
      setRateLoading(true)
      try {
        const { data } = await api.get('/exchange/current')
        setRate(Number(data.usd_try))
        setRateDate(data.date || '')
        if (data.created_at) {
          setRateSyncedTime(
            new Date(data.created_at).toLocaleTimeString('tr-TR', {
              hour: '2-digit',
              minute: '2-digit',
            })
          )
        } else {
          setRateSyncedTime('')
        }
      } catch {
        setRate(null)
        setRateSyncedTime('')
      } finally {
        setRateLoading(false)
      }
    }
    fetchRate()
  }, [token])

  const toggleItem = (id) => {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, checked: !i.checked } : i))
    )
  }

  const updateItem = (id, field, value) => {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, [field]: value } : i))
    )
  }

  const toggleAiDetails = (id) => {
    setAiDetailsOpen((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const { subtotalUsd, taxUsdById, totalCostUsd, totalCostTry, salePriceUsd, salePriceTry, netProfitUsd, netProfitTry } = useMemo(() => {
    const usdRate = rate != null && !Number.isNaN(rate) ? rate : 0
    let sub = 0
    const checkedItems = items.filter((i) => i.checked && !i.isTax)
    for (const i of checkedItems) {
      if (i.isSskRate && usdRate > 0) {
        const tryVal = getSskAmountTry(i, items)
        sub += tryVal / usdRate
      } else if (i.isTry && i.amountTry !== '' && usdRate > 0) {
        const tryVal = parseDecimal(i.amountTry)
        sub += tryVal / usdRate
      } else if (!i.isTry) {
        const q = parseDecimal(i.quantity)
        const p = parseDecimal(i.unitPriceUsd)
        sub += q * p
      }
    }
    const taxUsdById = {}
    const subTry = sub * usdRate
    let totalTaxUsd = 0
    for (const i of items.filter((x) => x.checked && x.isTax)) {
      let taxAmount = 0
      if (i.isProgressiveIncomeTax) {
        const incomeTaxTry = calculateIncomeTaxTry(subTry)
        taxAmount = usdRate > 0 ? incomeTaxTry / usdRate : 0
      } else {
        const taxRate = Number(i.taxRate || 0)
        taxAmount = sub * taxRate
      }
      taxUsdById[i.id] = taxAmount
      totalTaxUsd += taxAmount
    }
    const totalUsd = sub + totalTaxUsd
    const totalTry = totalUsd * usdRate
    const margin = parseFloat(String(profitMarginPct).replace(',', '.')) || 0
    const saleUsd = totalUsd * (1 + margin / 100)
    const saleTry = saleUsd * usdRate
    const netUsd = saleUsd - totalUsd
    const netTry = netUsd * usdRate
    return {
      subtotalUsd: sub,
      taxUsdById,
      totalCostUsd: totalUsd,
      totalCostTry: totalTry,
      salePriceUsd: saleUsd,
      salePriceTry: saleTry,
      netProfitUsd: netUsd,
      netProfitTry: netTry,
    }
  }, [items, rate, profitMarginPct])

  const itemTotalUsd = (item) => {
    if (item.isTax) return taxUsdById[item.id] || 0
    if (item.isSskRate) {
      const tryVal = getSskAmountTry(item)
      return rate > 0 ? tryVal / rate : 0
    }
    if (item.isTry) {
      const tryVal = parseDecimal(item.amountTry)
      return rate > 0 ? tryVal / rate : 0
    }
    const q = parseDecimal(item.quantity)
    const p = parseDecimal(item.unitPriceUsd)
    return q * p
  }

  const getFilteredToolsItems = (sourceItems) => {
    let filtered = sourceItems
    if (toolsTab === 'openai') {
      filtered = filtered.filter((i) => i.aiProvider === 'openai')
    } else if (toolsTab === 'anthropic') {
      filtered = filtered.filter((i) => i.aiProvider === 'anthropic')
    } else if (toolsTab === 'other') {
      filtered = filtered.filter((i) => !i.aiProvider)
    }
    const query = toolsSearch.trim().toLowerCase()
    const searched = query ? filtered.filter((i) => i.name.toLowerCase().includes(query)) : filtered

    if (toolsTab === 'openai' || toolsTab === 'anthropic') {
      return [...searched].sort((a, b) => {
        const pa = toPriceNumber(a.unitPriceUsd)
        const pb = toPriceNumber(b.unitPriceUsd)
        if (pa !== pb) return pa - pb
        return String(a.name || '').localeCompare(String(b.name || ''), 'tr')
      })
    }

    if (toolsTab === 'all') {
      const nonAi = searched.filter((i) => !i.aiProvider)
      const ai = searched.filter((i) => i.aiProvider)
      ai.sort((a, b) => {
        const providerCmp = String(a.aiProvider || '').localeCompare(String(b.aiProvider || ''), 'tr')
        if (providerCmp !== 0) return providerCmp
        const pa = toPriceNumber(a.unitPriceUsd)
        const pb = toPriceNumber(b.unitPriceUsd)
        if (pa !== pb) return pa - pb
        return String(a.name || '').localeCompare(String(b.name || ''), 'tr')
      })
      return [...nonAi, ...ai]
    }

    return searched
  }

  const handleSave = async () => {
    const productId = selectedProductId ? parseInt(selectedProductId, 10) : null
    setSaveSuccessModalOpen(false)
    if (!productId || rate == null) {
      setSaveError('Ürün ve döviz kuru gerekli.')
      return
    }
    const checkedItems = items.filter((i) => i.checked)
    if (checkedItems.length === 0) {
      setSaveError('Tüm alanlar boşken kayıt yapılamaz. En az bir kalem seçip değer girin.')
      return
    }
    const hasAnyValue = checkedItems.some((i) => {
      if (i.isTax) return false
      if (i.isSskRate) return getSskAmountTry(i) > 0
      if (i.isTry) return parseDecimal(i.amountTry) > 0
      return parseDecimal(i.quantity) > 0 && parseDecimal(i.unitPriceUsd) > 0
    })
    if (!hasAnyValue) {
      setSaveError('Tüm alanlar boşken kayıt yapılamaz. En az bir kalem seçip değer girin.')
      return
    }
    const today = new Date().toISOString().slice(0, 10)
    setSaveError('')
    setSaving(true)
    try {
      const snapshotItems = items
        .filter((i) => i.checked)
        .map((i) => {
          const totalUsd = itemTotalUsd(i)
          if (i.isTax) {
            return {
              name: i.name,
              category: i.category,
              total_usd: totalUsd,
              source: 'manuel',
              tax: true,
              tax_rate: i.isProgressiveIncomeTax ? null : Number(i.taxRate || 0),
            }
          }
          if (i.isSskRate) {
            const ratePct = parseDecimal(i.quantity)
            const amountTry = getSskAmountTry(i)
            return {
              name: i.name,
              category: i.category,
              rate_pct: ratePct,
              amount_try: amountTry,
              total_usd: totalUsd,
              source: 'manuel',
              based_on: 'maasli',
            }
          }
          if (i.isTry) {
            return {
              name: i.name,
              category: i.category,
              amount_try: parseDecimal(i.amountTry),
              total_usd: totalUsd,
              source: 'manuel',
            }
          }
          const q = parseDecimal(i.quantity)
          const p = parseDecimal(i.unitPriceUsd)
          return {
            name: i.name,
            category: i.category,
            quantity: q,
            unit: i.unit,
            unit_price_usd: p,
            total_usd: totalUsd,
            source: i.id.startsWith('ai-') ? 'ai_pricing' : (i.category === 'Altyapı' ? 'aws_pricing' : 'manuel'),
          }
        })
      const body = {
        product_id: productId,
        period: today,
        usd_try_rate: rate,
        total_cost_usd: totalCostUsd,
        total_cost_try: totalCostTry,
        profit_margin_pct: parseFloat(String(profitMarginPct).replace(',', '.')) || 0,
        sale_price_usd: salePriceUsd,
        sale_price_try: salePriceTry,
        net_profit_usd: netProfitUsd,
        net_profit_try: netProfitTry,
        snapshot_data: { items: snapshotItems },
      }
      await api.post('/costs', body)
      setSaveError('')
      setSaveSuccessModalOpen(true)
    } catch (err) {
      setSaveError(err.response?.data?.detail || 'Kayıt başarısız')
      setSaveSuccessModalOpen(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex gap-6">
      <div className="min-w-0 flex-1 space-y-4">
        <h1 className="text-2xl font-semibold text-[#f1f5f9]">Maliyet Hesaplama</h1>

        {rateLoading ? (
          <p className="text-sm text-[#94a3b8]">Kur yükleniyor…</p>
        ) : rate != null ? (
          <p className="inline-block rounded border border-[#2e3347] bg-[#1a1d27] px-3 py-1.5 text-sm font-mono text-[#f1f5f9]">
            Güncel kur: {Number(rate).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
            {rateDate && <span className="ml-2 text-[#94a3b8]">({formatDisplayDate(rateDate)})</span>}
            {rateSyncedTime && <span className="ml-2 text-[#94a3b8]">Son senkron: {rateSyncedTime}</span>}
          </p>
        ) : (
          <p className="text-sm text-[#f59e0b]">Kur alınamadı.</p>
        )}

        <div className="rounded-lg border border-[#2e3347] bg-[#1a1d27] p-4">
          <label htmlFor="cost-product" className="mb-2 block text-sm text-[#94a3b8]">Ürün</label>
          <select
            id="cost-product"
            value={selectedProductId}
            onChange={(e) => setSelectedProductId(e.target.value)}
            className="rounded border border-[#2e3347] bg-[#0f1117] px-3 py-2 text-[#f1f5f9] focus:border-[#6366f1] focus:outline-none"
          >
            <option value="">Seçin</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          {awsPriceError && (
            <p className="mt-2 text-xs text-[#f59e0b]">
              AWS/AI fiyatları otomatik alınamadı: {awsPriceError}
            </p>
          )}
          {!awsPriceError && awsPriceSyncedTime && (
            <p className="mt-2 text-xs text-[#94a3b8]">
              Birim fiyat son senkron: {awsPriceSyncedTime}
            </p>
          )}
        </div>

        <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-2">
          {categoriesOrder.map((cat) => {
            const catItemsRaw = items.filter((i) => i.category === cat)
            const catItems = cat === 'Araçlar' ? getFilteredToolsItems(catItemsRaw) : catItemsRaw
            if (catItemsRaw.length === 0) return null
            const isOpen = openCategory === cat
            return (
              <div key={cat} className="rounded-lg border border-[#2e3347] bg-[#1a1d27] p-4">
                <button
                  type="button"
                  onClick={() => setOpenCategory((prev) => (prev === cat ? '' : cat))}
                  className="mb-3 flex w-full items-center justify-between text-left"
                >
                  <h2 className="text-sm font-medium text-[#94a3b8]">{cat}</h2>
                  <span className="text-xs text-[#64748b]">{isOpen ? '▲' : '▼'}</span>
                </button>
                {isOpen && cat === 'Araçlar' && (
                  <div className="mb-3 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setToolsTab('all')}
                        className={`rounded px-2 py-1 text-xs ${toolsTab === 'all' ? 'bg-[#6366f1] text-white' : 'bg-[#0f1117] text-[#94a3b8]'}`}
                      >
                        Tümü
                      </button>
                      <button
                        type="button"
                        onClick={() => setToolsTab('openai')}
                        className={`rounded px-2 py-1 text-xs ${toolsTab === 'openai' ? 'bg-[#6366f1] text-white' : 'bg-[#0f1117] text-[#94a3b8]'}`}
                      >
                        OpenAI
                      </button>
                      <button
                        type="button"
                        onClick={() => setToolsTab('anthropic')}
                        className={`rounded px-2 py-1 text-xs ${toolsTab === 'anthropic' ? 'bg-[#6366f1] text-white' : 'bg-[#0f1117] text-[#94a3b8]'}`}
                      >
                        Anthropic
                      </button>
                      <button
                        type="button"
                        onClick={() => setToolsTab('other')}
                        className={`rounded px-2 py-1 text-xs ${toolsTab === 'other' ? 'bg-[#6366f1] text-white' : 'bg-[#0f1117] text-[#94a3b8]'}`}
                      >
                        Diğer Araçlar
                      </button>
                    </div>
                    <input
                      type="text"
                      placeholder="Araç kalemi ara"
                      value={toolsSearch}
                      onChange={(e) => setToolsSearch(e.target.value)}
                      className="w-full rounded border border-[#2e3347] bg-[#0f1117] px-2 py-1.5 text-sm text-[#f1f5f9] focus:border-[#6366f1] focus:outline-none"
                    />
                  </div>
                )}
                {isOpen && (catItems.length === 0 ? (
                  <p className="text-xs text-[#94a3b8]">Filtreye uygun kalem bulunamadı.</p>
                ) : (
                  <ul className="space-y-2">
                  {catItems.map((item) => (
                    <li key={item.id} className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                      <input
                        id={`cost-item-${item.id}`}
                        type="checkbox"
                        checked={item.checked}
                        onChange={() => toggleItem(item.id)}
                        className="rounded border-[#2e3347] bg-[#0f1117] text-[#6366f1] focus:ring-[#6366f1]"
                      />
                      <label
                        htmlFor={`cost-item-${item.id}`}
                        className={`${item.isAiDynamic ? 'w-[28rem]' : 'w-48'} cursor-pointer select-none text-sm text-[#f1f5f9]`}
                      >
                        <span>{item.name}</span>
                      </label>
                      {item.isAiDynamic && (
                        <button
                          type="button"
                          onClick={() => toggleAiDetails(item.id)}
                          className="rounded border border-[#2e3347] bg-[#0f1117] px-2 py-1 text-xs text-[#94a3b8] hover:border-[#6366f1] hover:text-[#cbd5e1]"
                        >
                          {aiDetailsOpen[item.id] ? 'Detayları gizle' : 'Detayları göster'}
                        </button>
                      )}
                      {item.checked && (
                        <>
                          {item.isTax ? (
                            <span className="text-sm text-[#94a3b8]">
                              {item.isProgressiveIncomeTax
                                ? 'Kademeli: %15 / %20 / %27 / %35 / %40'
                                : `%${Math.round(Number(item.taxRate || 0) * 100)} sabit`}
                            </span>
                          ) : item.isSskRate ? (
                            <>
                              <input
                                type="text"
                                inputMode="decimal"
                                placeholder="%"
                                value={item.quantity}
                                onChange={(e) => updateItem(item.id, 'quantity', e.target.value)}
                                className="w-20 rounded border border-[#2e3347] bg-[#0f1117] px-2 py-1 text-right font-mono text-sm text-[#f1f5f9] focus:border-[#6366f1] focus:outline-none"
                              />
                              <span className="text-xs text-[#94a3b8]">
                                Brüt maaş üzerinden (işveren payı): {formatTry(getSskAmountTry(item))}
                              </span>
                            </>
                          ) : item.isTry ? (
                            <input
                              type="text"
                              inputMode="decimal"
                              placeholder="TRY"
                              value={item.amountTry}
                              onChange={(e) => updateItem(item.id, 'amountTry', e.target.value)}
                              className="w-28 rounded border border-[#2e3347] bg-[#0f1117] px-2 py-1 text-right font-mono text-sm text-[#f1f5f9] focus:border-[#6366f1] focus:outline-none"
                            />
                          ) : (
                            <>
                              {item.isAiFixed ? (
                                <span className="w-24 rounded border border-[#2e3347] bg-[#0f1117] px-2 py-1 text-center font-mono text-sm text-[#94a3b8]">
                                  1M input
                                </span>
                              ) : (
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  placeholder={item.noDefaultQty ? '' : item.unit}
                                  value={item.quantity}
                                  onChange={(e) => updateItem(item.id, 'quantity', e.target.value)}
                                  className="w-24 rounded border border-[#2e3347] bg-[#0f1117] px-2 py-1 text-right font-mono text-sm text-[#f1f5f9] focus:border-[#6366f1] focus:outline-none"
                                />
                              )}
                              {item.isAws ? (
                                <span className="w-36 rounded border border-[#2e3347] bg-[#0f1117] px-2 py-1 text-right font-mono text-sm text-[#94a3b8]">
                                  {item.unitPriceUsd !== ''
                                    ? `${Number(item.unitPriceUsd).toFixed(4)} USD`
                                    : (item.id.startsWith('ai-') ? 'AI fiyat yok' : 'AWS fiyat yok')}
                                </span>
                              ) : (
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  placeholder="Birim fiyat (USD)"
                                  value={item.unitPriceUsd}
                                  onChange={(e) => updateItem(item.id, 'unitPriceUsd', e.target.value)}
                                  className="w-24 rounded border border-[#2e3347] bg-[#0f1117] px-2 py-1 text-right font-mono text-sm text-[#f1f5f9] focus:border-[#6366f1] focus:outline-none"
                                />
                              )}
                            </>
                          )}
                          <span className="font-mono text-sm text-[#94a3b8]">
                            {formatUsd(itemTotalUsd(item))}
                          </span>
                        </>
                      )}
                      </div>
                      {item.isAiDynamic && aiDetailsOpen[item.id] && (
                        <div className="ml-6 max-w-[24rem] rounded border border-[#2e3347] bg-[#0f1117] p-2 text-xs leading-5 text-[#94a3b8]">
                          {formatUsdPerMtok(item.aiInputPriceUsd) && (
                            <div>Girdi: {formatUsdPerMtok(item.aiInputPriceUsd)}</div>
                          )}
                          {formatUsdPerMtok(item.aiCacheReadPriceUsd) && (
                            <div>Önbellek okuma: {formatUsdPerMtok(item.aiCacheReadPriceUsd)}</div>
                          )}
                          {formatUsdPerMtok(item.aiCacheWrite5mPriceUsd) && (
                            <div>Önbellek yazma (5dk): {formatUsdPerMtok(item.aiCacheWrite5mPriceUsd)}</div>
                          )}
                          {formatUsdPerMtok(item.aiCacheWrite1hPriceUsd) && (
                            <div>Önbellek yazma (1s): {formatUsdPerMtok(item.aiCacheWrite1hPriceUsd)}</div>
                          )}
                          {formatUsdPerMtok(item.aiOutputPriceUsd) && (
                            <div>Çıktı: {formatUsdPerMtok(item.aiOutputPriceUsd)}</div>
                          )}
                        </div>
                      )}
                    </li>
                  ))}
                  </ul>
                ))}
              </div>
            )
          })}
        </div>
      </div>

      <aside className="w-72 shrink-0 rounded-lg border border-[#2e3347] bg-[#1a1d27] p-4">
        <h2 className="mb-4 text-sm font-medium text-[#94a3b8]">Özet (Aylık)</h2>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-[#94a3b8]">Toplam maliyet (Aylık)</dt>
            <dd className="font-mono text-[#f1f5f9]">{formatUsd(totalCostUsd)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-[#94a3b8]">Toplam maliyet (TRY/Aylık)</dt>
            <dd className="font-mono text-[#f1f5f9]">{formatTry(totalCostTry)}</dd>
          </div>
        </dl>
        <div className="mt-4">
          <label htmlFor="profit-pct" className="mb-1 block text-xs text-[#94a3b8]">Kar %</label>
          <input
            id="profit-pct"
            type="text"
            inputMode="decimal"
            value={profitMarginPct}
            onChange={(e) => setProfitMarginPct(e.target.value)}
            className="w-full rounded border border-[#2e3347] bg-[#0f1117] px-2 py-1.5 text-right font-mono text-[#f1f5f9] focus:border-[#6366f1] focus:outline-none"
          />
        </div>
        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-[#94a3b8]">Önerilen satış (Aylık)</dt>
            <dd className="font-mono text-[#f1f5f9]">{formatUsd(salePriceUsd)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-[#94a3b8]">Önerilen satış (TRY/Aylık)</dt>
            <dd className="font-mono text-[#f1f5f9]">{formatTry(salePriceTry)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-[#94a3b8]">Net kar (Aylık)</dt>
            <dd className={`font-mono ${netProfitUsd >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
              {formatUsd(netProfitUsd)} / {formatTry(netProfitTry)}
            </dd>
          </div>
        </dl>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !selectedProductId || rate == null}
          className="mt-6 w-full rounded-md bg-[#6366f1] py-2 text-sm font-medium text-white hover:bg-[#5558e3] disabled:opacity-50"
        >
          {saving ? 'Kaydediliyor…' : 'Hesaplamayı kaydet'}
        </button>
        {saveError && <p className="mt-2 text-sm text-[#ef4444]">{saveError}</p>}
      </aside>
      {saveSuccessModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-lg border border-[#2e3347] bg-[#1a1d27] p-4 shadow-xl">
            <h3 className="text-base font-semibold text-[#f1f5f9]">Kayıt başarılı</h3>
            <p className="mt-2 text-sm text-[#94a3b8]">Kayıt başarıyla yapıldı.</p>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setSaveSuccessModalOpen(false)
                  window.location.reload()
                }}
                className="rounded-md bg-[#6366f1] px-3 py-1.5 text-sm text-white hover:bg-[#5558e3]"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
