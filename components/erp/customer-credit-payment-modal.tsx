'use client'

import { useEffect, useState } from 'react'
import { Button, Field, Modal, Select, TextInput, useToast } from './ui'
import { fetchCustomerCreditLedger, settleCustomerCredit, type ApiCustomer, type CustomerCreditLedger, type CustomerCreditPayment } from '@/lib/billing-api'
import { money2 } from '@/lib/erp-data'

export function CustomerCreditPaymentModal({ customer, onClose, onSaved }: {
  customer: ApiCustomer
  onClose: () => void
  onSaved: () => void | Promise<void>
}) {
  const toast = useToast()
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<CustomerCreditPayment['paymentMethod']>('CASH')
  const [notes, setNotes] = useState('')
  const [ledger, setLedger] = useState<CustomerCreditLedger | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const due = ledger?.currentBalance ?? customer.creditBalance
  const value = Number(amount)

  useEffect(() => {
    setLoading(true)
    void fetchCustomerCreditLedger(customer.id).then(setLedger).catch(() => setLedger(null)).finally(() => setLoading(false))
  }, [customer.id])

  async function submit() {
    if (!Number.isFinite(value) || value <= 0 || value > due) return
    setSaving(true)
    try {
      const saved = await settleCustomerCredit(customer.id, { amount: value, paymentMethod: method, notes: notes.trim() || undefined })
      toast(`${saved.paymentNo} recorded · balance ${money2(saved.balanceAfter)}`)
      await onSaved()
      onClose()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not record payment', { tone: 'danger' })
    } finally {
      setSaving(false)
    }
  }

  return <Modal title="Settle customer credit" sub={`${customer.name} · outstanding ${money2(due)}`} icon="wallet-cards" onClose={onClose}
    footer={<><Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button><Button variant="primary" icon="check" onClick={() => void submit()} disabled={saving || !Number.isFinite(value) || value <= 0 || value > due}>{saving ? 'Recording…' : 'Record payment'}</Button></>}>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Field label="Amount received" required><TextInput type="number" value={amount} onChange={setAmount} min="0.01" max={due} step="0.01" placeholder={`Up to ${due}`} /></Field>
      <div className="row gap8"><Button size="sm" variant="outline" onClick={() => setAmount(String(due))}>Pay full due · {money2(due)}</Button></div>
      <Field label="Payment method"><Select value={method} onChange={v => setMethod(v as CustomerCreditPayment['paymentMethod'])} options={[{ value: 'CASH', label: 'Cash' }, { value: 'UPI', label: 'UPI' }, { value: 'CARD', label: 'Card' }]} /></Field>
      <Field label="Notes" optional><TextInput value={notes} onChange={setNotes} placeholder="Reference or note…" /></Field>
      <div className="divider" />
      <div className="row" style={{ justifyContent: 'space-between' }}><div className="menu-label" style={{ padding: 0 }}>Credit history</div><span className="td-sub">Newest first</span></div>
      {loading ? <div className="muted">Loading credit history…</div> : !ledger?.entries.length ? <div className="muted">No credit sales or settlements yet.</div> : ledger.entries.map(entry => {
        const isSale = entry.type === 'CREDIT_SALE'
        return <div key={entry.type + entry.id} className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', padding: '9px 0', borderBottom: '1px solid var(--border)' }}>
          <div style={{ minWidth: 0 }}><div className="td-strong mono">{entry.reference}</div><div className="td-sub">{entry.description} · {new Date(entry.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })}</div><div className="td-sub">{entry.paymentMethod}{entry.notes ? ` · ${entry.notes}` : ''} · {entry.processedBy}</div></div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}><div className="tnum td-strong" style={{ color: isSale ? 'var(--warning-fg)' : 'var(--success-fg)' }}>{isSale ? '+' : '−'}{money2(isSale ? entry.debit : entry.credit)}</div><div className="td-sub tnum">Balance {money2(entry.balanceAfter)}</div></div>
        </div>
      })}
    </div>
  </Modal>
}
