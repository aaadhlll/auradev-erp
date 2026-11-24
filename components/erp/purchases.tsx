'use client'

import { useEffect, useState } from 'react'
import { Icon, Button, Badge, KpiCard, Card, Select, TextInput, IconTile, ContentLoader, Field, Modal, useToast } from './ui'
import { money } from '@/lib/erp-data'
import {
  confirmPurchase,
  payPurchase,
  receivePurchase,
  cancelPurchase,
  deletePurchase,
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
import { PurchasePaymentModal } from './purchase-payment-modal'
import { SupplierSettlementModal } from './supplier-settlement-modal'
import { SupplierPaymentHistoryModal } from './supplier-payment-history-modal'
import { ProcurementImportModal } from './procurement-import-modal'
import { SuppliersPanel } from './suppliers'
import type { Supplier } from '@/lib/purchases-api'
import { useAuth } from '@/lib/auth-context'
import { canAccessView, canManagePurchases, canManageSuppliers } from '@/lib/rbac'
import { ConfirmDeleteModal } from './confirm-delete-modal'
import { SmartReorderWorkspace } from './smart-reorder'
import { PurchaseReturnModal } from './purchase-return-modal'
import { PurchaseReturnsPage } from './purchase-returns'
import { GrnReceiveModal } from './grn-receive-modal'

function formatDate(iso: string): string {
  return new Date(iso + (iso.includes('T') ? '' : 'T00:00:00')).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

export type ProcurementSectionId = 'suppliers' | 'purchase-orders' | 'purchase-receipts' | 'purchase-returns' | 'reorder'

export function Purchases({
  prefillQuery,
  prefillKey,
  onPrefillConsumed,
  openPurchaseId,
  onOpenPurchaseConsumed,
  section = 'purchase-orders',
}: {
  prefillQuery?: string
  prefillKey?: number
  onPrefillConsumed?: () => void
  openPurchaseId?: string | null
  onOpenPurchaseConsumed?: () => void
  section?: ProcurementSectionId
} = {}) {
  const toast = useToast()
  const { user } = useAuth()
  const canManage = canManagePurchases(user)
  const canSuppliers = canManageSuppliers(user)
  const canViewSuppliers = canAccessView(user, 'purchases')
  const invalidatePurchases = useInvalidatePurchases()
  const invalidateSuppliers = useInvalidateSuppliers()
  const invalidateCatalog = useInvalidateCatalog()
  const [q, setQ] = useState('')
  const [supplierId, setSupplierId] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [appliedFilters, setAppliedFilters] = useState({ q: '', supplierId: '', statusFilter: 'all' })
  const [hasSearched, setHasSearched] = useState(false)
  const [supplierLookupOpen, setSupplierLookupOpen] = useState(false)
  const [page, setPage] = useState(0)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [directReceipt, setDirectReceipt] = useState(false)
  const [supplierFormOpen, setSupplierFormOpen] = useState(false)
  const [editSupplier, setEditSupplier] = useState<Supplier | null>(null)
  const [importKind, setImportKind] = useState<'suppliers' | 'purchases' | null>(null)
  const [actionBusy, setActionBusy] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [returnOpen, setReturnOpen] = useState(false)
  const [grnOpen, setGrnOpen] = useState(false)
  const [settlementSupplier, setSettlementSupplier] = useState<Supplier | null>(null)
  const [historySupplier, setHistorySupplier] = useState<Supplier | null>(null)

  const isSuppliers = section === 'suppliers'
  const isPurchaseOrders = section === 'purchase-orders'
  const sectionStatus = isPurchaseOrders ? 'orders' : section === 'purchase-receipts' ? 'receipts' : 'all'
  const statusApi = appliedFilters.statusFilter === 'all' ? sectionStatus : appliedFilters.statusFilter
  const suppliersQuery = useSuppliersQuery(hasSearched || formOpen || supplierFormOpen || supplierLookupOpen)
  const suppliers = suppliersQuery.data ?? []

  useEffect(() => {
    setPage(0)
    setStatusFilter('all')
    setAppliedFilters({ q: '', supplierId: '', statusFilter: 'all' })
    setHasSearched(false)
  }, [section])

  useEffect(() => {
    if (!prefillQuery || prefillKey == null) return
    setQ(prefillQuery)
    setPage(0)
    setAppliedFilters(current => ({ ...current, q: prefillQuery }))
    setHasSearched(true)
    onPrefillConsumed?.()
  }, [prefillKey, prefillQuery, onPrefillConsumed])

  useEffect(() => {
    if (!openPurchaseId) return
    setSelectedId(openPurchaseId)
    setHasSearched(true)
    onOpenPurchaseConsumed?.()
  }, [openPurchaseId, onOpenPurchaseConsumed])

  const purchasesQuery = usePurchasesQuery(appliedFilters.q, statusApi, appliedFilters.supplierId, page, !isSuppliers && hasSearched)
  const kpisQuery = usePurchaseKpisQuery(!isSuppliers && hasSearched)
  const detailQuery = usePurchaseQuery(selectedId)

  const rows = purchasesQuery.data?.items ?? []
  const initialLoading = purchasesQuery.isLoading && rows.length === 0
  const totalPages = purchasesQuery.data?.totalPages ?? 1
  const total = purchasesQuery.data?.totalElements ?? rows.length

  const kpis = kpisQuery.data ?? {
    totalValue: 0, awaitingValue: 0, awaitingCount: 0, paidValue: 0,
    totalOrders: 0, draftCount: 0, pendingCount: 0, completedCount: 0, cancelledCount: 0,
  }

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

  const selectStatus = (value: string) => {
    setStatusFilter(value)
    setPage(0)
  }

  const runSearch = () => {
    setPage(0)
    setAppliedFilters({ q, supplierId, statusFilter })
    setHasSearched(true)
  }

  if (section === 'reorder') return <SmartReorderWorkspace />
  if (section === 'purchase-returns') return <PurchaseReturnsPage />

  return (
    <div className="content-pad page-shell">
      <div className="page-header">
        <div className="page-header-main">
          <div className="section-title">{isSuppliers ? 'Supplier master' : isPurchaseOrders ? 'Purchase orders' : 'Purchase receipts'}</div>
          <div className="section-sub">{isSuppliers ? 'Supplier contacts and purchasing details' : isPurchaseOrders ? 'All purchase orders from draft to completed' : 'Awaiting GRN and received purchase history'}</div>
        </div>
        {(canManage || canSuppliers) && (
        <div className="row gap8 page-header-actions" style={{ flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {isPurchaseOrders ? (
            canManage && (
            <>
              <Button size="sm" variant="outline" icon="upload" onClick={() => setImportKind('purchases')}>
                Bulk record
              </Button>
              <Button size="sm" variant="primary" icon="plus" onClick={() => { setDirectReceipt(false); setFormOpen(true) }}>
                Create new
              </Button>
            </>
            )
          ) : isSuppliers ? (
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
          ) : section === 'purchase-receipts' && canManage ? (
            <Button size="sm" variant="primary" icon="plus" onClick={() => { setDirectReceipt(true); setFormOpen(true) }}>Create direct purchase</Button>
          ) : null}
        </div>
        )}
      </div>

      {!isSuppliers && (
        <div className="kpi-grid procurement-status-grid">
          {isPurchaseOrders ? <>
            <KpiCard label="Total orders" value={String(hasSearched ? kpis.totalOrders : 0)} icon="files" tone="tile-primary" vs={hasSearched ? `${money(kpis.totalValue)} value` : undefined} active={statusFilter === 'all'} onClick={() => selectStatus('all')} />
            <KpiCard label="New drafts" value={String(hasSearched ? kpis.draftCount : 0)} icon="file-pen-line" tone="tile-info" active={statusFilter === 'DRAFT'} onClick={() => selectStatus('DRAFT')} />
            <KpiCard label="Awaiting delivery" value={String(hasSearched ? kpis.pendingCount : 0)} icon="truck" tone="tile-warning" active={statusFilter === 'PENDING_GRN'} onClick={() => selectStatus('PENDING_GRN')} />
            <KpiCard label="Completed" value={String(hasSearched ? kpis.completedCount : 0)} icon="badge-check" tone="tile-success" vs={hasSearched && kpis.cancelledCount ? `${kpis.cancelledCount} cancelled` : undefined} active={statusFilter === 'completed'} onClick={() => selectStatus('completed')} />
          </> : <>
            <KpiCard label="All receipts" value={String(hasSearched ? kpis.pendingCount + kpis.completedCount : 0)} icon="files" tone="tile-primary" active={statusFilter === 'all'} onClick={() => selectStatus('all')} />
            <KpiCard label="Awaiting delivery" value={String(hasSearched ? kpis.pendingCount : 0)} icon="truck" tone="tile-warning" active={statusFilter === 'PENDING_GRN'} onClick={() => selectStatus('PENDING_GRN')} />
            <KpiCard label="Fully received" value={String(hasSearched ? kpis.completedCount : 0)} icon="package-check" tone="tile-success" active={statusFilter === 'completed'} onClick={() => selectStatus('completed')} />
            <KpiCard label="Awaiting payment" value={hasSearched ? money(kpis.awaitingValue) : money(0)} icon="hourglass" tone="tile-info" active={statusFilter === 'BILLED'} onClick={() => selectStatus('BILLED')} vs={hasSearched ? `${kpis.awaitingCount} bills` : undefined} />
          </>}
        </div>
      )}

      {isSuppliers && canViewSuppliers ? (
        <SuppliersPanel
          canManage={canSuppliers}
          onInvalidate={invalidateSuppliers}
          onSettleSupplier={canManage ? setSettlementSupplier : undefined}
          onPaymentHistory={canManage ? setHistorySupplier : undefined}
        />
      ) : (
      <Card noBody className="procurement-ledger">
        {initialLoading ? (
          <ContentLoader />
        ) : (
        <>
        <div className="filter-toolbar">
          <div className="toolbar-field">
            <TextInput
              size="sm"
              icon="search"
              placeholder="Search purchase order ID…"
              value={q}
              onChange={v => setQ(v)}
            />
          </div>
          <Select
            size="sm"
            width={220}
            value={supplierId}
            onChange={v => setSupplierId(v)}
            options={[
              { value: '', label: 'All suppliers' },
              ...suppliers.map(s => ({ value: s.id, label: s.name })),
            ]}
            onOpenChange={open => { if (open) setSupplierLookupOpen(true) }}
          />
          <Select
            size="sm"
            width={170}
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: 'all', label: 'All statuses' },
              ...(isPurchaseOrders ? [{ value: 'DRAFT', label: 'Draft' }] : []),
              { value: 'PENDING_GRN', label: 'Pending GRN' },
              { value: 'completed', label: 'Completed' },
              ...(isPurchaseOrders ? [{ value: 'CANCELLED', label: 'Cancelled' }] : []),
              { value: 'BILLED', label: 'Billed' },
              { value: 'PAID', label: 'Paid' },
            ]}
          />
          <Button size="sm" variant="primary" icon="search" onClick={runSearch} disabled={purchasesQuery.isFetching}>{purchasesQuery.isFetching ? 'Searching…' : 'Search'}</Button>
          <div style={{ flex: 1 }} />
        </div>

        <div className="tbl-wrap">
          <table className="tbl tbl-clickable">
            <thead>
              <tr>
                <th>Purchase No.</th>
                <th>{isPurchaseOrders ? 'Vendor' : 'Supplier'}</th>
                <th>Transaction date</th>
                <th className="num">Items</th>
                <th className="num">Amount</th>
                <th>Due</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {!hasSearched ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: '48px 0', color: 'var(--fg-subtle)', fontSize: 13 }}><Icon name="search" size={18} style={{ marginBottom: 8 }} /><div style={{ fontWeight: 600, color: 'var(--fg)', marginBottom: 3 }}>Search {isPurchaseOrders ? 'purchase orders' : 'purchase receipts'}</div><div>Choose filters if needed, then click Search to load records.</div></td></tr>
              ) : purchasesQuery.error ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '40px 0', color: 'var(--danger-fg)' }}>
                    {purchasesQuery.error.message}
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '40px 0', color: 'var(--fg-subtle)', fontSize: 13 }}>
                    {isPurchaseOrders
                      ? <>No purchase orders yet.{canManage ? <> Click <b>Record purchase</b> to create one.</> : null}</>
                      : 'No pending or completed purchase receipts yet.'}
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
        </>
        )}
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
            if (directReceipt) {
              setDirectReceipt(false)
              void confirmPurchase(id).then(() => {
                invalidatePurchases()
                setGrnOpen(true)
                toast('Purchase confirmed — enter received quantities', { icon: 'package-check' })
              }).catch(error => toast(error instanceof Error ? error.message : 'Could not prepare direct purchase', { tone: 'danger' }))
            } else {
              toast('Purchase draft created', { icon: 'file-plus' })
            }
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
          onReceive={canManage && section === 'purchase-receipts' && detailQuery.data?.status === 'PENDING_GRN'
            ? () => setGrnOpen(true)
            : undefined}
          onCancel={canManage && detailQuery.data?.status === 'PENDING_GRN'
            ? () => { setCancelReason(''); setCancelOpen(true) }
            : undefined}
          onPay={canManage && detailQuery.data?.status === 'BILLED'
            ? () => setPaymentOpen(true)
            : undefined}
          onReturn={canManage && (detailQuery.data?.status === 'BILLED' || detailQuery.data?.status === 'PAID')
            ? () => setReturnOpen(true)
            : undefined}
          onDelete={canManage && detailQuery.data?.status === 'DRAFT'
            ? () => setDeleteOpen(true)
            : undefined}
        />
      )}

      {paymentOpen && detailQuery.data && <PurchasePaymentModal purchase={detailQuery.data} onClose={() => setPaymentOpen(false)} onSaved={() => invalidatePurchases()} />}
      {returnOpen && detailQuery.data && <PurchaseReturnModal purchase={detailQuery.data} onClose={() => setReturnOpen(false)} onSaved={() => { invalidatePurchases(); invalidateCatalog.products() }} />}
      {grnOpen && detailQuery.data && <GrnReceiveModal purchase={detailQuery.data} onClose={() => setGrnOpen(false)} onSaved={() => { invalidatePurchases(); invalidateCatalog.products() }} />}
      {settlementSupplier && <SupplierSettlementModal supplier={settlementSupplier} onClose={() => setSettlementSupplier(null)} onSaved={() => invalidatePurchases()} />}
      {historySupplier && <SupplierPaymentHistoryModal supplier={historySupplier} onClose={() => setHistorySupplier(null)} />}

      {cancelOpen && detailQuery.data && (
        <Modal
          title="Cancel purchase order"
          sub={`${detailQuery.data.purchaseNo} · no stock has been received`}
          icon="x-circle"
          onClose={() => !actionBusy && setCancelOpen(false)}
          footer={<>
            <Button variant="outline" disabled={actionBusy} onClick={() => setCancelOpen(false)}>Keep order</Button>
            <Button variant="danger-soft" icon="x-circle" disabled={actionBusy || !cancelReason.trim()} onClick={() => {
              if (!selectedId) return
              void (async () => {
                setActionBusy(true)
                try {
                  await cancelPurchase(selectedId, cancelReason.trim())
                  invalidatePurchases()
                  invalidateCatalog.products()
                  setCancelOpen(false)
                  setSelectedId(null)
                  toast('Purchase order cancelled — no stock was changed', { icon: 'check' })
                } catch (e) {
                  toast(e instanceof Error ? e.message : 'Could not cancel purchase order', { tone: 'danger' })
                } finally {
                  setActionBusy(false)
                }
              })()
            }}>Cancel order</Button>
          </>}
        >
          <div className="td-sub" style={{ marginBottom: 14 }}>
            This is only available before a GRN is received. The cancellation is recorded in the activity log.
          </div>
          <Field label="Cancellation reason" required>
            <TextInput value={cancelReason} onChange={setCancelReason} placeholder="Supplier cancelled delivery, duplicate order…" />
          </Field>
        </Modal>
      )}

      <ConfirmDeleteModal
        open={deleteOpen}
        title="Delete draft purchase?"
        sub={detailQuery.data ? `${detailQuery.data.purchaseNo} · ${detailQuery.data.supplierName}` : undefined}
        onClose={() => !actionBusy && setDeleteOpen(false)}
        busy={actionBusy}
        onConfirm={async () => {
          if (!selectedId) return
          setActionBusy(true)
          try {
            await deletePurchase(selectedId)
            invalidatePurchases()
            setDeleteOpen(false)
            setSelectedId(null)
            toast('Draft purchase deleted', { icon: 'trash-2' })
          } catch (e) {
            toast(e instanceof Error ? e.message : 'Could not delete purchase', { tone: 'danger' })
          } finally {
            setActionBusy(false)
          }
        }}
      />
    </div>
  )
}
