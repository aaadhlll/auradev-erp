import { apiFetch } from './api'

// ── Filter types ──────────────────────────────────────────────────────────────

export type DashboardPreset = 'today' | 'yesterday' | 'week' | 'month' | 'custom'

export interface DashboardFilters {
  preset: DashboardPreset
  from?: string
  to?: string
  customerId?: string
  productId?: string
  productLabel?: string
}

export const DEFAULT_DASHBOARD_FILTERS: DashboardFilters = { preset: 'today' }

function filtersQuery(filters: DashboardFilters): string {
  const params = new URLSearchParams()
  params.set('preset', filters.preset)
  if (filters.preset === 'custom') {
    if (filters.from) params.set('from', filters.from)
    if (filters.to) params.set('to', filters.to)
  }
  if (filters.customerId) params.set('customerId', filters.customerId)
  if (filters.productId) params.set('productId', filters.productId)
  return params.toString()
}

export function dashboardFiltersKey(filters: DashboardFilters): string {
  return JSON.stringify({
    preset: filters.preset,
    from: filters.from ?? '',
    to: filters.to ?? '',
    customerId: filters.customerId ?? '',
    productId: filters.productId ?? '',
  })
}

export function hasDashboardLivePoll(filters: DashboardFilters): boolean {
  return filters.preset === 'today'
    && !filters.customerId
    && !filters.productId
}

// ── Backend DTOs ──────────────────────────────────────────────────────────────

interface DashboardMeta {
  preset: string
  periodLabel: string
  compareLabel: string
  customerName?: string
  productName?: string
  filtersActive: boolean
}

interface DashboardKpis {
  periodSales?: number
  compareSales?: number
  periodBills?: number
  compareBills?: number
  periodItems?: number
  compareItems?: number
  lowStockCount: number
  /** @deprecated legacy backend fields */
  todaySales?: number
  yesterdaySales?: number
  billsToday?: number
  billsYesterday?: number
  itemsSoldToday?: number
  itemsSoldYesterday?: number
}

function normalizeKpis(raw: DashboardKpis | undefined) {
  const k = raw ?? { lowStockCount: 0 }
  return {
    periodSales: Number(k.periodSales ?? k.todaySales ?? 0),
    compareSales: Number(k.compareSales ?? k.yesterdaySales ?? 0),
    periodBills: Number(k.periodBills ?? k.billsToday ?? 0),
    compareBills: Number(k.compareBills ?? k.billsYesterday ?? 0),
    periodItems: Number(k.periodItems ?? k.itemsSoldToday ?? 0),
    compareItems: Number(k.compareItems ?? k.itemsSoldYesterday ?? 0),
    lowStockCount: Number(k.lowStockCount ?? 0),
  }
}

interface SalesDayPoint {
  day: string
  current: number
  previous: number
}

interface TopProductPoint {
  name: string
  quantity: number
  revenue: number
}

interface RecentBillRow {
  id: string
  billNo: string
  customer: string
  cashier: string
  items: number
  total: number
  payment: string
  status: string
  createdAt: string
}

interface LowStockRow {
  id: string
  name: string
  sku: string
  category: string
  unitLabel: string
  stock: number
  reorder: number
  status: 'LOW' | 'OUT'
}

interface ActivityRow {
  who: string
  action: string
  detail: string
  icon: string
  tone: string
  createdAt: string
}

interface DashboardActionRow { type: string; title: string; detail: string; tone: string; target: string }
interface DashboardOperationsRow {
  cashSummary?: { cash: number; upi: number; card: number; total: number }
  creditSummary?: { customers: number; outstanding: number; topCustomers?: { id: string; name: string; phone?: string | null; outstanding: number }[] }
  actions?: DashboardActionRow[]
}

