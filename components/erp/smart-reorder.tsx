'use client'

import { useEffect, useState } from 'react'
import { Button, Card, ContentLoader, Field, Icon, KpiCard, Modal, Select, TextInput, useToast } from './ui'
import { money, stockStatus, type Product } from '@/lib/erp-data'
import { createPurchase, type Supplier } from '@/lib/purchases-api'
import { useProductsQuery } from '@/lib/queries/use-catalog'
import { useInvalidatePurchases, useSuppliersQuery } from '@/lib/queries/use-purchases'
import { useAuth } from '@/lib/auth-context'
import { canManagePurchases } from '@/lib/rbac'

type ReorderLine = { product: Product; quantity: string }

function todayIsoDate() {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function CreateReorderModal({ products, suppliers, onClose }: { products: Product[]; suppliers: Supplier[]; onClose: () => void }) {
  const toast = useToast()
  const invalidatePurchases = useInvalidatePurchases()
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id ?? '')
  const [lines, setLines] = useState<ReorderLine[]>(() => products.map(product => ({
    product,
    quantity: String(Math.max(product.reorder - product.stock, product.unit === 'kg' ? 0.5 : 1)),
  })))
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!supplierId && suppliers[0]) setSupplierId(suppliers[0].id)
  }, [supplierId, suppliers])

  async function createDraft() {
    if (!supplierId) return toast('Choose a supplier before creating the purchase order', { icon: 'alert-circle' })
    const items = lines.map(line => ({
      productId: line.product.id,
      quantity: Number(line.quantity),
      rate: line.product.cost > 0 ? line.product.cost : line.product.price,
    })).filter(line => Number.isFinite(line.quantity) && line.quantity > 0 && line.rate > 0)
    if (!items.length) return toast('Keep at least one item with a quantity to order', { icon: 'alert-circle' })
    setBusy(true)
    try {
      const purchase = await createPurchase({ supplierId, billDate: todayIsoDate(), notes: 'Smart reorder suggestion', items })
      invalidatePurchases()
      toast(`Draft purchase order ${purchase.purchaseNo} created`, { icon: 'file-check' })
      onClose()
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not create the purchase order', { icon: 'alert-circle' })
    } finally { setBusy(false) }
  }

  return <Modal title="Create smart reorder" sub="Suggestions replenish each item to its configured reorder level" icon="shopping-cart" wide onClose={onClose}
    footer={<><Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button><Button variant="primary" icon="file-plus" onClick={() => void createDraft()} disabled={busy || !lines.length}>{busy ? 'Creating…' : 'Create draft purchase order'}</Button></>}>
    {!suppliers.length ? <div className="alert-banner danger"><Icon name="alert-circle" size={16} /><span>Add a supplier before creating a purchase order.</span></div> : <div style={{ maxWidth: 460, marginBottom: 16 }}><Field label="Supplier" required><Select value={supplierId} onChange={setSupplierId} placeholder="Search supplier" options={suppliers.map(supplier => ({ value: supplier.id, label: supplier.name, sub: supplier.phone || undefined }))} /></Field></div>}
    <div className="tbl-wrap" style={{ border: '1px solid var(--border)', borderRadius: 10 }}><table className="tbl"><thead><tr><th>Product</th><th className="num">On hand</th><th className="num">Reorder level</th><th style={{ width: 150 }}>Order quantity</th><th style={{ width: 42 }} /></tr></thead><tbody>
      {lines.map(line => <tr key={line.product.id}><td><div className="cell-stack"><span className="td-strong">{line.product.name}</span><span className="td-sub mono">{line.product.sku}</span></div></td><td className="num tnum">{line.product.stock} {line.product.unit}</td><td className="num tnum muted">{line.product.reorder} {line.product.unit}</td><td><TextInput size="sm" type="number" min="0" step={line.product.unit === 'kg' ? '0.001' : '1'} value={line.quantity} onChange={quantity => setLines(current => current.map(entry => entry.product.id === line.product.id ? { ...entry, quantity } : entry))} /></td><td><button className="icon-btn" aria-label={`Remove ${line.product.name}`} onClick={() => setLines(current => current.filter(entry => entry.product.id !== line.product.id))}><Icon name="x" size={16} /></button></td></tr>)}
    </tbody></table></div>
    <p className="muted" style={{ fontSize: 12.5, marginTop: 12 }}>This creates a draft only. Stock increases only after the purchase order is received through GRN.</p>
  </Modal>
}

