'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button, Field, Modal, Select, TextInput, useToast } from './ui'
import { money2 } from '@/lib/erp-data'
import { fetchSupplierOutstanding, recordSupplierSettlement, type PurchasePayment, type Supplier, type SupplierOutstanding } from '@/lib/purchases-api'

export function SupplierSettlementModal({ supplier, onClose, onSaved }: { supplier: Supplier; onClose: () => void; onSaved: () => void | Promise<void> }) {
  const toast = useToast(); const [data, setData] = useState<SupplierOutstanding | null>(null); const [loading, setLoading] = useState(true)
  const [amount, setAmount] = useState(''); const [method, setMethod] = useState<PurchasePayment['method']>('UPI'); const [notes, setNotes] = useState(''); const [allocations, setAllocations] = useState<Record<string, string>>({}); const [saving, setSaving] = useState(false)
  useEffect(() => { void fetchSupplierOutstanding(supplier.id).then(setData).catch(e => toast(e instanceof Error ? e.message : 'Could not load supplier bills', { tone: 'danger' })).finally(() => setLoading(false)) }, [supplier.id, toast])
  const paid = useMemo(() => Object.values(allocations).reduce((total, value) => total + (Number(value) || 0), 0), [allocations])
  const value = Number(amount) || 0
  const valid = value > 0 && value <= (data?.totalDue ?? 0) && Math.abs(value - paid) < 0.005
  function autoAllocate() { if (!data || value <= 0) return; let remaining = value; const next: Record<string, string> = {}; for (const bill of data.bills) { const use = Math.min(remaining, bill.balanceDue); if (use > 0) next[bill.id] = String(use); remaining -= use; if (remaining <= 0) break }; setAllocations(next) }
  async function save() { if (!data || !valid) return; setSaving(true); try { await recordSupplierSettlement(supplier.id, { amount: value, method, notes: notes.trim() || undefined, allocations: Object.entries(allocations).filter(([, v]) => Number(v) > 0).map(([purchaseId, v]) => ({ purchaseId, amount: Number(v) })) }); await onSaved(); toast('Supplier payment allocated to selected bills'); onClose() } catch (e) { toast(e instanceof Error ? e.message : 'Could not record supplier payment', { tone: 'danger' }) } finally { setSaving(false) } }
  return <Modal wide title="Settle supplier balance" sub={`${supplier.name} · allocate one payment across multiple bills`} icon="wallet-cards" onClose={onClose} footer={<><Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button><Button variant="primary" icon="check" onClick={() => void save()} disabled={!valid || saving}>{saving ? 'Saving…' : `Record ${money2(value)}`}</Button></>}>
    {loading ? <div className="empty" style={{ padding: 36 }}>Loading unpaid bills…</div> : !data?.bills.length ? <div className="empty" style={{ padding: 36 }}>No outstanding bills for this supplier.</div> : <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="pay-summary"><div className="row" style={{ justifyContent: 'space-between', fontWeight: 700 }}><span>Total supplier balance</span><span className="tnum">{money2(data.totalDue)}</span></div></div>
      <div className="form-grid-2"><Field label="Payment amount" required><TextInput type="number" value={amount} onChange={setAmount} min="0.01" max={data.totalDue} step="0.01" placeholder={`Up to ${data.totalDue}`} /></Field><Field label="Payment method"><Select value={method} onChange={v => setMethod(v as PurchasePayment['method'])} options={[{ value: 'CASH', label: 'Cash' }, { value: 'UPI', label: 'UPI / bank transfer' }, { value: 'CARD', label: 'Card' }]} /></Field></div>
      <div className="row gap8"><Button size="sm" variant="outline" onClick={() => setAmount(String(data.totalDue))}>Pay all · {money2(data.totalDue)}</Button><Button size="sm" variant="outline" onClick={autoAllocate} disabled={value <= 0}>Auto allocate oldest first</Button></div>
      <div className="menu-label" style={{ padding: '2px 0 0' }}>Allocate payment to bills</div>
      <div className="tbl-wrap"><table className="tbl"><thead><tr><th>Bill</th><th>Bill date</th><th className="num">Balance</th><th style={{ width: 170 }}>Pay now</th></tr></thead><tbody>{data.bills.map(bill => <tr key={bill.id}><td className="td-strong mono">{bill.purchaseNo}</td><td className="muted">{new Date(bill.billDate + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td><td className="num tnum">{money2(bill.balanceDue)}</td><td><TextInput size="sm" type="number" min="0" max={bill.balanceDue} step="0.01" value={allocations[bill.id] ?? ''} onChange={v => setAllocations(current => ({ ...current, [bill.id]: v }))} placeholder="0" /></td></tr>)}</tbody></table></div>
      <div className="row" style={{ justifyContent: 'space-between', fontWeight: 700 }}><span>Allocated</span><span className="tnum">{money2(paid)} / {money2(value)}</span></div>
      {value > 0 && Math.abs(value - paid) >= 0.005 && <div className="td-sub" style={{ color: 'var(--danger)' }}>Allocate the full payment amount before saving.</div>}
      <Field label="Reference or note" optional><TextInput value={notes} onChange={setNotes} placeholder="Bank reference, cheque no., note…" /></Field>
    </div>}
  </Modal>
}
