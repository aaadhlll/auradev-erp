import type { Product } from '@/lib/erp-data'

const KEY = 'auradev.pos.recent'
const MAX = 12

type RecentEntry = { id: string; at: number; p: Product }

export function readPosRecents(): Product[] {
  if (typeof sessionStorage === 'undefined') return []
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return []
    const entries = JSON.parse(raw) as RecentEntry[]
    return entries
      .sort((a, b) => b.at - a.at)
      .slice(0, MAX)
      .map(e => e.p)
  } catch {
    return []
  }
}

export function pushPosRecent(product: Product) {
  if (typeof sessionStorage === 'undefined') return
  try {
    const raw = sessionStorage.getItem(KEY)
    const entries = (raw ? JSON.parse(raw) : []) as RecentEntry[]
    const now = Date.now()
    const next: RecentEntry[] = [
      { id: product.id, at: now, p: product },
      ...entries.filter(e => e.id !== product.id),
    ].slice(0, MAX)
    sessionStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // ignore quota / private mode
  }
}

export function mergeQuickPicks(recents: Product[], api: Product[], limit = 12): Product[] {
  const seen = new Set<string>()
  const out: Product[] = []
  // Recent products decide the order, but the API is the source of truth for
  // mutable values such as stock. A sessionStorage entry can be older than a
  // stock receipt, adjustment, or another POS sale.
  const latestById = new Map(api.map(product => [product.id, product]))
  for (const p of [...recents, ...api]) {
    if (seen.has(p.id)) continue
    seen.add(p.id)
    out.push(latestById.get(p.id) ?? p)
    if (out.length >= limit) break
  }
  return out
}
