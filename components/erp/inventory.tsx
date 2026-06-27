'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import {
  Icon, Button, Badge, Checkbox, Field, TextInput, Select, Segmented, Modal, Drawer, Card, IconTile, ContentLoader, KpiCard, useToast, useClickOutside,
} from './ui'
import { CAT_TONE, CAT_ICON, stockStatus, money, type Product } from '@/lib/erp-data'
import {
  fetchProduct, createProduct, updateProduct, adjustStock,
  fetchMovements, movementLabel, downloadProductsExport,
  type ProductFormData, type ApiCategory, type StockMovement,
} from '@/lib/inventory-api'
import { computeInventorySummary } from '@/lib/inventory-summary'
import { useProductsQuery, useCategoriesQuery, useInvalidateCatalog } from '@/lib/queries/use-catalog'
import { useTaxSettingsQuery } from '@/lib/queries/use-settings'
import { gstRateSelectOptions } from '@/lib/gst'
import { canEditInventory, canImportInventory, canExportInventory, canViewInventoryCost } from '@/lib/rbac'
import { useAuth } from '@/lib/auth-context'
import { InventoryImportModal } from './inventory-import-modal'

const STATUS_BADGE = {
  in:  { tone: 'success', label: 'In Stock' },
  low: { tone: 'warning', label: 'Low Stock' },
  out: { tone: 'danger',  label: 'Out of Stock' },
} as const

function RowMenu({ onEdit, onHistory, onAdjust }: {
  onEdit?: () => void
  onHistory: () => void
  onAdjust?: () => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useClickOutside(ref, () => setOpen(false), open)
  const canEdit = Boolean(onEdit || onAdjust)

  if (!canEdit) {
    return (
      <button className="icon-btn" style={{ width: 30, height: 30 }} onClick={onHistory} aria-label="Movement history">
        <Icon name="history" size={17} />
      </button>
    )
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button className="icon-btn" style={{ width: 30, height: 30 }} onClick={e => { e.stopPropagation(); setOpen(v => !v) }}>
        <Icon name="more-horizontal" size={17} />
      </button>
      {open && (
        <div className="popover" style={{ position: 'absolute', top: 'calc(100% + 4px)', right: 0, minWidth: 184 }}>
          {onAdjust && <button className="menu-item" onClick={() => { setOpen(false); onAdjust() }}><Icon name="package-plus" size={16} className="lead" />Quick adjust stock</button>}
          <button className="menu-item" onClick={() => { setOpen(false); onHistory() }}><Icon name="history" size={16} className="lead" />Movement history</button>
          {onEdit && <button className="menu-item" onClick={() => { setOpen(false); onEdit() }}><Icon name="pencil" size={16} className="lead" />Edit product</button>}
        </div>
      )}
    </div>
  )
}

function AdjustModal({ product, onClose, onSave }: {
  product: Product
  onClose: () => void
  onSave: (delta: number, reason: string, notes: string) => void
}) {
  const [type, setType] = useState('add')
  const [qty, setQty] = useState('')
  const [reason, setReason] = useState('grn')
  const [notes, setNotes] = useState('')
  const n = parseFloat(qty) || 0
  const result = type === 'add' ? product.stock + n : Math.max(0, product.stock - n)

  return (
    <Modal title="Adjust stock" sub={`${product.name} · ${product.sku}`} icon="package-plus" onClose={onClose}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" icon="check" disabled={n <= 0} onClick={() => onSave(type === 'add' ? n : -n, reason, notes)}>Save adjustment</Button>
      </>}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Segmented value={type} onChange={setType} options={[{ value: 'add', icon: 'plus', label: 'Add stock' }, { value: 'remove', icon: 'minus', label: 'Remove' }]} />
        <Field label="Quantity" hint={`Current on hand: ${product.stock} ${product.unit}`}>
          <TextInput type="number" value={qty} onChange={setQty} placeholder="0" icon="hash" autoFocus
            suffix={<span className="muted" style={{ fontSize: 12, fontWeight: 600 }}>{product.unit}</span>} />
        </Field>
        <Field label="Reason">
          <Select value={reason} onChange={setReason} options={[
            { value: 'grn', label: 'Goods received (GRN)', icon: 'truck' },
            { value: 'damage', label: 'Damage / wastage', icon: 'trash-2' },
            { value: 'return', label: 'Customer return', icon: 'undo-2' },
            { value: 'count', label: 'Stock count correction', icon: 'clipboard-check' },
          ]} />
        </Field>
        <Field label="Notes" optional>
          <div className="input" style={{ height: 'auto' }}>
            <textarea className="bare" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional note for the audit log" />
          </div>
        </Field>
        <div className="pay-summary">
          <div className="row" style={{ justifyContent: 'space-between', fontWeight: 700 }}>
            <span>New stock on hand</span><span className="tnum">{result} {product.unit}</span>
          </div>
        </div>
      </div>
    </Modal>
  )
}

