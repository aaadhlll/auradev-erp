'use client'

import { Icon, Button, Badge, Drawer, useToast } from './ui'
import { money, money2 } from '@/lib/erp-data'
import type { PurchaseDetail } from '@/lib/purchases-api'
import { statusLabel, statusTone } from '@/lib/purchases-api'
import { printPurchase, savePurchaseJpeg, savePurchasePdf } from '@/lib/purchase-export'
import { useReceiptMeta, useReceiptPrintOptions } from '@/lib/queries/use-settings'

function formatDate(iso: string): string {
  return new Date(iso + (iso.includes('T') ? '' : 'T00:00:00')).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

export function PurchaseDetailDrawer({
  purchase,
  loading,
  error,
  busy,
  onClose,
  onConfirm,
  onReceive,
  onPay,
  onDelete,
}: {
  purchase: PurchaseDetail | null
  loading?: boolean
  error?: string | null
  busy?: boolean
  onClose: () => void
  onConfirm?: () => void
  onReceive?: () => void
  onPay?: () => void
  onDelete?: () => void
}) {
  const toast = useToast()
  const receiptMeta = useReceiptMeta()
  const printOptions = useReceiptPrintOptions()

  if (!purchase && !loading) return null

  const title = purchase?.purchaseNo ?? 'Purchase'
  const sub = purchase
    ? `${purchase.supplierName} · ${formatDate(purchase.billDate)}`
    : 'Loading…'

  return (
    <Drawer title={title} sub={sub} onClose={onClose}>
      {loading && !purchase ? (
        <div className="empty" style={{ padding: '40px 0' }}>
          <Icon name="loader" size={22} />
          <div style={{ fontWeight: 600, color: 'var(--fg)', marginTop: 8 }}>Loading purchase…</div>
        </div>
      ) : error ? (
        <div className="empty" style={{ padding: '40px 0' }}>
          <div className="ei"><Icon name="alert-circle" size={22} /></div>
          <div style={{ fontWeight: 600, color: 'var(--fg)' }}>{error}</div>
        </div>
      ) : purchase ? (
        <>
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 16 }}>
            <Badge tone={statusTone(purchase.status)} dot>{statusLabel(purchase.status)}</Badge>
            {purchase.dueDate && (
              <span className="td-sub">Due {formatDate(purchase.dueDate)}</span>
            )}
          </div>

          <div className="row gap12" style={{ marginBottom: 16 }}>
            <div className="kpi" style={{ flex: 1, padding: 12, gap: 4 }}>
              <div className="kpi-label">Grand total</div>
              <div className="kpi-val tnum" style={{ fontSize: 22 }}>{money(purchase.grandTotal)}</div>
            </div>
            <div className="kpi" style={{ flex: 1, padding: 12, gap: 4 }}>
              <div className="kpi-label">Line items</div>
              <div className="kpi-val tnum" style={{ fontSize: 22 }}>{purchase.lines.length}</div>
            </div>
          </div>

          {(purchase.supplierGstin || purchase.supplierPhone) && (
            <div style={{ background: 'var(--surface-2)', borderRadius: 'var(--r-md)', padding: '12px 14px', marginBottom: 16, fontSize: 12.5 }}>
              {purchase.supplierGstin && (
                <div className="row" style={{ justifyContent: 'space-between', padding: '3px 0' }}>
                  <span className="muted">GSTIN</span><span className="mono">{purchase.supplierGstin}</span>
                </div>
              )}
              {purchase.supplierPhone && (
                <div className="row" style={{ justifyContent: 'space-between', padding: '3px 0' }}>
                  <span className="muted">Phone</span><span>{purchase.supplierPhone}</span>
                </div>
              )}
            </div>
          )}

          <div className="menu-label" style={{ padding: '0 0 8px' }}>Items</div>
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
                {purchase.lines.map(line => (
                  <tr key={line.productId + line.sku}>
                    <td>
                      <div className="td-strong">{line.name}</div>
                      <div className="td-sub mono">{line.sku}</div>
                    </td>
                    <td className="num tnum">{line.quantity} {line.unitLabel}</td>
                    <td className="num tnum muted">{money2(line.rate)}</td>
                    <td className="num tnum td-strong">{money2(line.lineTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 13.5, marginBottom: 20 }}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span className="muted">Subtotal</span><span className="tnum">{money2(purchase.subtotal)}</span>
            </div>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span className="muted">GST</span><span className="tnum">{money2(purchase.gstTotal)}</span>
            </div>
            <div className="divider" style={{ margin: '6px 0' }} />
            <div className="row" style={{ justifyContent: 'space-between', fontWeight: 700, fontSize: 17 }}>
              <span>Total</span><span className="tnum">{money2(purchase.grandTotal)}</span>
            </div>
          </div>

          <div className="row gap8" style={{ flexWrap: 'wrap', marginBottom: 16 }}>
            <Button variant="primary" icon="printer" onClick={() => {
              void printPurchase(purchase, receiptMeta, printOptions).catch(() => {
                toast('Could not open print dialog', { tone: 'danger' })
              })
            }}>Print</Button>
            <Button variant="outline" icon="file-down" onClick={() => {
              void savePurchasePdf(purchase, receiptMeta, printOptions).catch(() => {
                toast('Could not save PDF', { tone: 'danger' })
              })
            }}>PDF</Button>
            <Button variant="outline" icon="image" onClick={() => {
              void savePurchaseJpeg(purchase, receiptMeta, printOptions).catch(() => {
                toast('Could not save JPG', { tone: 'danger' })
              })
            }}>JPG</Button>
          </div>

          <div className="row gap8" style={{ flexWrap: 'wrap' }}>
            {purchase.status === 'DRAFT' && onConfirm && (
              <Button variant="outline" icon="send" disabled={busy} onClick={onConfirm}>
                Confirm order
              </Button>
            )}
            {(purchase.status === 'DRAFT' || purchase.status === 'PENDING_GRN') && onReceive && (
              <Button variant="primary" icon="package-check" disabled={busy} onClick={onReceive}>
                Receive GRN
              </Button>
            )}
            {purchase.status === 'BILLED' && onPay && (
              <Button variant="primary" icon="check" disabled={busy} onClick={onPay}>
                Mark paid
              </Button>
            )}
            {purchase.status === 'DRAFT' && onDelete && (
              <Button variant="danger-soft" icon="trash-2" disabled={busy} onClick={onDelete}>
                Delete draft
              </Button>
            )}
          </div>
        </>
      ) : null}
    </Drawer>
  )
}
