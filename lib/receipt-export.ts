import type { SavedBill } from './billing-api'
import { gstSchemeShortLabel, isBillLevelGstScheme } from './gst'
import { money2 } from './erp-data'

export interface ReceiptMeta {
  storeName?: string
  storePhone?: string
  logoUrl?: string
  billFooter?: string
  gstin?: string
  address?: string
}

export interface ReceiptPrintOptions {
  widthMm?: number
  showLogo?: boolean
  copies?: number
  showCashier?: boolean
  showTax?: boolean
  showGstBreakup?: boolean
  showCustomer?: boolean
  showStorePhone?: boolean
  showStoreAddress?: boolean
  showStoreTin?: boolean
  showBillDate?: boolean
  showPayment?: boolean
  showTendered?: boolean
  showChange?: boolean
  receiptTitle?: string
  /** Label used for generated documents such as a sales return note. */
  documentLabel?: string
}

export const DEFAULT_RECEIPT_PRINT: ReceiptPrintOptions = {
  widthMm: 80,
  showLogo: true,
  copies: 1,
  showCashier: true,
  showTax: false,
  showGstBreakup: true,
  showCustomer: true,
  showStorePhone: true,
  showStoreAddress: true,
  showStoreTin: true,
  showBillDate: true,
  showPayment: true,
  showTendered: true,
  showChange: true,
  receiptTitle: 'SALES RECEIPT',
}

export const DEFAULT_RECEIPT_META: ReceiptMeta = {
  storeName: 'Nenjankod Supermarket',
  storePhone: '0820 256 7711',
  logoUrl: '/logo.jpeg',
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('en-QA', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  })
}

function receiptLines(bill: SavedBill, meta: ReceiptMeta, options: ReceiptPrintOptions = DEFAULT_RECEIPT_PRINT): string[] {
  const lines: string[] = [
    meta.storeName ?? DEFAULT_RECEIPT_META.storeName!,
    meta.storePhone ?? DEFAULT_RECEIPT_META.storePhone!,
  ]
  if (meta.gstin) lines.push(`CR / TIN: ${meta.gstin}`)
  if (meta.address) lines.push(meta.address)
  lines.push(
    '--------------------------------',
    `${options.documentLabel ?? 'Bill'}  ${bill.billNo}`,
    formatDate(bill.createdAt),
    ...(options.showTax === true ? [`Tax scheme: ${gstSchemeShortLabel(bill.gstScheme)}`] : []),
  )
  if (options.showCustomer !== false) lines.push(`Customer: ${bill.customerName}`)
  if (options.showCustomer !== false && bill.customerAddress) lines.push(`Address: ${bill.customerAddress}`)
  if (options.showCashier !== false) lines.push(`Cashier: ${bill.cashierName}`)
  lines.push('--------------------------------')
  const billLevelGst = isBillLevelGstScheme(bill.gstScheme)
  for (const line of bill.lines) {
    lines.push(line.name)
    if (billLevelGst || options.showTax !== true) {
      lines.push(`  ${line.quantity} ${line.unitLabel} x ${money2(line.unitPrice)}  ${money2(line.lineTotal)}`)
    } else {
      lines.push(`  ${line.quantity} ${line.unitLabel} x ${money2(line.unitPrice)} @${line.gstRate}%  ${money2(line.lineTotal)}`)
    }
  }
  lines.push('--------------------------------')
  lines.push(`Subtotal${' '.repeat(18)}${money2(bill.subtotal)}`)
  if (bill.billDiscount > 0) {
    lines.push(`Discount${' '.repeat(18)}-${money2(bill.billDiscount)}`)
  }
  if (options.showTax === true && options.showGstBreakup !== false) {
    if (bill.gstSlabs.length > 0) {
      for (const slab of bill.gstSlabs) {
        const label = billLevelGst
          ? `Composite ${slab.ratePct}%`
          : `GST ${slab.ratePct}%`
        lines.push(`${label}${' '.repeat(Math.max(1, 20 - label.length))}${money2(slab.taxAmount)}`)
      }
    }
    lines.push(`CGST${' '.repeat(20)}${money2(bill.cgstTotal)}`)
    lines.push(`SGST${' '.repeat(20)}${money2(bill.sgstTotal)}`)
  } else if (options.showTax === true && bill.cgstTotal + bill.sgstTotal > 0) {
    lines.push(`GST${' '.repeat(21)}${money2(bill.cgstTotal + bill.sgstTotal)}`)
  }
  lines.push(`TOTAL${' '.repeat(19)}${money2(bill.grandTotal)}`)
  lines.push(`Paid via ${bill.paymentMethod}`)
  if (bill.tendered != null) {
    lines.push(`Tendered${' '.repeat(17)}${money2(bill.tendered)}`)
  }
  if (bill.changeDue != null && bill.changeDue > 0) {
    lines.push(`Change${' '.repeat(19)}${money2(bill.changeDue)}`)
  }
  lines.push('--------------------------------')
  lines.push(meta.billFooter?.trim() || 'Thank you! Visit again.')
  return lines
}

