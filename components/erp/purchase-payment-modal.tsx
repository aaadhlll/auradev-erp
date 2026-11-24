'use client'

import { useState } from 'react'
import { Button, Field, Modal, Select, TextInput, useToast } from './ui'
import { money2 } from '@/lib/erp-data'
import { recordPurchasePayment, type PurchaseDetail, type PurchasePayment } from '@/lib/purchases-api'

export function PurchasePaymentModal({ purchase, onClose, onSaved }: { purchase: PurchaseDetail; onClose: () => void; onSaved: () => void | Promise<void> }) {
  const toast = useToast()
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<PurchasePayment['method']>('CASH')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const value = Number(amount)
  const valid = Number.isFinite(value) && value > 0 && value <= purchase.balanceDue
  async function save() {
    if (!valid) return
    setSaving(true)
    try {
      await recordPurchasePayment(purchase.id, { amount: value, method, notes: notes.trim() || undefined })
      await onSaved(); toast(value === purchase.balanceDue ? 'Purchase fully paid' : 'Partial supplier payment recorded'); onClose()
    } catch (e) { toast(e instanceof Error ? e.message : 'Could not record supplier payment', { tone: 'danger' }) }
    finally { setSaving(false) }
  }
  return <Modal title="Record supplier payment" sub={`${purchase.purchaseNo} · balance ${money2(purchase.balanceDue)}`} icon="wallet-cards" onClose={onClose}
    footer={<><Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button><Button variant="primary" icon="check" onClick={() => void save()} disabled={!valid || saving}>{saving ? 'Saving…' : `Record ${money2(value || 0)}`}</Button></>}>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="pay-summary"><div className="row" style={{ justifyContent: 'space-between' }}><span className="muted">Purchase total</span><span className="tnum">{money2(purchase.grandTotal)}</span></div><div className="row" style={{ justifyContent: 'space-between' }}><span className="muted">Already paid</span><span className="tnum">{money2(purchase.totalPaid)}</span></div><div className="row" style={{ justifyContent: 'space-between', fontWeight: 700 }}><span>Balance due</span><span className="tnum">{money2(purchase.balanceDue)}</span></div></div>
      <Field label="Amount paid" required><TextInput type="number" value={amount} onChange={setAmount} min="0.01" max={purchase.balanceDue} step="0.01" placeholder={`Up to ${purchase.balanceDue}`} /></Field>
      <Button size="sm" variant="outline" onClick={() => setAmount(String(purchase.balanceDue))}>Pay full balance · {money2(purchase.balanceDue)}</Button>
      <Field label="Payment method"><Select value={method} onChange={v => setMethod(v as PurchasePayment['method'])} options={[{ value: 'CASH', label: 'Cash' }, { value: 'UPI', label: 'UPI / bank transfer' }, { value: 'CARD', label: 'Card' }]} /></Field>
      <Field label="Reference or note" optional><TextInput value={notes} onChange={setNotes} placeholder="UPI reference, cheque no., note…" /></Field>
    </div>
  </Modal>
}
