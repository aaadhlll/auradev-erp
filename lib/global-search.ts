import type { ViewId } from '@/components/erp/shell'
import type { AuthUser } from './api'
import { canAccessView } from './rbac'
import { fetchGlobalSearch } from './search-api'
import { fetchPurchases } from './purchases-api'

export type SearchResultKind = 'page' | 'product' | 'bill' | 'purchase' | 'category'

export interface SearchResult {
  id: string
  kind: SearchResultKind
  label: string
  sub: string
  icon: string
  view: ViewId
  query?: string
  billId?: string
}

const PAGES: SearchResult[] = [
  { id: 'page-dashboard', kind: 'page', label: 'Dashboard', sub: 'Operations · Overview', icon: 'layout-dashboard', view: 'dashboard' },
  { id: 'page-pos', kind: 'page', label: 'Billing / POS', sub: 'Operations · Counter', icon: 'scan-line', view: 'pos' },
  { id: 'page-bills', kind: 'page', label: 'Sales bills', sub: 'Operations · Bill history', icon: 'receipt', view: 'bills' },
  { id: 'page-inventory', kind: 'page', label: 'Inventory', sub: 'Operations · Stock', icon: 'boxes', view: 'inventory' },
  { id: 'page-purchases', kind: 'page', label: 'Purchases', sub: 'Procurement · Supplier bills', icon: 'truck', view: 'purchases' },
  { id: 'page-settings', kind: 'page', label: 'Settings', sub: 'Administration', icon: 'settings', view: 'settings' },
]

const API_HIT_MAP: Record<string, { kind: SearchResultKind; icon: string; view: ViewId }> = {
  PRODUCT: { kind: 'product', icon: 'package', view: 'inventory' },
  BILL: { kind: 'bill', icon: 'receipt', view: 'bills' },
  CATEGORY: { kind: 'category', icon: 'tag', view: 'inventory' },
}

export function searchPages(q: string): SearchResult[] {
  const lq = q.toLowerCase().trim()
  if (!lq) return PAGES
  return PAGES.filter(p =>
    p.label.toLowerCase().includes(lq) ||
    p.sub.toLowerCase().includes(lq),
  )
}

export async function searchPurchases(q: string): Promise<SearchResult[]> {
  const lq = q.toLowerCase().trim()
  if (!lq) return []
  try {
    const page = await fetchPurchases(lq, 'all', '', 0, 6)
    return page.items.map(p => ({
      id: `purchase-${p.id}`,
      kind: 'purchase' as const,
      label: p.purchaseNo,
      sub: p.supplierName,
      icon: 'truck',
      view: 'purchases' as ViewId,
      query: p.purchaseNo,
    }))
  } catch {
    return []
  }
}

export function filterSearchResults(user: AuthUser | null | undefined, results: SearchResult[]): SearchResult[] {
  if (!user) return []
  return results.filter(r => canAccessView(user, r.view))
}

export async function runGlobalSearch(q: string, user?: AuthUser | null): Promise<SearchResult[]> {
  const trimmed = q.trim()
  const pages = filterSearchResults(user, searchPages(trimmed))

  if (!trimmed) return pages

  const [apiHits, purchases] = await Promise.all([
    fetchGlobalSearch(trimmed, 12).catch(() => []),
    searchPurchases(trimmed),
  ])

  const apiResults: SearchResult[] = apiHits.flatMap(hit => {
    const mapped = API_HIT_MAP[hit.type]
    if (!mapped) return []
    return [{
      id: `${mapped.kind}-${hit.id}`,
      kind: mapped.kind,
      label: hit.label,
      sub: hit.subtitle,
      icon: mapped.icon,
      view: mapped.view,
      query: hit.query || hit.label,
      billId: hit.type === 'BILL' ? hit.id : undefined,
    }]
  })

  const pageHits = pages.slice(0, 3)
  return filterSearchResults(user, [...pageHits, ...apiResults, ...purchases])
}

export const SEARCH_GROUP_LABEL: Record<SearchResultKind, string> = {
  page: 'Pages',
  product: 'Products',
  bill: 'Sales bills',
  purchase: 'Purchase bills',
  category: 'Categories',
}

export const SEARCH_GROUP_ORDER: SearchResultKind[] = [
  'page', 'product', 'category', 'bill', 'purchase',
]
