'use client'

import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { type Product, money } from '@/lib/erp-data'
import { encodeCode128 } from '@/lib/code128'
import { Button, Card, Checkbox, Field, Icon, Select, TextInput, useToast } from './ui'

type LabelSize = 'small' | 'medium' | 'large'

const LABEL_SIZES: Record<LabelSize, { label: string; width: string; height: string }> = {
  small: { label: 'Small · 38 × 25 mm', width: '38mm', height: '25mm' },
  medium: { label: 'Medium · 50 × 30 mm', width: '50mm', height: '30mm' },
  large: { label: 'Large · 70 × 40 mm', width: '70mm', height: '40mm' },
}

function Barcode({ value }: { value: string }) {
  const encoded = useMemo(() => {
    try { return encodeCode128(value) } catch { return null }
  }, [value])

  if (!encoded) return <div className="barcode-invalid">Invalid barcode</div>

  return (
    <svg className="barcode-svg" viewBox={`0 0 ${encoded.modules} 64`} preserveAspectRatio="none" role="img" aria-label={`Barcode ${value}`}>
      <rect width={encoded.modules} height="64" fill="#fff" />
      {encoded.bars.map((bar, index) => <rect key={`${bar.x}-${index}`} x={bar.x} y="0" width={bar.width} height="64" fill="#050505" />)}
    </svg>
  )
}

function ProductLabel({ product, size, showName, showPrice }: { product: Product; size: LabelSize; showName: boolean; showPrice: boolean }) {
  return (
    <div className={`barcode-label barcode-label-${size}`} style={{ '--label-width': LABEL_SIZES[size].width, '--label-height': LABEL_SIZES[size].height } as React.CSSProperties}>
      {showName && <div className="barcode-product-name">{product.name}</div>}
      <Barcode value={product.barcode} />
      <div className="barcode-value">{product.barcode}</div>
      <div className="barcode-label-footer"><span>{product.sku}</span>{showPrice && <strong>{money(product.price)}</strong>}</div>
    </div>
  )
}

