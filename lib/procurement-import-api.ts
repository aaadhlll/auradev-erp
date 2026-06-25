import { getAccessToken, getRefreshToken, clearTokens, ApiError } from './api'
import { getApiBaseUrl } from './api-base'

export interface ImportRowIssue {
  row: number
  sku: string
  reason: string
}

export interface SupplierImportResult {
  totalRows: number
  imported: number
  skippedDuplicates: number
  skippedInvalid: number
  issues: ImportRowIssue[]
}

export interface PurchaseImportResult {
  totalRows: number
  purchasesCreated: number
  suppliersCreated: number
  skippedInvalid: number
  issues: ImportRowIssue[]
}

async function authFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = getAccessToken()
  const headers = new Headers(init.headers)
  if (token) headers.set('Authorization', `Bearer ${token}`)

  let res = await fetch(`${getApiBaseUrl()}${path}`, { ...init, headers })

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
      res = await fetch(`${getApiBaseUrl()}${path}`, { ...init, headers })
    } else {
      clearTokens()
      throw new ApiError(401, 'Session expired')
    }
  }

  return res
}

async function parseError(res: Response): Promise<ApiError> {
  const body = await res.json().catch(() => ({})) as Record<string, unknown>
  const msg = String(body?.detail ?? body?.message ?? body?.title ?? res.statusText)
  return new ApiError(res.status, msg, body)
}

function triggerDownload(blob: Blob, filename: string) {
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

async function downloadFile(path: string, filename: string): Promise<void> {
  const res = await authFetch(path)
  if (!res.ok) throw await parseError(res)
  const blob = await res.blob()
  if (blob.size < 100) {
    throw new ApiError(500, 'Downloaded file is empty — restart the backend and try again')
  }
  triggerDownload(blob, filename)
}

async function uploadFile<T>(path: string, file: File, extra?: Record<string, string>): Promise<T> {
  const form = new FormData()
  form.append('file', file)
  if (extra) {
    for (const [k, v] of Object.entries(extra)) form.append(k, v)
  }
  const res = await authFetch(path, { method: 'POST', body: form })
  if (!res.ok) throw await parseError(res)
  return res.json() as Promise<T>
}

export async function downloadSupplierImportTemplate(): Promise<void> {
  await downloadFile('/api/v1/suppliers/import/template', 'supplier-import-template.xlsx')
}

export async function uploadSupplierImport(file: File): Promise<SupplierImportResult> {
  return uploadFile('/api/v1/suppliers/import', file)
}

export async function downloadPurchaseImportTemplate(): Promise<void> {
  await downloadFile('/api/v1/purchases/import/template', 'purchase-import-template.xlsx')
}

export async function uploadPurchaseImport(file: File, supplierId: string): Promise<PurchaseImportResult> {
  return uploadFile('/api/v1/purchases/import', file, { supplierId })
}
