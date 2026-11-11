import { apiFetch } from './api'

export interface ApiCustomer {
  id: string
  name: string
  phone: string | null
  type: 'walkin' | 'b2c' | 'b2b'
  loyaltyPoints: number
  creditBalance: number
}

export interface CustomerCreditPayment {
  id: string
  paymentNo: string
  amount: number
  paymentMethod: 'CASH' | 'UPI' | 'CARD'
  notes: string | null
  receivedBy: string
  createdAt: string
  balanceAfter: number
}

export interface CustomerCreditLedgerEntry {
  id: string
  type: 'CREDIT_SALE' | 'SETTLEMENT'
  reference: string
  description: string
  debit: number
  credit: number
  balanceAfter: number
  paymentMethod: string
  notes: string | null
  processedBy: string
  createdAt: string
}

export interface CustomerCreditLedger {
  currentBalance: number
  entries: CustomerCreditLedgerEntry[]
}

export interface BillLine {
  billItemId: string
  productId: string
  name: string
  sku: string
  unitLabel: string
  quantity: number
  unitPrice: number
  lineDiscount: number
  gstRate: number
  lineTotal: number
  returnedQuantity: number
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
  customerId: string
  customerName: string
  itemCount: number
  grandTotal: number
  updatedAt: string
}

export interface BillCartPayload {
  customerId: string
  heldBillId?: string
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
    billItemId: String(l.billItemId),
    productId: String(l.productId),
    name: String(l.name),
    sku: String(l.sku),
    unitLabel: String(l.unitLabel),
    quantity: Number(l.quantity),
    unitPrice: Number(l.unitPrice),
    lineDiscount: Number(l.lineDiscount ?? 0),
    gstRate: Number(l.gstRate),
    lineTotal: Number(l.lineTotal),
    returnedQuantity: Number(l.returnedQuantity ?? 0),
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

export interface SalesReturnLine {
  billItemId: string
  productId: string
  name: string
  quantity: number
  refundAmount: number
}

export interface SalesReturn {
  id: string
  returnNo: string
  billId: string
  reason: string
  refundMethod: 'CASH' | 'UPI' | 'CARD' | 'CREDIT'
  refundTotal: number
  createdAt: string
  items: SalesReturnLine[]
}

export interface SalesReturnReportRow {
  id: string
  returnNo: string
  billId: string
  billNo: string
  customerName: string
  productName: string
  sku: string
  quantity: number
  refundAmount: number
  refundMethod: SalesReturn['refundMethod']
  reason: string
  processedBy: string
  createdAt: string
}

export interface PagedSalesReturns {
  items: SalesReturnReportRow[]
  page: number
  size: number
  totalElements: number
  totalPages: number
}

export async function fetchSalesReturns(billId: string): Promise<SalesReturn[]> {
  return apiFetch<SalesReturn[]>(`/api/v1/bills/${billId}/returns`)
}

export async function createSalesReturn(billId: string, payload: {
  reason: string
  refundMethod: SalesReturn['refundMethod']
  items: { billItemId: string; quantity: number }[]
}): Promise<SalesReturn> {
  return apiFetch<SalesReturn>(`/api/v1/bills/${billId}/returns`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function fetchSalesReturnsReport(q = '', page = 0, size = 25): Promise<PagedSalesReturns> {
  const params = new URLSearchParams({ page: String(page), size: String(size) })
  if (q.trim()) params.set('q', q.trim())
  const raw = await apiFetch<Record<string, unknown>>(`/api/v1/bills/returns/report?${params}`)
  const items = ((raw.content as Record<string, unknown>[]) ?? []).map(row => ({
    id: String(row.id), returnNo: String(row.returnNo), billId: String(row.billId), billNo: String(row.billNo),
    customerName: String(row.customerName ?? 'Walk-in'), productName: String(row.productName), sku: String(row.sku),
    quantity: Number(row.quantity), refundAmount: Number(row.refundAmount),
    refundMethod: String(row.refundMethod) as SalesReturn['refundMethod'], reason: String(row.reason),
    processedBy: String(row.processedBy ?? '—'), createdAt: String(row.createdAt),
  }))
  return { items, page: Number(raw.page ?? 0), size: Number(raw.size ?? size), totalElements: Number(raw.totalElements ?? items.length), totalPages: Number(raw.totalPages ?? 1) }
}

export async function downloadSalesReturnsReport(q = ''): Promise<void> {
  const { downloadAuthenticatedFile } = await import('./file-download')
  const params = new URLSearchParams()
  if (q.trim()) params.set('q', q.trim())
  await downloadAuthenticatedFile(`/api/v1/bills/returns/export/csv?${params}`, 'sales-returns.csv')
}

function mapHeldSummary(b: Record<string, unknown>): HeldBillSummary {
  return {
    id: String(b.id),
    billNo: String(b.billNo),
    customerId: String(b.customerId),
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

export interface CreateCustomerPayload {
  name: string
  phone?: string
  type?: 'b2c' | 'b2b'
  gstin?: string
}

export async function createCustomer(payload: CreateCustomerPayload): Promise<ApiCustomer> {
  return apiFetch<ApiCustomer>('/api/v1/customers', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function fetchCustomerCreditPayments(customerId: string): Promise<CustomerCreditPayment[]> {
  return apiFetch<CustomerCreditPayment[]>(`/api/v1/customers/${customerId}/credit-payments`)
}

export async function fetchCustomerCreditLedger(customerId: string): Promise<CustomerCreditLedger> {
  return apiFetch<CustomerCreditLedger>(`/api/v1/customers/${customerId}/credit-ledger`)
}

export async function settleCustomerCredit(customerId: string, payload: {
  amount: number
  paymentMethod: CustomerCreditPayment['paymentMethod']
  notes?: string
}): Promise<CustomerCreditPayment> {
  return apiFetch<CustomerCreditPayment>(`/api/v1/customers/${customerId}/credit-payments`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
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

export type BillExportMode = 'summary' | 'detailed'

export async function downloadBillsExport(q = '', mode: BillExportMode = 'summary'): Promise<void> {
  const { downloadAuthenticatedFile } = await import('./file-download')
  const params = new URLSearchParams({ mode })
  if (q.trim()) params.set('q', q.trim())
  const suffix = mode === 'detailed' ? 'line-items' : 'summary'
  await downloadAuthenticatedFile(`/api/v1/bills/export/csv?${params}`, `bills-${suffix}.csv`)
}