function formatMoveDate(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  const time = d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })
  if (sameDay) return `Today ${time}`
  if (d.toDateString() === yesterday.toDateString()) return `Yesterday ${time}`
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) + ' ' + time
}

function moveTone(m: StockMovement): string {
  if (m.signedDelta > 0) return 'success'
  if (m.movementType === 'waste') return 'warning'
  return 'danger'
}

function HistoryDrawer({ product, onClose }: { product: Product; onClose: () => void }) {
  const [moves, setMoves] = useState<StockMovement[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetchMovements(product.id)
      .then(setMoves)
      .catch(() => setMoves([]))
      .finally(() => setLoading(false))
  }, [product.id])

  return (
    <Drawer title="Movement history" sub={`${product.name} · ${product.sku}`} onClose={onClose}>
      <div className="row gap12" style={{ marginBottom: 16 }}>
        <div className="kpi" style={{ flex: 1, padding: 12 }}>
          <div className="kpi-label">On hand</div>
          <div className="kpi-val tnum" style={{ fontSize: 22 }}>{product.stock} <span style={{ fontSize: 13, color: 'var(--fg-subtle)' }}>{product.unit}</span></div>
        </div>
        <div className="kpi" style={{ flex: 1, padding: 12 }}>
          <div className="kpi-label">Reorder at</div>
          <div className="kpi-val tnum" style={{ fontSize: 22 }}>{product.reorder}</div>
        </div>
      </div>
      {loading ? (
        <div className="muted" style={{ textAlign: 'center', padding: 24, fontSize: 13 }}>Loading movements…</div>
      ) : moves.length === 0 ? (
        <div className="muted" style={{ textAlign: 'center', padding: 24, fontSize: 13 }}>No stock movements yet.</div>
      ) : moves.map((m, i) => (
        <div key={m.id} className="row gap10" style={{ padding: '10px 0', borderBottom: i < moves.length - 1 ? '1px solid var(--border)' : 0 }}>
          <IconTile tone={`tile-${moveTone(m)}`} size={30} icon={m.signedDelta > 0 ? 'arrow-down-to-line' : 'arrow-up-from-line'} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{movementLabel(m.movementType)}</div>
            <div className="td-sub">{formatMoveDate(m.createdAt)}{m.notes ? ` · ${m.notes}` : ''}</div>
          </div>
          <span className="tnum" style={{ fontWeight: 700, color: m.signedDelta > 0 ? 'var(--success-fg)' : 'var(--danger-fg)' }}>
            {m.signedDelta > 0 ? '+' : ''}{m.signedDelta}
          </span>
        </div>
      ))}
    </Drawer>
  )
}

