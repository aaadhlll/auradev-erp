'use client'

import { useEffect, useRef, useState } from 'react'
import { Button, Badge, Card, TextInput, ContentLoader, KpiCard, useToast, useClickOutside } from './ui'
import { money } from '@/lib/erp-data'
import type { BillSummary } from '@/lib/billing-api'
import { downloadBillsExport, downloadSalesReturnsReport, type BillExportMode } from '@/lib/billing-api'
import { useBillQuery, useBillsQuery, useSalesReturnsReportQuery } from '@/lib/queries/use-bills'
import { BillDetailDrawer } from './bill-detail'

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit',
  })
}

function payTone(status: string): string {
  return status === 'CREDIT' ? 'warning' : 'success'
}

function payLabel(status: string): string {
  return status === 'CREDIT' ? 'Credit' : 'Paid'
}

export function Bills({
  openBillId,
  onOpenBillConsumed,
  prefillQuery,
  prefillKey,
  onPrefillConsumed,
  customerFilter,
  onClearCustomerFilter,
}: {
  openBillId?: string | null
  onOpenBillConsumed?: () => void
  prefillQuery?: string
  prefillKey?: number
  onPrefillConsumed?: () => void
  customerFilter?: { id: string; name: string } | null
  onClearCustomerFilter?: () => void
} = {}) {
  const toast = useToast()
  const [q, setQ] = useState('')
  const [appliedBillQuery, setAppliedBillQuery] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [appliedDates, setAppliedDates] = useState({ from: '', to: '' })
  const [billsSearched, setBillsSearched] = useState(false)
  const [page, setPage] = useState(0)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [exportOpen, setExportOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [tab, setTab] = useState<'bills' | 'returns'>('bills')
  const [returnQ, setReturnQ] = useState('')
  const [appliedReturnQuery, setAppliedReturnQuery] = useState('')
  const [returnsSearched, setReturnsSearched] = useState(false)
  const [returnPage, setReturnPage] = useState(0)
  const exportRef = useRef<HTMLDivElement>(null)
  useClickOutside(exportRef, () => setExportOpen(false), exportOpen)

  useEffect(() => {
    if (!prefillQuery || prefillKey == null) return
    setQ(prefillQuery)
    setAppliedBillQuery(prefillQuery)
    setAppliedDates({ from: '', to: '' })
    setBillsSearched(true)
    setPage(0)
    onPrefillConsumed?.()
  }, [prefillKey, prefillQuery, onPrefillConsumed])

  useEffect(() => {
    setPage(0)
    setBillsSearched(false)
  }, [customerFilter?.id])

  useEffect(() => {
    if (!openBillId) return
    setSelectedId(openBillId)
    onOpenBillConsumed?.()
  }, [openBillId, onOpenBillConsumed])

  const billsQuery = useBillsQuery(appliedBillQuery, page, customerFilter?.id ?? '', billsSearched, appliedDates.from, appliedDates.to)
  const returnsQuery = useSalesReturnsReportQuery(appliedReturnQuery, returnPage, tab === 'returns' && returnsSearched)
  const billDetailQuery = useBillQuery(selectedId)
  const rows = billsQuery.data?.items ?? []
  const totalPages = billsQuery.data?.totalPages ?? 1
  const total = billsQuery.data?.totalElements ?? rows.length
  const initialLoading = billsQuery.isLoading && rows.length === 0
  const paidBills = rows.filter(row => row.paymentStatus !== 'CREDIT').length
  const creditBills = rows.filter(row => row.paymentStatus === 'CREDIT').length
  const visibleSales = rows.reduce((sum, row) => sum + row.grandTotal, 0)

  const openBill = (row: BillSummary) => setSelectedId(row.id)

  function searchBills() {
    setPage(0)
    setAppliedBillQuery(q)
    setAppliedDates({ from: dateFrom, to: dateTo })
    setBillsSearched(true)
  }

  function searchReturns() {
    setReturnPage(0)
    setAppliedReturnQuery(returnQ)
    setReturnsSearched(true)
  }

  async function doExport(mode: BillExportMode) {
    setExportOpen(false)
    setExporting(true)
    try {
      await downloadBillsExport(appliedBillQuery, mode)
      toast(mode === 'detailed' ? 'Line-item export downloaded' : 'Bill summary export downloaded', { icon: 'file-down' })
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Export failed', { tone: 'danger' })
    } finally {
      setExporting(false)
    }
  }

  async function exportReturns() {
    setExporting(true)
    try {
      await downloadSalesReturnsReport(appliedReturnQuery)
      toast('Sales returns report downloaded', { icon: 'file-down' })
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Export failed', { tone: 'danger' })
    } finally {
      setExporting(false)
    }
  }

  const returnRows = returnsQuery.data?.items ?? []
  const returnedUnits = returnRows.reduce((sum, row) => sum + row.quantity, 0)
  const refundedTotal = returnRows.reduce((sum, row) => sum + row.refundAmount, 0)

  return (
    <div className="content-pad page-shell">
      <div className="page-header">
        <div className="page-header-main">
          <h1 className="page-header-title">Sales bills</h1>
          <p className="muted page-header-sub">{customerFilter ? `Bills for ${customerFilter.name}` : 'Completed transactions, returns and receipts'}</p>
        </div>
        {tab === 'bills' ? <div className="page-header-actions row gap8">
          <TextInput
            size="sm"
            icon="search"
            placeholder="Search bill number…"
            value={q}
            onChange={v => { setQ(v); setPage(0) }}
          />
          <input className="input sm" type="date" value={dateFrom} onChange={event => setDateFrom(event.target.value)} aria-label="Bills from date" title="From date" />
          <input className="input sm" type="date" value={dateTo} min={dateFrom || undefined} onChange={event => setDateTo(event.target.value)} aria-label="Bills to date" title="To date" />
          <Button size="sm" variant="primary" icon="search" onClick={searchBills} disabled={billsQuery.isFetching}>{billsQuery.isFetching ? 'Searching…' : 'Search'}</Button>
          <div ref={exportRef} style={{ position: 'relative' }}>
            <Button
              size="sm"
              icon="download"
              iconRight="chevron-down"
              disabled={exporting || initialLoading || !billsSearched}
              onClick={() => setExportOpen(v => !v)}
            >
              {exporting ? 'Exporting…' : 'Export'}
            </Button>
            {exportOpen && (
              <div className="popover" style={{ position: 'absolute', top: 'calc(100% + 4px)', right: 0, minWidth: 220, zIndex: 20 }}>
                <button type="button" className="menu-item" onClick={() => void doExport('summary')}>
                  Summary CSV
                  <span className="muted" style={{ fontSize: 11, marginLeft: 6 }}>one row per bill</span>
                </button>
                <button type="button" className="menu-item" onClick={() => void doExport('detailed')}>
                  Line items CSV
                  <span className="muted" style={{ fontSize: 11, marginLeft: 6 }}>full product detail</span>
                </button>
              </div>
            )}
          </div>
        </div> : <div className="page-header-actions row gap8">
          <TextInput size="sm" icon="search" placeholder="Return, bill or product…" value={returnQ} onChange={v => { setReturnQ(v); setReturnPage(0) }} />
          <Button size="sm" variant="primary" icon="search" onClick={searchReturns} disabled={returnsQuery.isFetching}>{returnsQuery.isFetching ? 'Searching…' : 'Search'}</Button>
          <Button size="sm" icon="download" disabled={exporting || !returnsSearched} onClick={() => void exportReturns()}>{exporting ? 'Exporting…' : 'Export CSV'}</Button>
        </div>}
      </div>
      {customerFilter && (
        <div className="row gap8" style={{ marginBottom: 14 }}>
          <Badge tone="info">Customer: {customerFilter.name}</Badge>
          <Button size="sm" variant="ghost" icon="x" onClick={onClearCustomerFilter}>Clear customer filter</Button>
        </div>
      )}

      <div className="row gap8" style={{ marginBottom: 16 }}>
        <Button size="sm" variant={tab === 'bills' ? 'primary' : 'outline'} onClick={() => setTab('bills')}>Sales bills</Button>
        <Button size="sm" variant={tab === 'returns' ? 'primary' : 'outline'} icon="rotate-ccw" onClick={() => setTab('returns')}>Returns report</Button>
      </div>

      {tab === 'bills' ? <>
        <div className="kpi-grid procurement-status-grid">
          <KpiCard label="Bills found" value={String(billsSearched ? total : 0)} icon="receipt-text" tone="tile-primary" />
          <KpiCard label="Paid bills" value={String(billsSearched ? paidBills : 0)} icon="badge-check" tone="tile-success" />
          <KpiCard label="Credit bills" value={String(billsSearched ? creditBills : 0)} icon="wallet-cards" tone="tile-warning" />
          <KpiCard label="Sales on this page" value={billsSearched ? money(visibleSales) : money(0)} icon="circle-dollar-sign" tone="tile-info" />
        </div>
        <Card title="Bill history" sub={!billsSearched ? 'Search to load completed bills' : initialLoading ? 'Loading…' : `${total} completed bill${total === 1 ? '' : 's'}`} noBody>
        {!billsSearched ? <div className="empty" style={{ minHeight: 260 }}><div className="ei">⌕</div><div style={{ fontWeight: 600, color: 'var(--fg)' }}>Search sales bills</div><div>Enter a bill number if needed, then click Search to load bill history.</div></div> : initialLoading ? (
          <ContentLoader />
        ) : (
        <div className="tbl-wrap">
          <table className="tbl tbl-clickable">
            <thead>
              <tr>
                <th>Bill No.</th>
                <th>Customer</th>
                <th>Cashier</th>
                <th className="num">Items</th>
                <th className="num">Total</th>
                <th>Payment</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {billsQuery.error ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '40px 0', color: 'var(--danger-fg)' }}>
                    {billsQuery.error.message}
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '40px 0', color: 'var(--fg-subtle)', fontSize: 13 }}>
                    No bills found{q ? ' for this search' : ''}.
                  </td>
                </tr>
              ) : rows.map(b => (
                <tr key={b.id} onClick={() => openBill(b)} style={{ cursor: 'pointer' }}>
                  <td className="mono td-strong" style={{ fontSize: 12.5 }}>{b.billNo}</td>
                  <td>{b.customerName}</td>
                  <td className="muted">{b.cashierName}</td>
                  <td className="num tnum">{b.itemCount}</td>
                  <td className="num td-strong tnum">{money(b.grandTotal)}</td>
                  <td><Badge tone={payTone(b.paymentStatus)}>{payLabel(b.paymentStatus)}</Badge></td>
                  <td className="muted tnum">{formatWhen(b.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        )}

        {billsSearched && !initialLoading && totalPages > 1 && (
          <div className="filter-toolbar-foot" style={{ justifyContent: 'space-between' }}>
            <span className="muted" style={{ fontSize: 12.5 }}>Page {page + 1} of {totalPages}</span>
            <div className="row gap8">
              <Button size="sm" variant="outline" disabled={page <= 0} onClick={() => setPage(p => p - 1)}>Previous</Button>
              <Button size="sm" variant="outline" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Next</Button>
            </div>
          </div>
        )}
        </Card>
      </> : <>
        <div className="kpi-grid procurement-status-grid">
          <KpiCard label="Return lines" value={String(returnsSearched ? returnsQuery.data?.totalElements ?? 0 : 0)} icon="rotate-ccw" tone="tile-primary" />
          <KpiCard label="Units on this page" value={String(returnsSearched ? returnedUnits : 0)} icon="package" tone="tile-info" />
          <KpiCard label="Refunds on this page" value={returnsSearched ? money(refundedTotal) : money(0)} icon="wallet" tone="tile-warning" />
          <KpiCard label="Pages found" value={String(returnsSearched ? returnsQuery.data?.totalPages ?? 0 : 0)} icon="files" tone="tile-success" />
        </div>
        <Card title="Sales returns" sub={!returnsSearched ? 'Search to load return records' : 'Every returned product line · refund, reason and staff trail'} noBody>
          <div className="tbl-wrap"><table className="tbl tbl-clickable"><thead><tr><th>Return</th><th>Bill / customer</th><th>Product</th><th className="num">Qty</th><th className="num">Refund</th><th>Method</th><th>Reason</th><th>Processed by</th><th>Date</th></tr></thead>
            <tbody>{!returnsSearched ? <tr><td colSpan={9} style={{ textAlign: 'center', padding: '48px 0', color: 'var(--fg-subtle)' }}><div style={{ fontWeight: 600, color: 'var(--fg)', marginBottom: 3 }}>Search sales returns</div><div>Enter a return number, bill number, or product, then click Search to load records.</div></td></tr> : returnsQuery.isLoading || returnsQuery.isFetching ? <tr><td colSpan={9} style={{ textAlign: 'center', padding: '40px 0' }}>Loading returns…</td></tr>
              : returnsQuery.error ? <tr><td colSpan={9} style={{ textAlign: 'center', padding: '40px 0', color: 'var(--danger-fg)' }}>{returnsQuery.error.message}</td></tr>
              : returnRows.length === 0 ? <tr><td colSpan={9} style={{ textAlign: 'center', padding: '40px 0', color: 'var(--fg-subtle)' }}>No returns found.</td></tr>
              : returnRows.map(row => <tr key={row.id + row.productName} onClick={() => setSelectedId(row.billId)} style={{ cursor: 'pointer' }}><td className="mono td-strong">{row.returnNo}</td><td><div>{row.billNo}</div><div className="td-sub">{row.customerName}</div></td><td><div className="td-strong">{row.productName}</div><div className="td-sub mono">{row.sku}</div></td><td className="num tnum" style={{ color: 'var(--danger-fg)' }}>{row.quantity}</td><td className="num tnum td-strong">{money(row.refundAmount)}</td><td><Badge tone="info">{row.refundMethod}</Badge></td><td className="muted">{row.reason}</td><td>{row.processedBy}</td><td className="muted tnum">{formatWhen(row.createdAt)}</td></tr>)}</tbody>
          </table></div>
          {returnsSearched && (returnsQuery.data?.totalPages ?? 1) > 1 && <div className="filter-toolbar-foot" style={{ justifyContent: 'space-between' }}><span className="muted" style={{ fontSize: 12.5 }}>Page {returnPage + 1} of {returnsQuery.data?.totalPages}</span><div className="row gap8"><Button size="sm" variant="outline" disabled={returnPage <= 0} onClick={() => setReturnPage(p => p - 1)}>Previous</Button><Button size="sm" variant="outline" disabled={returnPage >= (returnsQuery.data?.totalPages ?? 1) - 1} onClick={() => setReturnPage(p => p + 1)}>Next</Button></div></div>}
        </Card>
      </>}

      {selectedId && (
        <BillDetailDrawer
          bill={billDetailQuery.data ?? null}
          loading={billDetailQuery.isLoading}
          error={billDetailQuery.error?.message}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  )
}
