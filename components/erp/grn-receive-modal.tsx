'use client'

import { useMemo, useState } from 'react'
import { Button, Field, Modal, TextInput, useToast } from './ui'
import type { PurchaseDetail } from '@/lib/purchases-api'
import { receivePurchase } from '@/lib/purchases-api'

export function GrnReceiveModal({ purchase, onClose, onSaved }: { purchase: PurchaseDetail; onClose: () => void; onSaved: () => void }) {
  const toast = useToast()
  const [quantities, setQuantities] = useState<Record<string, string>>(() => Object.fromEntries(purchase.lines.map(line => [line.purchaseItemId, String(Math.max(0, line.quantity - line.receivedQuantity))])))
  const [notes, setNotes] = useState('')
  const [batches, setBatches] = useState<Record<string, { number: string; expiry: string }>>({})
  const [saving, setSaving] = useState(false)
  const lines = useMemo(() => purchase.lines.map(line => ({ ...line, remaining: Math.max(0, line.quantity - line.receivedQuantity), selected: Number(quantities[line.purchaseItemId] || 0) })), [purchase.lines, quantities])
  const selected = lines.filter(line => line.selected > 0)
  const valid = selected.length > 0 && selected.every(line => line.selected <= line.remaining && (!line.expiryTracked || (batches[line.purchaseItemId]?.number && batches[line.purchaseItemId]?.expiry)))
  const save = async () => {
    if (!valid) return
    setSaving(true)
    try {
      await receivePurchase(purchase.id, { items: selected.map(line => ({ purchaseItemId: line.purchaseItemId, quantity: line.selected, batchNumber: batches[line.purchaseItemId]?.number, expiryDate: batches[line.purchaseItemId]?.expiry })), notes })
      toast('GRN recorded · stock updated for delivered quantities', { icon: 'check' })
      onSaved(); onClose()
    } catch (error) { toast(error instanceof Error ? error.message : 'Could not receive GRN', { tone: 'danger' }) } finally { setSaving(false) }
  }
  return <Modal wide title="Receive delivery (GRN)" sub={`${purchase.purchaseNo} · enter quantities delivered today`} icon="package-check" onClose={onClose} footer={<><Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button><Button variant="primary" icon="check" disabled={!valid || saving} onClick={() => void save()}>{saving ? 'Receiving…' : 'Confirm GRN'}</Button></>}>
    <div className="td-sub" style={{ marginBottom: 14 }}>Only delivered quantities are added to stock. The purchase stays awaiting delivery until every item is received.</div>
    <div className="tbl-wrap" style={{ marginBottom: 16 }}><table className="tbl"><thead><tr><th>Product</th><th className="num">Ordered</th><th className="num">Remaining</th><th>Receive / batch details</th></tr></thead><tbody>{lines.map(line => <tr key={line.purchaseItemId}><td><div className="td-strong">{line.name}</div><div className="td-sub mono">{line.sku}{line.expiryTracked ? ' · batch tracked' : ''}</div></td><td className="num tnum">{line.quantity}</td><td className="num tnum td-strong">{line.remaining}</td><td><div className="row gap8"><TextInput type="number" value={quantities[line.purchaseItemId] ?? ''} onChange={value => setQuantities(current => ({ ...current, [line.purchaseItemId]: value }))} disabled={line.remaining <= 0} />{line.expiryTracked && <><TextInput value={batches[line.purchaseItemId]?.number ?? ''} onChange={value => setBatches(s => ({ ...s, [line.purchaseItemId]: { ...s[line.purchaseItemId], number: value } }))} placeholder="Batch no.*" /><TextInput type="date" value={batches[line.purchaseItemId]?.expiry ?? ''} onChange={value => setBatches(s => ({ ...s, [line.purchaseItemId]: { ...s[line.purchaseItemId], expiry: value } }))} /></>}</div></td></tr>)}</tbody></table></div>
    {selected.some(line => line.selected > line.remaining) && <div style={{ color: 'var(--danger-fg)', fontSize: 13, marginBottom: 12 }}>A quantity cannot be higher than the remaining order quantity.</div>}
    <Field label="Delivery note (optional)"><TextInput value={notes} onChange={setNotes} placeholder="Supplier delivery note, short delivery reason…" /></Field>
  </Modal>
}
