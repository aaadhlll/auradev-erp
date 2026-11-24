'use client'

import { useEffect, useState } from 'react'
import { Button, Icon, Modal, useToast } from './ui'
import { money2 } from '@/lib/erp-data'
import { fetchSupplierPaymentHistory, type Supplier, type SupplierPaymentHistory } from '@/lib/purchases-api'

export function SupplierPaymentHistoryModal({ supplier, onClose }: { supplier: Supplier; onClose: () => void }) {
  const toast = useToast(); const [data, setData] = useState<SupplierPaymentHistory | null>(null); const [loading, setLoading] = useState(true)
  useEffect(() => { void fetchSupplierPaymentHistory(supplier.id).then(setData).catch(e => toast(e instanceof Error ? e.message : 'Could not load supplier payment history', { tone: 'danger' })).finally(() => setLoading(false)) }, [supplier.id, toast])
  return <Modal wide title="Supplier payment history" sub={`${supplier.name} · every recorded payment and bill allocation`} icon="history" onClose={onClose} footer={<Button variant="ghost" onClick={onClose}>Close</Button>}>
    {loading ? <div className="empty" style={{ padding: 40 }}><Icon name="loader" size={20} /><div>Loading payment history…</div></div> : !data?.settlements.length ? <div className="empty" style={{ padding: 40 }}>No supplier payments have been recorded yet.</div> : <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{data.settlements.map(settlement => <div key={settlement.reference} style={{ border: '1px solid var(--border)', borderRadius: 'var(--r-md)', overflow: 'hidden' }}><div className="row" style={{ justifyContent: 'space-between', padding: '12px 14px', background: 'var(--surface-2)' }}><div><div className="td-strong mono">{settlement.reference}</div><div className="td-sub">{new Date(settlement.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })} · {settlement.method.replace('_', ' ')}</div></div><div className="tnum" style={{ fontWeight: 700, fontSize: 16 }}>{money2(settlement.amount)}</div></div><div style={{ padding: '8px 14px 12px' }}>{settlement.allocations.map(allocation => <div key={allocation.purchaseId} className="row" style={{ justifyContent: 'space-between', padding: '5px 0' }}><span className="muted">Allocated to <span className="mono">{allocation.purchaseNo}</span></span><span className="tnum">{money2(allocation.amount)}</span></div>)}{settlement.notes && <div className="td-sub" style={{ marginTop: 6 }}>Note: {settlement.notes}</div>}</div></div>)}</div>}
  </Modal>
}
