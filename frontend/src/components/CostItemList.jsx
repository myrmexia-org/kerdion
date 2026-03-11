/**
 * Maliyet kalemlerini kategori başlıkları altında listeler.
 * Props: items, categoriesOrder, onToggle, onUpdate, getItemTotalUsd, formatUsd
 */
const INPUT_CLASS =
  'rounded border border-[#2e3347] bg-[#0f1117] px-2 py-1 text-right font-mono text-sm text-[#f1f5f9] focus:border-[#6366f1] focus:outline-none'

export default function CostItemList({
  items = [],
  categoriesOrder = ['Altyapı', 'İletişim', 'İnsan Kaynağı', 'Araçlar', 'Vergi & Mali'],
  onToggle,
  onUpdate,
  getItemTotalUsd,
  formatUsd = (n) => (n != null && !Number.isNaN(n) ? `$${Number(n).toFixed(2)}` : '—'),
}) {
  return (
    <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-2">
      {categoriesOrder.map((cat) => {
        const catItems = items.filter((i) => i.category === cat)
        if (catItems.length === 0) return null
        return (
          <div key={cat} className="rounded-lg border border-[#2e3347] bg-[#1a1d27] p-4">
            <h2 className="mb-3 text-sm font-medium text-[#94a3b8]">{cat}</h2>
            <ul className="space-y-2">
              {catItems.map((item) => (
                <li key={item.id} className="flex flex-wrap items-center gap-2">
                  <input
                    type="checkbox"
                    checked={item.checked}
                    onChange={() => onToggle?.(item.id)}
                    className="rounded border-[#2e3347] bg-[#0f1117] text-[#6366f1] focus:ring-[#6366f1]"
                  />
                  <span className="w-48 shrink-0 text-sm text-[#f1f5f9]">{item.name}</span>
                  {item.checked && (
                    <>
                      {item.isKdv ? (
                        <span className="text-sm text-[#94a3b8]">%20 sabit</span>
                      ) : item.isTry ? (
                        <input
                          type="text"
                          inputMode="decimal"
                          placeholder="TRY"
                          value={item.amountTry ?? ''}
                          onChange={(e) => onUpdate?.(item.id, 'amountTry', e.target.value)}
                          className={`${INPUT_CLASS} w-28`}
                        />
                      ) : (
                        <>
                          <input
                            type="text"
                            inputMode="decimal"
                            placeholder={item.unit}
                            value={item.quantity ?? ''}
                            onChange={(e) => onUpdate?.(item.id, 'quantity', e.target.value)}
                            className={`${INPUT_CLASS} w-24`}
                          />
                          <input
                            type="text"
                            inputMode="decimal"
                            placeholder="USD birim"
                            value={item.unitPriceUsd ?? ''}
                            onChange={(e) => onUpdate?.(item.id, 'unitPriceUsd', e.target.value)}
                            className={`${INPUT_CLASS} w-24`}
                          />
                        </>
                      )}
                      <span className="font-mono text-sm text-[#94a3b8]">
                        {formatUsd(getItemTotalUsd?.(item))}
                      </span>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )
      })}
    </div>
  )
}
