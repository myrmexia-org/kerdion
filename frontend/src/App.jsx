import { createContext, useContext, useState, useCallback } from 'react'
import { BrowserRouter, Routes, Route, Navigate, Outlet, NavLink } from 'react-router-dom'

import Login from './pages/Login'
import Users from './pages/Users'
import UserSettings from './pages/UserSettings'
import Products from './pages/Products'
import ProductDetail from './pages/ProductDetail'
import CostCalculator from './pages/CostCalculator'
import CostsHistory from './pages/CostsHistory'
import { TOKEN_KEY } from './api'

const AuthContext = createContext(null)

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}

function AuthProvider({ children }) {
  const [token, setTokenState] = useState(() => localStorage.getItem(TOKEN_KEY))

  const setToken = useCallback((value) => {
    if (value == null) {
      localStorage.removeItem(TOKEN_KEY)
      setTokenState(null)
    } else {
      localStorage.setItem(TOKEN_KEY, value)
      setTokenState(value)
    }
  }, [])

  return (
    <AuthContext.Provider value={{ token, setToken }}>
      {children}
    </AuthContext.Provider>
  )
}

function ProtectedLayout() {
  const { setToken } = useAuth()
  const token = localStorage.getItem('token')
  if (!token) return <Navigate to="/login" replace />
  return (
    <div className="flex min-h-screen bg-[#0f1117] text-[#f1f5f9]">
      <aside className="fixed left-0 top-0 z-10 h-full w-64 border-r border-[#2e3347] bg-[#1a1d27]">
        <div className="flex h-full flex-col p-4">
          <div className="mb-6 border-b border-[#2e3347] pb-4">
            <img
              src="/kerdion_logo.svg"
              alt="Kerdion"
              className="block h-auto w-full"
            />
          </div>
          <nav className="flex flex-col gap-1">
            <NavLink
              to="/products"
              className={({ isActive }) =>
                `rounded-md px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? 'bg-[#6366f1] text-white'
                    : 'text-[#94a3b8] hover:bg-[#2e3347] hover:text-[#f1f5f9]'
                }`
              }
            >
              Ürünler
            </NavLink>
            <NavLink
              to="/cost-history"
              className={({ isActive }) =>
                `rounded-md px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? 'bg-[#6366f1] text-white'
                    : 'text-[#94a3b8] hover:bg-[#2e3347] hover:text-[#f1f5f9]'
                }`
              }
            >
              Maliyetler
            </NavLink>
            <NavLink
              to="/costs"
              className={({ isActive }) =>
                `rounded-md px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? 'bg-[#6366f1] text-white'
                    : 'text-[#94a3b8] hover:bg-[#2e3347] hover:text-[#f1f5f9]'
                }`
              }
            >
              Maliyet Hesaplama
            </NavLink>
            <NavLink
              to="/users"
              className={({ isActive }) =>
                `rounded-md px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? 'bg-[#6366f1] text-white'
                    : 'text-[#94a3b8] hover:bg-[#2e3347] hover:text-[#f1f5f9]'
                }`
              }
            >
              Kullanıcılar
            </NavLink>
            <div className="mt-auto border-t border-[#2e3347] pt-4">
              <NavLink
                to="/settings"
                className={({ isActive }) =>
                  `block rounded-md px-3 py-2 text-sm transition-colors ${
                    isActive
                      ? 'bg-[#6366f1] text-white'
                      : 'text-[#94a3b8] hover:bg-[#2e3347] hover:text-[#f1f5f9]'
                  }`
                }
              >
                Ayarlar
              </NavLink>
              <button
                type="button"
                onClick={() => {
                  setToken(null)
                  window.location.href = '/login'
                }}
                className="mt-2 w-full rounded-md border border-[#ef4444] px-3 py-2 text-left text-sm text-[#ef4444] transition-colors hover:bg-[#2e3347]"
              >
                Çıkış Yap
              </button>
            </div>
          </nav>
        </div>
      </aside>
      <main className="ml-64 flex min-h-screen flex-1 flex-col p-6">
        <div className="flex-1">
          <Outlet />
        </div>
        <footer className="mt-8 border-t border-[#2e3347] pt-4 text-center text-sm text-[#94a3b8]">
          Myrmexia Teknoloji tarafından geliştirilmiştir
        </footer>
      </main>
    </div>
  )
}

function PublicRoute({ children }) {
  const token = localStorage.getItem('token')
  if (token) return <Navigate to="/products" replace />
  return children
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route
            path="/login"
            element={
              <PublicRoute>
                <Login />
              </PublicRoute>
            }
          />
          <Route path="/" element={<ProtectedLayout />}>
            <Route index element={<Navigate to="/products" replace />} />
            <Route path="users" element={<Users />} />
            <Route path="settings" element={<UserSettings />} />
            <Route path="products" element={<Products />} />
            <Route path="products/:id" element={<ProductDetail />} />
            <Route path="costs" element={<CostCalculator />} />
            <Route path="cost-history" element={<CostsHistory />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
