'use client'

import { useEffect, useMemo, useState } from 'react'
import { Icon, Button, Badge, KpiCard, Card, Select, TextInput, IconTile, useToast } from './ui'
import { money } from '@/lib/erp-data'
import {
  STATUS_FILTERS,
  confirmPurchase,
  payPurchase,
  receivePurchase,
  statusLabel,
  statusTone,
} from '@/lib/purchases-api'
import {
  useInvalidatePurchases,
  useInvalidateSuppliers,
  usePurchaseKpisQuery,
  usePurchaseQuery,
  usePurchasesQuery,
  useSuppliersQuery,
} from '@/lib/queries/use-purchases'
import { useInvalidateCatalog } from '@/lib/queries/use-catalog'
import { PurchaseDetailDrawer } from './purchase-detail'
import { PurchaseFormModal } from './purchase-form-modal'
import { SupplierFormModal } from './supplier-form-modal'
import { ProcurementImportModal } from './procurement-import-modal'
import { SuppliersPanel } from './suppliers'
import type { Supplier } from '@/lib/purchases-api'
import { useAuth } from '@/lib/auth-context'
import { canManagePurchases, canManageSuppliers } from '@/lib/rbac'

function formatDate(iso: string): string {
  return new Date(iso + (iso.includes('T') ? '' : 'T00:00:00')).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

export function Purchases({
  prefillQuery,
  prefillKey,
  onPrefillConsumed,
}: {
  prefillQuery?: string
  prefillKey?: number
  onPrefillConsumed?: () => void
} = {}) {
  const toast = useToast()
  const { user } = useAuth()
  const canManage = canManagePurchases(user)
  const canSuppliers = canManageSuppliers(user)
  const invalidatePurchases = useInvalidatePurchases()
  const invalidateSuppliers = useInvalidateSuppliers()
  const invalidateCatalog = useInvalidateCatalog()
  const suppliersQuery = useSuppliersQuery()
  const suppliers = suppliersQuery.data ?? []

  const [q, setQ] = useState('')
  const [supplierId, setSupplierId] = useState('')
  const [status, setStatus] = useState('all')
  const [page, setPage] = useState(0)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [tab, setTab] = useState<'bills' | 'suppliers'>('bills')
  const [supplierFormOpen, setSupplierFormOpen] = useState(false)
  const [editSupplier, setEditSupplier] = useState<Supplier | null>(null)
  const [importKind, setImportKind] = useState<'suppliers' | 'purchases' | null>(null)
  const [actionBusy, setActionBusy] = useState(false)

  useEffect(() => {
    if (tab === 'suppliers' && !canSuppliers) setTab('bills')
  }, [tab, canSuppliers])

  const statusApi = STATUS_FILTERS.find(f => f.value === status)?.api ?? 'all'

  useEffect(() => {
    if (!prefillQuery || prefillKey == null) return
    setQ(prefillQuery)
    setPage(0)
    onPrefillConsumed?.()
  }, [prefillKey, prefillQuery, onPrefillConsumed])

  const purchasesQuery = usePurchasesQuery(q, statusApi, supplierId, page)
  const kpisQuery = usePurchaseKpisQuery()
  const detailQuery = usePurchaseQuery(selectedId)

  const rows = purchasesQuery.data?.items ?? []
  const totalPages = purchasesQuery.data?.totalPages ?? 1
  const total = purchasesQuery.data?.totalElements ?? rows.length

  const kpis = useMemo(() => {
    const all = kpisQuery.data?.items ?? []
    const billed = all.filter(p => p.status === 'BILLED')
    const paid = all.filter(p => p.status === 'PAID')
    return {
      totalValue: all.reduce((s, p) => s + p.grandTotal, 0),
      awaiting: billed.reduce((s, p) => s + p.grandTotal, 0),
      awaitingCount: billed.length,
      paidValue: paid.reduce((s, p) => s + p.grandTotal, 0),
    }
  }, [kpisQuery.data])

  const statusCounts = useMemo(() => {
    const all = kpisQuery.data?.items ?? []
    return {
      all: all.length,
      draft: all.filter(p => p.status === 'DRAFT').length,
      pending: all.filter(p => p.status === 'PENDING_GRN').length,
      billed: all.filter(p => p.status === 'BILLED').length,
      paid: all.filter(p => p.status === 'PAID').length,
    }
  }, [kpisQuery.data])

  const runAction = async (fn: () => Promise<unknown>, success: string) => {
    setActionBusy(true)
    try {
      await fn()
      invalidatePurchases()
      invalidateCatalog.products()
      toast(success, { icon: 'check' })
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Action failed', { tone: 'danger' })
    } finally {
      setActionBusy(false)
    }
  }

  return (
    <div className="content-pad" style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 1480, margin: '0 auto' }}>
      <div className="row" style={{ justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div className="section-title">Purchases</div>
          <div className="section-sub">Supplier bills · stock in on GRN receive</div>
        </div>
        {(canManage || canSuppliers) && (
        <div className="row gap8" style={{ flexWrap: 'wrap' }}>
          {tab === 'bills' ? (
            canManage && (
            <>
              <Button size="sm" variant="outline" icon="upload" onClick={() => setImportKind('purchases')}>
                Bulk record
              </Button>
              <Button size="sm" variant="primary" icon="plus" onClick={() => setFormOpen(true)}>
                Record purchase
              </Button>
            </>
            )
          ) : (
            canSuppliers && (
            <>
              <Button size="sm" variant="outline" icon="upload" onClick={() => setImportKind('suppliers')}>
                Import suppliers
              </Button>
              <Button size="sm" variant="primary" icon="plus" onClick={() => { setEditSupplier(null); setSupplierFormOpen(true) }}>
                Add supplier
              </Button>
            </>
            )
          )}
        </div>
        )}
      </div>

      <div className="kpi-grid">
        <KpiCard label="Purchase value" value={money(kpis.totalValue)} icon="shopping-bag" tone="tile-primary" />
        <KpiCard label="Awaiting payment" value={money(kpis.awaiting)} icon="hourglass" tone="tile-warning" vs={`${kpis.awaitingCount} billed`} />
        <KpiCard label="Paid" value={money(kpis.paidValue)} icon="badge-check" tone="tile-success" />
        <KpiCard label="Suppliers" value={String(suppliers.length)} icon="truck" tone="tile-info" />
      </div>

      <div className="chips" style={{ marginBottom: 2 }}>
        <button type="button" className={'chip' + (tab === 'bills' ? ' on' : '')} onClick={() => setTab('bills')}>
          Purchase bills
        </button>
        {canSuppliers && (
        <button type="button" className={'chip' + (tab === 'suppliers' ? ' on' : '')} onClick={() => setTab('suppliers')}>
          Suppliers
          <span className="ct">{suppliers.length}</span>
        </button>
        )}
      </div>

      {tab === 'suppliers' && canSuppliers ? (
        <SuppliersPanel
          canManage={canSuppliers}
          onInvalidate={invalidateSuppliers}
          onAddSupplier={() => { setEditSupplier(null); setSupplierFormOpen(true) }}
          onImportSuppliers={() => setImportKind('suppliers')}
        />
      ) : (
      <Card noBody>
        <div className="filter-toolbar">
          <div style={{ width: 260 }}>
            <TextInput
              size="sm"
              icon="search"
              placeholder="Search purchase no…"
              value={q}
              onChange={v => { setQ(v); setPage(0) }}
            />
          </div>
          <Select
            size="sm"
            width={220}
            value={supplierId}
            onChange={v => { setSupplierId(v); setPage(0) }}
            options={[
              { value: '', label: 'All suppliers' },
              ...suppliers.map(s => ({ value: s.id, label: s.name })),
            ]}
          />
          <div style={{ flex: 1 }} />
          <div className="chips">
            {STATUS_FILTERS.map(f => (
              <button
                key={f.value}
                type="button"
                className={'chip' + (status === f.value ? ' on' : '')}
                onClick={() => { setStatus(f.value); setPage(0) }}
              >
                {f.label}
                <span className="ct">{statusCounts[f.value as keyof typeof statusCounts] ?? 0}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="tbl-wrap">
          <table className="tbl tbl-clickable">
            <thead>
              <tr>
                <th>Purchase No.</th>
                <th>Supplier</th>
                <th>Bill date</th>
                <th className="num">Items</th>
                <th className="num">Amount</th>
                <th>Due</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {purchasesQuery.isLoading && rows.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '40px 0' }}>
                    <Icon name="loader" size={20} />
                  </td>
                </tr>
              ) : purchasesQuery.error ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '40px 0', color: 'var(--danger-fg)' }}>
                    {purchasesQuery.error.message}
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '40px 0', color: 'var(--fg-subtle)', fontSize: 13 }}>
                    No purchases yet.{canManage ? <> Click <b>Record purchase</b> to create your first supplier bill.</> : null}
                  </td>
                </tr>
              ) : rows.map(p => (
                <tr key={p.id} onClick={() => setSelectedId(p.id)}>
                  <td className="mono td-strong" style={{ fontSize: 12.5 }}>{p.purchaseNo}</td>
                  <td>
                    <div className="row gap10">
                      <IconTile tone="tile-info" size={30} icon="truck" />
                      <span className="td-strong">{p.supplierName}</span>
                    </div>
                  </td>
                  <td className="muted tnum">{formatDate(p.billDate)}</td>
                  <td className="num tnum">{p.itemCount}</td>
                  <td className="num tnum td-strong">{money(p.grandTotal)}</td>
                  <td className="muted tnum">{p.dueDate ? formatDate(p.dueDate) : '—'}</td>
                  <td><Badge tone={statusTone(p.status)} dot>{statusLabel(p.status)}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="row" style={{ justifyContent: 'space-between', padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
          <span className="muted" style={{ fontSize: 12.5 }}>
            {total} purchase{total === 1 ? '' : 's'}
            {totalPages > 1 && ` · page ${page + 1} of ${totalPages}`}
          </span>
          {totalPages > 1 && (
            <div className="row gap8">
              <Button size="sm" variant="outline" disabled={page <= 0} onClick={() => setPage(p => p - 1)}>Previous</Button>
              <Button size="sm" variant="outline" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Next</Button>
            </div>
          )}
        </div>
      </Card>
      )}

      {canManage && formOpen && (
        <PurchaseFormModal
          suppliers={suppliers}
          onClose={() => setFormOpen(false)}
          onAddSupplier={() => setSupplierFormOpen(true)}
          onCreated={id => {
            invalidatePurchases()
            setSelectedId(id)
            toast('Purchase draft created', { icon: 'file-plus' })
          }}
        />
      )}

      {canSuppliers && (supplierFormOpen || editSupplier) && (
        <SupplierFormModal
          supplier={editSupplier}
          onClose={() => { setSupplierFormOpen(false); setEditSupplier(null) }}
          onSaved={() => {
            invalidateSuppliers()
            toast(editSupplier ? 'Supplier updated' : 'Supplier added', { icon: 'truck' })
          }}
        />
      )}

      {(importKind === 'suppliers' ? canSuppliers : canManage) && importKind && (
        <ProcurementImportModal
          kind={importKind}
          suppliers={importKind === 'purchases' ? suppliers : undefined}
          onClose={() => setImportKind(null)}
          onAddSupplier={importKind === 'purchases' ? () => setSupplierFormOpen(true) : undefined}
          onComplete={() => {
            if (importKind === 'suppliers') invalidateSuppliers()
            else invalidatePurchases()
          }}
        />
      )}

      {selectedId && (
        <PurchaseDetailDrawer
          purchase={detailQuery.data ?? null}
          loading={detailQuery.isLoading}
          error={detailQuery.error?.message}
          busy={actionBusy}
          onClose={() => setSelectedId(null)}
          onConfirm={canManage && detailQuery.data?.status === 'DRAFT'
            ? () => runAction(() => confirmPurchase(selectedId), 'Order confirmed — awaiting delivery')
            : undefined}
          onReceive={canManage && (detailQuery.data?.status === 'DRAFT' || detailQuery.data?.status === 'PENDING_GRN')
            ? () => runAction(() => receivePurchase(selectedId), 'GRN received · stock updated')
            : undefined}
          onPay={canManage && detailQuery.data?.status === 'BILLED'
            ? () => runAction(() => payPurchase(selectedId), 'Marked as paid')
            : undefined}
        />
      )}
    </div>
  )
}
