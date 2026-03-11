export default function ConfirmDialog({
  open,
  title = 'Emin misiniz?',
  message = '',
  confirmText = 'Onayla',
  cancelText = 'İptal',
  onConfirm,
  onCancel,
}) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg border border-[#2e3347] bg-[#1a1d27] p-4 shadow-xl">
        <h3 className="text-base font-semibold text-[#f1f5f9]">{title}</h3>
        {message && <p className="mt-2 text-sm text-[#94a3b8]">{message}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-[#2e3347] px-3 py-1.5 text-sm text-[#94a3b8] hover:bg-[#2e3347]"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-md bg-[#ef4444] px-3 py-1.5 text-sm text-white hover:bg-red-600"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
