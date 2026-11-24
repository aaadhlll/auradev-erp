'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Badge, Button, Card, ContentLoader, Icon, KpiCard, TextInput } from './ui'
import { fetchPurchaseReturns } from '@/lib/purchases-api'
import { money } from '@/lib/erp-data'

export function PurchaseReturnsPage() {
  const [hasSearched, setHasSearched] = useState(false)
  const [search, setSearch] = useState('')
  const query = useQuery({ queryKey: ['purchase-returns'], queryFn: fetchPurchaseReturns, enabled: hasSearched })
  const loadedRows = query.data ?? []
  const needle = search.trim().toLowerCase()
  const rows = hasSearched && needle
    ? loadedRows.filter(row => `${row.returnNo} ${row.purchaseNo} ${row.supplierName} ${row.reason} ${row.resolution}`.toLowerCase().includes(needle))
    : loadedRows
  const totalValue = rows.reduce((sum, row) => sum + row.returnTotal, 0)
  const credits = rows.filter(row => row.resolution === 'SUPPLIER_CREDIT').length
  const refunds = rows.filter(row => row.resolution !== 'SUPPLIER_CREDIT').length
  const items = rows.reduce((sum, row) => sum + row.items.length, 0)

  function runSearch() {
    if (hasSearched) void query.refetch()
    else setHasSearched(true)
  }

  return <div className="content-pad page-shell">
    <div className="page-header"><div className="page-header-main"><div className="section-title">Purchase returns</div><div className="section-sub">Every supplier return, reason, resolution and stock reversal</div></div></div>
    <div className="kpi-grid procurement-status-grid">
      <KpiCard label="Total returns" value={String(hasSearched ? rows.length : 0)} icon="rotate-ccw" tone="tile-primary" />
      <KpiCard label="Returned items" value={String(hasSearched ? items : 0)} icon="package" tone="tile-info" />
      <KpiCard label="Supplier credits" value={String(hasSearched ? credits : 0)} icon="badge-check" tone="tile-success" />
      <KpiCard label="Refunds" value={String(hasSearched ? refunds : 0)} icon="wallet" tone="tile-warning" vs={hasSearched ? money(totalValue) : undefined} />
    </div>
    <Card noBody className="procurement-ledger">
      <div className="filter-toolbar"><div className="toolbar-field"><TextInput size="sm" icon="search" value={search} onChange={setSearch} placeholder="Search return, purchase or supplier…" /></div><Button size="sm" variant="primary" icon="search" onClick={runSearch} disabled={query.isFetching}>{query.isFetching ? 'Searching…' : 'Search'}</Button></div>
      {!hasSearched ? <div className="empty" style={{ minHeight: 240 }}><div className="ei"><Icon name="search" size={22} /></div><div style={{ fontWeight: 600, color: 'var(--fg)' }}>Search purchase returns</div><div>Enter a purchase number, supplier, or return reference if needed, then click Search to load records.</div></div> : query.isLoading || query.isFetching ? <ContentLoader /> : query.error ? <div className="empty" style={{ minHeight: 240 }}><div style={{ color: 'var(--danger-fg)', fontWeight: 600 }}>{query.error.message}</div><Button size="sm" variant="outline" onClick={runSearch}>Retry</Button></div> : <div className="tbl-wrap"><table className="tbl"><thead><tr><th>Return no.</th><th>Purchase / supplier</th><th>Items</th><th>Resolution</th><th className="num">Value</th><th>Reason</th><th>Date</th></tr></thead><tbody>{rows.length === 0 ? <tr><td colSpan={7} style={{ textAlign: 'center', padding: '42px 0' }}>No purchase returns found.</td></tr> : rows.map(row => <tr key={row.id}><td className="mono td-strong">{row.returnNo}</td><td><div className="td-strong">{row.purchaseNo}</div><div className="td-sub">{row.supplierName}</div></td><td>{row.items.length}</td><td><Badge tone="info">{row.resolution.replaceAll('_', ' ').toLowerCase()}</Badge></td><td className="num td-strong tnum">{money(row.returnTotal)}</td><td className="muted">{row.reason}</td><td className="muted">{new Date(row.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td></tr>)}</tbody></table></div>}
    </Card>
  </div>
}
