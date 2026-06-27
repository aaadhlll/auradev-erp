import { getAccessToken, getRefreshToken, clearTokens, ApiError } from './api'
import { getApiBaseUrl } from './api-base'

export function triggerFileDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  window.setTimeout(() => {
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, 200)
}

async function authFetch(path: string): Promise<Response> {
  const token = getAccessToken()
  const headers = new Headers()
  if (token) headers.set('Authorization', `Bearer ${token}`)

  let res = await fetch(`${getApiBaseUrl()}${path}`, { headers, cache: 'no-store' })

  if (res.status === 401 && getRefreshToken()) {
    const refreshRes = await fetch(`${getApiBaseUrl()}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: getRefreshToken() }),
    })
    if (refreshRes.ok) {
      const data = await refreshRes.json()
      localStorage.setItem('erp_access_token', data.accessToken)
      localStorage.setItem('erp_refresh_token', data.refreshToken)
      headers.set('Authorization', `Bearer ${data.accessToken}`)
      res = await fetch(`${getApiBaseUrl()}${path}`, { headers, cache: 'no-store' })
    } else {
      clearTokens()
      throw new ApiError(401, 'Session expired')
    }
  }

  return res
}

export async function downloadAuthenticatedFile(path: string, filename: string): Promise<void> {
  const res = await authFetch(path)
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as Record<string, unknown>
    const code = body?.code ? String(body.code) + ': ' : ''
    const detail = String(body?.detail ?? body?.message ?? body?.title ?? res.statusText)
    throw new ApiError(res.status, code + detail, body)
  }

  const contentType = res.headers.get('content-type') ?? ''
  if (contentType.includes('json') || contentType.includes('problem')) {
    const body = await res.json().catch(() => ({})) as Record<string, unknown>
    throw new ApiError(res.status, String(body?.detail ?? body?.message ?? 'Export failed'), body)
  }

  const blob = await res.blob()
  if (blob.size < 2) {
    throw new ApiError(500, 'Downloaded file is empty')
  }

  triggerFileDownload(blob, filename)
}
