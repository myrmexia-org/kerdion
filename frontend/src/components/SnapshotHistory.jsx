/**
 * Geçmiş maliyet hesaplamaları (snapshot) listesi. İsteğe bağlı silme.
 */
function defaultFormatUsd(n) {
  if (n == null || Number.isNaN(n)) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(Number(n))
}

function defaultFormatTry(n) {
  if (n == null || Number.isNaN(n)) return '—'
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', minimumFractionDigits: 2 }).format(Number(n))
}

export default function SnapshotHistory({
  snapshots = [],
  emptyMessage = 'Kayıtlı hesaplama yok.',
  onDelete,
  formatUsd = defaultFormatUsd,
  formatTry = defaultFormatTry,
}) {
  if (snapshots.length === 0) {
    return (
      <p className="rounded-lg border border-[#2e3347] bg-[#1a1d27] p-6 text-center text-[#94a3b8]">
        {emptyMessage}
      </p>
    )
  }

  return (
    <div className="space-y-4">
      {snapshots.map((s) => (
        <div
          key={s.id}
          className="rounded-lg border border-[#2e3347] bg-[#1a1d27] p-4"
        >
          <p className="mb-2 text-sm text-[#94a3b8]">
            Bu hesaplama 1 USD ={' '}
            {Number(s.usd_try_rate).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}{' '}
            TRY kuruyla yapılmıştır.
          </p>
          <div className="mb-3 grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
            <span className="text-[#94a3b8]">Dönem:</span>
            <span className="font-mono text-[#f1f5f9]">{s.period}</span>
            <span className="text-[#94a3b8]">Toplam maliyet:</span>
            <span className="font-mono text-[#f1f5f9]">
              {formatUsd(s.total_cost_usd)} / {formatTry(s.total_cost_try)}
            </span>
            <span className="text-[#94a3b8]">Satış fiyatı:</span>
            <span className="font-mono text-[#f1f5f9]">
              {formatUsd(s.sale_price_usd)} / {formatTry(s.sale_price_try)}
            </span>
            <span className="text-[#94a3b8]">Net kar:</span>
            <span
              className={`font-mono ${
                Number(s.net_profit_usd) >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'
              }`}
            >
              {formatUsd(s.net_profit_usd)} / {formatTry(s.net_profit_try)}
            </span>
          </div>
          {onDelete != null && (
            <button
              type="button"
              onClick={(e) => onDelete(s.id, e)}
              className="rounded px-2 py-1 text-xs text-[#ef4444] hover:bg-[#2e3347]"
            >
              Sil
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