function ProductModal({ onClose, onSave, categories, initialProduct }: {
  onClose: () => void
  onSave: (f: ProductFormData) => void
  categories: ApiCategory[]
  initialProduct?: Product
}) {
  const defaultCatId = categories.find(c => c.name === initialProduct?.cat)?.id ?? categories[0]?.id ?? ''
  const [f, setF] = useState<ProductFormData>({
    name: initialProduct?.name ?? '',
    sku: initialProduct?.sku ?? '',
    barcode: initialProduct?.barcode === '—' ? '' : (initialProduct?.barcode ?? ''),
    categoryId: defaultCatId,
    unit: initialProduct?.unit ?? 'pcs',
    mrp: initialProduct ? String(initialProduct.mrp) : '',
    price: initialProduct ? String(initialProduct.price) : '',
    cost: initialProduct ? String(initialProduct.cost) : '',
    tax: initialProduct ? String(initialProduct.tax) : '5',
    reorder: initialProduct ? String(initialProduct.reorder) : '',
    stock: initialProduct ? String(initialProduct.stock) : '',
  })
  const [tried, setTried] = useState(false)
  const { data: taxSettings } = useTaxSettingsQuery()
  const taxOptions = gstRateSelectOptions(taxSettings?.enabledRates, f.tax)
  const set = (k: keyof ProductFormData) => (v: string) => setF(s => ({ ...s, [k]: v }))
  const err = (k: keyof ProductFormData) => tried && !String(f[k]).trim() ? 'Required' : null
  const valid = f.name.trim() && f.sku.trim() && f.price && f.mrp && f.categoryId
  const isEdit = Boolean(initialProduct)

  return (
    <Modal
      title={isEdit ? 'Edit product' : 'Add product'}
      sub={isEdit ? `${initialProduct!.sku} · ${initialProduct!.id}` : 'Create a new catalogue item'}
      icon={isEdit ? 'pencil' : 'plus'}
      iconTone="tile-primary"
      wide
      onClose={onClose}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" icon="check" onClick={() => { setTried(true); if (valid) onSave(f) }}>
          {isEdit ? 'Save changes' : 'Create product'}
        </Button>
      </>}
    >
      <div className="form-grid-2">
        <div style={{ gridColumn: '1 / -1' }}>
          <Field label="Product name" required error={err('name')}><TextInput value={f.name} onChange={set('name')} placeholder="e.g. Sona Masoori Rice" error={Boolean(err('name'))} /></Field>
        </div>
        <Field label="SKU" required error={err('sku')}><TextInput value={f.sku} onChange={set('sku')} placeholder="GRN-RICE-25" error={Boolean(err('sku'))} /></Field>
        <Field label="Barcode" optional><TextInput value={f.barcode} onChange={set('barcode')} placeholder="8901234500000" /></Field>
        <Field label="Category" required error={tried && !f.categoryId ? 'Required' : null}>
          <Select value={f.categoryId} onChange={set('categoryId')} options={categories.map(c => ({ value: c.id, label: c.name }))} />
        </Field>
        <Field label="Unit type"><Select value={f.unit} onChange={set('unit')} options={[{ value: 'pcs', label: 'Unit (pcs / packet)' }, { value: 'kg', label: 'Weight (kg)' }]} /></Field>
        <Field label="MRP (₹)" required error={err('mrp')}><TextInput type="number" value={f.mrp} onChange={set('mrp')} placeholder="0" error={Boolean(err('mrp'))} /></Field>
        <Field label="Selling price (₹)" required error={err('price')}><TextInput type="number" value={f.price} onChange={set('price')} placeholder="0" error={Boolean(err('price'))} /></Field>
        <Field label="Cost price (₹)" optional><TextInput type="number" value={f.cost} onChange={set('cost')} placeholder="0" /></Field>
        <Field label="GST rate"><Select value={f.tax} onChange={set('tax')} options={taxOptions} /></Field>
        <Field label="Reorder level"><TextInput type="number" value={f.reorder} onChange={set('reorder')} placeholder="0" /></Field>
        {!isEdit && <Field label="Initial stock"><TextInput type="number" value={f.stock} onChange={set('stock')} placeholder="0" /></Field>}
      </div>
    </Modal>
  )
}

