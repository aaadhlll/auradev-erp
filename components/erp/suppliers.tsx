'use client'

import { useMemo, useState } from 'react'
import { Icon, Button, Card, TextInput, IconTile } from './ui'
import type { Supplier } from '@/lib/purchases-api'
import { useSuppliersQuery } from '@/lib/queries/use-purchases'
import { SupplierFormModal } from './supplier-form-modal'
import { ProcurementImportModal } from './procurement-import-modal'

export function SuppliersPanel({
  canManage = true,
  onInvalidate,
  onAddSupplier,
  onImportSuppliers,
}: {
  canManage?: boolean
  onInvalidate: () => void
  onAddSupplier?: () => void
  onImportSuppliers?: () => void
}) {
  const suppliersQuery = useSuppliersQuery()
  const suppliers = suppliersQuery.data ?? []
  const [q, setQ] = useState('')
  const [editSupplier, setEditSupplier] = useState<Supplier | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)

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

  const openAdd = () => {
    setEditSupplier(null)
    if (onAddSupplier) onAddSupplier()
    else setFormOpen(true)
  }

  const openImport = () => {
    if (onImportSuppliers) onImportSuppliers()
    else setImportOpen(true)
  }

  return (
    <>
      <Card noBody>
        <div className="filter-toolbar">
          <div style={{ width: 280 }}>
            <TextInput
              size="sm"
              icon="search"
              placeholder="Search suppliers…"
              value={q}
              onChange={setQ}
            />
          </div>
          <div style={{ flex: 1 }} />
          {canManage && (
          <div className="row gap8">
            <Button size="sm" variant="outline" icon="upload" onClick={openImport}>Import</Button>
            <Button size="sm" variant="primary" icon="plus" onClick={openAdd}>Add supplier</Button>
          </div>
          )}
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
              {suppliersQuery.isLoading && suppliers.length === 0 ? (
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
                      ? <>{canManage ? <>No suppliers yet. Click <b>Add supplier</b> or <b>Import</b>.</> : 'No suppliers yet.'}</>
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
                    {canManage && (
                    <Button size="sm" variant="ghost" icon="pencil" onClick={() => setEditSupplier(s)}>
                      Edit
                    </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
          <span className="muted" style={{ fontSize: 12.5 }}>
            {filtered.length} supplier{filtered.length === 1 ? '' : 's'}
            {q.trim() && suppliers.length !== filtered.length && ` · ${suppliers.length} total`}
          </span>
        </div>
      </Card>

      {canManage && formOpen && (
        <SupplierFormModal
          onClose={() => setFormOpen(false)}
          onSaved={onInvalidate}
        />
      )}

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

      {importOpen && (
        <ProcurementImportModal
          kind="suppliers"
          onClose={() => setImportOpen(false)}
          onComplete={onInvalidate}
        />
      )}
    </>
  )
}