function loadImage(src: string): Promise<HTMLImageElement> {
  if (cachedLogo?.src === src) {
    return Promise.resolve(cachedLogo.img)
  }
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      cachedLogo = { src, img }
      resolve(img)
    }
    img.onerror = () => reject(new Error(`Failed to load receipt logo: ${src}`))
    img.src = src
  })
}

/** Warm logo cache when POS loads — avoids delay on first print. */
export function preloadReceiptLogo(logoUrl?: string) {
  const src = logoUrl ?? DEFAULT_RECEIPT_META.logoUrl!
  if (!src || cachedLogo?.src === src) return
  void loadImage(src).catch(() => {})
}

let cachedLogo: { src: string; img: HTMLImageElement } | null = null
let printFrame: HTMLIFrameElement | null = null

function getPrintFrame(): HTMLIFrameElement {
  if (printFrame && document.body.contains(printFrame)) return printFrame
  printFrame = document.createElement('iframe')
  printFrame.setAttribute('aria-hidden', 'true')
  printFrame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden'
  document.body.appendChild(printFrame)
  return printFrame
}

async function renderCanvas(
  bill: SavedBill,
  meta: ReceiptMeta,
  options: ReceiptPrintOptions = DEFAULT_RECEIPT_PRINT,
): Promise<HTMLCanvasElement> {
  const widthMm = options.widthMm === 58 ? 58 : 80
  const width = Math.round(widthMm * 4)
  const padding = widthMm === 58 ? 12 : 16
  const bodySize = widthMm === 58 ? 10 : 12
  const smallSize = widthMm === 58 ? 8 : 10
  const lineHeight = widthMm === 58 ? 15 : 18
  const showLogo = options.showLogo !== false
  const logoUrl = showLogo ? (meta.logoUrl ?? DEFAULT_RECEIPT_META.logoUrl!) : undefined

  let logoImg: HTMLImageElement | null = null
  if (logoUrl) {
    try { logoImg = await loadImage(logoUrl) } catch { logoImg = null }
  }

  // Start with a generous canvas and crop after rendering. This keeps receipts
  // compact for short bills while allowing longer baskets without clipping.
  // Customer addresses can be several lines long. Reserve enough space before
  // rendering so the cropped receipt never cuts the address or the rows below.
  const addressAllowance = bill.customerAddress
    ? Math.ceil(bill.customerAddress.length / (widthMm === 58 ? 22 : 34)) * lineHeight
    : 0
  const height = Math.max(760, 430 + bill.lines.length * (lineHeight * 2 + 8) + addressAllowance)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)
  ctx.fillStyle = '#111111'

  let y = padding
  const inner = width - padding * 2
  const text = (value: string, x: number, align: CanvasTextAlign = 'left', size = bodySize, bold = false) => {
    ctx.font = `${bold ? '700' : '400'} ${size}px Arial, sans-serif`
    ctx.textAlign = align
    ctx.fillText(value, x, y)
  }
  const rule = () => { ctx.strokeStyle = '#1f2937'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(padding, y); ctx.lineTo(width - padding, y); ctx.stroke(); y += 10 }
  const row = (label: string, value: string, bold = false) => { text(label, padding, 'left', bodySize, bold); text(value, width - padding, 'right', bodySize, bold); y += lineHeight }
  const centre = (value: string, size = bodySize, bold = false) => { text(value, width / 2, 'center', size, bold); y += lineHeight }
  const truncate = (value: string, maxWidth: number) => {
    ctx.font = `700 ${bodySize}px Arial, sans-serif`
    if (ctx.measureText(value).width <= maxWidth) return value
    let textValue = value
    while (textValue.length && ctx.measureText(`${textValue}…`).width > maxWidth) textValue = textValue.slice(0, -1)
    return `${textValue}…`
  }
  const wrap = (value: string, maxWidth: number, size = bodySize, bold = false) => {
    ctx.font = `${bold ? '700' : '400'} ${size}px Arial, sans-serif`
    const words = value.trim().split(/\s+/).filter(Boolean)
    const lines: string[] = []
    let current = ''
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word
      if (current && ctx.measureText(candidate).width > maxWidth) {
        lines.push(current)
        current = word
      } else {
        current = candidate
      }
    }
    if (current) lines.push(current)
    return lines.length ? lines : ['']
  }
  const detailBlock = (label: string, value: string) => {
    text(label, padding, 'left', bodySize)
    y += lineHeight
    for (const line of wrap(value, inner - 8, bodySize)) {
      text(line, padding + 8, 'left', bodySize)
      y += lineHeight
    }
  }

  if (logoImg) {
    const scale = Math.min(1, (inner * .55) / logoImg.width, 48 / logoImg.height)
    const drawWidth = logoImg.width * scale, drawHeight = logoImg.height * scale
    ctx.drawImage(logoImg, (width - drawWidth) / 2, y, drawWidth, drawHeight)
    y += drawHeight + 8
  }
  centre(meta.storeName ?? DEFAULT_RECEIPT_META.storeName!, widthMm === 58 ? 13 : 16, true)
  if (options.showStoreAddress !== false && meta.address) centre(meta.address, smallSize)
  const contact = [
    options.showStorePhone !== false ? meta.storePhone : null,
    options.showStoreTin !== false && meta.gstin ? `CR / TIN: ${meta.gstin}` : null,
  ].filter(Boolean).join('  ·  ')
  if (contact) centre(contact, smallSize)
  y += 3; rule()
  centre(options.documentLabel ?? options.receiptTitle ?? 'SALES RECEIPT', smallSize, true)
  row('Bill no.', bill.billNo)
  if (options.showBillDate !== false) row('Date', formatDate(bill.createdAt))
  if (options.showCustomer !== false) row('Customer', bill.customerName)
  if (options.showCustomer !== false && bill.customerAddress) detailBlock('Address', bill.customerAddress)
  if (options.showCashier !== false) row('Cashier', bill.cashierName)
  y += 2; rule()
  text('ITEM', padding, 'left', smallSize, true); text('AMOUNT', width - padding, 'right', smallSize, true); y += lineHeight
  const billLevelGst = isBillLevelGstScheme(bill.gstScheme)
  for (const line of bill.lines) {
    text(truncate(line.name, inner - 72), padding, 'left', bodySize, true)
    text(money2(line.lineTotal), width - padding, 'right', bodySize, true)
    y += lineHeight
    const taxNote = options.showTax === true && !billLevelGst ? ` · ${line.gstRate}% tax` : ''
    text(`${line.quantity} ${line.unitLabel} × ${money2(line.unitPrice)}${taxNote}`, padding, 'left', smallSize)
    y += lineHeight + 4
  }
  rule()
  row('Subtotal', money2(bill.subtotal))
  if (bill.billDiscount > 0) row('Discount', `−${money2(bill.billDiscount)}`)
  if (options.showTax === true && options.showGstBreakup !== false && bill.cgstTotal + bill.sgstTotal > 0) {
    row('CGST', money2(bill.cgstTotal)); row('SGST', money2(bill.sgstTotal))
  }
  rule(); row('TOTAL', money2(bill.grandTotal), true); y += 3
  const payments = bill.payments?.length
    ? bill.payments
    : [{ method: bill.paymentMethod, amount: bill.grandTotal, tendered: bill.tendered, changeDue: bill.changeDue }]
  if (options.showPayment !== false) {
    if (payments.length > 1) {
      row('Payment', 'SPLIT', true)
      for (const payment of payments) row(`  ${payment.method}`, money2(payment.amount))
    } else {
      row('Payment', payments[0].method)
    }
  }
  const totalTendered = payments.reduce((total, payment) => total + (payment.tendered ?? 0), 0)
  const totalChange = payments.reduce((total, payment) => total + (payment.changeDue ?? 0), 0)
  if (options.showTendered !== false && totalTendered > 0) row('Tendered', money2(totalTendered))
  if (options.showChange !== false && totalChange > 0) row('Change due', money2(totalChange))
  y += 3; rule()
  centre(meta.billFooter?.trim() || 'Thank you for shopping with us!', smallSize, true)
  centre('Please visit again', smallSize)

  const cropped = document.createElement('canvas')
  cropped.width = width
  cropped.height = Math.ceil(y + padding)
  cropped.getContext('2d')!.drawImage(canvas, 0, 0)
  return cropped
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export async function saveReceiptPng(
  bill: SavedBill,
  meta: ReceiptMeta = DEFAULT_RECEIPT_META,
  options: ReceiptPrintOptions = DEFAULT_RECEIPT_PRINT,
) {
  const canvas = await renderCanvas(bill, meta, options)
  canvas.toBlob(blob => {
    if (blob) downloadBlob(blob, `${bill.billNo}.png`)
  }, 'image/png')
}

