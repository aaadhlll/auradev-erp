import { apiFetch } from './api'
import { getAccessToken, getRefreshToken, clearTokens, ApiError } from './api'
import { getApiBaseUrl } from './api-base'

export interface StoreProfile {
  tenantId: string
  name: string
  phone: string | null
  gstin: string | null
  stateCode: string
  address: string | null
  billNoPrefix: string
  billFooter: string | null
  logoUrl: string | null
}

export interface UpdateStoreProfilePayload {
  name: string
  phone?: string
  gstin?: string
  stateCode?: string
  address?: string
  billNoPrefix: string
  billFooter?: string
}

export async function fetchStoreProfile(): Promise<StoreProfile> {
  return apiFetch<StoreProfile>('/api/v1/settings/profile')
}

export async function updateStoreProfile(payload: UpdateStoreProfilePayload): Promise<StoreProfile> {
  return apiFetch<StoreProfile>('/api/v1/settings/profile', {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
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

export async function uploadStoreLogo(file: File): Promise<StoreProfile> {
  const form = new FormData()
  form.append('file', file)
  const res = await authFetch('/api/v1/settings/logo', { method: 'POST', body: form })
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as Record<string, unknown>
    throw new ApiError(res.status, String(body?.detail ?? body?.message ?? res.statusText), body)
  }
  return res.json() as Promise<StoreProfile>
}

export function storeProfileToReceiptMeta(profile: StoreProfile | null | undefined) {
  if (!profile) return undefined
  return {
    storeName: profile.name,
    storePhone: profile.phone ?? undefined,
    logoUrl: resolveLogoUrl(profile.logoUrl),
    billFooter: profile.billFooter ?? undefined,
    gstin: profile.gstin ?? undefined,
    address: profile.address ?? undefined,
  }
}

export function resolveLogoUrl(logoUrl: string | null | undefined): string | undefined {
  if (!logoUrl) return undefined
  if (logoUrl.startsWith('http://') || logoUrl.startsWith('https://')) return logoUrl
  const base = getApiBaseUrl().replace(/\/$/, '')
  return logoUrl.startsWith('/') ? `${base}${logoUrl}` : `${base}/${logoUrl}`
}

export interface BillingSettings {
  maxLineDiscountPercent: number
  maxBillDiscountPercent: number
  cashierMaxBillDiscountPercent: number
  allowHoldBill: boolean
  allowCreditSales: boolean
  showCashierOnReceipt: boolean
  showGstBreakupOnReceipt: boolean
  showCustomerOnReceipt: boolean
  roundTotalToRupee: boolean
}

export async function fetchBillingSettings(): Promise<BillingSettings> {
  return apiFetch<BillingSettings>('/api/v1/settings/billing')
}

export async function updateBillingSettings(payload: Partial<BillingSettings>): Promise<BillingSettings> {
  return apiFetch<BillingSettings>('/api/v1/settings/billing', {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export type GstScheme = 'PRODUCT' | 'COMPOSITE' | 'CATEGORY'

export interface CategoryGstRate {
  categoryId: string
  categoryName: string
  ratePct: number
}

export interface TaxSettings {
  scheme: GstScheme
  priceIncludesTax: boolean
  enabledRates: number[]
  compositeRatePct: number
  defaultCategoryRatePct: number
  categoryRates: CategoryGstRate[]
}

export async function fetchTaxSettings(): Promise<TaxSettings> {
  return apiFetch<TaxSettings>('/api/v1/settings/tax')
}

export async function updateTaxSettings(payload: Omit<Partial<TaxSettings>, 'categoryRates'> & {
  categoryRates?: { categoryId: string; ratePct: number }[]
}): Promise<TaxSettings> {
  return apiFetch<TaxSettings>('/api/v1/settings/tax', {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export interface PrinterSettings {
  widthMm: number
  autoPrint: boolean
  copies: number
  showLogo: boolean
}

export async function fetchPrinterSettings(): Promise<PrinterSettings> {
  return apiFetch<PrinterSettings>('/api/v1/settings/printer')
}

export async function updatePrinterSettings(payload: Partial<PrinterSettings>): Promise<PrinterSettings> {
  return apiFetch<PrinterSettings>('/api/v1/settings/printer', {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}
