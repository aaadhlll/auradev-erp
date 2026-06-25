'use client'

import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { Icon, Button, Badge, Field, TextInput, Select, Segmented, Modal, IconTile, useToast } from './ui'
import { CAT_TONE, CAT_ICON, stockStatus, money, money2, type Product } from '@/lib/erp-data'
import { resolveProductScan, fetchProduct } from '@/lib/inventory-api'
import {
  createBill,
  holdBill as holdBillApi,
  fetchHeldBill,
  completeHeldBill,
  discardHeldBill,
  type ApiCustomer,
  type SavedBill,
  type HeldBillSummary,
} from '@/lib/billing-api'
import { saveReceiptPng, saveReceiptPdf, printReceipt, type ReceiptMeta, type ReceiptPrintOptions } from '@/lib/receipt-export'
import { useReceiptMeta, usePrinterSettingsQuery, useBillingSettingsQuery, useTaxSettingsQuery, useReceiptPrintOptions, mergePrintOptions } from '@/lib/queries/use-settings'
import { effectiveTaxSettings, resolveLineGstRate, cartGstTotal, gstSchemeShortLabel, isBillLevelGstScheme, type GstScheme } from '@/lib/gst'
import { canEditSettingsSection } from '@/lib/rbac'
import { useAuth } from '@/lib/auth-context'
import { canHoldBill } from '@/lib/rbac'
import { useInvalidateCatalog } from '@/lib/queries/use-catalog'
import { useCustomersQuery } from '@/lib/queries/use-customers'
import { useInvalidateDashboard } from '@/lib/queries/use-dashboard'
import { usePosSearchQuery } from '@/lib/queries/use-pos-search'
import { usePosQuickPicksQuery, useInvalidatePos } from '@/lib/queries/use-pos-quick-picks'
import { ConfirmDeleteModal } from './confirm-delete-modal'
import { useHeldBillsQuery, useInvalidateHeldBills } from '@/lib/queries/use-held-bills'
import { mergeQuickPicks, pushPosRecent, readPosRecents } from '@/lib/pos-recent'

interface CartItem { p: Product; qty: number; disc: number }

function ProductCard({ p, onAdd, dense }: { p: Product; onAdd: (p: Product) => void; dense: boolean }) {
  const st = stockStatus(p)
  const out = st === 'out'
  return (
    <button
      className="prod-card"
      disabled={out}
      onClick={() => onAdd(p)}
      style={out ? { opacity: .55, cursor: 'not-allowed' } : undefined}
    >
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <IconTile tone={CAT_TONE[p.cat] ?? 'tile-primary'} size={dense ? 26 : 30} icon={CAT_ICON[p.cat] ?? 'package'} iconSize={dense ? 14 : 16} />
        {st === 'low' && <Badge tone="warning">{p.stock}{p.unit === 'kg' ? 'kg' : ''}</Badge>}
        {out && <Badge tone="danger">Out</Badge>}
      </div>
      <div className="pc-name">{p.name}</div>
      <div className="row" style={{ justifyContent: 'space-between', marginTop: 'auto' }}>
        <span className="pc-price tnum">{money(p.price)}<span className="pc-unit">/{p.unit}</span></span>
        <span className="pc-sku mono">{p.sku.split('-').slice(-1)[0]}</span>
      </div>
    </button>
  )
}

const PAY_ICON: Record<string, string> = { Cash: 'banknote', UPI: 'qr-code', Card: 'credit-card', Credit: 'notebook-pen', Split: 'split' }

