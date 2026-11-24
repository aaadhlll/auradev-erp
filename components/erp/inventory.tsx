'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import {
  Icon, Button, Badge, Checkbox, Field, TextInput, Select, Segmented, Modal, Drawer, Card, IconTile, ContentLoader, KpiCard, useToast, useClickOutside,
} from './ui'
import { CAT_TONE, CAT_ICON, stockStatus, money, type Product } from '@/lib/erp-data'
import {
  fetchProduct, createProduct, updateProduct, adjustStock, recordOpeningStock, recordBatchReceipt, fetchProductBatches, fetchOpeningStock, fetchStockTransactions,
  fetchMovements, movementLabel, downloadProductsExport,
  type ProductFormData, type ApiCategory, type StockMovement, type InventoryBatch,
} from '@/lib/inventory-api'
import { computeInventorySummary } from '@/lib/inventory-summary'
import { useProductsQuery, useCategoriesQuery, useInvalidateCatalog } from '@/lib/queries/use-catalog'
import { useTaxSettingsQuery } from '@/lib/queries/use-settings'
import { gstRateSelectOptions } from '@/lib/gst'
import { canEditInventory, canImportInventory, canExportInventory, canViewInventoryCost } from '@/lib/rbac'
import { useAuth } from '@/lib/auth-context'
import { InventoryImportModal } from './inventory-import-modal'
import { BarcodeGenerator } from './barcode-generator'
import { InventoryHealth } from './inventory-health'

const STATUS_BADGE = {
  in:  { tone: 'success', label: 'In Stock' },
  low: { tone: 'warning', label: 'Low Stock' },
  out: { tone: 'danger',  label: 'Out of Stock' },
} as const

type StockTransaction = 'opening' | 'receipt' | 'adjustment' | 'count' | 'wastage'
export type InventorySectionId = 'items' | 'barcodes' | 'health' | 'movements' | StockTransaction

const TRANSACTION_COPY: Record<StockTransaction, { title: string; description: string; action: string; icon: string }> = {
  opening: { title: 'Opening stock', description: 'Record the initial stock available when you start using Mercantile.', action: 'Record opening stock', icon: 'package-open' },
  receipt: { title: 'Stock receipt', description: 'Record stock received outside a purchase order or GRN.', action: 'Record receipt', icon: 'package-check' },
  adjustment: { title: 'Stock adjustments', description: 'Correct stock differences with a reason and audit note.', action: 'Adjust stock', icon: 'package-plus' },
  count: { title: 'Physical count', description: 'Enter the counted quantity; Mercantile records the exact difference.', action: 'Save count', icon: 'clipboard-check' },
  wastage: { title: 'Damage & wastage', description: 'Remove damaged, expired, or wasted items from available stock.', action: 'Record wastage', icon: 'trash-2' },
}

function RowMenu({ onEdit, onAdjust }: {
  onEdit?: () => void
  onAdjust?: () => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useClickOutside(ref, () => setOpen(false), open)
  const canEdit = Boolean(onEdit || onAdjust)

  if (!canEdit) return null

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button className="icon-btn" style={{ width: 30, height: 30 }} onClick={e => { e.stopPropagation(); setOpen(v => !v) }}>
        <Icon name="more-horizontal" size={17} />
      </button>
      {open && (
        <div className="popover" style={{ position: 'absolute', top: 'calc(100% + 4px)', right: 0, minWidth: 184 }}>
          {onAdjust && <button className="menu-item" onClick={() => { setOpen(false); onAdjust() }}><Icon name="package-plus" size={16} className="lead" />Quick adjust stock</button>}
          {onEdit && <button className="menu-item" onClick={() => { setOpen(false); onEdit() }}><Icon name="pencil" size={16} className="lead" />Edit product</button>}
        </div>
      )}
    </div>
  )
}

