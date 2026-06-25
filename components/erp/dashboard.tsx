'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Icon, Button, Badge, KpiCard, Card, IconTile, Select, TextInput,
} from './ui'
import { money } from '@/lib/erp-data'
import {
  greetingFor,
  DEFAULT_DASHBOARD_FILTERS,
  type DashboardData,
  type DashboardFilters,
  type DashboardPreset,
  dashboardFiltersKey,
} from '@/lib/dashboard-api'
import { useDashboardQuery } from '@/lib/queries/use-dashboard'
import { useDebouncedValue } from '@/lib/queries/use-debounced-value'
import { useCustomersQuery } from '@/lib/queries/use-customers'
import { usePosSearchQuery } from '@/lib/queries/use-pos-search'
import { useAuth } from '@/lib/auth-context'
import { canCreateBill, canEditInventory, canAccessView, canManagePurchases } from '@/lib/rbac'

function localIsoDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function defaultCustomRange(): Pick<DashboardFilters, 'from' | 'to'> {
  const to = new Date()
  const from = new Date()
  from.setDate(from.getDate() - 6)
  return { from: localIsoDate(from), to: localIsoDate(to) }
}

function todayIso(): string {
  return localIsoDate(new Date())
}

function clampCustomRange(
  filters: DashboardFilters,
  patch: Partial<Pick<DashboardFilters, 'from' | 'to'>>,
): DashboardFilters {
  const today = todayIso()
  let from = patch.from ?? filters.from ?? today
  let to = patch.to ?? filters.to ?? today
  if (from > today) from = today
  if (to > today) to = today
  if (from > to) {
    if (patch.from !== undefined) to = from
    else from = to
  }
  return { ...filters, from, to }
}

const PERIOD_LABELS: Record<DashboardPreset, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  week: 'Last 7 days',
  month: 'Last 30 days',
  custom: 'Custom range',
}

function compareLabelFor(filters: DashboardFilters, fromApi?: string): string {
  if (fromApi) return fromApi
  switch (filters.preset) {
    case 'today':
    case 'yesterday':
      return 'vs previous day'
    case 'week':
      return 'vs prior 7 days'
    case 'month':
      return 'vs prior 30 days'
    default:
      return 'vs prior period'
  }
}

function periodLabelFor(filters: DashboardFilters, fromApi?: string): string {
  if (fromApi) return fromApi
  if (filters.preset === 'custom' && filters.from && filters.to) {
    return `${filters.from} – ${filters.to}`
  }
  return PERIOD_LABELS[filters.preset]
}

const PERIOD_CHIPS: { value: DashboardPreset; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'week', label: '7 days' },
  { value: 'month', label: '30 days' },
  { value: 'custom', label: 'Custom' },
]