export async function saveReceiptPdf(
  bill: SavedBill,
  meta: ReceiptMeta = DEFAULT_RECEIPT_META,
  options: ReceiptPrintOptions = DEFAULT_RECEIPT_PRINT,
) {
  const canvas = await renderCanvas(bill, meta, options)
  const imgData = canvas.toDataURL('image/png')
  const { jsPDF } = await import('jspdf')
  const widthMm = options.widthMm === 58 ? 58 : 80
  const heightMm = (canvas.height / canvas.width) * widthMm
  const pdf = new jsPDF({ unit: 'mm', format: [widthMm, heightMm], orientation: 'portrait' })
  pdf.addImage(imgData, 'PNG', 0, 0, widthMm, heightMm)
  pdf.save(`${bill.billNo}.pdf`)
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function printReceiptOnce(
  bill: SavedBill,
  meta: ReceiptMeta,
  options: ReceiptPrintOptions,
) {
  const canvas = await renderCanvas(bill, meta, options)
  const dataUrl = canvas.toDataURL('image/png')
  const widthMm = options.widthMm === 58 ? 58 : 80
  const frame = getPrintFrame()
  const doc = frame.contentDocument ?? frame.contentWindow?.document
  if (!doc) return
  doc.open()
  doc.write(`<!DOCTYPE html>
<html><head><title>${bill.billNo}</title>
<style>
  @page { margin: 0; }
  body { margin: 0; display: flex; justify-content: center; background: #fff; }
  img { width: ${widthMm}mm; max-width: 100%; height: auto; }
</style></head>
<body><img src="${dataUrl}" alt="Receipt" /></body></html>`)
  doc.close()
  const img = doc.querySelector('img')
  const print = () => {
    frame.contentWindow?.focus()
    frame.contentWindow?.print()
  }
  if (img?.complete) {
    print()
  } else {
    img?.addEventListener('load', print, { once: true })
  }
}

export async function printReceipt(
  bill: SavedBill,
  meta: ReceiptMeta = DEFAULT_RECEIPT_META,
  options: ReceiptPrintOptions = DEFAULT_RECEIPT_PRINT,
) {
  const copies = Math.max(1, Math.min(options.copies ?? 1, 3))
  for (let i = 0; i < copies; i++) {
    await printReceiptOnce(bill, meta, options)
    if (i < copies - 1) await sleep(250)
  }
}
