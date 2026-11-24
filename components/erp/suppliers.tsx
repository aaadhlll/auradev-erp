'use client'

import { useMemo, useState } from 'react'
import { Icon, Button, Card, TextInput, IconTile, KpiCard } from './ui'
import type { Supplier } from '@/lib/purchases-api'
import { useSuppliersQuery } from '@/lib/queries/use-purchases'
import { SupplierFormModal } from './supplier-form-modal'

export function SuppliersPanel({
  canManage = true,
  onInvalidate,
  onSettleSupplier,
  onPaymentHistory,
}: {
  canManage?: boolean
  onInvalidate: () => void
  onSettleSupplier?: (supplier: Supplier) => void
  onPaymentHistory?: (supplier: Supplier) => void
}) {
  const [hasSearched, setHasSearched] = useState(false)
  const suppliersQuery = useSuppliersQuery(hasSearched)
  const suppliers = suppliersQuery.data ?? []
  const [q, setQ] = useState('')
  const [editSupplier, setEditSupplier] = useState<Supplier | null>(null)

  const filtered = useMemo(() => {
    const lq = q.trim().toLowerCase()
    if (!lq) return suppliers
    return suppliers.filter(s =>
      s.name.toLowerCase().includes(lq)
      || (s.phone ?? '').includes(lq)
      || (s.gstin ?? '').toLowerCase().includes(lq)
      || (s.contactPerson ?? '').toLowerCase().includes(lq)
      || (s.email ?? '').toLowerCase().includes(lq),
    )
  }, [suppliers, q])

  const supplierContacts = suppliers.filter(s => Boolean(s.contactPerson)).length
  const supplierPhones = suppliers.filter(s => Boolean(s.phone)).length
  const supplierEmails = suppliers.filter(s => Boolean(s.email)).length

  function runSearch() {
    if (hasSearched) void suppliersQuery.refetch()
    else setHasSearched(true)
  }

  return (
    <>
      <div className="kpi-grid procurement-status-grid">
        <KpiCard label="Total suppliers" value={String(hasSearched ? suppliers.length : 0)} icon="truck" tone="tile-primary" />
        <KpiCard label="Contact persons" value={String(hasSearched ? supplierContacts : 0)} icon="users" tone="tile-info" />
        <KpiCard label="Phone available" value={String(hasSearched ? supplierPhones : 0)} icon="phone" tone="tile-success" />
        <KpiCard label="Email available" value={String(hasSearched ? supplierEmails : 0)} icon="mail" tone="tile-warning" />
      </div>
      <Card noBody>
        <div className="filter-toolbar">
          <div className="toolbar-field">
            <TextInput
              size="sm"
              icon="search"
              placeholder="Search suppliers…"
              value={q}
              onChange={setQ}
            />
          </div>
          <Button size="sm" variant="primary" icon="search" onClick={runSearch} disabled={suppliersQuery.isFetching}>{suppliersQuery.isFetching ? 'Searching…' : 'Search'}</Button>
        </div>

        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Supplier</th>
                <th>Contact</th>
                <th>Phone</th>
                <th>GSTIN</th>
                <th>Address</th>
                <th style={{ width: 88 }} />
              </tr>
            </thead>
            <tbody>
              {!hasSearched ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '48px 0', color: 'var(--fg-subtle)', fontSize: 13 }}>
                    <Icon name="search" size={18} style={{ marginBottom: 8 }} />
                    <div style={{ fontWeight: 600, color: 'var(--fg)', marginBottom: 3 }}>Search suppliers</div>
                    <div>Enter a supplier name, phone, registration number, or email, then click Search to load suppliers.</div>
                  </td>
                </tr>
              ) : suppliersQuery.isLoading || suppliersQuery.isFetching ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '40px 0' }}>
                    <Icon name="loader" size={20} />
                  </td>
                </tr>
              ) : suppliersQuery.error ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '40px 0', color: 'var(--danger-fg)' }}>
                    {suppliersQuery.error.message}
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '40px 0', color: 'var(--fg-subtle)', fontSize: 13 }}>
                    {suppliers.length === 0
                      ? <>{canManage ? <>No suppliers yet. Use <b>Add supplier</b> or <b>Import suppliers</b> above.</> : 'No suppliers yet.'}</>
                      : 'No suppliers match your search.'}
                  </td>
                </tr>
              ) : filtered.map(s => (
                <tr key={s.id}>
                  <td>
                    <div className="row gap10">
                      <IconTile tone="tile-info" size={30} icon="truck" />
                      <span className="td-strong">{s.name}</span>
                    </div>
                  </td>
                  <td className="muted">{s.contactPerson || '—'}</td>
                  <td className="tnum">{s.phone || '—'}</td>
                  <td className="mono" style={{ fontSize: 12 }}>{s.gstin || '—'}</td>
                  <td className="muted" style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {s.address || '—'}
                  </td>
                  <td>
                    {canManage && <div className="row gap4">{onSettleSupplier && <Button size="sm" variant="ghost" icon="wallet-cards" onClick={() => onSettleSupplier(s)}>Settle</Button>}{onPaymentHistory && <Button size="sm" variant="ghost" icon="history" onClick={() => onPaymentHistory(s)}>History</Button>}<Button size="sm" variant="ghost" icon="pencil" onClick={() => setEditSupplier(s)}>Edit</Button></div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
          <span className="muted" style={{ fontSize: 12.5 }}>
            {hasSearched ? <>{filtered.length} supplier{filtered.length === 1 ? '' : 's'}{q.trim() && suppliers.length !== filtered.length && ` · ${suppliers.length} total`}</> : 'Search to load suppliers'}
          </span>
        </div>
      </Card>

      {canManage && editSupplier && (
        <SupplierFormModal
          supplier={editSupplier}
          onClose={() => setEditSupplier(null)}
          onSaved={() => {
            onInvalidate()
            setEditSupplier(null)
          }}
        />
      )}

    </>
  )
}