function AdjustModal({ product, mode = 'adjustment', onClose, onSave }: {
  product: Product
  mode?: StockTransaction
  onClose: () => void
  onSave: (delta: number, reason: string, notes: string, batchNumber?: string, expiryDate?: string) => void
}) {
  const config = TRANSACTION_COPY[mode]
  const [type, setType] = useState(mode === 'wastage' ? 'remove' : 'add')
  const [qty, setQty] = useState('')
  const [notes, setNotes] = useState('')
  const [batchNumber, setBatchNumber] = useState('')
  const [expiryDate, setExpiryDate] = useState('')
  const n = parseFloat(qty) || 0
  const isCount = mode === 'count'
  const delta = isCount ? n - product.stock : type === 'add' ? n : -n
  const result = isCount ? n : type === 'add' ? product.stock + n : Math.max(0, product.stock - n)
  const isBatchReceipt = mode === 'receipt' && product.expiryTracked
  const valid = n >= 0 && (isCount ? n !== product.stock : n > 0) && (delta >= 0 || product.stock + delta >= 0) && (!isBatchReceipt || Boolean(batchNumber.trim()))

  return (
    <Modal title={config.title} sub={`${product.name} · ${product.sku}`} icon={config.icon} onClose={onClose}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" icon="check" disabled={!valid} onClick={() => onSave(delta, mode, notes, batchNumber, expiryDate)}>{config.action}</Button>
      </>}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {mode === 'adjustment' && <Segmented value={type} onChange={setType} options={[{ value: 'add', icon: 'plus', label: 'Add stock' }, { value: 'remove', icon: 'minus', label: 'Remove' }]} />}
        <Field label={isCount ? 'Counted quantity' : 'Quantity'} hint={`Current on hand: ${product.stock} ${product.unit}`}>
          <TextInput type="number" value={qty} onChange={setQty} placeholder="0" icon="hash" autoFocus
            suffix={<span className="muted" style={{ fontSize: 12, fontWeight: 600 }}>{product.unit}</span>} />
        </Field>
        {isBatchReceipt && <div className="form-grid-2">
          <Field label="Batch / lot number" required><TextInput value={batchNumber} onChange={setBatchNumber} placeholder="e.g. LOT-241101-A" /></Field>
          <Field label="Expiry date" hint="Optional for non-dated goods"><TextInput type="date" value={expiryDate} onChange={setExpiryDate} /></Field>
        </div>}
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
  const [batches, setBatches] = useState<InventoryBatch[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetchMovements(product.id)
      .then(setMoves)
      .catch(() => setMoves([]))
      .finally(() => setLoading(false))
    if (product.expiryTracked) fetchProductBatches(product.id).then(setBatches).catch(() => setBatches([]))
  }, [product.id])

  const expiryLabel = (date: string | null) => {
    if (!date) return 'No expiry date'
    const days = Math.ceil((new Date(`${date}T00:00:00`).getTime() - Date.now()) / 86_400_000)
    if (days < 0) return 'Expired'
    if (days <= 30) return `Expires in ${days} days`
    return `Expires ${new Date(`${date}T00:00:00`).toLocaleDateString('en-QA', { day: 'numeric', month: 'short', year: 'numeric' })}`
  }

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
      {product.expiryTracked && <div style={{ marginBottom: 20 }}>
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}><div style={{ fontWeight: 700, fontSize: 13 }}>Batches & expiry</div><Badge tone="info">{batches.length} batches</Badge></div>
        {batches.length === 0 ? <div className="muted" style={{ fontSize: 12.5 }}>No batches have been received for this item yet.</div> : batches.map(batch => {
          const expiresSoon = batch.expiryDate && Math.ceil((new Date(`${batch.expiryDate}T00:00:00`).getTime() - Date.now()) / 86_400_000) <= 30
          return <div key={batch.id} className="row" style={{ justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid var(--border)' }}>
            <div><div className="td-strong mono">{batch.batchNumber}</div><div className="td-sub">Received {batch.receivedDate}</div></div>
            <div style={{ textAlign: 'right' }}><div className="tnum" style={{ fontWeight: 700 }}>{batch.quantityOnHand} {product.unit}</div><div className="td-sub" style={{ color: expiresSoon ? 'var(--warning-fg)' : undefined }}>{expiryLabel(batch.expiryDate)}</div></div>
          </div>
        })}
      </div>}
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
    tax: initialProduct ? String(initialProduct.tax) : '0',
    reorder: initialProduct ? String(initialProduct.reorder) : '',
    stock: initialProduct ? String(initialProduct.stock) : '',
    expiryTracked: initialProduct?.expiryTracked ?? false,
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
        <Field label="MRP (QAR)" required error={err('mrp')}><TextInput type="number" value={f.mrp} onChange={set('mrp')} placeholder="0" error={Boolean(err('mrp'))} /></Field>
        <Field label="Selling price (QAR)" required error={err('price')}><TextInput type="number" value={f.price} onChange={set('price')} placeholder="0" error={Boolean(err('price'))} /></Field>
        <Field label="Cost price (QAR)" optional><TextInput type="number" value={f.cost} onChange={set('cost')} placeholder="0" /></Field>
        <Field label="Tax rate"><Select value={f.tax} onChange={set('tax')} options={taxOptions} /></Field>
        <Field label="Reorder level"><TextInput type="number" value={f.reorder} onChange={set('reorder')} placeholder="0" /></Field>
        <div className="row gap8" style={{ gridColumn: '1 / -1', fontSize: 13, fontWeight: 600 }}><Checkbox checked={f.expiryTracked} onChange={checked => setF(s => ({ ...s, expiryTracked: checked }))} />Track batches and expiry dates for this item</div>
      </div>
    </Modal>
  )
}

