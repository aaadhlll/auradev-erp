'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button, Field, Modal, Select, TextInput, useToast } from './ui'
import { money2 } from '@/lib/erp-data'
import { createPurchaseReturn, fetchPurchaseReturns, type PurchaseDetail, type PurchaseReturn } from '@/lib/purchases-api'

export function PurchaseReturnModal({ purchase, onClose, onSaved }: { purchase: PurchaseDetail; onClose: () => void; onSaved: () => void }) {
  const toast = useToast()
  const [allReturns, setAllReturns] = useState<PurchaseReturn[]>([])
  const [quantities, setQuantities] = useState<Record<string, string>>({})
  const [reason, setReason] = useState('')
  const [resolution, setResolution] = useState<PurchaseReturn['resolution']>('SUPPLIER_CREDIT')
  const [saving, setSaving] = useState(false)
  useEffect(() => { void fetchPurchaseReturns().then(setAllReturns).catch(() => toast('Could not load previous returns', { tone: 'danger' })) }, [toast])
  const returned = useMemo(() => allReturns.filter(value => value.purchaseId === purchase.id).flatMap(value => value.items)
    .reduce<Record<string, number>>((sum, line) => ({ ...sum, [line.purchaseItemId]: (sum[line.purchaseItemId] ?? 0) + line.quantity }), {}), [allReturns, purchase.id])
  const lines = purchase.lines.map(line => ({ ...line, alreadyReturned: returned[line.purchaseItemId] ?? 0, available: line.quantity - (returned[line.purchaseItemId] ?? 0), selected: Number(quantities[line.purchaseItemId] || 0) }))
  const selected = lines.filter(line => line.selected > 0)
  const total = selected.reduce((sum, line) => sum + (line.lineTotal * line.selected / line.quantity), 0)
  const valid = Boolean(reason.trim()) && selected.length > 0 && selected.every(line => line.selected <= line.available)
  const save = async () => {
    if (!valid) return
    setSaving(true)
    try {
      await createPurchaseReturn(purchase.id, { reason: reason.trim(), resolution, items: selected.map(line => ({ purchaseItemId: line.purchaseItemId, quantity: line.selected })) })
      toast('Purchase return recorded · stock reduced', { icon: 'check' })
      onSaved(); onClose()
    } catch (error) { toast(error instanceof Error ? error.message : 'Could not record purchase return', { tone: 'danger' }) } finally { setSaving(false) }
  }
  return <Modal wide title="Return to supplier" sub={`${purchase.purchaseNo} · received items only`} icon="rotate-ccw" onClose={onClose} footer={<><Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button><Button variant="primary" icon="check" disabled={!valid || saving} onClick={() => void save()}>{saving ? 'Saving…' : `Record return ${money2(total)}`}</Button></>}>
    <div className="td-sub" style={{ marginBottom: 14 }}>Only the remaining received quantity can be returned. Stock is reduced once this is recorded.</div>
    <div className="tbl-wrap" style={{ marginBottom: 16 }}><table className="tbl"><thead><tr><th>Product</th><th className="num">Received</th><th className="num">Already returned</th><th className="num">Available</th><th style={{ width: 150 }}>Return qty</th></tr></thead><tbody>{lines.map(line => <tr key={line.purchaseItemId}><td><div className="td-strong">{line.name}</div><div className="td-sub mono">{line.sku}</div></td><td className="num tnum">{line.quantity}</td><td className="num tnum">{line.alreadyReturned}</td><td className="num tnum td-strong">{line.available}</td><td><TextInput type="number" value={quantities[line.purchaseItemId] ?? ''} onChange={value => setQuantities(current => ({ ...current, [line.purchaseItemId]: value }))} placeholder="0" disabled={line.available <= 0} /></td></tr>)}</tbody></table></div>
    {selected.some(line => line.selected > line.available) && <div style={{ color: 'var(--danger-fg)', fontSize: 13, marginBottom: 12 }}>A return quantity cannot be higher than the available quantity.</div>}
    <div className="form-grid"><Field label="Resolution" required><Select value={resolution} onChange={value => setResolution(value as PurchaseReturn['resolution'])} options={[{ value: 'SUPPLIER_CREDIT', label: 'Supplier credit note' }, { value: 'CASH_REFUND', label: 'Cash refund' }, { value: 'BANK_REFUND', label: 'Bank refund' }]} /></Field><Field label="Return reason" required><TextInput value={reason} onChange={setReason} placeholder="Damaged, expired, incorrect delivery…" /></Field></div>
  </Modal>
}
