import type { SavedBill } from './billing-api'

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
  showGstBreakup?: boolean
  showCustomer?: boolean
}

export const DEFAULT_RECEIPT_PRINT: ReceiptPrintOptions = {
  widthMm: 80,
  showLogo: true,
  copies: 1,
  showCashier: true,
  showGstBreakup: true,
  showCustomer: true,
}

export const DEFAULT_RECEIPT_META: ReceiptMeta = {
  storeName: 'Nenjankod Supermarket',
  storePhone: '0820 256 7711',
  logoUrl: '/logo.jpeg',
}

function money(n: number): string {
  return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  })
}

function receiptLines(bill: SavedBill, meta: ReceiptMeta, options: ReceiptPrintOptions = DEFAULT_RECEIPT_PRINT): string[] {
  const lines: string[] = [
    meta.storeName ?? DEFAULT_RECEIPT_META.storeName!,
    meta.storePhone ?? DEFAULT_RECEIPT_META.storePhone!,
  ]
  if (meta.gstin) lines.push(`GSTIN: ${meta.gstin}`)
  if (meta.address) lines.push(meta.address)
  lines.push(
    '--------------------------------',
    `Bill  ${bill.billNo}`,
    formatDate(bill.createdAt),
  )
  if (options.showCustomer !== false) lines.push(`Customer: ${bill.customerName}`)
  if (options.showCashier !== false) lines.push(`Cashier: ${bill.cashierName}`)
  lines.push('--------------------------------')
  for (const line of bill.lines) {
    lines.push(line.name)
    lines.push(`  ${line.quantity} ${line.unitLabel} x ${money(line.unitPrice)}  ${money(line.lineTotal)}`)
  }
  lines.push('--------------------------------')
  lines.push(`Subtotal${' '.repeat(18)}${money(bill.subtotal)}`)
  if (bill.billDiscount > 0) {
    lines.push(`Discount${' '.repeat(18)}-${money(bill.billDiscount)}`)
  }
  if (options.showGstBreakup !== false) {
    lines.push(`CGST${' '.repeat(20)}${money(bill.cgstTotal)}`)
    lines.push(`SGST${' '.repeat(20)}${money(bill.sgstTotal)}`)
  } else if (bill.cgstTotal + bill.sgstTotal > 0) {
    lines.push(`GST${' '.repeat(21)}${money(bill.cgstTotal + bill.sgstTotal)}`)
  }
  lines.push(`TOTAL${' '.repeat(19)}${money(bill.grandTotal)}`)
  lines.push(`Paid via ${bill.paymentMethod}`)
  if (bill.tendered != null) {
    lines.push(`Tendered${' '.repeat(17)}${money(bill.tendered)}`)
  }
  if (bill.changeDue != null && bill.changeDue > 0) {
    lines.push(`Change${' '.repeat(19)}${money(bill.changeDue)}`)
  }
  lines.push('--------------------------------')
  lines.push(meta.billFooter?.trim() || 'Thank you! Visit again.')
  return lines
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`Failed to load receipt logo: ${src}`))
    img.src = src
  })
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
  const win = window.open('', '_blank', 'noopener,noreferrer,width=360,height=720')
  if (!win) return
  win.document.write(`<!DOCTYPE html>
<html><head><title>${bill.billNo}</title>
<style>
  body { margin: 0; display: flex; justify-content: center; background: #fff; }
  img { width: ${widthMm}mm; max-width: 100%; height: auto; }
  @media print { body { margin: 0; } img { width: ${widthMm}mm; } }
</style></head>
<body><img src="${dataUrl}" alt="Receipt" onload="window.print(); window.close();" /></body></html>`)
  win.document.close()
}

export async function printReceipt(
  bill: SavedBill,
  meta: ReceiptMeta = DEFAULT_RECEIPT_META,
  options: ReceiptPrintOptions = DEFAULT_RECEIPT_PRINT,
) {
  const copies = Math.max(1, Math.min(options.copies ?? 1, 3))
  for (let i = 0; i < copies; i++) {
    await printReceiptOnce(bill, meta, options)
    if (i < copies - 1) await sleep(600)
  }
}