function PaymentModal({ total, customer, allowCreditSales, onClose, onDone, busy }: {
  total: number
  customer: ApiCustomer | undefined
  allowCreditSales: boolean
  onClose: () => void
  onDone: (method: string, tendered: number, splitCash: number) => void
  busy?: boolean
}) {
  const [method, setMethod] = useState('Cash')
  const [tendered, setTendered] = useState('')
  const [splitCash, setSplitCash] = useState('')

  const tend = parseFloat(tendered) || 0
  const change = Math.max(0, tend - total)
  const sCash = parseFloat(splitCash) || 0
  const sUpi = Math.max(0, total - sCash)
  const allowCredit = allowCreditSales && customer && customer.type !== 'walkin'
  const methods = ['Cash', 'UPI', 'Card', 'Split', ...(allowCreditSales ? ['Credit'] : [])]
  const quick = [total, Math.ceil(total / 100) * 100, Math.ceil(total / 500) * 500, 2000]
    .filter((v, i, a) => a.indexOf(v) === i && v >= total).slice(0, 3)

  const canPay = method === 'Cash' ? tend >= total : method === 'Credit' ? Boolean(allowCredit) : true

  return (
    <Modal title="Take payment" sub={`Amount due · ${money2(total)}`} icon="wallet" wide onClose={onClose}
      footer={<>
        <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
        <Button variant="primary" icon="check" disabled={!canPay || busy} onClick={() => onDone(method, tend, sCash)}>
          {busy ? 'Saving…' : 'Confirm & save receipt'}
        </Button>
      </>}
    >
      <div className="seg" style={{ width: '100%', display: 'grid', gridTemplateColumns: `repeat(${methods.length},1fr)`, marginBottom: 18 }}>
        {methods.map(m => (
          <button key={m} className={method === m ? 'on' : ''} onClick={() => setMethod(m)} style={{ justifyContent: 'center' }}>
            <Icon name={PAY_ICON[m]} size={14} />{m}
          </button>
        ))}
      </div>

      {method === 'Cash' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Field label="Amount tendered">
            <TextInput icon="indian-rupee" value={tendered} onChange={setTendered} placeholder="0" type="number" autoFocus />
          </Field>
          <div className="row gap8">
            {quick.map(q => <Button key={q} size="sm" variant="outline" onClick={() => setTendered(String(q))}>{money(q)}</Button>)}
            <Button size="sm" variant="outline" onClick={() => setTendered(String(total))}>Exact</Button>
          </div>
          <div className="pay-summary">
            <div className="row" style={{ justifyContent: 'space-between' }}><span className="muted">Tendered</span><span className="tnum">{money2(tend)}</span></div>
            <div className="row" style={{ justifyContent: 'space-between' }}><span className="muted">Due</span><span className="tnum">{money2(total)}</span></div>
            <div className="divider" style={{ margin: '6px 0' }} />
            <div className="row" style={{ justifyContent: 'space-between', fontSize: 18, fontWeight: 700 }}>
              <span>Change</span><span className="tnum" style={{ color: 'var(--success-fg)' }}>{money2(change)}</span>
            </div>
          </div>
        </div>
      )}

      {method === 'UPI' && (
        <div style={{ display: 'flex', gap: 18, alignItems: 'center' }}>
          <div className="upi-qr">
            <svg viewBox="0 0 100 100" width="132" height="132">
              {Array.from({ length: 100 }).map((_, i) => {
                const r = Math.floor(i / 10), c = i % 10
                const on = (r * 7 + c * 13 + r * c) % 3 === 0 || (r < 3 && c < 3) || (r < 3 && c > 6) || (r > 6 && c < 3)
                return on ? <rect key={i} x={c * 10 + 1} y={r * 10 + 1} width="8" height="8" rx="1.5" fill="var(--fg)" /> : null
              })}
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Scan to pay {money2(total)}</div>
            <div className="muted" style={{ fontSize: 12.5, marginTop: 3 }}>UPI ID: <span className="mono">nenjankod@okhdfc</span></div>
            <div className="row gap8" style={{ marginTop: 12, color: 'var(--fg-muted)', fontSize: 12.5 }}>
              <span className="live-dot" />Waiting for confirmation…
            </div>
          </div>
        </div>
      )}

      {method === 'Card' && (
        <div className="empty" style={{ padding: '28px 20px' }}>
          <div className="ei"><Icon name="credit-card" size={22} /></div>
          <div style={{ fontWeight: 600, color: 'var(--fg)' }}>Insert / tap card on terminal</div>
          <div>POS terminal TID 5512•••44 · {money2(total)}</div>
        </div>
      )}

      {method === 'Credit' && (
        allowCredit ? (
          <div className="pay-summary">
            <div className="row gap10" style={{ marginBottom: 10 }}>
              <span className="avatar sm">{customer!.name.split(' ').map(w => w[0]).join('').toUpperCase()}</span>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{customer!.name}</div>
                <div className="td-sub">{customer!.phone ?? ''}</div>
              </div>
            </div>
            <div className="row" style={{ justifyContent: 'space-between' }}><span className="muted">Current balance</span><span className="tnum">{money2(customer!.creditBalance)}</span></div>
            <div className="row" style={{ justifyContent: 'space-between' }}><span className="muted">This bill</span><span className="tnum">{money2(total)}</span></div>
            <div className="divider" style={{ margin: '8px 0' }} />
            <div className="row" style={{ justifyContent: 'space-between', fontWeight: 700 }}>
              <span>New balance</span>
              <span className="tnum" style={{ color: 'var(--warning-fg)' }}>{money2(customer!.creditBalance + total)}</span>
            </div>
          </div>
        ) : (
          <div className="alert-banner">
            <Icon name="alert-triangle" size={18} />Credit sale requires a registered customer. Select one from the cart panel.
          </div>
        )
      )}

      {method === 'Split' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Field label="Cash portion">
            <TextInput icon="banknote" value={splitCash} onChange={setSplitCash} placeholder="0" type="number" />
          </Field>
          <div className="pay-summary">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span className="muted"><Icon name="banknote" size={13} style={{ verticalAlign: -2 }} /> Cash</span>
              <span className="tnum">{money2(sCash)}</span>
            </div>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span className="muted"><Icon name="qr-code" size={13} style={{ verticalAlign: -2 }} /> UPI (balance)</span>
              <span className="tnum">{money2(sUpi)}</span>
            </div>
          </div>
        </div>
      )}
    </Modal>
  )
}

