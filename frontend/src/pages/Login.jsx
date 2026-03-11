import { useState } from 'react'
import { useAuth } from '../App'
import api from '../api'

export default function Login() {
  const { setToken } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [totpCode, setTotpCode] = useState('')
  const [mfaRequired, setMfaRequired] = useState(false)
  const [infoMessage, setInfoMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const isMfaPromptError =
    typeof error === 'string' && error.toLowerCase().includes('mfa kodu girin')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setInfoMessage('')
    setLoading(true)
    try {
      const body = { username, password }
      if (mfaRequired && totpCode.trim()) body.totp_code = totpCode.trim()
      const response = await api.post('/auth/login', body)
      const token = response.data.access_token
      if (!token) {
        setError('Sunucu token döndürmedi.')
        setLoading(false)
        return
      }
      localStorage.setItem('token', token)
      setToken(token)
      if (response.data?.must_change_password) {
        window.location.href = '/settings'
        return
      }
      window.location.href = '/products'
      return
    } catch (err) {
      const status = err.response?.status
      const response = err.response?.data || {}
      const mfaHeader = err.response?.headers?.['x-mfa-required']
      if (status === 400 && (mfaHeader === 'true' || (response.detail && response.detail.includes('MFA')))) {
        setMfaRequired(true)
        setInfoMessage('MFA kodu girin.')
        setLoading(false)
        return
      }
      setError(response.detail || (err.response ? 'Giriş başarısız.' : 'Bağlantı hatası.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0f1117] px-4">
      <div className="w-full max-w-sm rounded-lg border border-[#2e3347] bg-[#1a1d27] p-6 shadow-xl">
        <h1 className="mb-6 text-center text-xl font-semibold text-[#f1f5f9]">Giriş</h1>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label htmlFor="username" className="mb-1 block text-sm text-[#94a3b8]">
              Kullanıcı adı
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoComplete="username"
              className="w-full rounded-md border border-[#2e3347] bg-[#0f1117] px-3 py-2 text-[#f1f5f9] placeholder-[#94a3b8] focus:border-[#6366f1] focus:outline-none focus:ring-1 focus:ring-[#6366f1]"
              placeholder="Kullanıcı adı"
            />
          </div>
          <div>
            <label htmlFor="password" className="mb-1 block text-sm text-[#94a3b8]">
              Şifre
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete={mfaRequired ? 'one-time-code' : 'current-password'}
              className="w-full rounded-md border border-[#2e3347] bg-[#0f1117] px-3 py-2 text-[#f1f5f9] placeholder-[#94a3b8] focus:border-[#6366f1] focus:outline-none focus:ring-1 focus:ring-[#6366f1]"
            />
          </div>
          {mfaRequired && (
            <div>
              <label htmlFor="totp" className="mb-1 block text-sm text-[#94a3b8]">
                MFA kodu (6 hane)
              </label>
              <input
                id="totp"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                className="w-full rounded-md border border-[#2e3347] bg-[#0f1117] px-3 py-2 font-mono text-[#f1f5f9] placeholder-[#94a3b8] focus:border-[#6366f1] focus:outline-none focus:ring-1 focus:ring-[#6366f1]"
                placeholder="000000"
              />
            </div>
          )}
          {(infoMessage || isMfaPromptError) && (
            <p className="text-sm text-[#60a5fa]">
              {infoMessage || error}
            </p>
          )}
          {error && !isMfaPromptError && (
            <p className="text-sm text-[#ef4444]" role="alert">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="mt-2 rounded-md bg-[#6366f1] px-4 py-2 font-medium text-white transition-colors hover:bg-[#5558e3] disabled:opacity-50"
          >
            {loading ? 'Giriş yapılıyor…' : 'Giriş yap'}
          </button>
        </form>
      </div>
    </div>
  )
}
