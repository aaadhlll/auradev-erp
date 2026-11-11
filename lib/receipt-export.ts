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
  const lines = receiptLines(bill, meta, options)
  const lineHeight = widthMm === 58 ? 16 : 18
  const padding = widthMm === 58 ? 12 : 16
  const showLogo = options.showLogo !== false
  const logoUrl = showLogo ? (meta.logoUrl ?? DEFAULT_RECEIPT_META.logoUrl!) : undefined

  let logoBlock = 0
  let logoImg: HTMLImageElement | null = null
  if (logoUrl) {
    try {
      logoImg = await loadImage(logoUrl)
      const maxLogoWidth = width - padding * 2
      const scale = Math.min(1, maxLogoWidth / logoImg.width)
      logoBlock = logoImg.height * scale + 12
    } catch {
      logoImg = null
    }
  }

  const height = padding * 2 + logoBlock + lines.length * lineHeight
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)
  ctx.fillStyle = '#111111'

  if (logoImg) {
    const maxLogoWidth = width - padding * 2
    const scale = Math.min(1, maxLogoWidth / logoImg.width)
    const drawWidth = logoImg.width * scale
    const drawHeight = logoImg.height * scale
    ctx.drawImage(logoImg, (width - drawWidth) / 2, padding, drawWidth, drawHeight)
  }

  const textTop = padding + logoBlock
  lines.forEach((line, i) => {
    ctx.font = i === 0 ? `bold ${widthMm === 58 ? 12 : 14}px sans-serif` : `${widthMm === 58 ? 11 : 13}px monospace`
    ctx.fillText(line, padding, textTop + (i + 1) * lineHeight - 4)
  })
  return canvas
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
