import { apiFetch } from './api'

export type PurchaseStatus = 'DRAFT' | 'PENDING_GRN' | 'BILLED' | 'PAID'

export interface Supplier {
  id: string
  name: string
  contactPerson: string | null
  phone: string | null
  email: string | null
  gstin: string | null
  address: string | null
}

export interface PurchaseLine {
  productId: string
  name: string
  sku: string
  unitLabel: string
  quantity: number
  rate: number
  gstRate: number
  amount: number
  gstAmount: number
  lineTotal: number
}

export interface PurchaseSummary {
  id: string
  purchaseNo: string
  supplierName: string
  billDate: string
  dueDate: string | null
  itemCount: number
  grandTotal: number
  status: PurchaseStatus
  createdAt: string
}

export interface PurchaseDetail {
  id: string
  purchaseNo: string
  supplierId: string
  supplierName: string
  supplierGstin: string | null
  supplierPhone: string | null
  billDate: string
  dueDate: string | null
  status: PurchaseStatus
  subtotal: number
  gstTotal: number
  grandTotal: number
  notes: string | null
  createdAt: string
  updatedAt: string
  lines: PurchaseLine[]
}

export interface PagedPurchases {
  items: PurchaseSummary[]
  page: number
  size: number
  totalElements: number
  totalPages: number
}

export interface CreatePurchasePayload {
  supplierId: string
  billDate: string
  dueDate?: string
  notes?: string
  items: { productId: string; quantity: number; rate: number; gstRatePct?: number }[]
}

function mapSummary(p: Record<string, unknown>): PurchaseSummary {
  return {
    id: String(p.id),
    purchaseNo: String(p.purchaseNo),
    supplierName: String(p.supplierName),
    billDate: String(p.billDate),
    dueDate: p.dueDate != null ? String(p.dueDate) : null,
    itemCount: Number(p.itemCount ?? 0),
    grandTotal: Number(p.grandTotal ?? 0),
    status: String(p.status) as PurchaseStatus,
    createdAt: String(p.createdAt),
  }
}

function mapDetail(p: Record<string, unknown>): PurchaseDetail {
  const lines = (p.lines as Record<string, unknown>[] ?? []).map(l => ({
    productId: String(l.productId),
    name: String(l.name),
    sku: String(l.sku),
    unitLabel: String(l.unitLabel),
    quantity: Number(l.quantity),
    rate: Number(l.rate),
    gstRate: Number(l.gstRate),
    amount: Number(l.amount),
    gstAmount: Number(l.gstAmount),
    lineTotal: Number(l.lineTotal),
  }))
  return {
    id: String(p.id),
    purchaseNo: String(p.purchaseNo),
    supplierId: String(p.supplierId),
    supplierName: String(p.supplierName),
    supplierGstin: p.supplierGstin != null ? String(p.supplierGstin) : null,
    supplierPhone: p.supplierPhone != null ? String(p.supplierPhone) : null,
    billDate: String(p.billDate),
    dueDate: p.dueDate != null ? String(p.dueDate) : null,
    status: String(p.status) as PurchaseStatus,
    subtotal: Number(p.subtotal),
    gstTotal: Number(p.gstTotal),
    grandTotal: Number(p.grandTotal),
    notes: p.notes != null ? String(p.notes) : null,
    createdAt: String(p.createdAt),
    updatedAt: String(p.updatedAt),
    lines,
  }
}

export async function fetchSuppliers(): Promise<Supplier[]> {
  return apiFetch<Supplier[]>('/api/v1/suppliers')
}

export interface CreateSupplierPayload {
  name: string
  contactPerson?: string
  phone?: string
  email?: string
  gstin?: string
  address?: string
}

export async function createSupplier(payload: CreateSupplierPayload): Promise<Supplier> {
  return apiFetch<Supplier>('/api/v1/suppliers', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function updateSupplier(id: string, payload: CreateSupplierPayload): Promise<Supplier> {
  return apiFetch<Supplier>(`/api/v1/suppliers/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export async function fetchPurchases(
  q = '',
  status = 'all',
  supplierId = '',
  page = 0,
  size = 25,
): Promise<PagedPurchases> {
  const params = new URLSearchParams({ page: String(page), size: String(size) })
  if (q.trim()) params.set('q', q.trim())
  if (status && status !== 'all') params.set('status', status)
  if (supplierId) params.set('supplierId', supplierId)
  const raw = await apiFetch<Record<string, unknown>>(`/api/v1/purchases?${params}`)
  const items = (raw.content as Record<string, unknown>[] ?? []).map(mapSummary)
  return {
    items,
    page: Number(raw.page ?? 0),
    size: Number(raw.size ?? size),
    totalElements: Number(raw.totalElements ?? items.length),
    totalPages: Number(raw.totalPages ?? 1),
  }
}

export async function fetchPurchase(id: string): Promise<PurchaseDetail> {
  const data = await apiFetch<Record<string, unknown>>(`/api/v1/purchases/${id}`)
  return mapDetail(data)
}

export async function createPurchase(payload: CreatePurchasePayload): Promise<PurchaseDetail> {
  const data = await apiFetch<Record<string, unknown>>('/api/v1/purchases', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return mapDetail(data)
}

export async function confirmPurchase(id: string): Promise<PurchaseDetail> {
  const data = await apiFetch<Record<string, unknown>>(`/api/v1/purchases/${id}/confirm`, { method: 'POST' })
  return mapDetail(data)
}

export async function receivePurchase(id: string): Promise<PurchaseDetail> {
  const data = await apiFetch<Record<string, unknown>>(`/api/v1/purchases/${id}/receive`, { method: 'POST' })
  return mapDetail(data)
}

export async function payPurchase(id: string): Promise<PurchaseDetail> {
  const data = await apiFetch<Record<string, unknown>>(`/api/v1/purchases/${id}/pay`, { method: 'POST' })
  return mapDetail(data)
}

export async function deletePurchase(id: string): Promise<void> {
  await apiFetch<void>(`/api/v1/purchases/${id}`, { method: 'DELETE' })
}

export function statusLabel(status: PurchaseStatus): string {
  switch (status) {
    case 'DRAFT': return 'Draft'
    case 'PENDING_GRN': return 'Pending GRN'
    case 'BILLED': return 'Billed'
    case 'PAID': return 'Paid'
  }
}

export function statusTone(status: PurchaseStatus): string {
  switch (status) {
    case 'DRAFT': return 'neutral'
    case 'PENDING_GRN': return 'warning'
    case 'BILLED': return 'info'
    case 'PAID': return 'success'
  }
}

export function statusFilterKey(status: PurchaseStatus): string {
  switch (status) {
    case 'DRAFT': return 'draft'
    case 'PENDING_GRN': return 'pending'
    case 'BILLED': return 'billed'
    case 'PAID': return 'paid'
  }
}

export const STATUS_FILTERS: { value: string; label: string; api: string }[] = [
  { value: 'all', label: 'All', api: 'all' },
  { value: 'draft', label: 'Draft', api: 'DRAFT' },
  { value: 'pending', label: 'Pending GRN', api: 'PENDING_GRN' },
  { value: 'billed', label: 'Billed', api: 'BILLED' },
  { value: 'paid', label: 'Paid', api: 'PAID' },
]
