import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAuth } from '../App'
import { api } from '../api'
import ConfirmDialog from '../components/ConfirmDialog'

function formatUsd(n) {
  if (n == null) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(Number(n))
}

function formatTry(n) {
  if (n == null) return '—'
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', minimumFractionDigits: 2 }).format(Number(n))
}

export default function ProductDetail() {
  const { id } = useParams()
  const { token } = useAuth()
  const [product, setProduct] = useState(null)
  const [snapshots, setSnapshots] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState({ open: false, id: null })

  async function loadProduct() {
    if (!id) return
    try {
      const { data } = await api.get(`/products/${id}`)
      setProduct(data)
    } catch (err) {
      setError(err.response?.data?.detail || 'Ürün alınamadı')
      setProduct(null)
    }
  }

  async function loadSnapshots() {
    if (!id) return
    try {
      const { data } = await api.get(`/products/${id}/snapshots`)
      setSnapshots(data)
    } catch {
      setSnapshots([])
    }
  }

  useEffect(() => {
    setLoading(true)
    setError('')
    loadProduct().finally(() => setLoading(false))
  }, [id, token])

  useEffect(() => {
    if (product) loadSnapshots()
  }, [product, id, token])

  async function handleDeleteSnapshot(snapshotId) {
    try {
      await api.delete(`/products/${id}/snapshots/${snapshotId}`)
      loadSnapshots()
    } catch (err) {
      setError(err.response?.data?.detail || 'Kayıt silinemedi')
    }
  }

  if (loading) {
    return <p className="text-[#94a3b8]">Yükleniyor…</p>
  }
  if (error || !product) {
    return (
      <div>
        <Link to="/products" className="text-sm text-[#6366f1] hover:underline">← Ürünlere dön</Link>
        <p className="mt-4 text-[#ef4444]">{error || 'Ürün bulunamadı'}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/products" className="text-sm text-[#6366f1] hover:underline">← Ürünler</Link>
        <h1 className="text-2xl font-semibold text-[#f1f5f9]">{product.name}</h1>
      </div>
      {product.description && (
        <p className="text-[#94a3b8]">{product.description}</p>
      )}

      <h2 className="text-lg font-medium text-[#f1f5f9]">Geçmiş maliyet hesaplamaları</h2>
      {error && <p className="text-sm text-[#ef4444]">{error}</p>}

      {snapshots.length === 0 ? (
        <p className="rounded-lg border border-[#2e3347] bg-[#1a1d27] p-6 text-center text-[#94a3b8]">
          Bu ürüne ait kayıtlı hesaplama yok. Maliyet Hesaplama sayfasından kayıt ekleyebilirsiniz.
        </p>
      ) : (
        <div className="space-y-4">
          {snapshots.map((s) => (
            <div
              key={s.id}
              className="rounded-lg border border-[#2e3347] bg-[#1a1d27] p-4"
            >
              <p className="mb-2 text-sm text-[#94a3b8]">
                Bu hesaplama 1 USD = {Number(s.usd_try_rate).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TRY kuruyla yapılmıştır.
              </p>
              <div className="mb-3 grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
                <span className="text-[#94a3b8]">Dönem:</span>
                <span className="font-mono text-[#f1f5f9]">{s.period}</span>
                <span className="text-[#94a3b8]">Toplam maliyet:</span>
                <span className="font-mono text-[#f1f5f9]">{formatUsd(s.total_cost_usd)} / {formatTry(s.total_cost_try)}</span>
                <span className="text-[#94a3b8]">Satış fiyatı:</span>
                <span className="font-mono text-[#f1f5f9]">{formatUsd(s.sale_price_usd)} / {formatTry(s.sale_price_try)}</span>
                <span className="text-[#94a3b8]">Net kar:</span>
                <span className={`font-mono ${Number(s.net_profit_usd) >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
                  {formatUsd(s.net_profit_usd)} / {formatTry(s.net_profit_try)}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setConfirmDelete({ open: true, id: s.id })}
                className="rounded px-2 py-1 text-xs text-[#ef4444] hover:bg-[#2e3347]"
              >
                Sil
              </button>
            </div>
          ))}
        </div>
      )}
      <ConfirmDialog
        open={confirmDelete.open}
        title="Maliyet kaydını sil"
        message="Bu maliyet kaydını silmek istediğinize emin misiniz?"
        confirmText="Sil"
        onCancel={() => setConfirmDelete({ open: false, id: null })}
        onConfirm={() => {
          handleDeleteSnapshot(confirmDelete.id)
          setConfirmDelete({ open: false, id: null })
        }}
      />
    </div>
  )
}
