import { apiFetch } from './api'
import type { Product } from './erp-data'

// ── Backend DTOs (schema v2.0) ────────────────────────────────────────────────

interface ApiProduct {
  id: string
  name: string
  sku: string
  barcode: string | null
  categoryName: string | null
  categoryId: string | null
  unitLabel: string
  unitType: string
  priceMrp: number
  priceSelling: number
  costPrice: number | null
  taxRatePct: number
  quantityOnHand: number
  lowStockThreshold: number | null
  reorderQuantity: number | null
}

export interface ApiCategory {
  id: string
  name: string
  slug: string
}

interface Page<T> {
  content: T[]
  totalElements: number
  totalPages: number
  page: number
  size: number
}

export interface StockMovement {
  id: string
  movementType: string
  signedDelta: number
  quantity: number
  notes: string | null
  quantityAfter: number
  createdAt: string
}

// ── Mapper ────────────────────────────────────────────────────────────────────

function mapUnit(unitType: string, unitLabel: string): 'pcs' | 'kg' {
  if (unitType === 'weight_kg' || unitType === 'weight_g' || unitLabel === 'kg') return 'kg'
  return 'pcs'
}

function mapProduct(p: ApiProduct): Product {
  return {
    id: p.id,
    name: p.name,
    sku: p.sku,
    barcode: p.barcode ?? '—',
    cat: p.categoryName ?? 'Uncategorised',
    categoryId: p.categoryId,
    unit: mapUnit(p.unitType, p.unitLabel),
    mrp: Number(p.priceMrp),
    price: Number(p.priceSelling),
    cost: p.costPrice != null ? Number(p.costPrice) : 0,
    tax: Number(p.taxRatePct),
    stock: Number(p.quantityOnHand),
    reorder: Number(p.reorderQuantity ?? p.lowStockThreshold ?? 0),
  }
}

const REASON_TO_MOVEMENT: Record<string, string> = {
  grn: 'purchase',
  damage: 'waste',
  return: 'return',
  count: 'adjustment_in',
}

const MOVEMENT_LABEL: Record<string, string> = {
  sale: 'Sale',
  purchase: 'GRN received',
  return: 'Customer return',
  customer_return: 'Customer return',
  waste: 'Damage',
  adjustment_in: 'Stock count (add)',
  adjustment_out: 'Stock count (remove)',
}

export function movementLabel(type: string): string {
  return MOVEMENT_LABEL[type] ?? type
}

// ── Form type ─────────────────────────────────────────────────────────────────

export interface ProductFormData {
  name: string
  sku: string
  barcode: string
  categoryId: string
  unit: string
  mrp: string
  price: string
  cost: string
  tax: string
  reorder: string
  stock: string
}

function unitTypeForForm(unit: string): string {
  return unit === 'kg' ? 'weight_kg' : 'unit'
}

function unitLabelForForm(unit: string): string {
  return unit === 'kg' ? 'kg' : 'pcs'
}

function toCreateBody(f: ProductFormData) {
  return {
    name: f.name,
    sku: f.sku,
    barcode: f.barcode || null,
    categoryId: f.categoryId,
    unitType: unitTypeForForm(f.unit),
    unitLabel: unitLabelForForm(f.unit),
    priceMrp: +f.mrp,
    priceSelling: +f.price,
    costPrice: f.cost ? +f.cost : null,
    taxRatePct: +f.tax,
    initialStock: +f.stock || 0,
    lowStockThreshold: +f.reorder || 0,
    reorderQuantity: +f.reorder || 0,
  }
}

function toUpdateBody(f: ProductFormData) {
  return {
    name: f.name,
    sku: f.sku,
    barcode: f.barcode || null,
    categoryId: f.categoryId,
    unitType: unitTypeForForm(f.unit),
    unitLabel: unitLabelForForm(f.unit),
    priceMrp: +f.mrp,
    priceSelling: +f.price,
    costPrice: f.cost ? +f.cost : null,
    taxRatePct: +f.tax,
    lowStockThreshold: +f.reorder || 0,
    reorderQuantity: +f.reorder || 0,
  }
}

// ── Products CRUD ─────────────────────────────────────────────────────────────

export async function fetchProducts(): Promise<Product[]> {
  const data = await apiFetch<Page<ApiProduct>>('/api/v1/products?size=1000&sort=name,asc')
  return data.content.map(mapProduct)
}

export async function searchProducts(q: string, size = 8): Promise<Product[]> {
  const data = await apiFetch<Page<ApiProduct>>(
    `/api/v1/products?q=${encodeURIComponent(q)}&size=${size}&sort=name,asc`,
  )
  return data.content.map(mapProduct)
}

export async function fetchProduct(id: string): Promise<Product> {
  const p = await apiFetch<ApiProduct>(`/api/v1/products/${id}`)
  return mapProduct(p)
}

