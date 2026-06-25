import { apiFetch } from './api'

export interface ApiCustomer {
  id: string
  name: string
  phone: string | null
  type: 'walkin' | 'b2c' | 'b2b'
  loyaltyPoints: number
  creditBalance: number
}

export interface BillLine {
  productId: string
  name: string
  sku: string
  unitLabel: string
  quantity: number
  unitPrice: number
  lineDiscount: number
  gstRate: number
  lineTotal: number
}

export interface BillSummary {
  id: string
  billNo: string
  customerName: string
  cashierName: string
  itemCount: number
  grandTotal: number
  paymentStatus: string
  createdAt: string
}

export interface GstSlab {
  ratePct: number
  taxableValue: number
  taxAmount: number
}

export interface SavedBill {
  id: string
  billNo: string
  customerId: string
  customerName: string
  cashierName: string
  status: 'COMPLETED' | 'HELD' | 'VOID'
  discountMode: 'AMOUNT' | 'PERCENT'
  gstScheme: GstScheme
  subtotal: number
  billDiscount: number
  cgstTotal: number
  sgstTotal: number
  grandTotal: number
  paymentStatus: string
  paymentMethod: string
  tendered: number | null
  changeDue: number | null
  createdAt: string
  updatedAt: string
  gstSlabs: GstSlab[]
  lines: BillLine[]
}

export type GstScheme = 'PRODUCT' | 'COMPOSITE' | 'CATEGORY'

export interface HeldBillSummary {
  id: string
  billNo: string
  customerName: string
  itemCount: number
  grandTotal: number
  updatedAt: string
}

export interface BillCartPayload {
  customerId: string
  discountMode: 'AMOUNT' | 'PERCENT'
  billDiscount: number
  gstSchemeOverride?: GstScheme
  items: { productId: string; quantity: number; lineDiscount?: number }[]
}

export interface CreateBillPayload extends BillCartPayload {
  payment: {
    method: 'CASH' | 'UPI' | 'CARD' | 'CREDIT'
    tendered?: number
    splitCashAmount?: number
  }
}

function mapBill(b: Record<string, unknown>): SavedBill {
  const lines = (b.lines as Record<string, unknown>[]).map(l => ({
    productId: String(l.productId),
    name: String(l.name),
    sku: String(l.sku),
    unitLabel: String(l.unitLabel),
    quantity: Number(l.quantity),
    unitPrice: Number(l.unitPrice),
    lineDiscount: Number(l.lineDiscount ?? 0),
    gstRate: Number(l.gstRate),
    lineTotal: Number(l.lineTotal),
  }))
  const gstSlabs = ((b.gstSlabs as Record<string, unknown>[]) ?? []).map(s => ({
    ratePct: Number(s.ratePct),
    taxableValue: Number(s.taxableValue),
    taxAmount: Number(s.taxAmount),
  }))
  return {
    id: String(b.id),
    billNo: String(b.billNo),
    customerId: String(b.customerId),
    customerName: String(b.customerName),
    cashierName: String(b.cashierName),
    status: String(b.status ?? 'COMPLETED') as SavedBill['status'],
    discountMode: String(b.discountMode ?? 'AMOUNT') as SavedBill['discountMode'],
    gstScheme: String(b.gstScheme ?? 'PRODUCT') as GstScheme,
    subtotal: Number(b.subtotal),
    billDiscount: Number(b.billDiscount),
    cgstTotal: Number(b.cgstTotal),
    sgstTotal: Number(b.sgstTotal),
    grandTotal: Number(b.grandTotal),
    paymentStatus: String(b.paymentStatus),
    paymentMethod: String(b.paymentMethod ?? ''),
    tendered: b.tendered != null ? Number(b.tendered) : null,
    changeDue: b.changeDue != null ? Number(b.changeDue) : null,
    createdAt: String(b.createdAt),
    updatedAt: String(b.updatedAt ?? b.createdAt),
    gstSlabs,
    lines,
  }
}

function mapHeldSummary(b: Record<string, unknown>): HeldBillSummary {
  return {
    id: String(b.id),
    billNo: String(b.billNo),
    customerName: String(b.customerName),
    itemCount: Number(b.itemCount),
    grandTotal: Number(b.grandTotal),
    updatedAt: String(b.updatedAt),
  }
}

function mapBillSummary(b: Record<string, unknown>): BillSummary {
  return {
    id: String(b.id),
    billNo: String(b.billNo),
    customerName: String(b.customerName),
    cashierName: String(b.cashierName),
    itemCount: Number(b.itemCount),
    grandTotal: Number(b.grandTotal),
    paymentStatus: String(b.paymentStatus),
    createdAt: String(b.createdAt),
  }
}

export interface PagedBills {
  items: BillSummary[]
  page: number
  size: number
  totalElements: number
  totalPages: number
}

export async function fetchCustomers(): Promise<ApiCustomer[]> {
  return apiFetch<ApiCustomer[]>('/api/v1/customers')
}

export async function fetchBills(q = '', page = 0, size = 25): Promise<PagedBills> {
  const params = new URLSearchParams({ page: String(page), size: String(size) })
  if (q.trim()) params.set('q', q.trim())
  const raw = await apiFetch<Record<string, unknown>>(`/api/v1/bills?${params}`)
  const items = (raw.content as Record<string, unknown>[] ?? []).map(mapBillSummary)
  return {
    items,
    page: Number(raw.page ?? 0),
    size: Number(raw.size ?? size),
    totalElements: Number(raw.totalElements ?? items.length),
    totalPages: Number(raw.totalPages ?? 1),
  }
}

export async function fetchBill(id: string): Promise<SavedBill> {
  const data = await apiFetch<Record<string, unknown>>(`/api/v1/bills/${id}`)
  return mapBill(data)
}

export async function createBill(payload: CreateBillPayload): Promise<SavedBill> {
  const data = await apiFetch<Record<string, unknown>>('/api/v1/bills', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return mapBill(data)
}

export async function holdBill(payload: BillCartPayload): Promise<SavedBill> {
  const data = await apiFetch<Record<string, unknown>>('/api/v1/bills/hold', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return mapBill(data)
}

export async function fetchHeldBills(): Promise<HeldBillSummary[]> {
  const rows = await apiFetch<Record<string, unknown>[]>('/api/v1/bills/held')
  return rows.map(mapHeldSummary)
}

export async function fetchHeldBill(id: string): Promise<SavedBill> {
  const data = await apiFetch<Record<string, unknown>>(`/api/v1/bills/held/${id}`)
  return mapBill(data)
}

export async function completeHeldBill(id: string, payload: CreateBillPayload): Promise<SavedBill> {
  const data = await apiFetch<Record<string, unknown>>(`/api/v1/bills/held/${id}/complete`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return mapBill(data)
}

export async function discardHeldBill(id: string): Promise<void> {
  await apiFetch<void>(`/api/v1/bills/held/${id}`, { method: 'DELETE' })
}
