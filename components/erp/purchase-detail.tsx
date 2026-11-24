'use client'

import { Icon, Button, Badge, Drawer, useToast } from './ui'
import { money, money2 } from '@/lib/erp-data'
import type { PurchaseDetail } from '@/lib/purchases-api'
import { statusLabel, statusTone } from '@/lib/purchases-api'
import { printPurchase, savePurchaseJpeg, savePurchasePdf } from '@/lib/purchase-export'
import { useReceiptMeta, useReceiptPrintOptions } from '@/lib/queries/use-settings'
import { useQuery } from '@tanstack/react-query'
import { fetchPurchaseReceipts, type PurchaseReceipt } from '@/lib/purchases-api'

function formatDate(iso: string): string {
  return new Date(iso + (iso.includes('T') ? '' : 'T00:00:00')).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

function printGrn(receipt: PurchaseReceipt) {
  const win = window.open('', '_blank', 'width=1100,height=760')
  if (!win) throw new Error('The print window was blocked')
  const rows = receipt.items.map((item, index) => `<tr><td>${index + 1}</td><td><b>${item.productName}</b><br><small>${item.sku}</small></td><td>${item.orderedQuantity ?? '—'}</td><td><b>${item.quantity}</b></td><td>${item.batchNumber ?? '—'}</td><td>${item.expiryDate ?? '—'}</td></tr>`).join('')
  win.document.write(`<!doctype html><title>${receipt.grnNo}</title><style>@page{size:A4 landscape;margin:14mm}body{font:13px Arial;color:#17211d}h1{color:#1f7a63;margin:0}header{display:flex;justify-content:space-between;border-bottom:2px solid #1f7a63;padding-bottom:14px;margin-bottom:20px}.meta{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:18px}table{width:100%;border-collapse:collapse}th{background:#e9f3ee;text-align:left}th,td{border:1px solid #cfd7d2;padding:9px}small{color:#64706a}.sign{display:flex;justify-content:space-between;margin-top:72px}.sign span{border-top:1px solid #17211d;width:170px;text-align:center;padding-top:7px}</style><header><div><h1>Mercantile</h1><div>Goods Receipt Note</div></div><div><h1>${receipt.grnNo}</h1><div>${new Date(receipt.createdAt).toLocaleString()}</div></div></header><div class="meta"><div><b>Supplier</b><br>${receipt.supplierName ?? '—'}</div><div><b>Purchase order</b><br>${receipt.purchaseNo ?? '—'}</div><div><b>Received by</b><br>${receipt.receivedBy ?? '—'}</div><div><b>Notes</b><br>${receipt.notes ?? '—'}</div></div><table><thead><tr><th>#</th><th>Item</th><th>Ordered</th><th>Received</th><th>Batch</th><th>Expiry</th></tr></thead><tbody>${rows}</tbody></table><div class="sign"><span>Prepared by</span><span>Verified by</span><span>Authorized by</span></div><script>window.onload=()=>window.print()</script>`)
  win.document.close()
}

export function PurchaseDetailDrawer({
  purchase,
  loading,
  error,
  busy,
  onClose,
  onConfirm,
  onReceive,
  onCancel,
  onReturn,
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
  onCancel?: () => void
  onReturn?: () => void
  onPay?: () => void
  onDelete?: () => void
}) {
  const toast = useToast()
  const receiptMeta = useReceiptMeta()
  const printOptions = useReceiptPrintOptions()
  const receiptsQuery = useQuery({ queryKey: ['purchase-receipts', purchase?.id], queryFn: () => fetchPurchaseReceipts(purchase!.id), enabled: Boolean(purchase) })

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
                {purchase.lines.map((line, index) => (
                  <tr key={`${line.productId}-${line.sku}-${index}`}>
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
            {printOptions.showTax === true && <div className="row" style={{ justifyContent: 'space-between' }}>
              <span className="muted">GST</span><span className="tnum">{money2(purchase.gstTotal)}</span>
            </div>}
            <div className="divider" style={{ margin: '6px 0' }} />
            <div className="row" style={{ justifyContent: 'space-between', fontWeight: 700, fontSize: 17 }}>
              <span>Total</span><span className="tnum">{money2(purchase.grandTotal)}</span>
            </div>
            {(purchase.status === 'BILLED' || purchase.status === 'PAID') && <>
              <div className="row" style={{ justifyContent: 'space-between' }}><span className="muted">Paid</span><span className="tnum">{money2(purchase.totalPaid)}</span></div>
              <div className="row" style={{ justifyContent: 'space-between', fontWeight: 700 }}><span>Balance due</span><span className="tnum">{money2(purchase.balanceDue)}</span></div>
            </>}
          </div>

          {purchase.payments.length > 0 && <div style={{ marginBottom: 18 }}><div className="menu-label" style={{ padding: '0 0 8px' }}>Payment history</div>{purchase.payments.map(payment => <div key={payment.id} className="row" style={{ justifyContent: 'space-between', padding: '9px 0', borderTop: '1px solid var(--border)' }}><div><div className="td-strong">{payment.method.replace('_', ' ')}</div><div className="td-sub">{new Date(payment.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}{payment.notes ? ` · ${payment.notes}` : ''}</div></div><strong className="tnum">{money2(payment.amount)}</strong></div>)}</div>}

          {(receiptsQuery.data?.length ?? 0) > 0 && <div style={{ marginBottom: 18 }}><div className="menu-label" style={{ padding: '0 0 8px' }}>Delivery history</div>{receiptsQuery.data?.map(receipt => <div key={receipt.id} style={{ padding: '9px 0', borderTop: '1px solid var(--border)' }}><div className="row" style={{ justifyContent: 'space-between' }}><span className="td-strong mono">{receipt.grnNo}</span><span className="td-sub">{new Date(receipt.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</span></div><div className="row" style={{ justifyContent: 'space-between', gap: 8 }}><div className="td-sub">{receipt.items.map(item => `${item.productName} × ${item.quantity}`).join(' · ')}{receipt.notes ? ` · ${receipt.notes}` : ''}</div><Button size="sm" variant="outline" icon="printer" onClick={() => printGrn(receipt)}>Print / PDF</Button></div></div>)}</div>}

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
            {purchase.status === 'PENDING_GRN' && onReceive && (
              <Button variant="primary" icon="package-check" disabled={busy} onClick={onReceive}>
                Receive GRN
              </Button>
            )}
            {purchase.status === 'PENDING_GRN' && onCancel && (
              <Button variant="danger-soft" icon="x-circle" disabled={busy} onClick={onCancel}>
                Cancel order
              </Button>
            )}
            {purchase.status === 'BILLED' && onPay && (
              <Button variant="primary" icon="check" disabled={busy} onClick={onPay}>
                Record payment
              </Button>
            )}
            {(purchase.status === 'BILLED' || purchase.status === 'PAID') && onReturn && (
              <Button variant="outline" icon="rotate-ccw" disabled={busy} onClick={onReturn}>
                Return items
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
