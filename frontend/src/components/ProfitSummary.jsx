/**
 * Maliyet özeti: toplam maliyet, kar %, önerilen satış, net kar. İsteğe bağlı kaydet butonu.
 */
function defaultFormatUsd(n) {
  if (n == null || Number.isNaN(n)) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(n)
}

function defaultFormatTry(n) {
  if (n == null || Number.isNaN(n)) return '—'
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', minimumFractionDigits: 2 }).format(n)
}

export default function ProfitSummary({
  totalCostUsd,
  totalCostTry,
  profitMarginPct = '',
  onProfitMarginChange,
  salePriceUsd,
  salePriceTry,
  netProfitUsd,
  netProfitTry,
  onSave,
  saving = false,
  saveError = '',
  saveDisabled = false,
  formatUsd = defaultFormatUsd,
  formatTry = defaultFormatTry,
}) {
  return (
    <aside className="w-72 shrink-0 rounded-lg border border-[#2e3347] bg-[#1a1d27] p-4">
      <h2 className="mb-4 text-sm font-medium text-[#94a3b8]">Özet</h2>
      <dl className="space-y-2 text-sm">
        <div className="flex justify-between">
          <dt className="text-[#94a3b8]">Toplam maliyet</dt>
          <dd className="font-mono text-[#f1f5f9]">{formatUsd(totalCostUsd)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-[#94a3b8]">Toplam maliyet (TRY)</dt>
          <dd className="font-mono text-[#f1f5f9]">{formatTry(totalCostTry)}</dd>
        </div>
      </dl>
      {onProfitMarginChange != null && (
        <div className="mt-4">
          <label htmlFor="profit-pct" className="mb-1 block text-xs text-[#94a3b8]">Kar %</label>
          <input
            id="profit-pct"
            type="text"
            inputMode="decimal"
            value={profitMarginPct}
            onChange={(e) => onProfitMarginChange(e.target.value)}
            className="w-full rounded border border-[#2e3347] bg-[#0f1117] px-2 py-1.5 text-right font-mono text-[#f1f5f9] focus:border-[#6366f1] focus:outline-none"
          />
        </div>
      )}
      <dl className="mt-4 space-y-2 text-sm">
        <div className="flex justify-between">
          <dt className="text-[#94a3b8]">Önerilen satış</dt>
          <dd className="font-mono text-[#f1f5f9]">{formatUsd(salePriceUsd)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-[#94a3b8]">Önerilen satış (TRY)</dt>
          <dd className="font-mono text-[#f1f5f9]">{formatTry(salePriceTry)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-[#94a3b8]">Net kar</dt>
          <dd
            className={`font-mono ${
              netProfitUsd != null && Number(netProfitUsd) >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'
            }`}
          >
            {formatUsd(netProfitUsd)} / {formatTry(netProfitTry)}
          </dd>
        </div>
      </dl>
      {onSave != null && (
        <>
          <button
            type="button"
            onClick={onSave}
            disabled={saving || saveDisabled}
            className="mt-6 w-full rounded-md bg-[#6366f1] py-2 text-sm font-medium text-white hover:bg-[#5558e3] disabled:opacity-50"
          >
            {saving ? 'Kaydediliyor…' : 'Hesaplamayı kaydet'}
          </button>
          {saveError && <p className="mt-2 text-sm text-[#ef4444]">{saveError}</p>}
        </>
      )}
    </aside>
  )
}