export function SmartReorderWorkspace() {
  const { user } = useAuth()
  const canManage = canManagePurchases(user)
  const [hasSearched, setHasSearched] = useState(false)
  const [open, setOpen] = useState(false)
  const productsQuery = useProductsQuery(hasSearched || open)
  const suppliersQuery = useSuppliersQuery(canManage && open)
  const products = (productsQuery.data ?? []).filter(product => stockStatus(product) !== 'in' && product.reorder > 0)
  const lowStock = products.filter(product => product.stock > 0)
  const outOfStock = products.filter(product => product.stock <= 0)
  const suggestedValue = products.reduce((total, product) => total + Math.max(product.reorder - product.stock, product.unit === 'kg' ? 0.5 : 1) * (product.cost > 0 ? product.cost : product.price), 0)

  if (!canManage) return <div className="content-pad page-shell"><div className="empty" style={{ minHeight: 300 }}><div className="ei"><Icon name="lock-keyhole" size={22} /></div><div style={{ fontWeight: 650 }}>Purchase access required</div><div>Ask an administrator for purchase-management access to create reorder drafts.</div></div></div>

  return <div className="content-pad page-shell compact">
    <div className="page-header"><div className="page-header-main"><div className="section-title">Reorder suggestions</div><div className="section-sub">Low-stock items ready to replenish from a supplier</div></div>{hasSearched && products.length > 0 && <Button size="sm" variant="primary" icon="shopping-cart" onClick={() => setOpen(true)}>Create reorder</Button>}</div>
    <div className="kpi-grid procurement-status-grid">
      <KpiCard label="Items to reorder" value={String(hasSearched ? products.length : 0)} icon="package-search" tone="tile-primary" />
      <KpiCard label="Low stock" value={String(hasSearched ? lowStock.length : 0)} icon="alert-triangle" tone="tile-warning" />
      <KpiCard label="Out of stock" value={String(hasSearched ? outOfStock.length : 0)} icon="circle-x" tone="tile-danger" />
      <KpiCard label="Suggested value" value={hasSearched ? money(suggestedValue) : money(0)} icon="wallet" tone="tile-success" />
    </div>
    <Card noBody>
      <div className="filter-toolbar"><div style={{ flex: 1 }} /><Button size="sm" variant="primary" icon="search" onClick={() => { if (hasSearched) void productsQuery.refetch(); else setHasSearched(true) }} disabled={productsQuery.isFetching}>{productsQuery.isFetching ? 'Searching…' : 'Search'}</Button></div>
      {!hasSearched ? <div className="empty" style={{ minHeight: 280 }}><div className="ei"><Icon name="search" size={22} /></div><div style={{ fontWeight: 650 }}>Search reorder suggestions</div><div>Click Search to calculate the items that need replenishment.</div></div> : productsQuery.isLoading || productsQuery.isFetching ? <ContentLoader /> : productsQuery.error ? <div className="empty" style={{ minHeight: 250 }}>Could not load inventory suggestions.</div> : products.length === 0 ? <div className="empty" style={{ minHeight: 280 }}><div className="ei"><Icon name="circle-check" size={22} /></div><div style={{ fontWeight: 650 }}>No products need reordering</div><div>Items will appear here when their stock reaches the configured reorder level.</div></div> : <div className="tbl-wrap"><table className="tbl"><thead><tr><th>Product</th><th className="num">On hand</th><th className="num">Reorder level</th><th className="num">Suggested order</th><th>Status</th></tr></thead><tbody>{products.map(product => { const suggested = Math.max(product.reorder - product.stock, product.unit === 'kg' ? 0.5 : 1); return <tr key={product.id}><td><div className="cell-stack"><span className="td-strong">{product.name}</span><span className="td-sub mono">{product.sku}</span></div></td><td className="num tnum">{product.stock} {product.unit}</td><td className="num tnum muted">{product.reorder} {product.unit}</td><td className="num tnum td-strong">{suggested} {product.unit}</td><td><span className="badge warning">{product.stock <= 0 ? 'Out of stock' : 'Low stock'}</span></td></tr> })}</tbody></table></div>}
    </Card>
    {open && <CreateReorderModal products={products} suppliers={suppliersQuery.data ?? []} onClose={() => setOpen(false)} />}
  </div>
}
