import { useState, useEffect } from 'react'
import { useAuth } from '../App'
import { api } from '../api'

function getApiErrorMessage(err, fallback) {
  const detail = err?.response?.data?.detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    return detail
      .map((item) => item?.msg || item?.message || 'Geçersiz istek')
      .join(' | ')
  }
  return fallback
}

export default function UserSettings() {
  const { token } = useAuth()
  const [me, setMe] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saveSuccess, setSaveSuccess] = useState('')

  const [mfaStep, setMfaStep] = useState(null)
  const [qrBase64, setQrBase64] = useState('')
  const [totpCode, setTotpCode] = useState('')
  const [mfaVerifyError, setMfaVerifyError] = useState('')
  const [mfaDisablePassword, setMfaDisablePassword] = useState('')
  const [mfaDisableError, setMfaDisableError] = useState('')
  const [mfaLoading, setMfaLoading] = useState(false)

  async function loadMe() {
    setLoading(true)
    setError('')
    try {
      const { data } = await api.get('/users/me')
      setMe(data)
      setName(data.name)
      setEmail(data.email)
    } catch (err) {
      setError(err.response?.data?.detail || 'Bilgiler alınamadı')
      setMe(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadMe()
  }, [token])

  async function handleSaveProfile(e) {
    e.preventDefault()
    setSaveError('')
    setSaveSuccess('')
    setSaving(true)
    try {
      const body = {}
      if (email.trim()) body.email = email.trim()
      if (password) body.password = password
      if (me.must_change_password && !password) {
        setSaveError('İlk girişte yeni şifre belirlemek zorunludur.')
        setSaving(false)
        return
      }
      if (Object.keys(body).length === 0) {
        setSaving(false)
        setSaveSuccess('Değişiklik yok.')
        return
      }
      const { data } = await api.patch('/users/me', body)
      setMe(data)
      setEmail(data.email)
      setPassword('')
      setSaveSuccess('Profil bilgileri başarıyla güncellendi.')
    } catch (err) {
      setSaveError(getApiErrorMessage(err, 'Güncellenemedi'))
    } finally {
      setSaving(false)
    }
  }

  async function handleMfaSetup() {
    setMfaVerifyError('')
    setMfaLoading(true)
    try {
      const { data } = await api.post('/users/me/mfa/setup')
      if (!data?.qr_image_base64) {
        setMfaVerifyError('MFA kurulum verisi alınamadı')
        return
      }
      setQrBase64(data.qr_image_base64 || '')
      setMfaStep('verify')
      setTotpCode('')
    } catch (err) {
      setMfaVerifyError(getApiErrorMessage(err, 'Kurulum başarısız'))
    } finally {
      setMfaLoading(false)
    }
  }

  async function handleMfaVerify(e) {
    e.preventDefault()
    setMfaVerifyError('')
    setMfaLoading(true)
    try {
      await api.post('/users/me/mfa/verify', { totp_code: totpCode.trim() })
      setMfaStep(null)
      setQrBase64('')
      setTotpCode('')
      loadMe()
    } catch (err) {
      setMfaVerifyError(getApiErrorMessage(err, 'Kod geçersiz'))
    } finally {
      setMfaLoading(false)
    }
  }

  async function handleMfaDisable(e) {
    e.preventDefault()
    setMfaDisableError('')
    setMfaLoading(true)
    try {
      await api.post('/users/me/mfa/disable', { password: mfaDisablePassword })
      setMfaDisablePassword('')
      setMfaStep(null)
      loadMe()
    } catch (err) {
      setMfaDisableError(getApiErrorMessage(err, 'MFA kapatılamadı'))
    } finally {
      setMfaLoading(false)
    }
  }

  if (loading) {
    return <p className="text-[#94a3b8]">Yükleniyor…</p>
  }
  if (error || !me) {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-[#f1f5f9]">Kullanıcı Ayarları</h1>
        <p className="mt-4 text-[#ef4444]">{error || 'Kullanıcı bilgisi alınamadı'}</p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold text-[#f1f5f9]">Kullanıcı Ayarları</h1>
      {me.must_change_password && (
        <p className="rounded border border-[#f59e0b] bg-[#2b2112] px-3 py-2 text-sm text-[#fcd34d]">
          İlk girişte şifre değişikliği zorunludur. Lütfen yeni şifre belirleyip kaydedin.
        </p>
      )}

      <section className="rounded-lg border border-[#2e3347] bg-[#1a1d27] p-6">
        <h2 className="mb-4 text-lg font-medium text-[#f1f5f9]">Profil</h2>
        <form onSubmit={handleSaveProfile} className="flex max-w-md flex-col gap-4">
          <div>
            <label htmlFor="settings-name" className="mb-1 block text-sm text-[#94a3b8]">Ad</label>
            <input
              id="settings-name"
              type="text"
              value={name}
              disabled
              className="w-full cursor-not-allowed rounded-md border border-[#2e3347] bg-[#0f1117] px-3 py-2 text-[#64748b]"
            />
            <p className="mt-1 text-xs text-[#94a3b8]">Kullanıcı adı değiştirilemez.</p>
          </div>
          <div>
            <label htmlFor="settings-email" className="mb-1 block text-sm text-[#94a3b8]">E-posta</label>
            <input
              id="settings-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-[#2e3347] bg-[#0f1117] px-3 py-2 text-[#f1f5f9] focus:border-[#6366f1] focus:outline-none focus:ring-1 focus:ring-[#6366f1]"
            />
          </div>
          <div>
            <label htmlFor="settings-password" className="mb-1 block text-sm text-[#94a3b8]">Yeni şifre (boş bırakırsanız değişmez)</label>
            <input
              id="settings-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              className="w-full rounded-md border border-[#2e3347] bg-[#0f1117] px-3 py-2 text-[#f1f5f9] focus:border-[#6366f1] focus:outline-none focus:ring-1 focus:ring-[#6366f1]"
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="w-fit rounded-md bg-[#6366f1] px-4 py-2 text-sm font-medium text-white hover:bg-[#5558e3] disabled:opacity-50"
          >
            {saving ? 'Kaydediliyor…' : 'Kaydet'}
          </button>
        </form>
        {saveError && <p className="mt-2 text-sm text-[#ef4444]">{saveError}</p>}
        {saveSuccess && <p className="mt-2 text-sm text-[#22c55e]">{saveSuccess}</p>}
      </section>

      <section className="rounded-lg border border-[#2e3347] bg-[#1a1d27] p-6">
        <h2 className="mb-4 text-lg font-medium text-[#f1f5f9]">MFA aktif etme / deaktif etme</h2>
        <p className="mb-4 text-sm text-[#94a3b8]">İki adımlı doğrulama (TOTP) ile girişte ek güvenlik. Microsoft Authenticator veya Google Authenticator ile kullanılabilir.</p>
        {me.mfa_enabled ? (
          <div>
            <p className="mb-3 text-sm text-[#22c55e]">MFA açık.</p>
            {mfaStep !== 'disable' ? (
              <button
                type="button"
                onClick={() => setMfaStep('disable')}
                className="rounded-md border border-[#ef4444] px-3 py-1.5 text-sm text-[#ef4444] hover:bg-[#2e3347]"
              >
                MFA kapat
              </button>
            ) : (
              <form onSubmit={handleMfaDisable} className="mt-2 flex flex-col gap-2">
                <input
                  type="password"
                  placeholder="Mevcut şifreniz"
                  value={mfaDisablePassword}
                  onChange={(e) => setMfaDisablePassword(e.target.value)}
                  required
                  className="max-w-xs rounded border border-[#2e3347] bg-[#0f1117] px-3 py-2 text-sm text-[#f1f5f9] focus:border-[#6366f1] focus:outline-none"
                />
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={mfaLoading}
                    className="rounded-md bg-[#ef4444] px-3 py-1.5 text-sm text-white hover:bg-red-600 disabled:opacity-50"
                  >
                    Kapat
                  </button>
                  <button
                    type="button"
                    onClick={() => { setMfaStep(null); setMfaDisableError('') }}
                    className="rounded-md border border-[#2e3347] px-3 py-1.5 text-sm text-[#94a3b8] hover:bg-[#2e3347]"
                  >
                    İptal
                  </button>
                </div>
                {mfaDisableError && <p className="text-sm text-[#ef4444]">{mfaDisableError}</p>}
              </form>
            )}
          </div>
        ) : (
          <div>
            {mfaStep !== 'verify' ? (
              <>
                <button
                  type="button"
                  onClick={handleMfaSetup}
                  disabled={mfaLoading}
                  className="rounded-md bg-[#6366f1] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#5558e3] disabled:opacity-50"
                >
                  {mfaLoading ? 'Hazırlanıyor…' : 'MFA aç'}
                </button>
                {mfaVerifyError && <p className="mt-2 text-sm text-[#ef4444]">{mfaVerifyError}</p>}
              </>
            ) : (
              <form onSubmit={handleMfaVerify} className="space-y-3">
                <p className="text-sm text-[#94a3b8]">Authenticator uygulamasıyla QR kodu tarayın, ardından 6 haneli kodu girin.</p>
                {qrBase64 && (
                  <img
                    src={`data:image/png;base64,${qrBase64}`}
                    alt="MFA QR"
                    className="inline-block h-40 w-40 rounded border border-[#2e3347] bg-white object-contain"
                  />
                )}
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  className="mt-2 w-28 rounded border border-[#2e3347] bg-[#0f1117] px-3 py-2 font-mono text-[#f1f5f9] focus:border-[#6366f1] focus:outline-none"
                />
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={mfaLoading || totpCode.length !== 6}
                    className="rounded-md bg-[#6366f1] px-3 py-1.5 text-sm text-white hover:bg-[#5558e3] disabled:opacity-50"
                  >
                    Doğrula
                  </button>
                  <button
                    type="button"
                    onClick={() => { setMfaStep(null); setMfaVerifyError('') }}
                    className="rounded-md border border-[#2e3347] px-3 py-1.5 text-sm text-[#94a3b8] hover:bg-[#2e3347]"
                  >
                    İptal
                  </button>
                </div>
                {mfaVerifyError && <p className="text-sm text-[#ef4444]">{mfaVerifyError}</p>}
              </form>
            )}
          </div>
        )}
      </section>
    </div>
  )
}
