'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Badge, Button, Card, ContentLoader, Icon, KpiCard } from './ui'
import { money } from '@/lib/erp-data'
import { apiFetch } from '@/lib/api'

type SlowMovingItem = { productId: string; name: string; sku: string; stock: number; valueAtRisk: number; lastSaleAt: string | null; classification: string }
type NearExpiryBatch = { productId: string; name: string; sku: string; batchNumber: string; expiryDate: string; quantity: number; valueAtRisk: number; daysLeft: number }
type Health = { slowMoving: SlowMovingItem[]; nearExpiry: NearExpiryBatch[] }
type HealthFilter = 'all' | 'slow-moving' | 'near-expiry' | 'dead-stock' | 'expiring-soon'

export function InventoryHealth() {
  const [filter, setFilter] = useState<HealthFilter>('all')
  const [hasSearched, setHasSearched] = useState(false)
  const q = useQuery({
    queryKey: ['inventory-health'],
    queryFn: () => apiFetch<Health>('/api/v1/products/inventory-health'),
    enabled: hasSearched,
  })
  const data = q.data
  const slowMoving = data?.slowMoving ?? []
  const nearExpiry = data?.nearExpiry ?? []
  const slowRisk = slowMoving.reduce((sum, item) => sum + item.valueAtRisk, 0)
  const expiryRisk = nearExpiry.reduce((sum, batch) => sum + batch.valueAtRisk, 0)
  const deadStock = slowMoving.filter(item => item.classification === 'Dead stock')
  const expiringSoon = nearExpiry.filter(batch => batch.daysLeft <= 7)
  const selectedSlowMoving = filter === 'dead-stock' ? deadStock : slowMoving
  const selectedNearExpiry = filter === 'expiring-soon' ? expiringSoon : nearExpiry
  const showSlowMoving = filter === 'all' || filter === 'slow-moving' || filter === 'dead-stock'
  const showNearExpiry = filter === 'all' || filter === 'near-expiry' || filter === 'expiring-soon'

  function chooseFilter(next: HealthFilter) {
    setFilter(current => current === next ? 'all' : next)
  }

  return <div className="content-pad page-shell">
    <div className="page-header"><div className="page-header-main"><div className="section-title">Inventory health</div><div className="section-sub">Slow stock and batches likely to expire before they sell</div></div><Button size="sm" variant="primary" icon="search" onClick={() => { if (hasSearched) void q.refetch(); else setHasSearched(true) }} disabled={q.isFetching}>{q.isFetching ? 'Searching…' : 'Search health'}</Button></div>
    <div className="kpi-grid inventory-status-grid">
      <KpiCard label="Slow / dead items" value={hasSearched ? slowMoving.length : 0} icon="snail" tone="tile-warning" vs={hasSearched ? `${money(slowRisk)} at risk` : undefined} onClick={() => chooseFilter('slow-moving')} active={filter === 'slow-moving'} />
      <KpiCard label="Near expiry batches" value={hasSearched ? nearExpiry.length : 0} icon="calendar-clock" tone="tile-danger" vs={hasSearched ? `${money(expiryRisk)} at risk` : undefined} onClick={() => chooseFilter('near-expiry')} active={filter === 'near-expiry'} />
      <KpiCard label="Dead stock" value={hasSearched ? deadStock.length : 0} icon="circle-x" tone="tile-danger" onClick={() => chooseFilter('dead-stock')} active={filter === 'dead-stock'} />
      <KpiCard label="Expiring in 7 days" value={hasSearched ? expiringSoon.length : 0} icon="alert-triangle" tone="tile-warning" onClick={() => chooseFilter('expiring-soon')} active={filter === 'expiring-soon'} />
    </div>
    {!hasSearched ? <Card><div className="empty" style={{ minHeight: 280 }}><div className="ei"><Icon name="search" size={22} /></div><div style={{ fontWeight: 600, color: 'var(--fg)' }}>Search inventory health</div><div>Click Search health to calculate slow-moving, dead-stock, and near-expiry alerts.</div></div></Card> : q.isLoading ? <ContentLoader /> : <div className="two-col">
      {showSlowMoving && <Card title={filter === 'dead-stock' ? 'Dead stock' : 'Slow-moving & dead stock'} sub={filter === 'dead-stock' ? 'Items with stock but no recorded sale' : 'No sale in the last 30 days'}><div className="tbl-wrap"><table className="tbl"><thead><tr><th>Item</th><th>Last sale</th><th className="num">Stock</th><th className="num">Risk</th><th>Status</th></tr></thead><tbody>
        {selectedSlowMoving.map(item => <tr key={item.productId}><td><div className="td-strong">{item.name}</div><div className="td-sub mono">{item.sku}</div></td><td>{item.lastSaleAt ? new Date(item.lastSaleAt).toLocaleDateString() : 'Never sold'}</td><td className="num tnum">{item.stock}</td><td className="num tnum">{money(item.valueAtRisk)}</td><td><Badge tone="warning">{item.classification}</Badge></td></tr>)}
        {!selectedSlowMoving.length && <tr><td colSpan={5} className="empty-state">No matching items.</td></tr>}
      </tbody></table></div></Card>}
      {showNearExpiry && <Card title={filter === 'expiring-soon' ? 'Batches expiring in 7 days' : 'Near-expiry batches'} sub={filter === 'expiring-soon' ? 'Prioritise these for sale, discount, or supplier return' : 'Expiry within 30 days'}><div className="tbl-wrap"><table className="tbl"><thead><tr><th>Item / batch</th><th>Expiry</th><th className="num">Qty</th><th className="num">Risk</th></tr></thead><tbody>
        {selectedNearExpiry.map(batch => <tr key={`${batch.productId}-${batch.batchNumber}`}><td><div className="td-strong">{batch.name}</div><div className="td-sub mono">{batch.batchNumber} · {batch.daysLeft} days left</div></td><td>{batch.expiryDate}</td><td className="num tnum">{batch.quantity}</td><td className="num tnum">{money(batch.valueAtRisk)}</td></tr>)}
        {!selectedNearExpiry.length && <tr><td colSpan={4} className="empty-state">No matching batches.</td></tr>}
      </tbody></table></div></Card>}
    </div>}
  </div>
}
