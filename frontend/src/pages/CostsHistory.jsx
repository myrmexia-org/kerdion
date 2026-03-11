import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../App'
import { api } from '../api'
import ConfirmDialog from '../components/ConfirmDialog'

function formatUsd(n) {
  if (n == null || Number.isNaN(Number(n))) return '—'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(Number(n))
}

function formatTry(n) {
  if (n == null || Number.isNaN(Number(n))) return '—'
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    minimumFractionDigits: 2,
  }).format(Number(n))
}

function formatDateTime(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('tr-TR')
}

function formatDateLabel(value) {
  if (!value) return '-'
  const d = new Date(value)
  if (!Number.isNaN(d.getTime())) {
    return d.toLocaleDateString('tr-TR')
  }
  const raw = String(value)
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [y, m, day] = raw.split('-')
    return `${day}.${m}.${y}`
  }
  return raw
}

function toSafeFilePart(value) {
  return String(value || '')
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '_')
}

const MAIN_CATEGORIES = ['Altyapı', 'İletişim', 'İnsan Kaynağı', 'Araçlar', 'Vergi & Mali']

function mapCategory(rawCategory, item) {
  const value = String(rawCategory || '').toLowerCase()
  if (item?.isAws || value.includes('aws') || value.includes('altyap')) return 'Altyapı'
  if (value.includes('ilet')) return 'İletişim'
  if (value.includes('insan') || value.includes('personel') || value.includes('maas') || value.includes('maaş')) return 'İnsan Kaynağı'
  if (value.includes('arac') || value.includes('araç') || value.includes('tool')) return 'Araçlar'
  if (value.includes('vergi') || value.includes('mali') || item?.isTax || item?.tax || item?.kdv) return 'Vergi & Mali'
  return 'Altyapı'
}

function getIncomeTaxBracketLabel(totalIncomeTry) {
  const income = Number(totalIncomeTry || 0)
  if (income <= 190000) return '%15 (0 - 190.000 TL)'
  if (income <= 400000) return '%20 (190.000 - 400.000 TL)'
  if (income <= 1500000) return '%27 (400.000 - 1.500.000 TL)'
  if (income <= 5300000) return '%35 (1.500.000 - 5.300.000 TL)'
  return '%40 (5.300.000 TL +)'
}

function getSnapshotSubtotalTry(record) {
  const items = record?.snapshot_data?.items || []
  const rate = Number(record?.usd_try_rate || 0)
  if (rate <= 0) return 0
  return items
    .filter((item) => !(item.tax === true || item.kdv === true || item.isTax === true || item.tax_rate != null || item.kdv_rate != null))
    .reduce((sum, item) => sum + Number(item.total_usd || 0) * rate, 0)
}

function getItemUnitPriceLabel(item, record) {
  if (item.unit_price_usd != null) {
    return `${Number(item.unit_price_usd).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 6,
    })} USD`
  }
  if (String(item.name || '').toLowerCase().includes('gelir vergisi')) {
    return getIncomeTaxBracketLabel(getSnapshotSubtotalTry(record))
  }
  if (String(item.name || '').toLowerCase().includes('kdv')) return '%20 sabit'
  if (item.tax_rate != null) {
    return `%${(Number(item.tax_rate) * 100).toLocaleString('tr-TR', {
      maximumFractionDigits: 2,
    })}`
  }
  if (item.kdv_rate != null) {
    return `%${(Number(item.kdv_rate) * 100).toLocaleString('tr-TR', {
      maximumFractionDigits: 2,
    })}`
  }
  return '-'
}

function formatQuantityLabel(item) {
  if (item.quantity == null) {
    if (item.amount_try != null) return `${Number(item.amount_try).toLocaleString('tr-TR')} TRY`
    if (item.rate_pct != null) return `%${Number(item.rate_pct).toLocaleString('tr-TR')}`
    return '-'
  }
  const qty = Number(item.quantity)
  const quantityText = Number.isNaN(qty) ? String(item.quantity) : qty.toLocaleString('tr-TR')
  const unitText = String(item.unit || '').trim()
  if (!unitText) return quantityText
  const m = /^(\d+(?:[.,]\d+)?)\s+(.+)$/.exec(unitText)
  if (!m) return `${quantityText} ${unitText}`
  const unitBase = Number(String(m[1]).replace(',', '.'))
  const unitName = m[2]
  if (!Number.isNaN(unitBase) && !Number.isNaN(qty) && qty === unitBase) {
    return unitText
  }
  return `${quantityText} ${unitName}`
}

