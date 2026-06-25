'use client'

import { Icon, Button, Badge, Drawer } from './ui'
import { money, money2 } from '@/lib/erp-data'
import type { SavedBill } from '@/lib/billing-api'
import { printReceipt, saveReceiptPdf, saveReceiptPng } from '@/lib/receipt-export'
import { useReceiptMeta, useReceiptPrintOptions } from '@/lib/queries/use-settings'
import { useToast } from './ui'

function formatBillDate(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  })
}

function paymentLabel(bill: SavedBill): string {
  if (bill.paymentStatus === 'CREDIT') return 'Credit'
  const m = bill.paymentMethod?.toLowerCase() ?? 'cash'
  return m.charAt(0).toUpperCase() + m.slice(1)
}

function paymentTone(bill: SavedBill): string {
  if (bill.paymentStatus === 'CREDIT') return 'warning'
  return 'success'
}

export function BillDetailDrawer({
  bill,
  loading,
  error,
  onClose,
}: {
  bill: SavedBill | null
  loading?: boolean
  error?: string | null
  onClose: () => void
}) {
  const toast = useToast()
  const receiptMeta = useReceiptMeta()
  const printOptions = useReceiptPrintOptions()

  if (!bill && !loading) return null

  const title = bill?.billNo ?? 'Bill'
  const sub = bill ? `${bill.customerName} · ${formatBillDate(bill.createdAt)}` : 'Loading…'

  return (
    <Drawer title={title} sub={sub} onClose={onClose}>
      {loading && !bill ? (
        <div className="empty" style={{ padding: '40px 0' }}>
          <Icon name="loader" size={22} />
          <div style={{ fontWeight: 600, color: 'var(--fg)', marginTop: 8 }}>Loading bill…</div>
        </div>
      ) : error ? (
        <div className="empty" style={{ padding: '40px 0' }}>
          <div className="ei"><Icon name="alert-circle" size={22} /></div>
          <div style={{ fontWeight: 600, color: 'var(--fg)' }}>{error}</div>
        </div>
      ) : bill ? (
        <>
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 16 }}>
            <Badge tone={paymentTone(bill)} dot>{paymentLabel(bill)}</Badge>
            <span className="td-sub">Cashier: {bill.cashierName}</span>
          </div>

          <div className="row gap12" style={{ marginBottom: 16 }}>
            <div className="kpi" style={{ flex: 1, padding: 12, gap: 4 }}>
              <div className="kpi-label">Grand total</div>
              <div className="kpi-val tnum" style={{ fontSize: 22 }}>{money(bill.grandTotal)}</div>
            </div>
            <div className="kpi" style={{ flex: 1, padding: 12, gap: 4 }}>
              <div className="kpi-label">Line items</div>
              <div className="kpi-val tnum" style={{ fontSize: 22 }}>{bill.lines.length}</div>
            </div>
          </div>

          <div className="menu-label" style={{ padding: '0 0 8px' }}>Items sold</div>
          <div className="tbl-wrap" style={{ border: '1px solid var(--border)', borderRadius: 'var(--r-md)', marginBottom: 16 }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Product</th>
                  <th className="num">Qty</th>
                  <th className="num">Rate</th>
                  <th className="num">Total</th>
                </tr>
              </thead>
              <tbody>
                {bill.lines.map(line => (
                  <tr key={line.productId + line.sku}>
                    <td>
                      <div className="td-strong">{line.name}</div>
                      <div className="td-sub mono">{line.sku}</div>
                    </td>
                    <td className="num tnum">{line.quantity} {line.unitLabel}</td>
                    <td className="num tnum muted">{money2(line.unitPrice)}</td>
                    <td className="num tnum td-strong">{money2(line.lineTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 13.5, marginBottom: 20 }}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span className="muted">Subtotal</span>
              <span className="tnum">{money2(bill.subtotal)}</span>
            </div>
            {bill.billDiscount > 0 && (
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span className="muted">Bill discount</span>
                <span className="tnum">-{money2(bill.billDiscount)}</span>
              </div>
            )}
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span className="muted">CGST</span>
              <span className="tnum">{money2(bill.cgstTotal)}</span>
            </div>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span className="muted">SGST</span>
              <span className="tnum">{money2(bill.sgstTotal)}</span>
            </div>
            <div className="divider" style={{ margin: '6px 0' }} />
            <div className="row" style={{ justifyContent: 'space-between', fontWeight: 700, fontSize: 17 }}>
              <span>Total</span>
              <span className="tnum">{money2(bill.grandTotal)}</span>
            </div>
            {bill.tendered != null && (
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span className="muted">Tendered</span>
                <span className="tnum">{money2(bill.tendered)}</span>
              </div>
            )}
            {bill.changeDue != null && bill.changeDue > 0 && (
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span className="muted">Change</span>
                <span className="tnum">{money2(bill.changeDue)}</span>
              </div>
            )}
          </div>

          <div className="row gap8" style={{ flexWrap: 'wrap' }}>
            <Button
              variant="primary"
              icon="printer"
              onClick={() => {
                void printReceipt(bill, receiptMeta, printOptions).catch(() => {
                  toast('Could not open print dialog', { tone: 'danger' })
                })
              }}
            >
              Print
            </Button>
            <Button variant="outline" icon="file-down" onClick={() => void saveReceiptPdf(bill, receiptMeta, printOptions)}>
              PDF
            </Button>
            <Button variant="outline" icon="image" onClick={() => void saveReceiptPng(bill, receiptMeta, printOptions)}>
              PNG
            </Button>
          </div>
        </>
      ) : null}
    </Drawer>
  )
}