export async function fetchProductByBarcode(barcode: string): Promise<Product> {
  const p = await apiFetch<ApiProduct>(`/api/v1/products/barcode/${encodeURIComponent(barcode)}`)
  return mapProduct(p)
}

export async function fetchPosQuickPicks(limit = 12): Promise<Product[]> {
  const rows = await apiFetch<ApiProduct[]>(`/api/v1/products/pos/quick-picks?limit=${limit}`)
  return rows.map(mapProduct)
}

/** Resolve a scanner input via barcode API, then SKU/exact search fallback. */
export async function resolveProductScan(code: string): Promise<Product> {
  const trimmed = code.trim()
  if (!trimmed) throw new Error('Empty scan code')
  try {
    return await fetchProductByBarcode(trimmed)
  } catch {
    const hits = await searchProducts(trimmed, 8)
    const exact = hits.find(
      p => p.sku.toLowerCase() === trimmed.toLowerCase() || p.barcode === trimmed,
    )
    if (exact) return exact
    if (hits.length === 1) return hits[0]
    throw new Error(`No product for "${trimmed}"`)
  }
}

export async function createProduct(f: ProductFormData): Promise<Product> {
  const created = await apiFetch<ApiProduct>('/api/v1/products', {
    method: 'POST',
    body: JSON.stringify(toCreateBody(f)),
  })
  return mapProduct(created)
}

export async function updateProduct(id: string, f: ProductFormData): Promise<Product> {
  const updated = await apiFetch<ApiProduct>(`/api/v1/products/${id}`, {
    method: 'PUT',
    body: JSON.stringify(toUpdateBody(f)),
  })
  return mapProduct(updated)
}

export async function deleteProduct(id: string): Promise<void> {
  await apiFetch(`/api/v1/products/${id}`, { method: 'DELETE' })
}

// ── Stock adjust ──────────────────────────────────────────────────────────────

function resolveMovementType(delta: number, reason: string): string {
  if (delta > 0) {
    return REASON_TO_MOVEMENT[reason] ?? 'adjustment_in'
  }
  if (reason === 'damage') return 'waste'
  return 'adjustment_out'
}

export async function adjustStock(
  id: string,
  delta: number,
  reason: string,
  notes: string,
): Promise<Product> {
  await apiFetch(`/api/v1/products/${id}/stock-adjust`, {
    method: 'POST',
    body: JSON.stringify({
      movementType: resolveMovementType(delta, reason),
      quantity: Math.abs(delta),
      notes: notes || null,
    }),
  })
  return fetchProduct(id)
}

// ── Movements ─────────────────────────────────────────────────────────────────

interface ApiStockMovement {
  id: string
  movementType: string
  signedDelta: number | string
  quantity: number | string
  notes: string | null
  quantityAfter: number | string
  createdAt: string
}

function mapMovement(m: ApiStockMovement): StockMovement {
  return {
    id: m.id,
    movementType: m.movementType,
    signedDelta: Number(m.signedDelta),
    quantity: Number(m.quantity),
    notes: m.notes,
    quantityAfter: Number(m.quantityAfter),
    createdAt: m.createdAt,
  }
}

export async function fetchMovements(productId: string): Promise<StockMovement[]> {
  const data = await apiFetch<Page<ApiStockMovement>>(`/api/v1/products/${productId}/movements?size=50`)
  return data.content.map(mapMovement)
}

// ── Categories ────────────────────────────────────────────────────────────────

export async function fetchCategories(): Promise<ApiCategory[]> {
  return apiFetch<ApiCategory[]>('/api/v1/categories')
}

// ── Export ────────────────────────────────────────────────────────────────────

export interface ProductExportFilters {
  q?: string
  category?: string
  unit?: 'all' | 'pcs' | 'kg'
  status?: 'all' | 'in' | 'low' | 'out'
}

function mapUnitFilter(unit?: string): string | undefined {
  if (!unit || unit === 'all') return undefined
  if (unit === 'kg') return 'kg'
  if (unit === 'pcs') return 'unit'
  return unit
}

export async function downloadProductsExport(filters: ProductExportFilters = {}): Promise<void> {
  const { downloadAuthenticatedFile } = await import('./file-download')
  const params = new URLSearchParams()
  if (filters.q?.trim()) params.set('q', filters.q.trim())
  if (filters.category && filters.category !== 'all') params.set('category', filters.category)
  const unit = mapUnitFilter(filters.unit)
  if (unit) params.set('unit', unit)
  if (filters.status && filters.status !== 'all') params.set('status', filters.status)
  const qs = params.toString()
  await downloadAuthenticatedFile(
    `/api/v1/products/export/csv${qs ? `?${qs}` : ''}`,
    'inventory.csv',
  )
}
