'use client'

import { useEffect, useState } from 'react'
import { Icon, Button, Badge, Drawer, Modal, Field, TextInput, Select } from './ui'
import { money, money2 } from '@/lib/erp-data'
import { createSalesReturn, fetchSalesReturns, type SavedBill, type SalesReturn } from '@/lib/billing-api'
import { gstSchemeShortLabel, isBillLevelGstScheme } from '@/lib/gst'
import { printReceipt, saveReceiptPdf, saveReceiptPng } from '@/lib/receipt-export'
import { useBillingSettingsQuery, useReceiptMeta, useReceiptPrintOptions } from '@/lib/queries/use-settings'
import { useToast } from './ui'
import { useAuth } from '@/lib/auth-context'
import { hasPermission } from '@/lib/permissions'

function ReturnItemsModal({ bill, previousReturns, onClose, onCreated }: {
  bill: SavedBill
  previousReturns: SalesReturn[]
  onClose: () => void
  onCreated: (value: SalesReturn) => void
}) {
  const toast = useToast()
  const [reason, setReason] = useState('')
  const [refundMethod, setRefundMethod] = useState<SalesReturn['refundMethod']>('CASH')
  const [quantities, setQuantities] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const returnedByItem = previousReturns.flatMap(value => value.items).reduce<Record<string, number>>((all, item) => {
    all[item.billItemId] = (all[item.billItemId] ?? 0) + item.quantity
    return all
  }, {})
  const linesTotal = bill.lines.reduce((sum, line) => sum + line.lineTotal, 0)
  const billFactor = linesTotal > 0 ? bill.grandTotal / linesTotal : 1
  const selected = bill.lines.flatMap(line => {
    const quantity = Number(quantities[line.billItemId] ?? 0)
    const available = Math.max(0, line.quantity - (returnedByItem[line.billItemId] ?? 0))
    return quantity > 0 && quantity <= available ? [{ billItemId: line.billItemId, quantity }] : []
  })
  const estimated = bill.lines.reduce((sum, line) => {
    const available = Math.max(0, line.quantity - (returnedByItem[line.billItemId] ?? 0))
    const quantity = Math.min(Number(quantities[line.billItemId] ?? 0), available)
    return sum + (quantity > 0 ? line.lineTotal * quantity / line.quantity * billFactor : 0)
  }, 0)

  function setReturnQuantity(lineId: string, name: string, available: number, value: string) {
    if (value === '') {
      setQuantities(current => ({ ...current, [lineId]: '' }))
      return
    }
    const quantity = Number(value)
    if (!Number.isFinite(quantity) || quantity < 0) return
    if (quantity > available) {
      setQuantities(current => ({ ...current, [lineId]: String(available) }))
      toast(`${name} — only ${available} sold unit${available === 1 ? '' : 's'} can be returned`, { icon: 'alert-circle' })
      return
    }
    setQuantities(current => ({ ...current, [lineId]: value }))
  }

  async function submit() {
    if (!reason.trim() || !selected.length) return
    setSaving(true)
    try {
      const created = await createSalesReturn(bill.id, { reason: reason.trim(), refundMethod, items: selected })
      onCreated(created)
      toast(`${created.returnNo} created · refund ${money2(created.refundTotal)}`)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not create return', { tone: 'danger' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="Return items" sub={`Original bill ${bill.billNo}`} icon="rotate-ccw" wide onClose={onClose}
      footer={<><Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
        <Button variant="primary" icon="check" onClick={() => void submit()} disabled={saving || !reason.trim() || !selected.length}>
          {saving ? 'Processing…' : `Refund ${money2(estimated)}`}
        </Button></>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--r-md)', overflow: 'hidden' }}>
          <table className="tbl" style={{ width: '100%', tableLayout: 'fixed' }}><thead><tr><th style={{ width: '44%' }}>Product</th><th className="num" style={{ width: '12%' }}>Sold</th><th className="num" style={{ width: '14%' }}>Returned</th><th className="num" style={{ width: '14%' }}>Available</th><th style={{ width: '16%' }}>Return qty</th></tr></thead>
            <tbody>{bill.lines.map(line => {
              const available = Math.max(0, line.quantity - (returnedByItem[line.billItemId] ?? 0))
              return <tr key={line.billItemId}>
              <td><div className="td-strong">{line.name}</div><div className="td-sub mono">{line.sku}</div></td>
              <td className="num tnum">{line.quantity}</td>
              <td className="num tnum">{returnedByItem[line.billItemId] ?? 0}</td>
              <td className="num tnum">{available}</td>
              <td><TextInput type="number" size="sm" value={quantities[line.billItemId] ?? ''}
                onChange={value => setReturnQuantity(line.billItemId, line.name, available, value)}
                min="0" max={available} step="0.001" placeholder={available > 0 ? '0' : 'Returned'} disabled={available <= 0} /></td>
            </tr>})}</tbody>
          </table>
        </div>
        <Field label="Refund method"><Select value={refundMethod} onChange={value => setRefundMethod(value as SalesReturn['refundMethod'])}
          options={[{ value: 'CASH', label: 'Cash' }, { value: 'UPI', label: 'UPI' }, { value: 'CARD', label: 'Card' }, { value: 'CREDIT', label: 'Store credit' }]} /></Field>
        <Field label="Return reason" required><TextInput value={reason} onChange={setReason} placeholder="Damaged, incorrect item, customer request…" /></Field>
      </div>
    </Modal>
  )
}

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

function returnReceiptBill(value: SalesReturn, original: SavedBill): SavedBill {
  return {
    id: value.id,
    billNo: value.returnNo,
    customerId: original.customerId,
    customerName: original.customerName,
    cashierName: original.cashierName,
    status: 'COMPLETED',
    discountMode: 'AMOUNT',
    gstScheme: 'PRODUCT',
    subtotal: value.refundTotal,
    billDiscount: 0,
    cgstTotal: 0,
    sgstTotal: 0,
    grandTotal: value.refundTotal,
    paymentStatus: 'REFUNDED',
    paymentMethod: value.refundMethod,
    tendered: null,
    changeDue: null,
    createdAt: value.createdAt,
    updatedAt: value.createdAt,
    gstSlabs: [],
    lines: value.items.map(item => {
      const originalLine = original.lines.find(line => line.billItemId === item.billItemId)
      return {
        billItemId: item.billItemId,
        productId: item.productId,
        name: item.name,
        sku: originalLine?.sku ?? '',
        unitLabel: originalLine?.unitLabel ?? 'pcs',
        quantity: item.quantity,
        unitPrice: item.quantity > 0 ? item.refundAmount / item.quantity : 0,
        lineDiscount: 0,
        gstRate: 0,
        lineTotal: item.refundAmount,
        returnedQuantity: item.quantity,
      }
    }),
  }
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
  const { user } = useAuth()
  const [returnOpen, setReturnOpen] = useState(false)
  const [returns, setReturns] = useState<SalesReturn[]>([])
  const receiptMeta = useReceiptMeta()
  const printOptions = useReceiptPrintOptions()
  const billingSettings = useBillingSettingsQuery().data
  const taxEnabled = billingSettings?.taxEnabled === true

  const billLevelGst = bill ? isBillLevelGstScheme(bill.gstScheme) : false
  const returnedByItem = returns.flatMap(value => value.items).reduce<Record<string, number>>((all, item) => {
    all[item.billItemId] = (all[item.billItemId] ?? 0) + item.quantity
    return all
  }, {})

  useEffect(() => {
    if (!bill?.id) return
    void fetchSalesReturns(bill.id).then(setReturns).catch(() => setReturns([]))
  }, [bill?.id])

  if (!bill && !loading) return null

  const title = bill?.billNo ?? 'Bill'
  const sub = bill ? `${bill.customerName} · ${formatBillDate(bill.createdAt)}` : 'Loading…'

  return (
    <Drawer title={title} sub={sub} onClose={onClose}>
      {loading && !bill ? (
        <div className="empty" style={{ padding: '40px 0' }}>
          <Icon name="loader" size={22} />
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
            <div className="row gap8">
              {taxEnabled && <Badge tone="info">{gstSchemeShortLabel(bill.gstScheme)}</Badge>}
              <span className="td-sub">Cashier: {bill.cashierName}</span>
            </div>
          </div>

          <div className="row gap12 bill-detail-kpis" style={{ marginBottom: 16, flexWrap: 'wrap' }}>
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
                  <th className="num">Sold</th>
                  <th className="num">Returned</th>
                  <th className="num">Net</th>
                  <th className="num">Rate</th>
                  {taxEnabled && !billLevelGst && <th className="num">Tax %</th>}
                  <th className="num">Total</th>
                </tr>
              </thead>
              <tbody>
                {bill.lines.map(line => {
                  const returned = Math.max(line.returnedQuantity, returnedByItem[line.billItemId] ?? 0)
                  const net = Math.max(0, line.quantity - returned)
                  return <tr key={line.productId + line.sku}>
                    <td>
                      <div className="td-strong">{line.name}</div>
                      <div className="td-sub mono">{line.sku}</div>
                    </td>
                    <td className="num tnum">{line.quantity} {line.unitLabel}</td>
                    <td className="num tnum">{returned > 0 ? <span style={{ color: 'var(--danger-fg)' }}>{returned}</span> : '—'}</td>
                    <td className="num tnum">{net} {line.unitLabel}</td>
                    <td className="num tnum muted">{money2(line.unitPrice)}</td>
                    {taxEnabled && !billLevelGst && <td className="num tnum muted">{line.gstRate}%</td>}
                    <td className="num tnum td-strong">{money2(line.lineTotal)}</td>
                  </tr>
                })}
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
            {taxEnabled && bill.gstSlabs.length > 0 && bill.gstSlabs.map(slab => (
              <div key={slab.ratePct} className="row" style={{ justifyContent: 'space-between' }}>
                <span className="muted">
                  {billLevelGst
                    ? `Composite tax ${slab.ratePct}% on ${money2(slab.taxableValue)}`
                    : `Tax ${slab.ratePct}% on ${money2(slab.taxableValue)}`}
                </span>
                <span className="tnum">{money2(slab.taxAmount)}</span>
              </div>
            ))}
            {taxEnabled && <div className="row" style={{ justifyContent: 'space-between' }}>
              <span className="muted">CGST</span>
              <span className="tnum">{money2(bill.cgstTotal)}</span>
            </div>}
            {taxEnabled && <div className="row" style={{ justifyContent: 'space-between' }}>
              <span className="muted">SGST</span>
              <span className="tnum">{money2(bill.sgstTotal)}</span>
            </div>}
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
            {hasPermission(user, 'SALE_RETURN') && (
              <Button variant="outline" icon="rotate-ccw" onClick={() => setReturnOpen(true)}>Return items</Button>
            )}
          </div>
          {returns.length > 0 && <div style={{ marginTop: 20 }}>
            <div className="menu-label" style={{ padding: '0 0 8px' }}>Returns</div>
            {returns.map(value => <div key={value.id} className="row" style={{ justifyContent: 'space-between', padding: '9px 0', borderTop: '1px solid var(--border)' }}>
              <div><div className="td-strong mono">{value.returnNo}</div><div className="td-sub">{value.reason} · {value.refundMethod}</div></div>
              <div className="row gap6">
                <strong className="tnum">{money2(value.refundTotal)}</strong>
                <Button size="sm" variant="outline" icon="printer" title="Print return bill" onClick={() => {
                  void printReceipt(returnReceiptBill(value, bill), receiptMeta, { ...printOptions, documentLabel: 'Return bill', showTax: false }).catch(() => toast('Could not open print dialog', { tone: 'danger' }))
                }}>Print</Button>
                <Button size="sm" variant="outline" icon="file-down" title="Download return bill PDF" onClick={() => {
                  void saveReceiptPdf(returnReceiptBill(value, bill), receiptMeta, { ...printOptions, documentLabel: 'Return bill', showTax: false })
                }}>PDF</Button>
              </div>
            </div>)}
          </div>}
          {returnOpen && <ReturnItemsModal bill={bill} previousReturns={returns} onClose={() => setReturnOpen(false)} onCreated={value => {
            setReturns(current => [value, ...current]); setReturnOpen(false)
          }} />}
        </>
      ) : null}
    </Drawer>
  )
}