export function Inventory({
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
  const canEdit = canEditInventory(user)
  const canImport = canImportInventory(user)
  const canExport = canExportInventory(user)
  const showCost = canViewInventoryCost(user)
  const invalidateCatalog = useInvalidateCatalog()
  const productsQuery = useProductsQuery()
  const categoriesQuery = useCategoriesQuery()
  const products = productsQuery.data ?? []
  const categories = categoriesQuery.data ?? []
  const loading = productsQuery.isPending || categoriesQuery.isPending
  const initialLoading = loading && products.length === 0
  const error = productsQuery.error?.message ?? categoriesQuery.error?.message ?? null
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('all')
  const [unit, setUnit] = useState('all')
  const [status, setStatus] = useState('all')
  const [sort, setSort] = useState<{ key: keyof Product; dir: 'asc' | 'desc' }>({ key: 'name', dir: 'asc' })
  const [page, setPage] = useState(0)
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [adjust, setAdjust] = useState<Product | null>(null)
  const [history, setHistory] = useState<Product | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [editProduct, setEditProduct] = useState<Product | null>(null)
  const [exporting, setExporting] = useState(false)
  const PER = 12

  const summary = useMemo(() => computeInventorySummary(products), [products])

  function refetch() {
    void productsQuery.refetch()
    void categoriesQuery.refetch()
  }

  useEffect(() => {
    if (!prefillQuery || prefillKey == null) return
    setQ(prefillQuery)
    setCat('all')
    setPage(0)
    onPrefillConsumed?.()
  }, [prefillKey, prefillQuery, onPrefillConsumed])

  const lowCount = products.filter(p => stockStatus(p) !== 'in').length

  let rows = products.filter(p => {
    if (q && !(p.name.toLowerCase().includes(q.toLowerCase()) || p.sku.toLowerCase().includes(q.toLowerCase()) || p.barcode.includes(q))) return false
    if (cat !== 'all' && p.cat !== cat) return false
    if (unit !== 'all' && p.unit !== unit) return false
    if (status !== 'all' && stockStatus(p) !== status) return false
    return true
  })
  rows = [...rows].sort((a, b) => {
    const av = a[sort.key], bv = b[sort.key]
    if (typeof av === 'string' && typeof bv === 'string')
      return av.toLowerCase().localeCompare(bv.toLowerCase()) * (sort.dir === 'asc' ? 1 : -1)
    return ((av as number) < (bv as number) ? -1 : (av as number) > (bv as number) ? 1 : 0) * (sort.dir === 'asc' ? 1 : -1)
  })

  const pages = Math.max(1, Math.ceil(rows.length / PER))
  const pageRows = rows.slice(page * PER, page * PER + PER)
  useEffect(() => { if (page >= pages) setPage(0) }, [pages, page])

  function toggleSort(key: keyof Product) {
    setSort(s => s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' })
  }

  function Th({ k, children, num }: { k: keyof Product; children: React.ReactNode; num?: boolean }) {
    return (
      <th className={`sortable${num ? ' num' : ''}`} onClick={() => toggleSort(k)}>
        <span className="th-in">{children}{sort.key === k && <Icon name={sort.dir === 'asc' ? 'arrow-up' : 'arrow-down'} size={13} />}</span>
      </th>
    )
  }

  function toggleSel(id: string) {
    setSel(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  const allOn = pageRows.length > 0 && pageRows.every(p => sel.has(p.id))
  function toggleAll() {
    setSel(s => { const n = new Set(s); if (allOn) pageRows.forEach(p => n.delete(p.id)); else pageRows.forEach(p => n.add(p.id)); return n })
  }

  async function doAdjust(delta: number, reason: string, notes: string) {
    if (!adjust) return
    const target = adjust
    try {
      await adjustStock(target.id, delta, reason, notes)
      await invalidateCatalog.products()
      setHistory(h => (h?.id === target.id ? { ...h, stock: Math.max(0, h.stock + delta) } : h))
      setAdjust(null)
      toast(`${delta > 0 ? '+' : ''}${delta} ${target.unit} · ${target.name}`, { icon: 'package-check' })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to adjust stock'
      toast(msg, { icon: 'alert-circle' })
    }
  }

  async function doAddProduct(f: ProductFormData) {
    try {
      await createProduct(f)
      await invalidateCatalog.all()
      setAddOpen(false)
      toast('Product created · ' + f.name, { icon: 'package-check' })
    } catch {
      toast('Failed to create product', { icon: 'alert-circle' })
    }
  }

  async function doUpdateProduct(f: ProductFormData) {
    if (!editProduct) return
    try {
      await updateProduct(editProduct.id, f)
      await invalidateCatalog.products()
      setEditProduct(null)
      toast('Product updated · ' + f.name, { icon: 'package-check' })
    } catch {
      toast('Failed to update product', { icon: 'alert-circle' })
    }
  }

  async function doExport(onlySelected = false) {
    setExporting(true)
    try {
      if (onlySelected && sel.size > 0) {
        const selected = products.filter(p => sel.has(p.id))
        const { triggerFileDownload } = await import('@/lib/file-download')
        const headers = showCost
          ? ['Name', 'SKU', 'Barcode', 'Category', 'Unit', 'MRP', 'Price', 'Cost', 'Stock', 'Reorder', 'Status', 'Cost Value', 'Selling Value']
          : ['Name', 'SKU', 'Barcode', 'Category', 'Unit', 'MRP', 'Price', 'Stock', 'Reorder', 'Status', 'Selling Value']
        const lines = [headers.join(',')]
        for (const p of selected) {
          const st = stockStatus(p)
          const sellingValue = p.stock * p.price
          const row = showCost
            ? [p.name, p.sku, p.barcode, p.cat, p.unit, p.mrp, p.price, p.cost, p.stock, p.reorder, st, p.stock * p.cost, sellingValue]
            : [p.name, p.sku, p.barcode, p.cat, p.unit, p.mrp, p.price, p.stock, p.reorder, st, sellingValue]
          lines.push(row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
        }
        triggerFileDownload(new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' }), 'inventory-selected.csv')
        toast(`Exported ${selected.length} selected products`, { icon: 'file-down' })
      } else {
        await downloadProductsExport({ q, category: cat, unit: unit as 'all' | 'pcs' | 'kg', status: status as 'all' | 'in' | 'low' | 'out' })
        toast(`Exported ${rows.length} products to CSV`, { icon: 'file-down' })
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Export failed', { tone: 'danger' })
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="content-pad page-shell compact">
      <div className="page-header">
        <div className="page-header-main">
          <div className="section-title">Inventory</div>
          <div className="section-sub">
            {initialLoading ? 'Loading catalog…' : `${products.length} products · ${categories.length} categories`}
          </div>
        </div>
        {(canImport || canExport || canEdit) && (
        <div className="row gap8 page-header-actions" style={{ flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {canImport && <Button size="sm" icon="upload" onClick={() => setImportOpen(true)}>Bulk import</Button>}
          {canExport && <Button size="sm" icon="download" disabled={exporting} onClick={() => void doExport(false)}>{exporting ? 'Exporting…' : 'Export'}</Button>}
          {canEdit && <Button size="sm" variant="primary" icon="plus" onClick={() => setAddOpen(true)}>Add Product</Button>}
        </div>
        )}
      </div>

      {!initialLoading && (
        <div className="kpi-grid">
          <KpiCard label="Total products" value={String(summary.totalProducts)} icon="package" tone="tile-primary" />
          {showCost ? (
            <KpiCard label="Stock value (cost)" value={money(summary.costValue)} icon="wallet" tone="tile-info" vs={`${summary.productsWithCost} with cost price`} />
          ) : (
            <KpiCard label="Units on hand" value={summary.totalUnits.toLocaleString('en-IN')} icon="layers" tone="tile-info" />
          )}
          <KpiCard label="Stock value (selling)" value={money(summary.sellingValue)} icon="indian-rupee" tone="tile-success" vs={`MRP ${money(summary.mrpValue)}`} />
          <KpiCard
            label="Stock alerts"
            value={String(summary.lowStockCount + summary.outOfStockCount)}
            icon="alert-triangle"
            tone="tile-warning"
            vs={`${summary.lowStockCount} low · ${summary.outOfStockCount} out`}
          />
        </div>
      )}

      {lowCount > 0 && (
        <div className="alert-banner">
          <Icon name="alert-triangle" size={16} />
          <span><b>{lowCount} products</b> are at or below reorder level. Review and raise purchase orders to avoid stockouts.</span>
          <div style={{ flex: 1 }} />
          <button
            className="chip"
            style={{ background: 'transparent', borderColor: 'color-mix(in oklab, var(--warning) 40%, transparent)', color: 'var(--warning-fg)' }}
            onClick={() => setStatus('low')}
          >View low stock</button>
        </div>
      )}

      <Card noBody>
        {initialLoading ? (
          <ContentLoader />
        ) : (
        <>
        <div className="filter-toolbar">
          <div className="toolbar-field">
            <div className="input sm" style={{ width: '100%' }}>
            <Icon name="search" size={14} />
            <input value={q} onChange={e => { setQ(e.target.value); setPage(0) }} placeholder="Search name, SKU or barcode" />
          </div>
          </div>
          <Select size="sm" width={150} value={cat} onChange={v => { setCat(v); setPage(0) }}
            options={[{ value: 'all', label: 'All categories' }, ...categories.map(c => ({ value: c.name, label: c.name }))]} />
          <Select size="sm" width={140} value={unit} onChange={v => { setUnit(v); setPage(0) }}
            options={[{ value: 'all', label: 'All units' }, { value: 'pcs', label: 'Unit-based' }, { value: 'kg', label: 'Weight-based' }]} />
          <Select size="sm" width={150} value={status} onChange={v => { setStatus(v); setPage(0) }}
            options={[{ value: 'all', label: 'All statuses' }, { value: 'in', label: 'In stock' }, { value: 'low', label: 'Low stock' }, { value: 'out', label: 'Out of stock' }]} />
          <div style={{ flex: 1 }} />
          {canEdit && sel.size > 0 && (
            <div className="row gap8">
              <span className="muted" style={{ fontSize: 12.5, fontWeight: 600 }}>{sel.size} selected</span>
              <Button size="sm" variant="outline" icon="package-plus" onClick={() => toast(`Bulk adjust for ${sel.size} items`)}>Adjust</Button>
              {canExport && <Button size="sm" variant="outline" icon="download" disabled={exporting} onClick={() => void doExport(true)}>Export selected</Button>}
            </div>
          )}
        </div>

        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th style={{ width: 38 }}>{canEdit ? <Checkbox checked={allOn} onChange={toggleAll} /> : null}</th>
                <Th k="name">Product</Th>
                <Th k="cat">Category</Th>
                <th>Unit</th>
                <Th k="mrp" num>MRP</Th>
                <Th k="price" num>Price</Th>
                <Th k="stock" num>Stock</Th>
                <Th k="reorder" num>Reorder</Th>
                <th>Status</th>
                <th style={{ width: 44 }}></th>
              </tr>
            </thead>
            <tbody>
              {error ? (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: '48px 0' }}>
                    <div style={{ color: 'var(--danger-fg)', marginBottom: 10, fontSize: 13 }}>{error}</div>
                    <Button size="sm" variant="outline" icon="refresh-cw" onClick={refetch}>Retry</Button>
                  </td>
                </tr>
              ) : pageRows.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: '48px 0', color: 'var(--fg-subtle)', fontSize: 13 }}>
                    No products match your filters.
                  </td>
                </tr>
              ) : pageRows.map(p => {
                const st = stockStatus(p)
                const sb = STATUS_BADGE[st]
                return (
                  <tr key={p.id} className={sel.has(p.id) ? 'selected' : ''}>
                    <td>{canEdit ? <Checkbox checked={sel.has(p.id)} onChange={() => toggleSel(p.id)} /> : null}</td>
                    <td>
                      <div className="row gap10">
                        <IconTile tone={CAT_TONE[p.cat] ?? 'tile-primary'} size={30} icon={CAT_ICON[p.cat] ?? 'package'} />
                        <div className="cell-stack">
                          <span className="td-strong">{p.name}</span>
                          <span className="td-sub mono">{p.sku} · {p.barcode}</span>
                        </div>
                      </div>
                    </td>
                    <td><Badge tone="neutral">{p.cat}</Badge></td>
                    <td className="muted">{p.unit === 'kg' ? 'Weight (kg)' : 'Unit (pcs)'}</td>
                    <td className="num tnum muted">{money(p.mrp)}</td>
                    <td className="num tnum td-strong">{money(p.price)}</td>
                    <td className="num tnum td-strong">{p.stock}</td>
                    <td className="num tnum muted">{p.reorder}</td>
                    <td><Badge tone={sb.tone} dot>{sb.label}</Badge></td>
                    <td>
                      <RowMenu
                        onHistory={() => setHistory(p)}
                        onAdjust={canEdit ? () => setAdjust(p) : undefined}
                        onEdit={canEdit ? () => setEditProduct(p) : undefined}
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="row" style={{ justifyContent: 'space-between', padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
          <span className="muted" style={{ fontSize: 12.5 }}>
            Showing {rows.length === 0 ? 0 : page * PER + 1}–{Math.min(rows.length, (page + 1) * PER)} of {rows.length}
          </span>
          <div className="row gap8">
            <Button size="sm" variant="outline" icon="chevron-left" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Prev</Button>
            <span className="muted" style={{ fontSize: 12.5, alignSelf: 'center' }}>{page + 1} / {pages}</span>
            <Button size="sm" variant="outline" iconRight="chevron-right" disabled={page >= pages - 1} onClick={() => setPage(p => p + 1)}>Next</Button>
          </div>
        </div>
        </>
        )}
      </Card>

      {canEdit && adjust && <AdjustModal product={adjust} onClose={() => setAdjust(null)} onSave={doAdjust} />}
      {history && <HistoryDrawer product={history} onClose={() => setHistory(null)} />}
      {canEdit && addOpen && <ProductModal categories={categories} onClose={() => setAddOpen(false)} onSave={doAddProduct} />}
      {canEdit && editProduct && <ProductModal categories={categories} initialProduct={editProduct} onClose={() => setEditProduct(null)} onSave={doUpdateProduct} />}
      {canImport && importOpen && (
        <InventoryImportModal
          onClose={() => setImportOpen(false)}
          onComplete={() => { void invalidateCatalog.products(); toast('Bulk import complete', { icon: 'package-check' }) }}
        />
      )}
    </div>
  )
}