function ReceiptModal({ bill, meta, printOptions, onClose }: {
  bill: SavedBill; meta: ReceiptMeta; printOptions: ReceiptPrintOptions; onClose: () => void
}) {
  return (
    <Modal title="Bill saved" sub={bill.billNo} icon="receipt" onClose={onClose}
      footer={<>
        <Button variant="outline" icon="image" onClick={() => saveReceiptPng(bill, meta, printOptions)}>Download PNG</Button>
        <Button variant="primary" icon="file-down" onClick={() => saveReceiptPdf(bill, meta, printOptions)}>Download PDF</Button>
      </>}
    >
      <div className="pay-summary" style={{ fontSize: 13 }}>
        <div className="row" style={{ justifyContent: 'space-between' }}><span className="muted">Customer</span><span>{bill.customerName}</span></div>
        <div className="row" style={{ justifyContent: 'space-between' }}><span className="muted">Items</span><span>{bill.lines.length}</span></div>
        <div className="row" style={{ justifyContent: 'space-between', fontWeight: 700, marginTop: 8 }}>
          <span>Total paid</span><span className="tnum">{money2(bill.grandTotal)}</span>
        </div>
        <div className="muted" style={{ fontSize: 12, marginTop: 12 }}>
          Stock has been updated. Receipt PNG/PDF downloads to your device — no printer required.
        </div>
      </div>
    </Modal>
  )
}