export function BarcodeGenerator({ products }: { products: Product[] }) {
  const toast = useToast()
  const eligibleProducts = useMemo(() => products.filter(product => product.barcode && product.barcode !== '—' && /^[\x20-\x7e]+$/.test(product.barcode)), [products])
  const [query, setQuery] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [quantity, setQuantity] = useState('1')
  const [size, setSize] = useState<LabelSize>('medium')
  const [showName, setShowName] = useState(true)
  const [showPrice, setShowPrice] = useState(true)

  const filtered = eligibleProducts.filter(product => `${product.name} ${product.sku} ${product.barcode}`.toLowerCase().includes(query.trim().toLowerCase()))
  const selectedProducts = eligibleProducts.filter(product => selectedIds.has(product.id))
  const copies = Math.min(100, Math.max(1, Number.parseInt(quantity, 10) || 1))
  const labels = selectedProducts.flatMap(product => Array.from({ length: copies }, (_, index) => ({ product, key: `${product.id}-${index}` })))
  const allFilteredSelected = filtered.length > 0 && filtered.every(product => selectedIds.has(product.id))

  function toggleProduct(id: string) {
    setSelectedIds(current => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAllFiltered() {
    setSelectedIds(current => {
      const next = new Set(current)
      filtered.forEach(product => allFilteredSelected ? next.delete(product.id) : next.add(product.id))
      return next
    })
  }

  function printLabels() {
    if (labels.length === 0) {
      toast('Select at least one item with a barcode', { icon: 'alert-circle' })
      return
    }
    document.body.classList.add('barcode-print-mode')
    const cleanup = () => document.body.classList.remove('barcode-print-mode')
    window.addEventListener('afterprint', cleanup, { once: true })
    window.print()
  }

  return <div className="content-pad page-shell compact barcode-generator-page">
    <div className="page-header">
      <div className="page-header-main"><div className="section-title">Barcode generator</div><div className="section-sub">Create and print Code 128 shelf and product labels from the item master.</div></div>
      <Button size="sm" variant="primary" icon="printer" disabled={labels.length === 0} onClick={printLabels}>Print {labels.length || ''} label{labels.length === 1 ? '' : 's'}</Button>
    </div>

    <div className="barcode-workspace" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 430px), 1fr))', gap: 16, alignItems: 'start' }}>
      <Card noBody>
        <div className="barcode-panel-head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: 16, borderBottom: '1px solid var(--border)' }}><div><strong>1. Select items</strong><div className="td-sub">Only items with a valid barcode are listed.</div></div><span className="muted">{selectedIds.size} selected</span></div>
        <div className="filter-toolbar"><div className="toolbar-field"><TextInput size="sm" icon="search" value={query} onChange={setQuery} placeholder="Search name, SKU or barcode" /></div></div>
        <div className="barcode-product-list" style={{ maxHeight: 510, overflow: 'auto' }}>
          <div className="barcode-product-row barcode-product-row-all" style={{ minHeight: 44, display: 'flex', alignItems: 'center', gap: 12, padding: '9px 16px', borderBottom: '1px solid var(--border)' }}><Checkbox checked={allFilteredSelected} onChange={toggleAllFiltered} /><strong style={{ flex: 1 }}>Select all results</strong><span>{filtered.length}</span></div>
          {filtered.map(product => <div className="barcode-product-row" style={{ minHeight: 58, display: 'flex', alignItems: 'center', gap: 12, padding: '9px 16px', borderBottom: '1px solid var(--border)' }} key={product.id}>
            <Checkbox checked={selectedIds.has(product.id)} onChange={() => toggleProduct(product.id)} />
            <span className="barcode-product-meta" style={{ display: 'flex', minWidth: 0, flex: 1, flexDirection: 'column', gap: 3 }}><strong>{product.name}</strong><span>{product.sku} · {product.barcode}</span></span>
            <span className="tnum" style={{ whiteSpace: 'nowrap' }}>{money(product.price)}</span>
          </div>)}
          {filtered.length === 0 && <div className="empty barcode-empty"><div className="ei"><Icon name="scan-line" size={22} /></div><div>No barcode-ready items found</div></div>}
        </div>
      </Card>

      <div className="barcode-config-column" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Card>
          <div className="barcode-panel-head barcode-panel-head-plain"><div><strong>2. Label settings</strong><div className="td-sub">Configure the printed label sheet.</div></div></div>
          <div className="barcode-settings-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(120px, .6fr) minmax(220px, 1.4fr)', gap: 12 }}>
            <Field label="Copies per item"><TextInput type="number" value={quantity} onChange={setQuantity} /></Field>
            <Field label="Label size"><Select value={size} onChange={value => setSize(value as LabelSize)} options={Object.entries(LABEL_SIZES).map(([value, item]) => ({ value, label: item.label }))} /></Field>
          </div>
          <div className="barcode-options" style={{ display: 'flex', flexWrap: 'wrap', gap: 22, marginTop: 15 }}><label style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Checkbox checked={showName} onChange={setShowName} />Product name</label><label style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Checkbox checked={showPrice} onChange={setShowPrice} />Selling price</label></div>
        </Card>

        <Card>
          <div className="barcode-panel-head barcode-panel-head-plain"><div><strong>3. Preview</strong><div className="td-sub">First selected label shown at print proportions.</div></div></div>
          <div className="barcode-preview" style={{ minHeight: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'auto', padding: 18, border: '1px dashed var(--border)', borderRadius: 'var(--r-md)', background: 'var(--surface-2)' }}>
            {selectedProducts[0] ? <ProductLabel product={selectedProducts[0]} size={size} showName={showName} showPrice={showPrice} /> : <div className="barcode-preview-empty"><Icon name="scan-line" size={28} /><span>Select an item to preview its label</span></div>}
          </div>
        </Card>
      </div>
    </div>

    {typeof document !== 'undefined' && createPortal(
      <div className="barcode-print-sheet" aria-hidden="true">
        {labels.map(({ product, key }) => <ProductLabel key={key} product={product} size={size} showName={showName} showPrice={showPrice} />)}
      </div>,
      document.body,
    )}
  </div>
}