interface DashboardApiResponse {
  tenantName: string
  userName: string
  meta?: DashboardMeta
  kpis: DashboardKpis
  salesTrend: SalesDayPoint[]
  topProducts: TopProductPoint[]
  recentBills: RecentBillRow[]
  lowStock: LowStockRow[]
  activity: ActivityRow[]
  operations?: DashboardOperationsRow
  aiBrief: string
}

interface DashboardShellApiResponse {
  tenantName: string
  userName: string
  lowStockCount: number
  lowStock: LowStockRow[]
  activity: ActivityRow[]
  operations?: DashboardOperationsRow
}

interface DashboardMetricsApiResponse {
  meta: DashboardMeta
  kpis: DashboardKpis
  salesTrend: SalesDayPoint[]
  topProducts: TopProductPoint[]
  recentBills: RecentBillRow[]
  aiBrief: string
}

export interface DashboardShellData {
  tenantName: string
  userName: string
  lowStockCount: number
  lowStock: DashboardData['lowStock']
  activity: DashboardData['activity']
  operations: DashboardData['operations']
}

export interface DashboardMetricsData {
  meta: DashboardData['meta']
  kpis: DashboardData['kpis']
  salesTrend: DashboardData['salesTrend']
  topProducts: DashboardData['topProducts']
  recentBills: DashboardData['recentBills']
  aiBrief: string
}

// ── View models ───────────────────────────────────────────────────────────────

export interface DashboardData {
  tenantName: string
  userName: string
  meta: {
    preset: DashboardPreset
    periodLabel: string
    compareLabel: string
    customerName?: string
    productName?: string
    filtersActive: boolean
  }
  kpis: {
    periodSales: number
    periodBills: number
    periodItems: number
    lowStockCount: number
    salesTrend: { value: string; dir: 'up' | 'down'; vs: string }
    billsTrend: { value: string; dir: 'up' | 'down'; vs: string }
    itemsTrend: { value: string; dir: 'up' | 'down'; vs: string }
  }
  salesTrend: { d: string; cur: number; prev: number }[]
  topProducts: { name: string; qty: number; rev: number }[]
  recentBills: {
    id: string
    no: string
    cust: string
    cashier: string
    items: number
    total: number
    pay: string
    status: string
    time: string
  }[]
  lowStock: {
    id: string
    name: string
    stock: number
    unit: string
    reorder: number
    status: 'low' | 'out'
  }[]
  activity: {
    who: string
    act: string
    detail: string
    icon: string
    tone: string
    time: string
  }[]
  operations: {
    cash: { cash: number; upi: number; card: number; total: number }
    credit: { customers: number; outstanding: number; topCustomers: { id: string; name: string; phone?: string | null; outstanding: number }[] }
    actions: DashboardActionRow[]
  }
  aiBrief: string
}

function trend(current: number, previous: number, vs: string): { value: string; dir: 'up' | 'down'; vs: string } {
  if (previous === 0) {
    if (current > 0) return { value: 'New', dir: 'up', vs }
    return { value: '0%', dir: 'up', vs }
  }
  const pct = ((current - previous) / previous) * 100
  const dir: 'up' | 'down' = pct < 0 ? 'down' : 'up'
  const value = pct === 0
    ? '0%'
    : `${pct > 0 ? '+' : ''}${pct.toFixed(1)}%`
  return { value, dir, vs }
}

function trendCount(current: number, previous: number, vs: string): { value: string; dir: 'up' | 'down'; vs: string } {
  const delta = current - previous
  const dir: 'up' | 'down' = delta < 0 ? 'down' : 'up'
  return {
    value: delta === 0 ? '0' : `${delta > 0 ? '+' : ''}${delta}`,
    dir,
    vs,
  }
}

function formatBillTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })
}

