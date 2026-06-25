'use client'

import { useEffect, useState } from 'react'
import { Button, Badge, Card, TextInput, ContentLoader } from './ui'
import { money } from '@/lib/erp-data'
import type { BillSummary } from '@/lib/billing-api'
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
  const [q, setQ] = useState('')
  const [page, setPage] = useState(0)
  const [selectedId, setSelectedId] = useState<string | null>(null)

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

  return (
    <div className="content-pad" style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 1480, margin: '0 auto' }}>
      <div className="row" style={{ justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>Sales bills</h1>
          <p className="muted" style={{ fontSize: 13.5, marginTop: 4 }}>Completed transactions · view details and reprint receipts</p>
        </div>
        <div style={{ width: 280 }}>
          <TextInput
            size="sm"
            icon="search"
            placeholder="Search bill number…"
            value={q}
            onChange={v => { setQ(v); setPage(0) }}
          />
        </div>
      </div>

      <Card title="Bill history" sub={initialLoading ? 'Loading…' : `${total} completed bill${total === 1 ? '' : 's'}`} noBody>
        {initialLoading ? (
          <ContentLoader label="Loading bills…" />
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