function ParkedBillsModal({
  bills,
  loading,
  onClose,
  onResume,
  onDiscard,
  busyId,
}: {
  bills: HeldBillSummary[]
  loading: boolean
  onClose: () => void
  onResume: (id: string) => void
  onDiscard: (id: string) => void
  busyId: string | null
}) {
  return (
    <Modal title="Parked bills" sub="Resume a parked sale or discard it" icon="pause" onClose={onClose} wide
      footer={<Button variant="ghost" onClick={onClose}>Close</Button>}
    >
      {loading ? (
        <div className="empty" style={{ padding: '28px 0' }}>
          <Icon name="loader" size={22} />
          <div style={{ fontWeight: 600, color: 'var(--fg)', marginTop: 8 }}>Loading parked bills…</div>
        </div>
      ) : bills.length === 0 ? (
        <div className="empty" style={{ padding: '28px 0' }}>
          <div className="ei"><Icon name="pause" size={22} /></div>
          <div style={{ fontWeight: 600, color: 'var(--fg)' }}>No parked bills</div>
          <div>Use Hold to park the current cart when another customer needs checkout first.</div>
        </div>
      ) : (
        <div className="parked-list">
          {bills.map(b => (
            <div className="parked-row" key={b.id}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{b.customerName}</div>
                <div className="td-sub mono">{b.billNo} · {b.itemCount} item{b.itemCount === 1 ? '' : 's'}</div>
              </div>
              <div className="tnum" style={{ fontWeight: 700, fontSize: 14 }}>{money2(b.grandTotal)}</div>
              <div className="row gap6">
                <Button
                  size="sm"
                  variant="primary"
                  icon="play"
                  disabled={busyId != null}
                  onClick={() => onResume(b.id)}
                >
                  Resume
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  icon="trash-2"
                  disabled={busyId != null}
                  onClick={() => onDiscard(b.id)}
                >
                  Discard
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  )
}

export function POS({
  active = true,
  prefillQuery,
  prefillKey,
  onPrefillConsumed,
}: {
  active?: boolean
  prefillQuery?: string
  prefillKey?: number
  onPrefillConsumed?: () => void
} = {}) {
  const toast = useToast()
  const { user } = useAuth()
  const receiptMeta = useReceiptMeta()
  const printerQuery = usePrinterSettingsQuery()
  const billingQuery = useBillingSettingsQuery()
  const taxQuery = useTaxSettingsQuery()
  const printOptions = useReceiptPrintOptions()
  const billing = billingQuery.data
  const taxSettings = taxQuery.data
  const [schemeOverride, setSchemeOverride] = useState<GstScheme | null>(null)
  const canEditGst = canEditSettingsSection(user, 'billing')
  const effectiveTax = useMemo(
    () => effectiveTaxSettings(taxSettings, schemeOverride),
    [taxSettings, schemeOverride],
  )

  useEffect(() => {
    setSchemeOverride(null)
  }, [taxSettings?.scheme])
  const allowHold = canHoldBill(user) && billing?.allowHoldBill !== false
  const maxBillDisc = user?.role === 'CASHIER'
    ? (billing?.cashierMaxBillDiscountPercent ?? 5)
    : (billing?.maxBillDiscountPercent ?? 15)
  const scannerRef = useRef<HTMLInputElement>(null)
  const discountRef = useRef<HTMLInputElement>(null)
  const invalidateCatalog = useInvalidateCatalog()
  const invalidateDashboard = useInvalidateDashboard()
  const invalidatePos = useInvalidatePos()
  const invalidateHeldBills = useInvalidateHeldBills()
  const customersQuery = useCustomersQuery()
  const quickPicksQuery = usePosQuickPicksQuery()
  const heldBillsQuery = useHeldBillsQuery()
  const customers = customersQuery.data ?? []
  const heldBills = heldBillsQuery.data ?? []
  const [cart, setCart] = useState<CartItem[]>([])
  const [searchInput, setSearchInput] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [barcode, setBarcode] = useState('')
  const [scanBusy, setScanBusy] = useState(false)
  const [holdBusy, setHoldBusy] = useState(false)
  const [parkedBusyId, setParkedBusyId] = useState<string | null>(null)
  const [heldBillId, setHeldBillId] = useState<string | null>(null)
  const [parkedOpen, setParkedOpen] = useState(false)
  const [customerId, setCustomerId] = useState('')
  const [billDisc, setBillDisc] = useState(0)
  const [discMode, setDiscMode] = useState('₹')
  const [layout, setLayout] = useState('split')
  const [payOpen, setPayOpen] = useState(false)
  const [payBusy, setPayBusy] = useState(false)
  const [savedBill, setSavedBill] = useState<SavedBill | null>(null)
  const [recents, setRecents] = useState<Product[]>([])
  const [scannerLock, setScannerLock] = useState(true)
  const [discardId, setDiscardId] = useState<string | null>(null)
  const [clearCartOpen, setClearCartOpen] = useState(false)

  const searchQuery = usePosSearchQuery(debouncedQ)
  const isSearching = debouncedQ.length >= 2
  const searchResults = searchQuery.data ?? []

  const customersLoading = customersQuery.isPending
  const customersError = customersQuery.error?.message ?? null
  const picksLoading = quickPicksQuery.isPending
  const picksError = quickPicksQuery.error?.message ?? null

  const quickPicks = useMemo(
    () => mergeQuickPicks(recents, quickPicksQuery.data ?? []),
    [recents, quickPicksQuery.data],
  )

  const focusScanner = useCallback(() => {
    requestAnimationFrame(() => {
      scannerRef.current?.focus({ preventScroll: true })
    })
  }, [])

  const engageScanner = useCallback(() => {
    setScannerLock(true)
    focusScanner()
  }, [focusScanner])

  const releaseScanner = useCallback(() => {
    setScannerLock(false)
  }, [])

  const scannerReady = active && !payOpen && !savedBill && scannerLock

  useEffect(() => {
    if (scannerReady) focusScanner()
  }, [scannerReady, focusScanner])

  useEffect(() => {
    if (scannerReady && !scanBusy) focusScanner()
  }, [scanBusy, scannerReady, focusScanner])

  useEffect(() => {
    if (active && !payOpen && !savedBill) {
      setScannerLock(true)
    }
  }, [active, payOpen, savedBill])

  function refetch() {
    void customersQuery.refetch()
    void quickPicksQuery.refetch()
    if (isSearching) void searchQuery.refetch()
  }

  useEffect(() => {
    setRecents(readPosRecents())
  }, [])

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(searchInput.trim()), 300)
    return () => clearTimeout(t)
  }, [searchInput])

  useEffect(() => {
    if (customerId || !customers.length) return
    const walkin = customers.find(c => c.type === 'walkin') ?? customers[0]
    if (walkin) setCustomerId(walkin.id)
  }, [customers, customerId])

  useEffect(() => {
    if (!prefillQuery || prefillKey == null) return
    setSearchInput(prefillQuery)
    onPrefillConsumed?.()
  }, [prefillKey, prefillQuery, onPrefillConsumed])

  const customer = customers.find(c => c.id === customerId)

  const add = useCallback((p: Product) => {
    const step = p.unit === 'kg' ? 0.5 : 1
    setCart(c => {
      const ex = c.find(x => x.p.id === p.id)
      const nextQty = ex ? +(ex.qty + step).toFixed(2) : step
      if (nextQty > p.stock) {
        toast(
          p.stock <= 0
            ? `${p.name} is out of stock`
            : `${p.name} — only ${p.stock}${p.unit === 'kg' ? ' kg' : ''} available`,
          { icon: 'alert-circle' },
        )
        return c
      }
      pushPosRecent(p)
      setRecents(readPosRecents())
      if (ex) return c.map(x => x.p.id === p.id ? { ...x, qty: nextQty } : x)
      return [...c, { p, qty: step === 0.5 ? step : 1, disc: 0 }]
    })
  }, [toast])

  const setQty = (id: string, qty: number) =>
    setCart(c => {
      const line = c.find(x => x.p.id === id)
      if (line && qty > line.p.stock) {
        toast(
          `${line.p.name} — only ${line.p.stock}${line.p.unit === 'kg' ? ' kg' : ''} available`,
          { icon: 'alert-circle' },
        )
        return c
      }
      return c.map(x => x.p.id === id ? { ...x, qty: Math.max(0, +qty.toFixed(2)) } : x).filter(x => x.qty > 0)
    })
  const remove = (id: string) => setCart(c => c.filter(x => x.p.id !== id))

  async function onBarcode(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter' || scanBusy) return
    const code = barcode.trim()
    if (!code) return
    setBarcode('')
    setScanBusy(true)
    try {
      const p = await resolveProductScan(code)
      add(p)
      toast(p.name + ' added')
    } catch {
      toast(`No product for "${code}"`, { icon: 'search-x', tone: '' })
    } finally {
      setScanBusy(false)
      focusScanner()
    }
  }

  const subtotal = cart.reduce((s, x) => s + x.p.price * x.qty, 0)
  const lineNet = cart.reduce((s, x) => s + x.p.price * x.qty - (x.disc || 0), 0)
  const discVal = discMode === '%' ? subtotal * (billDisc || 0) / 100 : (billDisc || 0)
  const gstLines = cart.map(x => ({
    gross: x.p.price * x.qty,
    discount: x.disc || 0,
    ratePct: resolveLineGstRate(x.p, effectiveTax) ?? 0,
  }))
  const gst = cartGstTotal(effectiveTax ?? null, gstLines, discVal)
  const priceInclGst = effectiveTax?.priceIncludesTax ?? false
  const compositeRate = effectiveTax?.scheme === 'COMPOSITE' ? effectiveTax.compositeRatePct : null
  const isComposite = effectiveTax?.scheme === 'COMPOSITE'
  const taxableBase = Math.max(0, lineNet - discVal)
  const grand = isComposite
    ? (priceInclGst ? taxableBase : taxableBase + gst)
    : (priceInclGst ? Math.max(0, subtotal - discVal) : Math.max(0, subtotal - discVal + gst))

  function cartPayload() {
    return {
      customerId,
      discountMode: (discMode === '%' ? 'PERCENT' : 'AMOUNT') as 'AMOUNT' | 'PERCENT',
      billDiscount: billDisc || 0,
      gstSchemeOverride: schemeOverride ?? undefined,
      items: cart.map(x => ({
        productId: x.p.id,
        quantity: x.qty,
        lineDiscount: x.disc || 0,
      })),
    }
  }

  function resetCart() {
    setCart([])
    setBillDisc(0)
    setHeldBillId(null)
    const walkin = customers.find(c => c.type === 'walkin')
    if (walkin) setCustomerId(walkin.id)
  }

  async function completeSale(method: string, tendered: number, splitCash: number) {
    if (!customerId || !cart.length) return
    setPayBusy(true)
    try {
      const payMethod = (method === 'Split' ? 'CASH' : method.toUpperCase()) as 'CASH' | 'UPI' | 'CARD' | 'CREDIT'
      const payload = {
        ...cartPayload(),
        payment: {
          method: payMethod,
          tendered: method === 'Cash' ? tendered : undefined,
          splitCashAmount: method === 'Split' && splitCash > 0 ? splitCash : undefined,
        },
      }
      const bill = heldBillId
        ? await completeHeldBill(heldBillId, payload)
        : await createBill(payload)

      void invalidateCatalog.products()
      void invalidatePos.quickPicks()
      void invalidateHeldBills()
      void invalidateDashboard()

      setPayOpen(false)
      resetCart()
      setSavedBill(bill)
      if (printerQuery.data?.autoPrint) {
        void printReceipt(bill, receiptMeta, printOptions)
      } else {
        void saveReceiptPng(bill, receiptMeta, printOptions)
      }
      toast(`Bill ${bill.billNo} saved · stock updated`, { icon: 'receipt' })
      focusScanner()
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to complete sale'
      toast(msg, { icon: 'alert-circle' })
    } finally {
      setPayBusy(false)
    }
  }

  async function holdBill() {
    if (!customerId || !cart.length || holdBusy) return
    setHoldBusy(true)
    try {
      const held = await holdBillApi(cartPayload())
      resetCart()
      void invalidateHeldBills()
      toast(`Bill parked · ${held.billNo}`, { icon: 'pause' })
      focusScanner()
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to park bill'
      toast(msg, { icon: 'alert-circle' })
    } finally {
      setHoldBusy(false)
    }
  }

  async function resumeHeldBill(id: string) {
    if (parkedBusyId) return
    if (cart.length && heldBillId !== id) {
      toast('Park or clear the current cart before resuming another bill', { icon: 'alert-triangle' })
      return
    }
    setParkedBusyId(id)
    try {
      const bill = await fetchHeldBill(id)
      const products = await Promise.all(bill.lines.map(l => fetchProduct(l.productId)))
      setCart(bill.lines.map((l, i) => ({
        p: products[i],
        qty: l.quantity,
        disc: l.lineDiscount,
      })))
      setCustomerId(bill.customerId)
      setBillDisc(bill.billDiscount)
      setDiscMode(bill.discountMode === 'PERCENT' ? '%' : '₹')
      setHeldBillId(bill.id)
      setParkedOpen(false)
      toast(`Resumed ${bill.billNo}`, { icon: 'play' })
      focusScanner()
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to resume bill'
      toast(msg, { icon: 'alert-circle' })
    } finally {
      setParkedBusyId(null)
    }
  }

  async function discardParkedBill(id: string) {
    if (parkedBusyId) return
    setParkedBusyId(id)
    try {
      await discardHeldBill(id)
      if (heldBillId === id) resetCart()
      void invalidateHeldBills()
      toast('Parked bill discarded', { icon: 'trash-2' })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to discard bill'
      toast(msg, { icon: 'alert-circle' })
    } finally {
      setParkedBusyId(null)
    }
  }

  function clearBill() {
    resetCart()
    focusScanner()
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'F8' && cart.length) { e.preventDefault(); setPayOpen(true) }
      if (e.key === 'F2' && cart.length) { e.preventDefault(); setClearCartOpen(true) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [cart.length])

  const dense = layout === 'wide'
  const cartFirst = layout === 'cartLeft'
  const displayProducts = isSearching ? searchResults : quickPicks
  const panelLoading = isSearching ? searchQuery.isFetching : picksLoading || customersLoading
  const panelError = isSearching ? searchQuery.error?.message : picksError ?? customersError

  const cartPanel = (
    <div
      className="pos-cart"
      style={{ order: cartFirst ? 0 : 2 }}
      onMouseDown={e => {
        const t = e.target as HTMLElement
        if (t.closest('button')) return
        if (t.closest('.pos-discount-row') || t.closest('.pos-lines') || t.closest('.pos-cart-head')) {
          releaseScanner()
        }
      }}
    >
      <div className="pos-cart-head">
        <Select
          width="100%"
          value={customerId}
          onChange={setCustomerId}
          icon="user-round"
          options={customers.map(c => ({
            value: c.id,
            label: c.name,
            sub: c.phone || (c.type === 'walkin' ? 'No profile needed' : ''),
            icon: c.type === 'b2b' ? 'building-2' : 'user-round',
          }))}
        />
        {heldBillId && (
          <div className="pos-parked-tag">
            <Icon name="pause" size={12} />
            <span>Resuming parked bill</span>
          </div>
        )}
      </div>
      <div className="pos-lines">
        {cart.length === 0 ? (
          <div className="empty" style={{ height: '100%' }}>
            <div className="ei"><Icon name="shopping-cart" size={22} /></div>
            <div style={{ fontWeight: 600, color: 'var(--fg)' }}>Cart is empty</div>
            <div>Scan a barcode or search to add items</div>
          </div>
        ) : cart.map(x => {
          const lineRate = resolveLineGstRate(x.p, effectiveTax)
          return (
          <div className="cart-line" key={x.p.id}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="cl-name">{x.p.name}</div>
              <div className="cl-meta tnum">
                {money(x.p.price)} × {x.qty}{x.p.unit === 'kg' ? ' kg' : ''}
                {lineRate != null ? ` · GST ${lineRate}%` : ''}
              </div>
            </div>
            <div className="qty">
              <button onClick={() => setQty(x.p.id, x.qty - (x.p.unit === 'kg' ? 0.5 : 1))}><Icon name="minus" size={13} /></button>
              <span className="tnum">{x.qty}</span>
              <button onClick={() => setQty(x.p.id, x.qty + (x.p.unit === 'kg' ? 0.5 : 1))}><Icon name="plus" size={13} /></button>
            </div>
            <div className="cl-total tnum">{money(x.p.price * x.qty)}</div>
            <button className="cl-rm" onClick={() => remove(x.p.id)} aria-label="Remove"><Icon name="x" size={14} /></button>
          </div>
          )
        })}
      </div>
      <div className="pos-totals">
        <div className="pos-discount-row">
          <span className="muted">Bill discount <span className="td-sub">(max {maxBillDisc}%)</span></span>
          <div className="row gap6" style={{ flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <div className="seg" style={{ padding: 2 }}>
              {['₹', '%'].map(m => (
                <button key={m} className={discMode === m ? 'on' : ''} style={{ padding: '3px 9px' }} onClick={() => setDiscMode(m)}>{m}</button>
              ))}
            </div>
            <div className="input sm" style={{ width: 84 }}>
              <input
                ref={discountRef}
                className="pos-discount-input"
                type="number"
                value={billDisc || ''}
                placeholder="0"
                onFocus={releaseScanner}
                onChange={e => setBillDisc(parseFloat(e.target.value) || 0)}
              />
            </div>
          </div>
        </div>
        <div className="t-row"><span className="muted">Subtotal</span><span className="tnum">{money2(subtotal)}</span></div>
        {discVal > 0 && <div className="t-row"><span className="muted">Discount</span><span className="tnum" style={{ color: 'var(--success-fg)' }}>−{money2(discVal)}</span></div>}
        <div className="t-row">
          <span className="muted">
            {compositeRate != null ? `GST ${compositeRate}% on bill` : 'GST'}
          </span>
          <span className="tnum">{money2(gst)}</span>
        </div>
        <div className="divider" style={{ margin: '6px 0' }} />
        <div className="t-row grand"><span>Total</span><span className="tnum">{money2(grand)}</span></div>
        <div className="pos-cart-actions">
          {allowHold && (
          <Button variant="outline" size="sm" icon="pause" disabled={!cart.length || holdBusy} onClick={holdBill}>
            {holdBusy ? '…' : 'Hold'}
          </Button>
          )}
          {allowHold && (
          <Button variant="outline" size="sm" icon="list" onClick={() => setParkedOpen(true)}>
            Parked{heldBills.length ? ` (${heldBills.length})` : ''}
          </Button>
          )}
          <Button variant="outline" size="sm" icon="trash-2" onClick={() => setClearCartOpen(true)}>Clear</Button>
        </div>
        <Button variant="primary" className="block pos-pay-btn" icon="wallet" disabled={!cart.length} onClick={() => setPayOpen(true)}>
          Pay {money(grand)} <span className="kbd" style={{ marginLeft: 4 }}>F8</span>
        </Button>
      </div>
    </div>
  )

  const productPanel = (
    <div
      className="pos-products"
      style={{ order: 1 }}
      onMouseDown={e => {
        const t = e.target as HTMLElement
        if (payOpen || savedBill) return
        if (t.closest('.pos-search-input') || t.closest('button') || t.closest('.seg')) return
        engageScanner()
      }}
    >
      <div className="pos-toolbar">
        <div className="input pill pos-scanner-wrap" style={{ flex: 1, maxWidth: 360 }}>
          <Icon name="scan-barcode" size={16} />
          <input
            ref={scannerRef}
            className="pos-scanner-input"
            value={barcode}
            onChange={e => setBarcode(e.target.value)}
            onKeyDown={onBarcode}
            onBlur={() => {
              if (!scannerLock || !active || payOpen || savedBill) return
              window.setTimeout(() => {
                if (!scannerLock) return
                const el = document.activeElement
                if (el?.classList.contains('pos-search-input')) return
                if (el?.classList.contains('pos-discount-input')) return
                if (el?.closest('.pos-cart')) return
                if (payOpen || savedBill) return
                focusScanner()
              }, 0)
            }}
            placeholder="Scan barcode / SKU, then Enter"
            disabled={scanBusy}
            autoComplete="off"
            spellCheck={false}
          />
        </div>
        <div className="input pill" style={{ flex: 1, maxWidth: 320 }}>
          <Icon name="search" size={16} />
          <input
            className="pos-search-input"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            placeholder="Search name, SKU, or barcode (min 2 chars)"
            autoComplete="off"
          />
        </div>
        <div style={{ flex: 1 }} />
        <Segmented
          value={layout}
          onChange={setLayout}
          options={[
            { value: 'split', icon: 'columns-2', label: '' },
            { value: 'cartLeft', icon: 'flip-horizontal-2', label: '' },
            { value: 'wide', icon: 'grid-2x2', label: '' },
          ]}
        />
      </div>

      <div className="pos-gst-bar">
        <Badge tone="info">GST: {gstSchemeShortLabel(effectiveTax?.scheme)}</Badge>
        {schemeOverride && (
          <button type="button" className="chip" onClick={() => setSchemeOverride(null)}>Store default</button>
        )}
        {canEditGst ? (
          <Segmented
            value={schemeOverride ?? effectiveTax?.scheme ?? 'PRODUCT'}
            onChange={v => setSchemeOverride(v as GstScheme)}
            options={[
              { value: 'PRODUCT', label: 'Product' },
              { value: 'COMPOSITE', label: 'Composite' },
              { value: 'CATEGORY', label: 'Category' },
            ]}
          />
        ) : (
          <span className="muted" style={{ fontSize: 12 }}>
            {effectiveTax?.scheme === 'CATEGORY' ? 'Category rates apply' : 'Set in Settings → Billing'}
          </span>
        )}
      </div>

      {!isSearching && (
        <div className="pos-picks-head">
          <span className="pos-picks-label">
            {recents.length ? 'Recent & quick picks' : 'Quick picks'}
          </span>
          {scanBusy && <span className="muted" style={{ fontSize: 12 }}><Icon name="loader" size={13} /> Looking up scan…</span>}
        </div>
      )}
      {isSearching && (
        <div className="pos-picks-head">
          <span className="pos-picks-label">Search results</span>
          {searchQuery.isFetching && <span className="muted" style={{ fontSize: 12 }}><Icon name="loader" size={13} /> Searching…</span>}
        </div>
      )}

      <div className="prod-grid" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${dense ? 132 : 158}px, 1fr))` }}>
        {panelLoading && displayProducts.length === 0 ? (
          <div className="empty" style={{ gridColumn: '1/-1' }}>
            <Icon name="loader" size={22} />
            <div style={{ fontWeight: 600, color: 'var(--fg)', marginTop: 8 }}>Loading…</div>
          </div>
        ) : panelError ? (
          <div className="empty" style={{ gridColumn: '1/-1' }}>
            <div className="ei"><Icon name="alert-circle" size={22} /></div>
            <div style={{ fontWeight: 600, color: 'var(--danger-fg)' }}>{panelError}</div>
            <Button size="sm" variant="outline" icon="refresh-cw" onClick={refetch} style={{ marginTop: 10 }}>Retry</Button>
          </div>
        ) : (
          <>
            {displayProducts.map(p => <ProductCard key={p.id} p={p} onAdd={add} dense={dense} />)}
            {displayProducts.length === 0 && (
              <div className="empty pos-empty-start" style={{ gridColumn: '1/-1' }}>
                <div className="ei"><Icon name={isSearching ? 'search-x' : 'scan-barcode'} size={22} /></div>
                <div style={{ fontWeight: 600, color: 'var(--fg)' }}>
                  {isSearching ? 'No products found' : 'Scan to start'}
                </div>
                <div className="muted" style={{ fontSize: 12.5, maxWidth: 320, textAlign: 'center' }}>
                  {isSearching
                    ? 'Try a different name, SKU, or barcode.'
                    : 'Use the scanner field or search above. Quick picks appear after your first sale or when items are added.'}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )

  return (
    <div className="pos-root">
      {cartFirst ? <>{cartPanel}{productPanel}</> : <>{productPanel}{cartPanel}</>}
      {payOpen && (
        <PaymentModal
          total={grand}
          customer={customer}
          allowCreditSales={billing?.allowCreditSales !== false}
          onClose={() => !payBusy && setPayOpen(false)}
          onDone={completeSale}
          busy={payBusy}
        />
      )}
      {savedBill && <ReceiptModal bill={savedBill} meta={receiptMeta} printOptions={printOptions} onClose={() => setSavedBill(null)} />}
      {parkedOpen && (
        <ParkedBillsModal
          bills={heldBills}
          loading={heldBillsQuery.isPending}
          onClose={() => setParkedOpen(false)}
          onResume={resumeHeldBill}
          onDiscard={id => setDiscardId(id)}
          busyId={parkedBusyId}
        />
      )}
      <ConfirmDeleteModal
        open={discardId != null}
        title="Discard parked bill?"
        sub={(() => {
          const b = heldBills.find(x => x.id === discardId)
          return b ? `${b.billNo} · ${b.customerName}` : undefined
        })()}
        onClose={() => !parkedBusyId && setDiscardId(null)}
        busy={parkedBusyId != null}
        onConfirm={async () => {
          if (!discardId) return
          await discardParkedBill(discardId)
          setDiscardId(null)
        }}
      />
      <ConfirmDeleteModal
        open={clearCartOpen}
        title="Clear cart?"
        sub={cart.length ? `${cart.length} item${cart.length === 1 ? '' : 's'} will be removed` : undefined}
        confirmText="CLEAR"
        onClose={() => setClearCartOpen(false)}
        onConfirm={() => {
          clearBill()
          setClearCartOpen(false)
        }}
      />
    </div>
  )
}
