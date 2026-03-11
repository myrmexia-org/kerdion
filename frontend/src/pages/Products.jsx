import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../App'
import { api } from '../api'
import ConfirmDialog from '../components/ConfirmDialog'

export default function Products() {
  const { token } = useAuth()
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editError, setEditError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState({ open: false, id: null, name: '' })

  async function load() {
    setLoading(true)
    setError('')
    try {
      const { data } = await api.get('/products')
      setList(data)
    } catch (err) {
      setError(err.response?.data?.detail || 'Liste alınamadı')
      setList([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [token])

  async function handleAdd(e) {
    e.preventDefault()
    setAddError('')
    setAdding(true)
    try {
      await api.post('/products', { name: name.trim(), description: description.trim() || null })
      setName('')
      setDescription('')
      load()
    } catch (err) {
      setAddError(err.response?.data?.detail || 'Eklenemedi')
    } finally {
      setAdding(false)
    }
  }

  async function handleDelete(productId) {
    try {
      await api.delete(`/products/${productId}`)
      load()
    } catch (err) {
      setError(err.response?.data?.detail || 'Silinemedi')
    }
  }

  async function handleEditSave(e) {
    e.preventDefault()
    setEditError('')
    try {
      await api.patch(`/products/${editingId}`, {
        name: editName.trim(),
        description: editDescription.trim() || null,
      })
      setEditingId(null)
      setEditName('')
      setEditDescription('')
      load()
    } catch (err) {
      setEditError(err.response?.data?.detail || 'Güncellenemedi')
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-[#f1f5f9]">Ürünler</h1>

      <section className="rounded-lg border border-[#2e3347] bg-[#1a1d27] p-4">
        <h2 className="mb-3 text-sm font-medium text-[#94a3b8]">Yeni ürün</h2>
        <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="product-name" className="mb-1 block text-xs text-[#94a3b8]">Ad</label>
            <input
              id="product-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-56 rounded border border-[#2e3347] bg-[#0f1117] px-2 py-1.5 text-sm text-[#f1f5f9] focus:border-[#6366f1] focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="product-desc" className="mb-1 block text-xs text-[#94a3b8]">Açıklama</label>
            <input
              id="product-desc"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-64 rounded border border-[#2e3347] bg-[#0f1117] px-2 py-1.5 text-sm text-[#f1f5f9] focus:border-[#6366f1] focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={adding}
            className="rounded bg-[#6366f1] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#5558e3] disabled:opacity-50"
          >
            {adding ? 'Ekleniyor…' : 'Ekle'}
          </button>
        </form>
        {addError && <p className="mt-2 text-sm text-[#ef4444]">{addError}</p>}
      </section>

      {error && <p className="text-sm text-[#ef4444]">{error}</p>}
      {loading ? (
        <p className="text-[#94a3b8]">Yükleniyor…</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-[#2e3347] bg-[#1a1d27]">
          {list.length === 0 ? (
            <p className="p-6 text-center text-[#94a3b8]">Henüz ürün yok. Yukarıdan ekleyebilirsiniz.</p>
          ) : (
            <ul className="divide-y divide-[#2e3347]">
              {list.map((p) => (
                <li key={p.id}>
                  <Link
                    to={`/products/${p.id}`}
                    className="flex items-center justify-between gap-4 p-4 transition-colors hover:bg-[#2e3347]/50"
                  >
                    <div className="min-w-0 flex-1">
                      <span className="font-medium text-[#f1f5f9]">{p.name}</span>
                      {p.description && (
                        <span className="ml-2 text-sm text-[#94a3b8]">— {p.description}</span>
                      )}
                    </div>
                    <div className="shrink-0 space-x-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          setEditingId(p.id)
                          setEditName(p.name || '')
                          setEditDescription(p.description || '')
                          setEditError('')
                        }}
                        className="rounded px-2 py-1 text-xs text-[#94a3b8] hover:bg-[#2e3347]"
                      >
                        Düzenle
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          setConfirmDelete({ open: true, id: p.id, name: p.name })
                        }}
                        className="rounded px-2 py-1 text-xs text-[#ef4444] hover:bg-[#2e3347]"
                      >
                        Sil
                      </button>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {editingId != null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form
            onSubmit={handleEditSave}
            className="w-full max-w-md rounded-lg border border-[#2e3347] bg-[#1a1d27] p-4"
          >
            <h2 className="mb-3 text-sm font-medium text-[#f1f5f9]">Ürün düzenle</h2>
            <label className="mb-1 block text-xs text-[#94a3b8]">Ad</label>
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              required
              className="mb-3 w-full rounded border border-[#2e3347] bg-[#0f1117] px-2 py-1.5 text-sm text-[#f1f5f9] focus:border-[#6366f1] focus:outline-none"
            />
            <label className="mb-1 block text-xs text-[#94a3b8]">Açıklama</label>
            <input
              type="text"
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              className="mb-3 w-full rounded border border-[#2e3347] bg-[#0f1117] px-2 py-1.5 text-sm text-[#f1f5f9] focus:border-[#6366f1] focus:outline-none"
            />
            {editError && <p className="mb-2 text-sm text-[#ef4444]">{editError}</p>}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingId(null)}
                className="rounded border border-[#2e3347] px-3 py-1.5 text-sm text-[#94a3b8] hover:bg-[#2e3347]"
              >
                İptal
              </button>
              <button
                type="submit"
                className="rounded bg-[#6366f1] px-3 py-1.5 text-sm text-white hover:bg-[#5558e3]"
              >
                Kaydet
              </button>
            </div>
          </form>
        </div>
      )}

      <ConfirmDialog
        open={confirmDelete.open}
        title="Ürünü sil"
        message={`"${confirmDelete.name}" ürününü silmek istediğinize emin misiniz?`}
        confirmText="Sil"
        onCancel={() => setConfirmDelete({ open: false, id: null, name: '' })}
        onConfirm={() => {
          handleDelete(confirmDelete.id)
          setConfirmDelete({ open: false, id: null, name: '' })
        }}
      />
    </div>
  )
}