function summarizeSnapshot(record) {
  const items = record?.snapshot_data?.items || []
  const subtotalTry = getSnapshotSubtotalTry(record)
  const categoryTotalsUsd = Object.fromEntries(MAIN_CATEGORIES.map((cat) => [cat, 0]))
  for (const item of items) {
    const category = mapCategory(item.category, item)
    const totalUsd = Number(item.total_usd || 0)
    categoryTotalsUsd[category] = (categoryTotalsUsd[category] || 0) + totalUsd
  }
  const taxItems = items
    .filter(
      (item) =>
        item.tax === true ||
        item.kdv === true ||
        item.isTax === true ||
        item.tax_rate != null ||
        item.kdv_rate != null ||
        String(item.name || '').toLowerCase().includes('vergi')
    )
    .map((item) => {
      let rateLabel = '-'
      if (item.tax_rate != null) {
        rateLabel = `%${(Number(item.tax_rate) * 100).toLocaleString('tr-TR', { maximumFractionDigits: 2 })}`
      } else if (item.kdv_rate != null) {
        rateLabel = `%${(Number(item.kdv_rate) * 100).toLocaleString('tr-TR', { maximumFractionDigits: 2 })}`
      } else if (String(item.name || '').toLowerCase().includes('gelir vergisi')) {
        rateLabel = getIncomeTaxBracketLabel(subtotalTry)
      } else if (String(item.name || '').toLowerCase().includes('kdv')) {
        rateLabel = '%20'
      }
      return {
        name: item.name || 'Vergi',
        rateLabel,
        totalUsd: Number(item.total_usd || 0),
      }
    })
  return { categoryTotalsUsd, taxItems }
}

