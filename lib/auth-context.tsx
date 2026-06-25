'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import {
  login as apiLogin,
  logout as apiLogout,
  getMe,
  getAccessToken,
  clearTokens,
  type AuthUser,
  type LoginResponse,
} from './api'
import { queryClient } from './query-client'

function normalizeUser(user: AuthUser): AuthUser {
  return { ...user, permissions: user.permissions ?? [] }
}

interface AuthState {
  user: AuthUser | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<LoginResponse>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // On mount, check if we have a valid token and restore session
  useEffect(() => {
    if (!getAccessToken()) {
      setIsLoading(false)
      return
    }
    getMe()
      .then(u => setUser(normalizeUser(u)))
      .catch(() => {
        clearTokens()
        setUser(null)
      })
      .finally(() => setIsLoading(false))
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const data = await apiLogin(email, password)
    setUser(normalizeUser(data.user))
    return data
  }, [])

  const logout = useCallback(async () => {
    await apiLogout()
    queryClient.clear()
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
