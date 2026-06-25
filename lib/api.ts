import { getApiBaseUrl } from './api-base'

// ── Token storage ─────────────────────────────────────────────────────────────

export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('erp_access_token')
}

export function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('erp_refresh_token')
}

export function setTokens(access: string, refresh: string): void {
  localStorage.setItem('erp_access_token', access)
  localStorage.setItem('erp_refresh_token', refresh)
}

export function clearTokens(): void {
  localStorage.removeItem('erp_access_token')
  localStorage.removeItem('erp_refresh_token')
}

// ── Refresh ───────────────────────────────────────────────────────────────────

let refreshPromise: Promise<string> | null = null

async function doRefresh(): Promise<string> {
  const refreshToken = getRefreshToken()
  if (!refreshToken) throw new Error('No refresh token')

  const res = await fetch(`${getApiBaseUrl()}/api/v1/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  })

  if (!res.ok) {
    clearTokens()
    throw new Error('Session expired')
  }

  const data = await res.json()
  setTokens(data.accessToken, data.refreshToken)
  return data.accessToken
}

async function refreshAccessToken(): Promise<string> {
  if (!refreshPromise) {
    refreshPromise = doRefresh().finally(() => { refreshPromise = null })
  }
  return refreshPromise
}

// ── Core fetch wrapper ────────────────────────────────────────────────────────

export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getAccessToken()

  const makeRequest = async (accessToken: string | null) => {
    const headers = new Headers(options.headers)
    if (!headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json')
    }
    if (accessToken) {
      headers.set('Authorization', `Bearer ${accessToken}`)
    }

    return fetch(`${getApiBaseUrl()}${path}`, { ...options, headers })
  }

  let res = await makeRequest(token)

  // Access token expired — refresh and retry once
  if (res.status === 401 && getRefreshToken()) {
    try {
      const newToken = await refreshAccessToken()
      res = await makeRequest(newToken)
    } catch {
      clearTokens()
      window.location.href = '/login'
      throw new Error('Session expired')
    }
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as Record<string, unknown>
    const msg = (body?.detail ?? body?.message ?? body?.title ?? res.statusText) as string
    throw new ApiError(res.status, msg, body)
  }

  // 204 No Content
  if (res.status === 204) return undefined as T

  return res.json() as Promise<T>
}

// ── Auth helpers ──────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string
  name: string
  email: string
  role: string
  status: string
  lastLoginAt: string | null
  createdAt: string
  permissions: string[]
}

export interface LoginResponse {
  accessToken: string
  refreshToken: string
  tokenType: string
  expiresIn: number
  user: AuthUser
}

export async function login(email: string, password: string): Promise<LoginResponse> {
  const res = await fetch(`${getApiBaseUrl()}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new ApiError(res.status, body?.message ?? 'Invalid credentials', body)
  }

  const data: LoginResponse = await res.json()
  setTokens(data.accessToken, data.refreshToken)
  return data
}

export async function logout(): Promise<void> {
  const refreshToken = getRefreshToken()
  if (refreshToken) {
    await apiFetch('/api/v1/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    }).catch(() => {})
  }
  clearTokens()
}

export async function getMe(): Promise<AuthUser> {
  return apiFetch<AuthUser>('/api/v1/auth/me')
}

// ── Error class ───────────────────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly body?: unknown,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}
