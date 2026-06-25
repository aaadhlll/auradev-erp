import { getAccessToken, getRefreshToken, clearTokens, ApiError } from './api'
import { getApiBaseUrl } from './api-base'

export interface ImportRowIssue {
  row: number
  sku: string
  reason: string
}

export interface InventoryImportResult {
  totalRows: number
  imported: number
  stockAdjusted: number
  skippedDuplicates: number
  skippedInvalid: number
  categoriesCreated: number
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

export async function downloadInventoryImportTemplate(): Promise<void> {
  await downloadImportFile('/api/v1/inventory/import/template', 'inventory-import-template.xlsx')
}

export async function downloadInventoryStockAdjustmentSample(): Promise<void> {
  await downloadImportFile('/api/v1/inventory/import/stock-sample', 'inventory-stock-adjustment-sample.xlsx')
}

async function downloadImportFile(path: string, filename: string): Promise<void> {
  const res = await authFetch(path)
  if (!res.ok) throw await parseError(res)

  const contentType = res.headers.get('content-type') ?? ''
  if (contentType.includes('json') || contentType.includes('problem')) {
    throw await parseError(res)
  }

  const blob = await res.blob()
  if (blob.size < 100) {
    throw new ApiError(500, 'Downloaded file is empty — restart the backend and try again')
  }

  triggerDownload(blob, filename)
}

export async function uploadInventoryImport(file: File): Promise<InventoryImportResult> {
  const form = new FormData()
  form.append('file', file)

  const res = await authFetch('/api/v1/inventory/import', {
    method: 'POST',
    body: form,
  })

  if (!res.ok) throw await parseError(res)
  return res.json() as Promise<InventoryImportResult>
}