function DashboardFiltersBar({
  filters,
  onChange,
}: {
  filters: DashboardFilters
  onChange: (next: DashboardFilters) => void
}) {
  const customersQuery = useCustomersQuery()
  const [productQ, setProductQ] = useState('')
  const [productOpen, setProductOpen] = useState(false)
  const productWrap = useRef<HTMLDivElement>(null)
  const productSearch = usePosSearchQuery(productQ)

  useEffect(() => {
    if (!productOpen) return
    const onDoc = (e: MouseEvent) => {
      if (productWrap.current && !productWrap.current.contains(e.target as Node)) {
        setProductOpen(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [productOpen])

  const customers = customersQuery.data ?? []
  const customerOptions = [
    { value: '', label: 'All customers' },
    ...customers.map(c => ({ value: c.id, label: c.name, sub: c.phone ?? undefined })),
  ]

  const setPreset = (preset: DashboardPreset) => {
    if (preset === 'custom') {
      const range = filters.from && filters.to
        ? clampCustomRange(filters, { from: filters.from, to: filters.to })
        : defaultCustomRange()
      onChange({ ...filters, preset, from: range.from, to: range.to })
      return
    }
    onChange({ ...filters, preset, from: undefined, to: undefined })
  }

  const clearFilters = () => {
    setProductQ('')
    setProductOpen(false)
    onChange({ ...DEFAULT_DASHBOARD_FILTERS })
  }

  const hasExtraFilters = Boolean(
    filters.customerId || filters.productId || filters.preset !== 'today',
  )

  return (
    <Card noBody>
      <div className="filter-toolbar">
        <div className="chips">
          {PERIOD_CHIPS.map(p => (
            <button
              key={p.value}
              type="button"
              className={'chip' + (filters.preset === p.value ? ' on' : '')}
              onClick={() => setPreset(p.value)}
            >
              {p.label}
            </button>
          ))}
        </div>

        {filters.preset === 'custom' && (
          <>
            <div style={{ width: 148 }}>
              <TextInput
                size="sm"
                type="date"
                max={filters.to && filters.to < todayIso() ? filters.to : todayIso()}
                value={filters.from ?? ''}
                onChange={v => onChange(clampCustomRange(filters, { from: v }))}
              />
            </div>
            <span className="muted" style={{ fontSize: 12 }}>to</span>
            <div style={{ width: 148 }}>
              <TextInput
                size="sm"
                type="date"
                min={filters.from ?? undefined}
                max={todayIso()}
                value={filters.to ?? ''}
                onChange={v => onChange(clampCustomRange(filters, { to: v }))}
              />
            </div>
          </>
        )}

        <Select
          size="sm"
          width={200}
          value={filters.customerId ?? ''}
          onChange={v => onChange({ ...filters, customerId: v || undefined })}
          options={customerOptions}
          placeholder="All customers"
          icon="user"
        />

        <div className="filter-product-wrap" ref={productWrap}>
          {filters.productId ? (
            <button
              type="button"
              className="chip on"
              style={{ height: 32, display: 'inline-flex', alignItems: 'center', gap: 6 }}
              onClick={() => onChange({ ...filters, productId: undefined, productLabel: undefined })}
            >
              <Icon name="package" size={14} />
              {filters.productLabel ?? 'Product'}
              <Icon name="x" size={12} />
            </button>
          ) : (
            <>
              <TextInput
                size="sm"
                icon="search"
                placeholder="Filter by product…"
                value={productQ}
                onChange={v => {
                  setProductQ(v)
                  setProductOpen(true)
                }}
                onFocus={() => setProductOpen(true)}
              />
              {productOpen && productQ.trim().length >= 2 && (
                <div className="filter-product-menu">
                  {productSearch.isLoading && (
                    <div className="filter-product-menu-empty muted">Searching…</div>
                  )}
                  {!productSearch.isLoading && (productSearch.data?.length ?? 0) === 0 && (
                    <div className="filter-product-menu-empty muted">No products found</div>
                  )}
                  {(productSearch.data ?? []).map(p => (
                    <button
                      key={p.id}
                      type="button"
                      className="filter-product-menu-item"
                      onClick={() => {
                        onChange({ ...filters, productId: p.id, productLabel: p.name })
                        setProductQ('')
                        setProductOpen(false)
                      }}
                    >
                      <span style={{ fontWeight: 550 }}>{p.name}</span>
                      <span className="muted mono" style={{ fontSize: 11.5 }}>{p.sku}</span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <div style={{ flex: 1 }} />

        <Button
          size="sm"
          variant="outline"
          icon="x"
          onClick={clearFilters}
          disabled={!hasExtraFilters}
        >
          Clear
        </Button>
      </div>

      {(filters.customerId || filters.productId) && (
        <div className="filter-toolbar-foot">
          {filters.customerId && (
            <Badge tone="info" dot>
              Customer: {customers.find(c => c.id === filters.customerId)?.name ?? 'Selected'}
            </Badge>
          )}
          {filters.productId && (
            <Badge tone="primary" dot>
              Product: {filters.productLabel ?? 'Selected'}
            </Badge>
          )}
        </div>
      )}
    </Card>
  )
}

type TrendPoint = { d: string; cur: number; prev: number }

function formatYTick(v: number): string {
  if (v >= 100000) return `₹${(v / 100000).toFixed(v % 100000 === 0 ? 0 : 1)}L`
  if (v >= 1000) return `₹${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k`
  return `₹${Math.round(v)}`
}

function autoYMax(peak: number): number {
  const base = Math.max(peak, 1)
  const step = base <= 1000 ? 200 : base <= 10000 ? 2000 : 20000
  return Math.ceil(base * 1.08 / step) * step || step
}

function parseAxisAmount(raw: string): number | null {
  const s = raw.replace(/,/g, '').trim()
  if (!s) return null
  const n = Number(s)
  if (!Number.isFinite(n) || n < 0) return null
  return n
}

function ChartDualRange({
  min, max, start, end, onChange,
}: {
  min: number; max: number; start: number; end: number
  onChange: (start: number, end: number) => void
}) {
  const lo = Math.min(start, end)
  const hi = Math.max(start, end)
  const span = Math.max(max - min, 1)
  const leftPct = ((lo - min) / span) * 100
  const widthPct = ((hi - lo) / span) * 100

  return (
    <div className="chart-dual-range">
      <div className="chart-dual-range-track" aria-hidden>
        <div className="chart-dual-range-fill" style={{ left: `${leftPct}%`, width: `${widthPct}%` }} />
      </div>
      <input
        type="range"
        className="chart-dual-range-thumb"
        min={min}
        max={max}
        value={lo}
        onChange={e => onChange(Math.min(Number(e.target.value), hi), hi)}
        aria-label="X-axis range start"
      />
      <input
        type="range"
        className="chart-dual-range-thumb"
        min={min}
        max={max}
        value={hi}
        onChange={e => onChange(lo, Math.max(Number(e.target.value), lo))}
        aria-label="X-axis range end"
      />
    </div>
  )
}

function SalesTrendChart({ data }: { data: TrendPoint[] }) {
  const chartRef = useRef<SVGSVGElement>(null)
  const [axesOpen, setAxesOpen] = useState(false)
  const [yMinRaw, setYMinRaw] = useState('')
  const [yMaxRaw, setYMaxRaw] = useState('')
  const [xStart, setXStart] = useState(0)
  const [xEnd, setXEnd] = useState(Math.max(0, data.length - 1))
  const [showCompare, setShowCompare] = useState(true)

  useEffect(() => {
    setXStart(0)
    setXEnd(Math.max(0, data.length - 1))
    setYMinRaw('')
    setYMaxRaw('')
  }, [data])

  const visible = useMemo(() => {
    if (data.length === 0) return []
    const start = Math.min(xStart, xEnd)
    const end = Math.max(xStart, xEnd)
    return data.slice(start, end + 1)
  }, [data, xStart, xEnd])

  const dataPeak = useMemo(
    () => Math.max(...visible.flatMap(d => [d.cur, showCompare ? d.prev : 0]), 0),
    [visible, showCompare],
  )

  const autoYMin = 0
  const autoYMaxVal = autoYMax(dataPeak)

  const yMinVal = parseAxisAmount(yMinRaw) ?? autoYMin
  const yMaxVal = Math.max(parseAxisAmount(yMaxRaw) ?? autoYMaxVal, yMinVal + 1)
  const ySpan = Math.max(yMaxVal - yMinVal, 1)

  const xDateOptions = useMemo(
    () => data.map((d, i) => ({ value: String(i), label: d.d })),
    [data],
  )

  const setXRange = (start: number, end: number) => {
    setXStart(start)
    setXEnd(end)
  }

  const resetAxes = () => {
    setYMinRaw('')
    setYMaxRaw('')
    setXStart(0)
    setXEnd(Math.max(0, data.length - 1))
    setShowCompare(true)
  }

  const axesDirty = yMinRaw !== '' || yMaxRaw !== ''
    || xStart !== 0 || xEnd !== data.length - 1 || !showCompare

  const fitYAxis = () => {
    setYMinRaw('')
    setYMaxRaw('')
  }

  useEffect(() => {
    const el = chartRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const factor = e.deltaY > 0 ? 1.12 : 0.88
      const mid = (yMinVal + yMaxVal) / 2
      const half = (yMaxVal - yMinVal) / 2 * factor
      setYMinRaw(String(Math.max(0, Math.round(mid - half))))
      setYMaxRaw(String(Math.max(Math.round(mid + half), 1)))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [yMinVal, yMaxVal])

  if (data.length === 0) {
    return (
      <div className="empty" style={{ padding: '48px 20px' }}>
        <div className="ei"><Icon name="bar-chart-3" size={22} /></div>
        <div style={{ fontWeight: 600, color: 'var(--fg)' }}>No sales data for this filter</div>
        <div>Try a wider date range or clear customer/product filters.</div>
      </div>
    )
  }

  const W = 720, H = 250, padL = 52, padR = 14, padT = 14, padB = 32
  const plotW = W - padL - padR
  const slotW = plotW / Math.max(visible.length, 1)
  const barW = Math.min(slotW * 0.62, Math.max(6, slotW - 6))
  const xCenter = (i: number) => padL + slotW * i + slotW / 2
  const barLeft = (i: number) => xCenter(i) - barW / 2
  const baseY = H - padB
  const yAt = (v: number) => padT + (1 - (v - yMinVal) / ySpan) * (H - padT - padB)
  const line = (key: 'cur' | 'prev') =>
    visible.map((d, i) => `${i ? 'L' : 'M'}${xCenter(i).toFixed(1)},${yAt(d[key]).toFixed(1)}`).join(' ')
  const yTicks = [yMinVal, yMinVal + ySpan / 2, yMaxVal]
  const xLabelStep = visible.length <= 7 ? 1 : Math.ceil(visible.length / 6)

  const lo = Math.min(xStart, xEnd)
  const hi = Math.max(xStart, xEnd)

  return (
    <div className="sales-trend-chart">
      <div className="chart-toolbar">
        <div className="chart-legend">
          <span className="chart-legend-item">
            <span className="chart-legend-bar" />Daily sales
          </span>
          <span className="chart-legend-item">
            <span className="chart-legend-line solid" />Trend
          </span>
          {showCompare && (
            <span className="chart-legend-item">
              <span className="chart-legend-line dashed" />Previous
            </span>
          )}
        </div>
        <div className="chart-toolbar-actions">
          <button
            type="button"
            className={'chip' + (showCompare ? ' on' : '')}
            onClick={() => setShowCompare(v => !v)}
          >
            Compare
          </button>
          <Button
            size="sm"
            variant={axesOpen ? 'primary' : 'outline'}
            icon="sliders-horizontal"
            onClick={() => setAxesOpen(v => !v)}
          >
            Axes
          </Button>
          {axesDirty && (
            <Button size="sm" variant="ghost" icon="rotate-ccw" onClick={resetAxes}>Reset</Button>
          )}
        </div>
      </div>

      {axesOpen && (
        <div className="chart-axes-panel">
          <div className="chart-axes-row">
            <span className="chart-axes-title">Y-axis</span>
            <div className="chart-axes-field">
              <span className="chart-axes-label">Min</span>
              <div style={{ width: 108 }}>
                <TextInput
                  size="sm"
                  type="number"
                  min={0}
                  value={yMinRaw}
                  onChange={setYMinRaw}
                  placeholder={String(autoYMin)}
                />
              </div>
            </div>
            <div className="chart-axes-field">
              <span className="chart-axes-label">Max</span>
              <div style={{ width: 108 }}>
                <TextInput
                  size="sm"
                  type="number"
                  min={1}
                  value={yMaxRaw}
                  onChange={setYMaxRaw}
                  placeholder={String(autoYMaxVal)}
                />
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={fitYAxis}>Fit to data</Button>
            <span className="muted chart-axes-hint">
              Scroll on chart to zoom Y · {formatYTick(yMinVal)} – {formatYTick(yMaxVal)}
            </span>
          </div>

          {data.length > 1 && (
            <div className="chart-axes-row">
              <span className="chart-axes-title">X-axis</span>
              <Select
                size="sm"
                width={120}
                value={String(lo)}
                onChange={v => setXRange(Number(v), hi)}
                options={xDateOptions}
              />
              <span className="muted" style={{ fontSize: 12 }}>to</span>
              <Select
                size="sm"
                width={120}
                value={String(hi)}
                onChange={v => setXRange(lo, Number(v))}
                options={xDateOptions}
              />
              <ChartDualRange
                min={0}
                max={data.length - 1}
                start={lo}
                end={hi}
                onChange={setXRange}
              />
            </div>
          )}
        </div>
      )}

      <svg
        ref={chartRef}
        viewBox={`0 0 ${W} ${H}`}
        className="sales-trend-svg"
        style={{ width: '100%', height: 'auto', display: 'block', cursor: 'ns-resize' }}
      >
        {yTicks.map((t, i) => (
          <g key={i}>
            <line x1={padL} x2={W - padR} y1={yAt(t)} y2={yAt(t)} stroke="var(--border)" strokeWidth="1" />
            <text x={padL - 8} y={yAt(t) + 3.5} textAnchor="end" fontSize="10.5" fill="var(--fg-subtle)" fontFamily="var(--font-mono)">
              {formatYTick(t)}
            </text>
          </g>
        ))}
        {visible.map((d, i) => (
          <rect
            key={`bar-${i}`}
            x={barLeft(i)}
            y={yAt(d.cur)}
            width={barW}
            height={Math.max(baseY - yAt(d.cur), 0)}
            rx={3}
            fill="color-mix(in oklab, var(--primary) 78%, var(--surface-2))"
            stroke="color-mix(in oklab, var(--primary) 35%, transparent)"
            strokeWidth="1"
          >
            <title>{`${d.d}: ${money(d.cur)}${showCompare ? ` (prev ${money(d.prev)})` : ''}`}</title>
          </rect>
        ))}
        {showCompare && (
          <path
            d={line('prev')}
            fill="none"
            stroke="var(--fg-subtle)"
            strokeWidth="2"
            strokeDasharray="5 4"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.85"
          />
        )}
        <path
          d={line('cur')}
          fill="none"
          stroke="var(--primary)"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {visible.map((d, i) => (
          <g key={`dot-${i}`}>
            <circle cx={xCenter(i)} cy={yAt(d.cur)} r="3.4" fill="var(--card)" stroke="var(--primary)" strokeWidth="2" />
            {showCompare && (
              <circle cx={xCenter(i)} cy={yAt(d.prev)} r="2.8" fill="var(--card)" stroke="var(--fg-subtle)" strokeWidth="1.6" />
            )}
          </g>
        ))}
        {visible.map((d, i) => (i === 0 || i === visible.length - 1 || i % xLabelStep === 0) && (
          <text key={`l-${i}`} x={xCenter(i)} y={H - 9} textAnchor="middle" fontSize="11" fill="var(--fg-subtle)">{d.d}</text>
        ))}
      </svg>
    </div>
  )
}


function TopProductsChart({ data, emptyLabel }: { data: DashboardData['topProducts']; emptyLabel: string }) {
  if (data.length === 0) {
    return (
      <div className="empty" style={{ padding: '32px 12px' }}>
        <div className="ei"><Icon name="package" size={22} /></div>
        <div style={{ fontWeight: 600, color: 'var(--fg)' }}>{emptyLabel}</div>
        <div className="muted" style={{ fontSize: 13 }}>Top sellers appear after matching bills are completed.</div>
      </div>
    )
  }

  const max = Math.max(...data.map(d => d.rev), 1)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
      {data.map((d, i) => (
        <div key={i}>
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 5 }}>
            <span style={{ fontSize: 13, fontWeight: 550 }}>{d.name}</span>
            <span className="tnum mono" style={{ fontSize: 12, color: 'var(--fg-muted)' }}>
              {money(d.rev)} · {d.qty}u
            </span>
          </div>
          <div className="bar">
            <i style={{
              width: (d.rev / max * 100) + '%',
              background: i === 0 ? 'var(--primary)' : `color-mix(in oklab, var(--primary) ${78 - i * 13}%, var(--surface-3))`,
            }} />
          </div>
        </div>
      ))}
    </div>
  )
}

export function Dashboard({
  setView,
  onOpenBill,
  active = true,
}: {
  setView: (v: string) => void
  onOpenBill?: (id: string) => void
  active?: boolean
}) {
  const { user } = useAuth()
  const canBill = canCreateBill(user)
  const canStock = canEditInventory(user)
  const canBills = canAccessView(user, 'bills')
  const canPurchases = canManagePurchases(user)
  const [filters, setFilters] = useState<DashboardFilters>(DEFAULT_DASHBOARD_FILTERS)
  const debouncedFilters = useDebouncedValue(filters, 300)
  const filtersPending = dashboardFiltersKey(filters) !== dashboardFiltersKey(debouncedFilters)
  const {
    data,
    shellReady,
    metricsFetching,
    isLoading,
    error: queryError,
    refetch,
  } = useDashboardQuery(debouncedFilters, active)
  const error = queryError ?? null
  const loading = isLoading || metricsFetching || filtersPending

  const greeting = data ? greetingFor(data.userName) : (user ? greetingFor(user.name) : 'Welcome')
  const tenant = data?.tenantName ?? 'Your store'
  const periodLabel = periodLabelFor(filters, data?.meta.periodLabel)
  const compareLabel = compareLabelFor(filters, data?.meta.compareLabel)
  const customRangeReady = filters.preset !== 'custom' || Boolean(filters.from && filters.to)
  const waitingForCustom = filters.preset === 'custom' && !customRangeReady

  if (waitingForCustom || (!shellReady && loading)) {
    return (
      <div className="content-pad" style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 1480, margin: '0 auto' }}>
        <DashboardFiltersBar filters={filters} onChange={setFilters} />
        <div className="empty" style={{ padding: '80px 0' }}>
          {error ? (
            <>
              <div className="ei"><Icon name="alert-circle" size={22} /></div>
              <div style={{ fontWeight: 600, color: 'var(--danger-fg)', marginBottom: 8 }}>{error}</div>
              <div className="muted" style={{ fontSize: 13, maxWidth: 420, margin: '0 auto 12px' }}>
                Ensure the backend is running with the latest code on port 8080, then retry.
              </div>
              <Button size="sm" variant="outline" icon="refresh-cw" onClick={() => void refetch()}>Retry</Button>
            </>
          ) : waitingForCustom ? (
            <>
              <Icon name="calendar" size={24} />
              <div style={{ marginTop: 12, fontWeight: 600 }}>Select a custom date range</div>
              <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>Choose both start and end dates above.</div>
            </>
          ) : (
            <>
              <Icon name="loader-2" size={24} />
              <div style={{ marginTop: 12, fontWeight: 600 }}>Loading dashboard…</div>
            </>
          )}
        </div>
      </div>
    )
  }

  if (!shellReady && !data) {
    return (
      <div className="content-pad" style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 1480, margin: '0 auto' }}>
        <DashboardFiltersBar filters={filters} onChange={setFilters} />
        <div className="empty" style={{ padding: '80px 0' }}>
          <div className="ei"><Icon name="alert-circle" size={22} /></div>
          <div style={{ fontWeight: 600, color: 'var(--danger-fg)', marginBottom: 8 }}>{error ?? 'Could not load dashboard data'}</div>
          <Button size="sm" variant="outline" icon="refresh-cw" onClick={() => void refetch()}>Retry</Button>
        </div>
      </div>
    )
  }

  const d = data!
  const lowStock = d.lowStock ?? []
  const salesKpiLabel = filters.preset === 'today'
    ? "Today's sales"
    : filters.preset === 'yesterday'
      ? "Yesterday's sales"
      : filters.productId
        ? 'Product revenue'
        : `Sales · ${periodLabel}`
  const billsKpiLabel = filters.preset === 'today'
    ? 'Bills today'
    : filters.preset === 'yesterday'
      ? 'Bills yesterday'
      : filters.productId
        ? 'Bills with product'
        : `Bills · ${periodLabel}`
  const itemsKpiLabel = filters.preset === 'today'
    ? 'Items sold today'
    : filters.preset === 'yesterday'
      ? 'Items sold yesterday'
      : filters.productId
        ? 'Units sold'
        : `Items sold · ${periodLabel}`

  return (
    <div className="content-pad" style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 1480, margin: '0 auto' }}>
      <div className="row" style={{ justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div className="section-title">{greeting} 👋</div>
          <div className="section-sub">{tenant} · {periodLabel}</div>
        </div>
        <div className="row gap8">
          <Button size="sm" icon="refresh-cw" onClick={() => void refetch()} disabled={loading || !customRangeReady}>
            {loading ? 'Updating…' : 'Refresh'}
          </Button>
          {canStock && <Button size="sm" icon="package-plus" onClick={() => setView('inventory')}>Stock Adjustment</Button>}
          {canStock && <Button size="sm" icon="plus" onClick={() => setView('inventory')}>Add Product</Button>}
          {canBill && <Button size="sm" variant="primary" icon="scan-line" onClick={() => setView('pos')}>New Bill</Button>}
        </div>
      </div>

      <DashboardFiltersBar filters={filters} onChange={setFilters} />

      {filters.preset === 'custom' && !customRangeReady && (
        <div className="alert-banner">
          <Icon name="calendar" size={18} />
          <span>Pick both start and end dates for a custom range.</span>
        </div>
      )}

      {metricsFetching && (
        <div className="row gap8" style={{ fontSize: 12.5, color: 'var(--fg-muted)' }}>
          <Icon name="loader" size={14} />
          Updating {periodLabel.toLowerCase()}…
        </div>
      )}

      <div className={metricsFetching ? 'dash-metrics-dim' : undefined} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {error && (
        <div className="alert-banner" style={{ borderColor: 'color-mix(in oklab, var(--danger) 35%, transparent)' }}>
          <Icon name="alert-circle" size={18} />
          <span>{error}</span>
          <div style={{ flex: 1 }} />
          <Button size="sm" variant="outline" onClick={() => void refetch()}>Retry</Button>
        </div>
      )}

      <div className="ai-banner">
        <div className="ai-ic"><Icon name="sparkles" size={18} /></div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 650, fontSize: 13.5, color: 'var(--primary-soft-fg)' }}>Tyga · Daily brief</div>
          <div style={{ fontSize: 13, color: 'var(--fg-muted)', marginTop: 2 }}>{d.aiBrief}</div>
          {lowStock.length > 0 && (
            <div className="row gap8" style={{ marginTop: 9, flexWrap: 'wrap' }}>
              <span className="ai-chip"><Icon name="package" size={14} />{lowStock.length} items need reorder attention</span>
            </div>
          )}
        </div>
      </div>

      <div className="kpi-grid">
        <KpiCard
          label={salesKpiLabel}
          value={money(d.kpis.periodSales)}
          icon="indian-rupee"
          tone="tile-primary"
          trend={d.kpis.salesTrend.value}
          trendDir={d.kpis.salesTrend.dir}
          vs={d.kpis.salesTrend.vs}
        />
        <KpiCard
          label={billsKpiLabel}
          value={String(d.kpis.periodBills)}
          icon="receipt"
          tone="tile-info"
          trend={d.kpis.billsTrend.value}
          trendDir={d.kpis.billsTrend.dir}
          vs={d.kpis.salesTrend.vs}
        />
        <KpiCard
          label={itemsKpiLabel}
          value={String(d.kpis.periodItems)}
          icon="shopping-basket"
          tone="tile-success"
          trend={d.kpis.itemsTrend.value}
          trendDir={d.kpis.itemsTrend.dir}
          vs={d.kpis.salesTrend.vs}
        />
        <KpiCard
          label="Low Stock Alerts"
          value={String(d.kpis.lowStockCount)}
          icon="alert-triangle"
          tone="tile-warning"
          vs="store-wide"
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.55fr 1fr', gap: 16 }}>
        <Card
          title="Sales trend"
          sub={`${periodLabel} · ${compareLabel}`}
        >
          <SalesTrendChart data={d.salesTrend} />
        </Card>
        <Card title="Top products" sub={`By revenue · ${periodLabel}`}>
          <TopProductsChart data={d.topProducts} emptyLabel="No sales in this period" />
        </Card>
      </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.55fr 1fr', gap: 16, alignItems: 'start' }}>
        <div className={metricsFetching ? 'dash-metrics-dim' : undefined}>
        <Card
          title="Recent bills"
          sub={d.meta.filtersActive ? `Matching bills in ${periodLabel}` : 'Last 10 transactions in period'}
          action={canBills ? (
            <Button size="sm" variant="ghost" iconRight="arrow-right" onClick={() => setView('bills')}>
              View all
            </Button>
          ) : undefined}
          noBody
        >
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Bill No.</th><th>Customer</th><th>Cashier</th>
                  <th className="num">Items</th><th className="num">Total</th>
                  <th>Payment</th><th>Time</th>
                </tr>
              </thead>
              <tbody>
                {d.recentBills.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '32px 0', color: 'var(--fg-subtle)', fontSize: 13 }}>
                      No bills match these filters.
                    </td>
                  </tr>
                ) : d.recentBills.map(b => (
                  <tr
                    key={b.id}
                    className="tbl-row-click"
                    onClick={() => canBills && onOpenBill?.(b.id)}
                    style={{ cursor: canBills && onOpenBill ? 'pointer' : undefined }}
                  >
                    <td className="mono td-strong" style={{ fontSize: 12.5 }}>{b.no}</td>
                    <td>{b.cust}</td>
                    <td className="muted">{b.cashier}</td>
                    <td className="num tnum">{b.items}</td>
                    <td className="num td-strong tnum">{money(b.total)}</td>
                    <td><Badge tone={b.pay === 'Credit' ? 'warning' : 'neutral'}>{b.pay}</Badge></td>
                    <td className="muted tnum">{b.time}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Card title="Low stock" sub="Store-wide · below reorder level" action={<Badge tone="warning" dot>{lowStock.length}</Badge>}>
            {lowStock.length === 0 ? (
              <div className="muted" style={{ fontSize: 13, padding: '8px 4px' }}>All products are above reorder level.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {lowStock.map(p => (
                  <div key={p.id} className="row" style={{ justifyContent: 'space-between', gap: 10, padding: '8px 4px', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 550, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                      <div className="td-sub">
                        {p.status === 'out' ? 'Out of stock' : `${p.stock} ${p.unit} left`} · reorder {p.reorder}
                      </div>
                    </div>
                    {canPurchases && <Button size="sm" variant="outline" onClick={() => setView('purchases')}>Reorder</Button>}
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card title="Activity" sub="Latest store events (unfiltered)" noBody>
            <div style={{ padding: '6px 14px 12px' }}>
              {d.activity.length === 0 ? (
                <div className="muted" style={{ fontSize: 13, padding: '12px 0' }}>No stock movements recorded yet.</div>
              ) : d.activity.map((a, i) => (
                <div key={i} className="row gap10" style={{ padding: '9px 0', borderBottom: i < d.activity.length - 1 ? '1px solid var(--border)' : 0, alignItems: 'flex-start' }}>
                  <IconTile tone={`tile-${a.tone}`} size={28} icon={a.icon} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, lineHeight: 1.4 }}><b>{a.who}</b> <span className="muted">{a.act}</span></div>
                    <div className="td-sub" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.detail}</div>
                  </div>
                  <span className="td-sub" style={{ whiteSpace: 'nowrap' }}>{a.time}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
