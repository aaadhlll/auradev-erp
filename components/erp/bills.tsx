'use client'

import { useEffect, useRef, useState } from 'react'
import { Button, Badge, Card, TextInput, ContentLoader, useToast, useClickOutside } from './ui'
import { money } from '@/lib/erp-data'
import type { BillSummary } from '@/lib/billing-api'
import { downloadBillsExport, type BillExportMode } from '@/lib/billing-api'
import { useBillQuery, useBillsQuery } from '@/lib/queries/use-bills'
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
}: {
  openBillId?: string | null
  onOpenBillConsumed?: () => void
  prefillQuery?: string
  prefillKey?: number
  onPrefillConsumed?: () => void
} = {}) {
  const toast = useToast()
  const [q, setQ] = useState('')
  const [page, setPage] = useState(0)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [exportOpen, setExportOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const exportRef = useRef<HTMLDivElement>(null)
  useClickOutside(exportRef, () => setExportOpen(false), exportOpen)

  useEffect(() => {
    if (!prefillQuery || prefillKey == null) return
    setQ(prefillQuery)
    setPage(0)
    onPrefillConsumed?.()
  }, [prefillKey, prefillQuery, onPrefillConsumed])

  useEffect(() => {
    if (!openBillId) return
    setSelectedId(openBillId)
    onOpenBillConsumed?.()
  }, [openBillId, onOpenBillConsumed])

  const billsQuery = useBillsQuery(q, page)
  const billDetailQuery = useBillQuery(selectedId)
  const rows = billsQuery.data?.items ?? []
  const totalPages = billsQuery.data?.totalPages ?? 1
  const total = billsQuery.data?.totalElements ?? rows.length
  const initialLoading = billsQuery.isLoading && rows.length === 0

  const openBill = (row: BillSummary) => setSelectedId(row.id)

  async function doExport(mode: BillExportMode) {
    setExportOpen(false)
    setExporting(true)
    try {
      await downloadBillsExport(q, mode)
      toast(mode === 'detailed' ? 'Line-item export downloaded' : 'Bill summary export downloaded', { icon: 'file-down' })
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Export failed', { tone: 'danger' })
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="content-pad page-shell">
      <div className="page-header">
        <div className="page-header-main">
          <h1 className="page-header-title">Sales bills</h1>
          <p className="muted page-header-sub">Completed transactions · view details and reprint receipts</p>
        </div>
        <div className="page-header-actions row gap8">
          <TextInput
            size="sm"
            icon="search"
            placeholder="Search bill number…"
            value={q}
            onChange={v => { setQ(v); setPage(0) }}
          />
          <div ref={exportRef} style={{ position: 'relative' }}>
            <Button
              size="sm"
              icon="download"
              iconRight="chevron-down"
              disabled={exporting || initialLoading}
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
        </div>
      </div>

      <Card title="Bill history" sub={initialLoading ? 'Loading…' : `${total} completed bill${total === 1 ? '' : 's'}`} noBody>
        {initialLoading ? (
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

        {!initialLoading && totalPages > 1 && (
          <div className="filter-toolbar-foot" style={{ justifyContent: 'space-between' }}>
            <span className="muted" style={{ fontSize: 12.5 }}>Page {page + 1} of {totalPages}</span>
            <div className="row gap8">
              <Button size="sm" variant="outline" disabled={page <= 0} onClick={() => setPage(p => p - 1)}>Previous</Button>
              <Button size="sm" variant="outline" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Next</Button>
            </div>
          </div>
        )}
      </Card>

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
