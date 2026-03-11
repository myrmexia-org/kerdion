import { useState, useEffect } from 'react'
import { useAuth } from '../App'
import { api } from '../api'
import ConfirmDialog from '../components/ConfirmDialog'

function formatLastLogin(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('tr-TR')
}

export default function Users() {
  const { token } = useAuth()
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState({ open: false, id: null })
  const [editingUser, setEditingUser] = useState(null)
  const [editEmail, setEditEmail] = useState('')
  const [editPassword, setEditPassword] = useState('')
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    try {
      const { data } = await api.get('/users')
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
      await api.post('/users', { name, email, password })
      setName('')
      setEmail('')
      setPassword('')
      load()
    } catch (err) {
      setAddError(err.response?.data?.detail || 'Eklenemedi')
    } finally {
      setAdding(false)
    }
  }

  async function handleDelete(userId) {
    try {
      await api.delete(`/users/${userId}`)
      load()
    } catch (err) {
      setError(err.response?.data?.detail || 'Silinemedi')
    }
  }

  async function handleEditSave(e) {
    e.preventDefault()
    if (!editingUser) return
    setEditError('')
    setEditSaving(true)
    try {
      const body = {}
      if (editEmail.trim() && editEmail.trim() !== editingUser.email) body.email = editEmail.trim()
      if (editPassword) body.password = editPassword
      await api.patch(`/users/manage/${editingUser.id}`, body)
      setEditingUser(null)
      setEditEmail('')
      setEditPassword('')
      load()
    } catch (err) {
      setEditError(err.response?.data?.detail || 'Güncellenemedi')
    } finally {
      setEditSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-[#f1f5f9]">Kullanıcılar</h1>

      <section className="rounded-lg border border-[#2e3347] bg-[#1a1d27] p-4">
        <h2 className="mb-3 text-sm font-medium text-[#94a3b8]">Yeni kullanıcı</h2>
        <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="user-name" className="mb-1 block text-xs text-[#94a3b8]">Ad</label>
            <input
              id="user-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-40 rounded border border-[#2e3347] bg-[#0f1117] px-2 py-1.5 text-sm text-[#f1f5f9] focus:border-[#6366f1] focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="user-email" className="mb-1 block text-xs text-[#94a3b8]">E-posta</label>
            <input
              id="user-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-48 rounded border border-[#2e3347] bg-[#0f1117] px-2 py-1.5 text-sm text-[#f1f5f9] focus:border-[#6366f1] focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="user-password" className="mb-1 block text-xs text-[#94a3b8]">Şifre</label>
            <input
              id="user-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-36 rounded border border-[#2e3347] bg-[#0f1117] px-2 py-1.5 text-sm text-[#f1f5f9] focus:border-[#6366f1] focus:outline-none"
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
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[#2e3347] text-[#94a3b8]">
                <th className="p-3 font-medium">Ad</th>
                <th className="p-3 font-medium">E-posta</th>
                <th className="p-3 font-medium">Son giriş</th>
                <th className="p-3 font-medium">IP</th>
                <th className="p-3 font-medium">MFA</th>
                <th className="p-3 font-medium w-36"></th>
              </tr>
            </thead>
            <tbody>
              {list.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-4 text-center text-[#94a3b8]">
                    Kayıtlı kullanıcı yok
                  </td>
                </tr>
              ) : (
                list.map((u) => (
                  <tr key={u.id} className="border-b border-[#2e3347] last:border-0">
                    <td className="p-3 font-mono text-[#f1f5f9]">{u.name}</td>
                    <td className="p-3 text-[#f1f5f9]">{u.email}</td>
                    <td className="p-3 text-[#94a3b8]">{formatLastLogin(u.last_login_at)}</td>
                    <td className="p-3 font-mono text-[#94a3b8]">{u.last_login_ip || '—'}</td>
                    <td className="p-3 text-[#94a3b8]">{u.mfa_enabled ? 'Açık' : 'Kapalı'}</td>
                    <td className="p-3">
                      {(() => {
                        const isProtectedUser =
                          String(u.name || '').trim().toLowerCase() === 'myrmadmin'
                        return (
                          <>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingUser(u)
                          setEditEmail(u.email || '')
                          setEditPassword('')
                          setEditError('')
                        }}
                        className="mr-1 rounded px-2 py-1 text-xs text-[#94a3b8] hover:bg-[#2e3347]"
                      >
                        Düzenle
                      </button>
                      {isProtectedUser ? (
                        <span
                          className="rounded px-2 py-1 text-xs text-[#64748b]"
                          title="MyrmAdmin kullanıcısı silinemez"
                        >
                          Silinemez
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDelete({ open: true, id: u.id })}
                          className="rounded px-2 py-1 text-xs text-[#ef4444] hover:bg-[#2e3347]"
                        >
                          Sil
                        </button>
                      )}
                          </>
                        )
                      })()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
      <ConfirmDialog
        open={confirmDelete.open}
        title="Kullanıcıyı sil"
        message="Bu kullanıcıyı silmek istediğinize emin misiniz?"
        confirmText="Sil"
        onCancel={() => setConfirmDelete({ open: false, id: null })}
        onConfirm={() => {
          handleDelete(confirmDelete.id)
          setConfirmDelete({ open: false, id: null })
        }}
      />
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form
            onSubmit={handleEditSave}
            className="w-full max-w-md rounded-lg border border-[#2e3347] bg-[#1a1d27] p-4"
          >
            <h2 className="mb-3 text-sm font-medium text-[#f1f5f9]">Kullanıcı düzenle</h2>
            <label className="mb-1 block text-xs text-[#94a3b8]">Ad (değiştirilemez)</label>
            <input
              type="text"
              value={editingUser.name || ''}
              disabled
              className="mb-3 w-full cursor-not-allowed rounded border border-[#2e3347] bg-[#0f1117] px-2 py-1.5 text-sm text-[#64748b]"
            />
            <label className="mb-1 block text-xs text-[#94a3b8]">E-posta</label>
            <input
              type="email"
              value={editEmail}
              onChange={(e) => setEditEmail(e.target.value)}
              required
              className="mb-3 w-full rounded border border-[#2e3347] bg-[#0f1117] px-2 py-1.5 text-sm text-[#f1f5f9] focus:border-[#6366f1] focus:outline-none"
            />
            <label className="mb-1 block text-xs text-[#94a3b8]">Yeni şifre (opsiyonel)</label>
            <input
              type="password"
              value={editPassword}
              onChange={(e) => setEditPassword(e.target.value)}
              autoComplete="new-password"
              className="mb-3 w-full rounded border border-[#2e3347] bg-[#0f1117] px-2 py-1.5 text-sm text-[#f1f5f9] focus:border-[#6366f1] focus:outline-none"
            />
            {editError && <p className="mb-2 text-sm text-[#ef4444]">{editError}</p>}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="rounded border border-[#2e3347] px-3 py-1.5 text-sm text-[#94a3b8] hover:bg-[#2e3347]"
              >
                İptal
              </button>
              <button
                type="submit"
                disabled={editSaving}
                className="rounded bg-[#6366f1] px-3 py-1.5 text-sm text-white hover:bg-[#5558e3] disabled:opacity-50"
              >
                {editSaving ? 'Kaydediliyor…' : 'Kaydet'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