function formatActivityTime(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'Just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

function mapUnitLabel(label: string): string {
  return label === 'kg' ? 'kg' : 'pcs'
}

function mapLowStock(rows: LowStockRow[] | undefined): DashboardData['lowStock'] {
  return (rows ?? []).map(p => ({
    id: p.id,
    name: p.name,
    stock: Number(p.stock ?? 0),
    unit: mapUnitLabel(p.unitLabel ?? 'pcs'),
    reorder: Number(p.reorder ?? 0),
    status: p.status === 'OUT' ? 'out' as const : 'low' as const,
  }))
}

function mapActivityRows(rows: ActivityRow[] | undefined): DashboardData['activity'] {
  return (rows ?? []).map(a => ({
    who: a.who ?? 'System',
    act: a.action ?? 'updated',
    detail: a.detail ?? '',
    icon: a.icon ?? 'package',
    tone: a.tone ?? 'neutral',
    time: a.createdAt ? formatActivityTime(a.createdAt) : '—',
  }))
}

function mapOperations(raw: DashboardOperationsRow | undefined): DashboardData['operations'] {
  return {
    cash: { cash: Number(raw?.cashSummary?.cash ?? 0), upi: Number(raw?.cashSummary?.upi ?? 0), card: Number(raw?.cashSummary?.card ?? 0), total: Number(raw?.cashSummary?.total ?? 0) },
    credit: { customers: Number(raw?.creditSummary?.customers ?? 0), outstanding: Number(raw?.creditSummary?.outstanding ?? 0), topCustomers: (raw?.creditSummary?.topCustomers ?? []).map(customer => ({ id: customer.id, name: customer.name, phone: customer.phone, outstanding: Number(customer.outstanding ?? 0) })) },
    actions: raw?.actions ?? [],
  }
}

function mapRecentBills(rows: RecentBillRow[] | undefined): DashboardData['recentBills'] {
  return (rows ?? []).map(b => ({
    id: b.id,
    no: b.billNo,
    cust: b.customer,
    cashier: b.cashier,
    items: Number(b.items ?? 0),
    total: Number(b.total ?? 0),
    pay: b.payment ?? 'Cash',
    status: (b.status ?? 'paid').toLowerCase(),
    time: b.createdAt ? formatBillTime(b.createdAt) : '—',
  }))
}

function mapMetrics(raw: DashboardMetricsApiResponse): DashboardMetricsData {
  const k = normalizeKpis(raw.kpis)
  const meta = raw.meta ?? {
    preset: 'today',
    periodLabel: 'Today',
    compareLabel: 'vs previous day',
    filtersActive: false,
  }
  const vs = meta.compareLabel ?? 'vs prior period'

  return {
    meta: {
      preset: (meta.preset ?? 'today') as DashboardPreset,
      periodLabel: meta.periodLabel ?? 'Today',
      compareLabel: vs,
      customerName: meta.customerName,
      productName: meta.productName,
      filtersActive: Boolean(meta.filtersActive),
    },
    kpis: {
      periodSales: k.periodSales,
      periodBills: k.periodBills,
      periodItems: k.periodItems,
      lowStockCount: k.lowStockCount,
      salesTrend: trend(k.periodSales, k.compareSales, vs),
      billsTrend: trendCount(k.periodBills, k.compareBills, vs),
      itemsTrend: trend(k.periodItems, k.compareItems, vs),
    },
    salesTrend: (raw.salesTrend ?? []).map(p => ({
      d: p.day,
      cur: Number(p.current ?? 0),
      prev: Number(p.previous ?? 0),
    })),
    topProducts: (raw.topProducts ?? []).map(p => ({
      name: p.name,
      qty: Number(p.quantity ?? 0),
      rev: Number(p.revenue ?? 0),
    })),
    recentBills: mapRecentBills(raw.recentBills),
    aiBrief: raw.aiBrief ?? 'Dashboard data loaded.',
  }
}

function mapShell(raw: DashboardShellApiResponse): DashboardShellData {
  return {
    tenantName: raw.tenantName ?? 'Your store',
    userName: raw.userName ?? 'there',
    lowStockCount: Number(raw.lowStockCount ?? 0),
    lowStock: mapLowStock(raw.lowStock),
    activity: mapActivityRows(raw.activity),
    operations: mapOperations(raw.operations),
  }
}

export function emptyDashboardMetrics(filters: DashboardFilters): DashboardMetricsData {
  const periodLabel = filters.preset === 'custom' && filters.from && filters.to
    ? `${filters.from} – ${filters.to}`
    : filters.preset === 'today' ? 'Today'
      : filters.preset === 'yesterday' ? 'Yesterday'
        : filters.preset === 'week' ? 'Last 7 days'
          : filters.preset === 'month' ? 'Last 30 days' : 'Custom range'
  const compareLabel = filters.preset === 'today' || filters.preset === 'yesterday'
    ? 'vs previous day'
    : filters.preset === 'week' ? 'vs prior 7 days'
      : filters.preset === 'month' ? 'vs prior 30 days' : 'vs prior period'

  return {
    meta: {
      preset: filters.preset,
      periodLabel,
      compareLabel,
      filtersActive: false,
    },
    kpis: {
      periodSales: 0,
      periodBills: 0,
      periodItems: 0,
      lowStockCount: 0,
      salesTrend: { value: '—', dir: 'up', vs: compareLabel },
      billsTrend: { value: '—', dir: 'up', vs: compareLabel },
      itemsTrend: { value: '—', dir: 'up', vs: compareLabel },
    },
    salesTrend: [],
    topProducts: [],
    recentBills: [],
    aiBrief: 'Loading sales metrics…',
  }
}

export function composeDashboard(shell: DashboardShellData, metrics: DashboardMetricsData): DashboardData {
  return {
    tenantName: shell.tenantName,
    userName: shell.userName,
    meta: metrics.meta,
    kpis: {
      ...metrics.kpis,
      lowStockCount: shell.lowStockCount,
    },
    salesTrend: metrics.salesTrend,
    topProducts: metrics.topProducts,
    recentBills: metrics.recentBills,
    lowStock: shell.lowStock,
    activity: shell.activity,
    operations: shell.operations,
    aiBrief: metrics.aiBrief,
  }
}

function mapDashboard(raw: DashboardApiResponse): DashboardData {
  const k = normalizeKpis(raw.kpis)
  const meta = raw.meta ?? {
    preset: 'today',
    periodLabel: "Today",
    compareLabel: 'vs previous day',
    filtersActive: false,
  }
  const vs = meta.compareLabel ?? 'vs prior period'

  return {
    tenantName: raw.tenantName ?? 'Your store',
    userName: raw.userName ?? 'there',
    meta: {
      preset: (meta.preset ?? 'week') as DashboardPreset,
      periodLabel: meta.periodLabel ?? 'Last 7 days',
      compareLabel: vs,
      customerName: meta.customerName,
      productName: meta.productName,
      filtersActive: Boolean(meta.filtersActive),
    },
    kpis: {
      periodSales: k.periodSales,
      periodBills: k.periodBills,
      periodItems: k.periodItems,
      lowStockCount: k.lowStockCount,
      salesTrend: trend(k.periodSales, k.compareSales, vs),
      billsTrend: trendCount(k.periodBills, k.compareBills, vs),
      itemsTrend: trend(k.periodItems, k.compareItems, vs),
    },
    salesTrend: (raw.salesTrend ?? []).map(p => ({
      d: p.day,
      cur: Number(p.current ?? 0),
      prev: Number(p.previous ?? 0),
    })),
    topProducts: (raw.topProducts ?? []).map(p => ({
      name: p.name,
      qty: Number(p.quantity ?? 0),
      rev: Number(p.revenue ?? 0),
    })),
    recentBills: mapRecentBills(raw.recentBills),
    lowStock: mapLowStock(raw.lowStock),
    activity: mapActivityRows(raw.activity),
    operations: mapOperations(raw.operations),
    aiBrief: raw.aiBrief ?? 'Dashboard data loaded.',
  }
}

/** @deprecated Use DashboardFilters instead */
export type DashboardRange = DashboardPreset

export async function fetchDashboardShell(): Promise<DashboardShellData> {
  const data = await apiFetch<DashboardShellApiResponse>('/api/v1/dashboard/shell')
  return mapShell(data)
}

export async function fetchDashboardMetrics(filters: DashboardFilters): Promise<DashboardMetricsData> {
  const data = await apiFetch<DashboardMetricsApiResponse>(`/api/v1/dashboard/metrics?${filtersQuery(filters)}`)
  return mapMetrics(data)
}

export async function fetchDashboard(filters: DashboardFilters = DEFAULT_DASHBOARD_FILTERS): Promise<DashboardData> {
  const data = await apiFetch<DashboardApiResponse>(`/api/v1/dashboard?${filtersQuery(filters)}`)
  return mapDashboard(data)
}

export async function fetchDashboardLive(filters: DashboardFilters = DEFAULT_DASHBOARD_FILTERS): Promise<DashboardApiResponse> {
  return apiFetch<DashboardApiResponse>(`/api/v1/dashboard/live?${filtersQuery(filters)}`)
}

export async function fetchDashboardTrend(filters: DashboardFilters): Promise<{ salesTrend: SalesDayPoint[] }> {
  return apiFetch<{ salesTrend: SalesDayPoint[] }>(`/api/v1/dashboard/trend?${filtersQuery(filters)}`)
}

export function mergeDashboardTrend(
  current: DashboardData,
  trend: { salesTrend: SalesDayPoint[] },
): DashboardData {
  return {
    ...current,
    salesTrend: (trend.salesTrend ?? []).map(p => ({
      d: p.day,
      cur: Number(p.current ?? 0),
      prev: Number(p.previous ?? 0),
    })),
  }
}

export function mergeMetricsLive(
  current: DashboardMetricsData,
  live: DashboardApiResponse | null | undefined,
): DashboardMetricsData {
  if (!live?.kpis) return current
  const k = normalizeKpis(live.kpis)
  const vs = live.meta?.compareLabel ?? current.meta.compareLabel

  return {
    ...current,
    meta: live.meta
      ? {
          ...current.meta,
          periodLabel: live.meta.periodLabel ?? current.meta.periodLabel,
          compareLabel: vs,
          filtersActive: Boolean(live.meta.filtersActive),
        }
      : current.meta,
    kpis: {
      ...current.kpis,
      periodSales: k.periodSales,
      periodBills: k.periodBills,
      periodItems: k.periodItems,
      salesTrend: trend(k.periodSales, k.compareSales, vs),
      billsTrend: trendCount(k.periodBills, k.compareBills, vs),
      itemsTrend: trend(k.periodItems, k.compareItems, vs),
    },
    recentBills: live.recentBills?.length ? mapRecentBills(live.recentBills) : current.recentBills,
    aiBrief: live.aiBrief ?? current.aiBrief,
  }
}

/** @deprecated Use mergeMetricsLive */
export function mergeDashboardLive(current: DashboardData, live: DashboardApiResponse | null | undefined): DashboardData {
  if (!live?.kpis) return current
  const metrics = mergeMetricsLive(
    {
      meta: current.meta,
      kpis: current.kpis,
      salesTrend: current.salesTrend,
      topProducts: current.topProducts,
      recentBills: current.recentBills,
      aiBrief: current.aiBrief,
    },
    live,
  )
  return composeDashboard(
    {
      tenantName: current.tenantName,
      userName: current.userName,
      lowStockCount: current.kpis.lowStockCount,
      lowStock: current.lowStock,
      activity: current.activity,
      operations: current.operations,
    },
    metrics,
  )
}

export function greetingFor(name: string): string {
  const hour = new Date().getHours()
  const salute = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const first = name.split(' ')[0] || name
  return `${salute}, ${first}`
}