export default function CostsHistory() {
  const { token } = useAuth()
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [productFilter, setProductFilter] = useState('')
  const [selected, setSelected] = useState({})
  const [confirmDelete, setConfirmDelete] = useState({ open: false, item: null })
  const [openDetails, setOpenDetails] = useState({})

  async function loadAll() {
    setLoading(true)
    setError('')
    try {
      const { data: products } = await api.get('/products')
      const snapshotsByProduct = await Promise.all(
        products.map(async (p) => {
          const { data } = await api.get(`/products/${p.id}/snapshots`)
          return data.map((s) => ({
            ...s,
            product_id: p.id,
            product_name: p.name,
          }))
        })
      )
      setRecords(snapshotsByProduct.flat())
    } catch (err) {
      setError(err.response?.data?.detail || 'Maliyet kayıtları alınamadı')
      setRecords([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAll()
  }, [token])

  const sortedRecords = useMemo(() => {
    return [...records].sort((a, b) => {
      const aTime = new Date(a.created_at || a.period).getTime()
      const bTime = new Date(b.created_at || b.period).getTime()
      return bTime - aTime
    })
  }, [records])

  const productOptions = useMemo(() => {
    const map = new Map()
    for (const r of records) {
      if (r?.product_id == null) continue
      if (!map.has(String(r.product_id))) {
        map.set(String(r.product_id), r.product_name || `Ürün #${r.product_id}`)
      }
    }
    return [...map.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'tr'))
  }, [records])

  const filteredRecords = useMemo(() => {
    if (!productFilter) return sortedRecords
    return sortedRecords.filter((r) => String(r.product_id) === productFilter)
  }, [sortedRecords, productFilter])

  async function handleDelete(item) {
    try {
      await api.delete(`/products/${item.product_id}/snapshots/${item.id}`)
      setRecords((prev) => prev.filter((r) => r.id !== item.id))
      setSelected((prev) => {
        const next = { ...prev }
        delete next[item.id]
        return next
      })
    } catch (err) {
      setError(err.response?.data?.detail || 'Kayıt silinemedi')
    }
  }

  const handleExportPdf = () => {
    const selectedRecords = filteredRecords.filter((r) => selected[r.id])
    if (selectedRecords.length === 0) {
      setError('PDF export için en az bir maliyet kaydı seçin.')
      return
    }
    const sections = selectedRecords
      .map((s, idx) => {
        const { categoryTotalsUsd, taxItems } = summarizeSnapshot(s)
        const categoryText = MAIN_CATEGORIES
          .filter((cat) => Number(categoryTotalsUsd[cat] || 0) > 0)
          .map((cat) => `${cat}: ${formatUsd(categoryTotalsUsd[cat])}`)
          .join(' | ') || '-'
        const taxText = taxItems
          .map((t) => `${t.name} (${t.rateLabel}): ${formatUsd(t.totalUsd)}`)
          .join(' | ') || '-'
        const detailRows = (s?.snapshot_data?.items || [])
          .map((item) => {
            const totalUsd = Number(item.total_usd || 0)
            const totalTry = totalUsd * Number(s.usd_try_rate || 0)
            const quantityText = formatQuantityLabel(item)
            return `<tr>
              <td>${item.name || '-'}</td>
              <td>${item.category || '-'}</td>
              <td>${quantityText}</td>
              <td>${getItemUnitPriceLabel(item, s)}</td>
              <td>${formatUsd(totalUsd)} / ${formatTry(totalTry)}</td>
            </tr>`
          })
          .join('')

        return `
          <section class="record-block ${idx > 0 ? 'record-break' : ''}">
            <h2>${s.product_name} - ${formatDateLabel(s.period)}</h2>
            <table>
              <thead>
                <tr>
                  <th>Ürün</th>
                  <th>Oluşturan</th>
                  <th>Oluşturulma</th>
                  <th>Dönem</th>
                  <th>Toplam maliyet</th>
                  <th>Satış fiyatı</th>
                  <th>Net kar</th>
                  <th>Kur</th>
                  <th>Kategori toplamları</th>
                  <th>Vergiler</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>${s.product_name}</td>
                  <td>${s.created_by_name || '-'}</td>
                  <td>${formatDateTime(s.created_at)}</td>
                  <td>${formatDateLabel(s.period)}</td>
                  <td>${formatUsd(s.total_cost_usd)} / ${formatTry(s.total_cost_try)}</td>
                  <td>${formatUsd(s.sale_price_usd)} / ${formatTry(s.sale_price_try)}</td>
                  <td>${formatUsd(s.net_profit_usd)} / ${formatTry(s.net_profit_try)}</td>
                  <td>${Number(s.usd_try_rate).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</td>
                  <td>${categoryText}</td>
                  <td>${taxText}</td>
                </tr>
              </tbody>
            </table>
            <div style="margin-top: 8px;">
              <strong>Maliyet Kalemi Detayları</strong>
              <table style="width:100%; border-collapse:collapse; margin-top:6px;">
                <thead>
                  <tr>
                    <th>Maliyet Kalemi</th>
                    <th>Kategori</th>
                    <th>Miktar</th>
                    <th>Birim Fiyat</th>
                    <th>Toplam</th>
                  </tr>
                </thead>
                <tbody>${detailRows || '<tr><td colspan="5">Detay yok</td></tr>'}</tbody>
              </table>
            </div>
          </section>
        `
      })
      .join('')
    const first = selectedRecords[0]
    const pdfTitle = selectedRecords.length === 1
      ? `${first?.product_name || '-'} - Maliyet Tablosu - ${formatDateLabel(first?.period)}`
      : `${first?.product_name || '-'} - Maliyet Tablosu - ${formatDateLabel(first?.period)} - ${selectedRecords.length} kayıt`
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(`
      <html>
        <head>
          <title>${pdfTitle}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; }
            h1 { margin-bottom: 16px; }
            h2 { margin: 0 0 8px; font-size: 16px; }
            .record-block { margin-bottom: 18px; }
            .record-break { page-break-before: always; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            th, td { border: 1px solid #ccc; padding: 8px; text-align: left; vertical-align: top; }
            th { background: #f2f2f2; }
          </style>
        </head>
        <body>
          <h1>${pdfTitle}</h1>
          ${sections}
        </body>
      </html>
    `)
    win.document.close()
    win.focus()
    win.print()
  }

  const selectedCount = useMemo(
    () => filteredRecords.filter((r) => selected[r.id]).length,
    [filteredRecords, selected]
  )
  const allSelected = filteredRecords.length > 0 && selectedCount === filteredRecords.length

  return (
    <div className="space-y-6">
      <style>{`@media print { .no-print { display: none !important; } }`}</style>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-[#f1f5f9]">Maliyetler</h1>
        <div className="no-print flex items-center gap-2">
          <select
            value={productFilter}
            onChange={(e) => setProductFilter(e.target.value)}
            className="rounded-md border border-[#2e3347] bg-[#0f1117] px-3 py-2 text-sm text-[#cbd5e1] focus:border-[#6366f1] focus:outline-none"
          >
            <option value="">Tüm ürünler</option>
            {productOptions.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() =>
              setSelected((prev) => {
                if (allSelected) {
                  const next = { ...prev }
                  for (const r of filteredRecords) delete next[r.id]
                  return next
                }
                return {
                  ...prev,
                  ...Object.fromEntries(filteredRecords.map((r) => [r.id, true])),
                }
              })
            }
            className="rounded-md border border-[#2e3347] px-3 py-2 text-sm text-[#94a3b8] hover:bg-[#2e3347]"
          >
            {allSelected ? 'Seçimi temizle' : 'Tümünü seç'}
          </button>
          <button
            type="button"
            onClick={handleExportPdf}
            className="rounded-md border border-[#6366f1] px-3 py-2 text-sm text-[#c7d2fe] hover:bg-[#2e3347]"
          >
            PDF Export ({selectedCount})
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-[#ef4444]">{error}</p>}

      {loading ? (
        <p className="text-[#94a3b8]">Yükleniyor…</p>
      ) : filteredRecords.length === 0 ? (
        <p className="rounded-lg border border-[#2e3347] bg-[#1a1d27] p-6 text-center text-[#94a3b8]">
          {productFilter ? 'Seçilen ürüne ait kayıt yok.' : 'Kayıtlı maliyet hesaplaması yok.'}
        </p>
      ) : (
        <div className="space-y-4">
          {filteredRecords.map((s) => (
            <div key={s.id} className="rounded-lg border border-[#2e3347] bg-[#1a1d27] p-4">
              {(() => {
                const { categoryTotalsUsd, taxItems } = summarizeSnapshot(s)
                return (
                  <>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="no-print"
                    checked={Boolean(selected[s.id])}
                    onChange={(e) => setSelected((prev) => ({ ...prev, [s.id]: e.target.checked }))}
                  />
                  <p className="text-sm text-[#94a3b8]">
                  Ürün: <span className="font-medium text-[#f1f5f9]">{s.product_name}</span> | Dönem:{' '}
                  <span className="font-mono text-[#f1f5f9]">{formatDateLabel(s.period)}</span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setConfirmDelete({ open: true, item: s })}
                  className="no-print rounded px-2 py-1 text-xs text-[#ef4444] hover:bg-[#2e3347]"
                >
                  Sil
                </button>
              </div>
              <div className="mb-2">
                <button
                  type="button"
                  onClick={() =>
                    setOpenDetails((prev) => ({ ...prev, [s.id]: !prev[s.id] }))
                  }
                  className="no-print rounded border border-[#2e3347] px-2 py-1 text-xs text-[#cbd5e1] hover:bg-[#2e3347]"
                >
                  {openDetails[s.id] ? 'Detayları gizle' : 'Detaylar'}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
                <span className="text-[#94a3b8]">Oluşturan:</span>
                <span className="font-mono text-[#f1f5f9]">{s.created_by_name || '—'}</span>
                <span className="text-[#94a3b8]">Oluşturulma:</span>
                <span className="font-mono text-[#f1f5f9]">{formatDateTime(s.created_at)}</span>
                <span className="text-[#94a3b8]">Toplam maliyet:</span>
                <span className="font-mono text-[#f1f5f9]">
                  {formatUsd(s.total_cost_usd)} / {formatTry(s.total_cost_try)}
                </span>
                <span className="text-[#94a3b8]">Satış fiyatı:</span>
                <span className="font-mono text-[#f1f5f9]">
                  {formatUsd(s.sale_price_usd)} / {formatTry(s.sale_price_try)}
                </span>
                <span className="text-[#94a3b8]">Net kar:</span>
                <span className={`font-mono ${Number(s.net_profit_usd) >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
                  {formatUsd(s.net_profit_usd)} / {formatTry(s.net_profit_try)}
                </span>
                <span className="text-[#94a3b8]">Kur:</span>
                <span className="font-mono text-[#f1f5f9]">
                  {Number(s.usd_try_rate).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                </span>
              </div>
              {openDetails[s.id] && (
                <div className="mt-3 overflow-x-auto rounded border border-[#2e3347] bg-[#0f1117] p-3">
                  <p className="mb-2 text-xs font-medium text-[#94a3b8]">
                    Maliyet Kalemi Detayları (kaydın oluşturulduğu andaki değerler)
                  </p>
                  {Array.isArray(s?.snapshot_data?.items) && s.snapshot_data.items.length > 0 ? (
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-[#2e3347] text-[#94a3b8]">
                          <th className="px-2 py-1">Maliyet Kalemi</th>
                          <th className="px-2 py-1">Kategori</th>
                          <th className="px-2 py-1">Miktar</th>
                          <th className="px-2 py-1">Birim Fiyat</th>
                          <th className="px-2 py-1">Toplam</th>
                        </tr>
                      </thead>
                      <tbody>
                        {s.snapshot_data.items.map((item, idx) => {
                          const totalUsd = Number(item.total_usd || 0)
                          const totalTry = totalUsd * Number(s.usd_try_rate || 0)
                          const quantityText = formatQuantityLabel(item)
                          const unitPriceText = getItemUnitPriceLabel(item, s)
                          return (
                            <tr key={`${s.id}-item-${idx}`} className="border-b border-[#1f2331] last:border-0 text-[#cbd5e1]">
                              <td className="px-2 py-1">{item.name || '-'}</td>
                              <td className="px-2 py-1">{item.category || '-'}</td>
                              <td className="px-2 py-1">{quantityText}</td>
                              <td className="px-2 py-1">{unitPriceText}</td>
                              <td className="px-2 py-1">
                                {formatUsd(totalUsd)} / {formatTry(totalTry)}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  ) : (
                    <p className="text-xs text-[#94a3b8]">Bu kayıtta kalem detayı yok.</p>
                  )}
                </div>
              )}
              <div className="mt-3 grid gap-2 rounded border border-[#2e3347] bg-[#0f1117] p-3 text-xs">
                <p className="font-medium text-[#94a3b8]">Ana başlık toplamları</p>
                <div className="flex flex-wrap gap-2">
                  {MAIN_CATEGORIES.filter((cat) => Number(categoryTotalsUsd[cat] || 0) > 0).length === 0 ? (
                    <p className="text-[#94a3b8]">Kategori verisi yok.</p>
                  ) : (
                    MAIN_CATEGORIES
                      .filter((cat) => Number(categoryTotalsUsd[cat] || 0) > 0)
                      .map((cat) => (
                        <span key={cat} className="rounded border border-[#2e3347] px-2 py-1 text-[#cbd5e1]">
                          {cat}: {formatUsd(categoryTotalsUsd[cat])} /{' '}
                          {formatTry((Number(categoryTotalsUsd[cat] || 0)) * Number(s.usd_try_rate || 0))}
                        </span>
                      ))
                  )}
                </div>
                <p className="mt-1 font-medium text-[#94a3b8]">Ödenecek vergiler</p>
                {taxItems.length === 0 ? (
                  <p className="text-[#94a3b8]">Vergi kalemi yok.</p>
                ) : (
                  <ul className="space-y-1 text-[#cbd5e1]">
                    {taxItems.map((t, idx) => (
                      <li key={`${s.id}-tax-${idx}`}>
                        {t.name} ({t.rateLabel}): {formatUsd(t.totalUsd)} /{' '}
                        {formatTry(t.totalUsd * Number(s.usd_try_rate || 0))}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
                  </>
                )
              })()}
            </div>
          ))}
        </div>
      )}
      <ConfirmDialog
        open={confirmDelete.open}
        title="Maliyet kaydını sil"
        message="Bu maliyet kaydını silmek istediğinize emin misiniz?"
        confirmText="Sil"
        onCancel={() => setConfirmDelete({ open: false, item: null })}
        onConfirm={() => {
          if (confirmDelete.item) handleDelete(confirmDelete.item)
          setConfirmDelete({ open: false, item: null })
        }}
      />
    </div>
  )
}