function StockAdjustmentWorkspace({
  products, canEdit, mode, onAdjust, savedKey,
}: {
  products: Product[]; canEdit: boolean; mode: StockTransaction; onAdjust: (product: Product, mode: StockTransaction) => void; savedKey: number
}) {
  const [creating, setCreating] = useState(false)
  const [productId, setProductId] = useState('')
  const [movements, setMovements] = useState<StockMovement[]>([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [hasSearched, setHasSearched] = useState(false)
  const [searchKey, setSearchKey] = useState(0)
  const previousSavedKey = useRef(savedKey)
  const product = products.find(item => item.id === productId)
  const config = TRANSACTION_COPY[mode]
  const movementTypes: Record<Exclude<StockTransaction, 'opening'>, string[]> = {
    receipt: ['stock_receipt'], adjustment: ['adjustment_in', 'adjustment_out'], count: ['count_in', 'count_out'], wastage: ['waste'],
  }

  useEffect(() => {
    if (!productId && products[0]) setProductId(products[0].id)
  }, [productId, products])

  useEffect(() => {
    if (previousSavedKey.current !== savedKey) {
      previousSavedKey.current = savedKey
      setCreating(false)
    }
  }, [savedKey])

  useEffect(() => {
    if (creating || !hasSearched) return
    setLoading(true)
    setLoadError(null)
    fetchStockTransactions(movementTypes[mode as Exclude<StockTransaction, 'opening'>])
      .then(setMovements)
      .catch(e => setLoadError(e instanceof Error ? e.message : `Could not load ${config.title.toLowerCase()}`))
      .finally(() => setLoading(false))
  }, [creating, mode, savedKey, hasSearched, searchKey])

  const records = movements.filter(move => !query.trim() || `${move.id} ${move.productName} ${move.sku} ${move.notes ?? ''}`.toLowerCase().includes(query.trim().toLowerCase()))
  const transactionSummary = useMemo(() => ({
    records: movements.length,
    items: new Set(movements.map(move => move.productName)).size,
    added: movements.filter(move => move.signedDelta > 0).reduce((sum, move) => sum + move.signedDelta, 0),
    removed: movements.filter(move => move.signedDelta < 0).reduce((sum, move) => sum + Math.abs(move.signedDelta), 0),
  }), [movements])

  if (!creating) return <div className="content-pad page-shell compact">
    <div className="page-header"><div className="page-header-main"><div className="section-title">{config.title}</div><div className="section-sub">{config.description}</div></div>{canEdit && <Button size="sm" variant="primary" icon="plus" onClick={() => setCreating(true)}>Create new</Button>}</div>
    <div className="kpi-grid transaction-status-grid">
      <KpiCard label="Total records" value={String(hasSearched ? transactionSummary.records : 0)} icon="files" tone="tile-primary" />
      <KpiCard label="Items affected" value={String(hasSearched ? transactionSummary.items : 0)} icon="package" tone="tile-info" />
      <KpiCard label="Stock added" value={String(hasSearched ? transactionSummary.added : 0)} icon="arrow-down-to-line" tone="tile-success" />
      <KpiCard label="Stock removed" value={String(hasSearched ? transactionSummary.removed : 0)} icon="arrow-up-from-line" tone="tile-warning" />
    </div>
    <Card noBody className="transaction-ledger">
      <div className="filter-toolbar"><div className="toolbar-field"><TextInput size="sm" icon="search" value={query} onChange={setQuery} placeholder={`Search ${config.title.toLowerCase()}…`} /></div><Button size="sm" variant="primary" icon="search" onClick={() => { setHasSearched(true); setSearchKey(key => key + 1) }} disabled={loading}>{loading ? 'Searching…' : 'Search'}</Button></div>
      {!hasSearched ? <div className="empty" style={{ minHeight: 240 }}><div className="ei"><Icon name="search" size={22} /></div><div style={{ fontWeight: 600, color: 'var(--fg)' }}>Search {config.title.toLowerCase()}</div><div>Enter a reference, item, or note if needed, then click Search to load records.</div></div> : loading ? <ContentLoader /> : loadError ? <div className="empty" style={{ minHeight: 240 }}><div style={{ color: 'var(--danger-fg)', fontWeight: 600 }}>{loadError}</div><Button size="sm" variant="outline" onClick={() => setHasSearched(false)}>Clear search</Button></div> : records.length === 0 ? <div className="empty" style={{ minHeight: 240 }}><div className="ei"><Icon name={config.icon} size={22} /></div><div style={{ fontWeight: 600, color: 'var(--fg)' }}>No {config.title.toLowerCase()} records</div><div>Create a transaction to record it in the inventory ledger.</div></div> : <div className="tbl-wrap"><table className="tbl"><thead><tr><th>Transaction ID</th><th>Item</th><th>Transaction</th><th className="num">Quantity</th><th>Date & time</th><th>Notes</th></tr></thead><tbody>{records.map(move => <tr key={move.id}><td className="mono td-strong">TX-{move.id.slice(0, 8).toUpperCase()}</td><td><div className="cell-stack"><span className="td-strong">{move.productName}</span><span className="td-sub mono">{move.sku}</span></div></td><td>{movementLabel(move.movementType)}</td><td className="num tnum" style={{ color: move.signedDelta > 0 ? 'var(--success-fg)' : 'var(--danger-fg)', fontWeight: 700 }}>{move.signedDelta > 0 ? '+' : ''}{move.signedDelta}</td><td className="muted">{formatMoveDate(move.createdAt)}</td><td className="muted">{move.notes || '—'}</td></tr>)}</tbody></table></div>}
    </Card>
  </div>

  return (
    <div className="content-pad page-shell compact">
      <div className="page-header">
        <div className="page-header-main">
          <div className="section-title">New {config.title.replace(/s$/, '')}</div>
          <div className="section-sub">{config.description}</div>
        </div>
        <Button size="sm" variant="outline" icon="arrow-left" onClick={() => setCreating(false)}>Back to records</Button>
      </div>
      <Card title={config.action} sub="Select an item and record this transaction in the stock ledger.">
        <div className="form-row">
          <div className="form-field-product"><Field label="Item" required><Select value={productId} onChange={setProductId} icon="package" placeholder="Select an item" options={products.map(item => ({ value: item.id, label: item.name, sub: `${item.sku} · ${item.stock} ${item.unit} on hand` }))} /></Field></div>
          {product && <>
            <div className="form-field-narrow"><Field label="On hand"><div className="input filled"><span className="tnum">{product.stock} {product.unit}</span></div></Field></div>
            <div className="form-field-narrow"><Field label="Reorder level"><div className="input filled"><span className="tnum">{product.reorder} {product.unit}</span></div></Field></div>
            <div style={{ alignSelf: 'end', display: 'flex', gap: 8 }}>
              {canEdit && <Button variant="primary" icon={config.icon} onClick={() => onAdjust(product, mode)}>{config.action}</Button>}
            </div>
          </>}
        </div>
      </Card>
    </div>
  )
}

type OpeningStockRow = { id: string; productId: string; quantity: string; batchNumber: string; expiryDate: string }

function newOpeningStockRow(): OpeningStockRow {
  return { id: Math.random().toString(36).slice(2), productId: '', quantity: '', batchNumber: '', expiryDate: '' }
}

function OpeningStockWorkspace({ products, canEdit, onSave }: {
  products: Product[]
  canEdit: boolean
  onSave: (lines: Array<{ productId: string; quantity: number; batchNumber?: string; expiryDate?: string }>) => Promise<void>
}) {
  const [creating, setCreating] = useState(false)
  const [rows, setRows] = useState<OpeningStockRow[]>(() => [newOpeningStockRow()])
  const [movements, setMovements] = useState<StockMovement[]>([])
  const [loadingList, setLoadingList] = useState(false)
  const [listError, setListError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [hasSearched, setHasSearched] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const updateRow = (id: string, patch: Partial<OpeningStockRow>) => setRows(current => current.map(row => row.id === id ? { ...row, ...patch } : row))
  const removeRow = (id: string) => setRows(current => current.length === 1 ? current : current.filter(row => row.id !== id))

  async function loadOpeningStock() {
    setLoadingList(true)
    setListError(null)
    try {
      setMovements(await fetchOpeningStock())
    } catch (e) {
      setListError(e instanceof Error ? e.message : 'Could not load opening stock')
    } finally {
      setLoadingList(false)
    }
  }

  useEffect(() => { if (hasSearched) void loadOpeningStock() }, [hasSearched])

  const records = useMemo(() => {
    const grouped = new Map<string, StockMovement[]>()
    for (const movement of movements) {
      const key = movement.referenceId ?? movement.id
      grouped.set(key, [...(grouped.get(key) ?? []), movement])
    }
    return [...grouped.entries()].map(([id, lines]) => ({
      id,
      createdAt: lines[0]?.createdAt ?? '',
      itemCount: lines.length,
      quantity: lines.reduce((total, line) => total + line.quantity, 0),
      items: lines.map(line => line.productName).join(', '),
    })).filter(record => !query.trim() || `${record.id} ${record.items}`.toLowerCase().includes(query.trim().toLowerCase()))
  }, [movements, query])
  const openingSummary = useMemo(() => ({
    records: new Set(movements.map(move => move.referenceId ?? move.id)).size,
    items: movements.length,
    quantity: movements.reduce((total, move) => total + move.quantity, 0),
  }), [movements])

  async function submit() {
    const filled = rows.filter(row => row.productId || row.quantity || row.batchNumber || row.expiryDate)
    if (filled.length === 0) return setError('Add at least one item and quantity.')
    if (filled.some(row => !row.productId || !Number.isFinite(Number(row.quantity)) || Number(row.quantity) <= 0)) {
      return setError('Choose an item and enter a quantity greater than zero for every row.')
    }
    if (new Set(filled.map(row => row.productId)).size !== filled.length) return setError('Add each item only once. Combine its quantity in one row.')
    setSaving(true)
    setError(null)
    try {
      await onSave(filled.map(row => ({ productId: row.productId, quantity: Number(row.quantity), batchNumber: row.batchNumber, expiryDate: row.expiryDate })))
      setRows([newOpeningStockRow()])
      setCreating(false)
      if (hasSearched) await loadOpeningStock()
      else setHasSearched(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not record opening stock')
    } finally {
      setSaving(false)
    }
  }

  if (!creating) return <div className="content-pad page-shell compact">
    <div className="page-header"><div className="page-header-main"><div className="section-title">Opening stock</div><div className="section-sub">Opening balances recorded when you started using Mercantile</div></div>{canEdit && <Button variant="primary" size="sm" icon="plus" onClick={() => { setError(null); setCreating(true) }}>Create new</Button>}</div>
    <div className="kpi-grid transaction-status-grid">
      <KpiCard label="Opening records" value={String(hasSearched ? openingSummary.records : 0)} icon="files" tone="tile-primary" />
      <KpiCard label="Items recorded" value={String(hasSearched ? openingSummary.items : 0)} icon="package" tone="tile-info" />
      <KpiCard label="Total quantity" value={String(hasSearched ? openingSummary.quantity : 0)} icon="layers" tone="tile-success" />
      <KpiCard label="Search results" value={String(hasSearched ? records.length : 0)} icon="search" tone="tile-warning" />
    </div>
    <Card noBody className="transaction-ledger">
      <div className="filter-toolbar"><div className="toolbar-field"><TextInput size="sm" icon="search" value={query} onChange={setQuery} placeholder="Search opening stock ID or item…" /></div><Button size="sm" variant="primary" icon="search" onClick={() => { if (hasSearched) void loadOpeningStock(); else setHasSearched(true) }} disabled={loadingList}>{loadingList ? 'Searching…' : 'Search'}</Button></div>
      {!hasSearched ? <div className="empty" style={{ minHeight: 240 }}><div className="ei"><Icon name="search" size={22} /></div><div style={{ fontWeight: 600, color: 'var(--fg)' }}>Search opening stock</div><div>Click Search to load previous opening-stock records.</div></div> : loadingList ? <ContentLoader /> : listError ? <div className="empty" style={{ minHeight: 240 }}><div style={{ color: 'var(--danger-fg)', fontWeight: 600 }}>{listError}</div><Button size="sm" variant="outline" onClick={() => void loadOpeningStock()}>Retry</Button></div> : records.length === 0 ? <div className="empty" style={{ minHeight: 240 }}><div className="ei"><Icon name="package-open" size={22} /></div><div style={{ fontWeight: 600, color: 'var(--fg)' }}>No opening stock records</div><div>Create an opening stock entry to record the inventory you already have.</div></div> : <div className="tbl-wrap"><table className="tbl"><thead><tr><th>Opening stock ID</th><th>Items</th><th className="num">Total quantity</th><th>Date & time</th></tr></thead><tbody>{records.map(record => <tr key={record.id}><td className="td-strong mono">OS-{record.id.slice(0, 8).toUpperCase()}</td><td><div className="cell-stack"><span className="td-strong">{record.itemCount} item{record.itemCount === 1 ? '' : 's'}</span><span className="td-sub">{record.items}</span></div></td><td className="num tnum">{record.quantity}</td><td className="muted">{formatMoveDate(record.createdAt)}</td></tr>)}</tbody></table></div>}
    </Card>
  </div>

  return <div className="content-pad page-shell compact">
    <div className="page-header"><div className="page-header-main"><div className="section-title">New opening stock</div><div className="section-sub">Enter the stock on hand when you begin using Mercantile</div></div><Button size="sm" variant="outline" icon="arrow-left" onClick={() => setCreating(false)}>Back to records</Button></div>
    <Card noBody className="transaction-entry">
      <div className="tbl-wrap"><table className="tbl"><thead><tr><th style={{ width: 46 }}>#</th><th>Item</th><th>Unit</th><th>Batch</th><th>Expiry</th><th className="num">Qty</th><th className="num">Cost</th><th className="num">Total</th><th style={{ width: 46 }} /></tr></thead><tbody>{rows.map((row, index) => {
        const product = products.find(item => item.id === row.productId)
        const qty = Number(row.quantity) || 0
        const hasBatch = Boolean(product?.expiryTracked)
        return <tr key={row.id}><td className="muted tnum">{index + 1}</td><td style={{ minWidth: 230 }}><Select value={row.productId} onChange={value => updateRow(row.id, { productId: value, batchNumber: '', expiryDate: '' })} placeholder="Search and select an item" options={products.map(item => ({ value: item.id, label: item.name, sub: `${item.sku} · ${item.stock} ${item.unit} on hand` }))} /></td><td className="muted">{product ? product.unit : '—'}</td><td><input className="input sm" value={row.batchNumber} disabled={!hasBatch} onChange={e => updateRow(row.id, { batchNumber: e.target.value })} placeholder={hasBatch ? 'Batch no.' : '—'} /></td><td><input className="input sm" type="date" value={row.expiryDate} disabled={!hasBatch} onChange={e => updateRow(row.id, { expiryDate: e.target.value })} /></td><td><input className="input sm tnum" type="number" min="0" step={product?.unit === 'kg' ? '0.001' : '1'} value={row.quantity} onChange={e => updateRow(row.id, { quantity: e.target.value })} placeholder="0" /></td><td className="num muted tnum">{product ? money(product.cost) : '—'}</td><td className="num td-strong tnum">{product ? money(qty * product.cost) : '—'}</td><td><button className="icon-btn" disabled={rows.length === 1} onClick={() => removeRow(row.id)} aria-label="Remove row"><Icon name="trash-2" size={16} /></button></td></tr>
      })}</tbody></table></div>
      <div className="row" style={{ justifyContent: 'space-between', padding: '12px 16px', borderTop: '1px solid var(--border)' }}><Button size="sm" variant="outline" icon="plus" onClick={() => setRows(current => [...current, newOpeningStockRow()])}>Add item</Button><div className="row gap12">{error && <span style={{ color: 'var(--danger-fg)', fontSize: 13 }}>{error}</span>}{canEdit && <Button variant="primary" icon="package-open" disabled={saving} onClick={() => void submit()}>{saving ? 'Saving…' : 'Save opening stock'}</Button>}</div></div>
    </Card>
  </div>
}

function StockMovementsWorkspace({ products }: { products: Product[] }) {
  const [selectedProductId, setSelectedProductId] = useState('')
  const [productId, setProductId] = useState('')
  const [moves, setMoves] = useState<StockMovement[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const product = products.find(item => item.id === productId)
  const selectedProduct = products.find(item => item.id === selectedProductId)

  const movementSummary = useMemo(() => ({
    received: moves.filter(move => move.signedDelta > 0).reduce((total, move) => total + move.signedDelta, 0),
    issued: moves.filter(move => move.signedDelta < 0).reduce((total, move) => total + Math.abs(move.signedDelta), 0),
    adjustments: moves.filter(move => move.movementType.includes('adjustment')).length,
  }), [moves])

  useEffect(() => {
    if (!productId) {
      setMoves([])
      setError(null)
      return
    }
    setLoading(true)
    setError(null)
    fetchMovements(productId)
      .then(setMoves)
      .catch(e => setError(e instanceof Error ? e.message : 'Could not load stock movements'))
      .finally(() => setLoading(false))
  }, [productId, reloadKey])

  function viewJourney() {
    if (!selectedProductId) return
    if (selectedProductId === productId) setReloadKey(key => key + 1)
    else setProductId(selectedProductId)
  }

  return <div className="content-pad page-shell compact">
    <div className="page-header"><div className="page-header-main"><div className="section-title">Stock movements</div><div className="section-sub">Trace one item from opening stock and receipts through sales, returns and adjustments</div></div></div>
    <Card noBody>
      <div className="filter-toolbar">
        <div className="toolbar-field" style={{ minWidth: 360 }}>
          <Field label="Item"><Select value={selectedProductId} onChange={setSelectedProductId} icon="package" placeholder="Search and select an item" options={products.map(item => ({ value: item.id, label: item.name, sub: `${item.sku} · ${item.stock} ${item.unit} on hand` }))} /></Field>
        </div>
        <Button size="sm" variant="primary" icon="search" onClick={viewJourney} disabled={!selectedProductId || loading} style={{ alignSelf: 'end' }}>{loading ? 'Loading…' : 'View journey'}</Button>
        {selectedProduct && <div className="row gap16" style={{ alignSelf: 'end', paddingBottom: 4, marginLeft: 4 }}><span className="muted">Current on hand</span><strong className="tnum">{selectedProduct.stock} {selectedProduct.unit}</strong><span className="muted">Reorder at {selectedProduct.reorder} {selectedProduct.unit}</span></div>}
      </div>
    </Card>

    <div className="kpi-grid transaction-status-grid">
      <KpiCard label="Current stock" value={product ? `${product.stock} ${product.unit}` : '0'} icon="package" tone="tile-primary" />
      <KpiCard label="Stock received" value={String(product ? movementSummary.received : 0)} icon="arrow-down-to-line" tone="tile-success" />
      <KpiCard label="Stock issued" value={String(product ? movementSummary.issued : 0)} icon="arrow-up-from-line" tone="tile-warning" />
      <KpiCard label="Adjustments" value={String(product ? movementSummary.adjustments : 0)} icon="sliders-horizontal" tone="tile-info" />
    </div>

    <Card noBody className="transaction-ledger">
      {!product ? (
        <div className="empty" style={{ minHeight: 270 }}><div className="ei"><Icon name="package-search" size={22} /></div><div style={{ fontWeight: 600, color: 'var(--fg)' }}>Choose an item and view its journey</div><div>Select a product above, then click View journey to load its complete stock history.</div></div>
      ) : loading ? <ContentLoader /> : error ? (
        <div className="empty" style={{ minHeight: 260 }}><div className="ei"><Icon name="alert-circle" size={22} /></div><div style={{ fontWeight: 600, color: 'var(--danger-fg)' }}>{error}</div><Button size="sm" variant="outline" onClick={viewJourney}>Try again</Button></div>
      ) : moves.length === 0 ? (
        <div className="empty" style={{ minHeight: 260 }}><div className="ei"><Icon name="history" size={22} /></div><div style={{ fontWeight: 600, color: 'var(--fg)' }}>No stock movements yet</div><div>Stock receipts, sales and adjustments will appear here.</div></div>
      ) : <>
        <div style={{ padding: '16px 16px 0' }}><div className="td-strong">{product.name} · movement timeline</div><div className="td-sub">Newest activity first · every change updates the running balance</div></div>
        <div className="tbl-wrap"><table className="tbl"><thead><tr><th>Activity</th><th>Date & time</th><th>Reference / notes</th><th className="num">Movement</th><th className="num">Balance after</th></tr></thead><tbody>{moves.map(move => (
          <tr key={move.id}><td><div className="row gap8"><IconTile tone={move.signedDelta > 0 ? 'tile-success' : 'tile-warning'} size={28} icon={move.signedDelta > 0 ? 'arrow-down-to-line' : 'arrow-up-from-line'} /><div className="cell-stack"><span className="td-strong">{movementLabel(move.movementType)}</span><span className="td-sub mono">{move.referenceId ? `REF-${move.referenceId.slice(0, 8).toUpperCase()}` : 'Manual transaction'}</span></div></div></td><td className="muted">{formatMoveDate(move.createdAt)}</td><td className="muted">{move.notes || '—'}</td><td className="num tnum" style={{ fontWeight: 700, color: move.signedDelta > 0 ? 'var(--success-fg)' : 'var(--danger-fg)' }}>{move.signedDelta > 0 ? '+' : ''}{move.signedDelta}</td><td className="num tnum td-strong">{move.quantityAfter} {product.unit}</td></tr>
        ))}</tbody></table></div>
        <div className="row" style={{ justifyContent: 'space-between', padding: '12px 16px', borderTop: '1px solid var(--border)' }}><span className="muted" style={{ fontSize: 12.5 }}>{moves.length} movement{moves.length === 1 ? '' : 's'} for {product.name}</span><span className="muted tnum" style={{ fontSize: 12.5 }}>Current balance: {product.stock} {product.unit}</span></div>
      </>}
    </Card>
  </div>
}

export function Inventory({
  prefillQuery,
  prefillKey,
  onPrefillConsumed,
  section = 'items',
}: {
  prefillQuery?: string
  prefillKey?: number
  onPrefillConsumed?: () => void
  section?: InventorySectionId
} = {}) {
  const toast = useToast()
  const { user } = useAuth()
  const canEdit = canEditInventory(user)
  const canImport = canImportInventory(user)
  const canExport = canExportInventory(user)
  const showCost = canViewInventoryCost(user)
  const invalidateCatalog = useInvalidateCatalog()
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('all')
  const [unit, setUnit] = useState('all')
  const [status, setStatus] = useState('all')
  const [itemSearchRequested, setItemSearchRequested] = useState(false)
  const [sort, setSort] = useState<{ key: keyof Product; dir: 'asc' | 'desc' }>({ key: 'name', dir: 'asc' })
  const [page, setPage] = useState(0)
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [adjust, setAdjust] = useState<{ product: Product; mode: StockTransaction } | null>(null)
  const [transactionSaved, setTransactionSaved] = useState(0)
  const [addOpen, setAddOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [editProduct, setEditProduct] = useState<Product | null>(null)
  const [exporting, setExporting] = useState(false)
  const PER = 12
  const catalogRequested = (section !== 'items' && section !== 'health') || itemSearchRequested || addOpen || Boolean(editProduct)
  const productsQuery = useProductsQuery(catalogRequested)
  const categoriesQuery = useCategoriesQuery(catalogRequested)
  const products = productsQuery.data ?? []
  const categories = categoriesQuery.data ?? []
  const loading = productsQuery.isPending || categoriesQuery.isPending
  const initialLoading = loading && products.length === 0
  const error = productsQuery.error?.message ?? categoriesQuery.error?.message ?? null

  const summary = useMemo(() => computeInventorySummary(products), [products])

  function refetch() {
    setItemSearchRequested(true)
    void productsQuery.refetch()
    void categoriesQuery.refetch()
  }

  useEffect(() => {
    if (!prefillQuery || prefillKey == null) return
    setQ(prefillQuery)
    setCat('all')
    setPage(0)
    setItemSearchRequested(true)
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

  async function doAdjust(delta: number, reason: string, notes: string, batchNumber?: string, expiryDate?: string) {
    if (!adjust) return
    const target = adjust.product
    try {
      if (reason === 'receipt' && target.expiryTracked) {
        await recordBatchReceipt(target.id, { quantity: delta, batchNumber: batchNumber?.trim() ?? '', expiryDate, notes })
      } else {
        await adjustStock(target.id, delta, reason, notes)
      }
      await invalidateCatalog.products()
      setAdjust(null)
      setTransactionSaved(key => key + 1)
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

  if (section === 'movements') return <StockMovementsWorkspace products={products} />

  if (section === 'barcodes') return <BarcodeGenerator products={products} />
  if (section === 'health') return <InventoryHealth />

  if (section === 'opening') return <OpeningStockWorkspace products={products} canEdit={canEdit} onSave={async lines => {
    await recordOpeningStock(lines)
    await invalidateCatalog.products()
    toast(`${lines.length} item${lines.length === 1 ? '' : 's'} added to opening stock`, { icon: 'package-check' })
  }} />

  if (section !== 'items') {
    return <>
      <StockAdjustmentWorkspace products={products} canEdit={canEdit} mode={section} savedKey={transactionSaved} onAdjust={(product, mode) => setAdjust({ product, mode })} />
      {canEdit && adjust && <AdjustModal product={adjust.product} mode={adjust.mode} onClose={() => setAdjust(null)} onSave={doAdjust} />}
    </>
  }

  return (
    <div className="content-pad page-shell compact">
      <div className="page-header">
        <div className="page-header-main">
          <div className="section-title">Item master</div>
          <div className="section-sub">
            {!itemSearchRequested && !addOpen ? 'Search when you need to load the item catalogue' : initialLoading ? 'Loading item master…' : `${products.length} items · ${categories.length} categories`}
          </div>
        </div>
        {(canImport || canExport || canEdit) && (
        <div className="row gap8 page-header-actions" style={{ flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {canImport && <Button size="sm" icon="upload" onClick={() => setImportOpen(true)}>Bulk import</Button>}
          {canExport && <Button size="sm" icon="download" disabled={exporting} onClick={() => void doExport(false)}>{exporting ? 'Exporting…' : 'Export'}</Button>}
          {canEdit && <Button size="sm" variant="primary" icon="plus" onClick={() => { setItemSearchRequested(true); setAddOpen(true) }}>Add item</Button>}
        </div>
        )}
      </div>

      {!initialLoading && (
        <div className="kpi-grid inventory-status-grid">
          <KpiCard label="Total items" value={String(itemSearchRequested ? summary.totalProducts : 0)} icon="package" tone="tile-primary" active={status === 'all'} onClick={() => { setStatus('all'); setPage(0) }} vs={itemSearchRequested ? `${summary.totalUnits.toLocaleString('en-IN')} units on hand` : undefined} />
          <KpiCard label="In stock" value={String(itemSearchRequested ? summary.totalProducts - summary.lowStockCount - summary.outOfStockCount : 0)} icon="circle-check" tone="tile-success" active={status === 'in'} onClick={() => { setStatus('in'); setPage(0) }} />
          <KpiCard label="Low stock" value={String(itemSearchRequested ? summary.lowStockCount : 0)} icon="alert-triangle" tone="tile-warning" active={status === 'low'} onClick={() => { setStatus('low'); setPage(0) }} vs={itemSearchRequested ? 'At or below reorder level' : undefined} />
          <KpiCard label="Out of stock" value={String(itemSearchRequested ? summary.outOfStockCount : 0)} icon="circle-x" tone="tile-danger" active={status === 'out'} onClick={() => { setStatus('out'); setPage(0) }} />
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

      <Card noBody className="inventory-ledger">
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
          <Button size="sm" variant="primary" icon="search" onClick={() => setItemSearchRequested(true)} disabled={initialLoading}>{initialLoading ? 'Searching…' : 'Search'}</Button>
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
              {!itemSearchRequested ? (
                <tr><td colSpan={10} style={{ textAlign: 'center', padding: '48px 0', color: 'var(--fg-subtle)', fontSize: 13 }}><Icon name="search" size={18} style={{ marginBottom: 8 }} /><div style={{ fontWeight: 600, color: 'var(--fg)', marginBottom: 3 }}>Search item master</div><div>Use filters if needed, then click Search to load products.</div></td></tr>
              ) : error ? (
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
                        onAdjust={canEdit ? () => setAdjust({ product: p, mode: 'adjustment' }) : undefined}
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

      {canEdit && adjust && <AdjustModal product={adjust.product} mode={adjust.mode} onClose={() => setAdjust(null)} onSave={doAdjust} />}
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
