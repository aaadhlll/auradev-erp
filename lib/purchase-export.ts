import type { PurchaseDetail } from './purchases-api'
import { statusLabel } from './purchases-api'
import { DEFAULT_RECEIPT_META, DEFAULT_RECEIPT_PRINT, type ReceiptMeta, type ReceiptPrintOptions } from './receipt-export'

function money(n: number): string {
  return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatDate(iso: string): string {
  const d = iso.includes('T') ? iso : iso + 'T00:00:00'
  return new Date(d).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

function purchaseLines(purchase: PurchaseDetail, meta: ReceiptMeta): string[] {
  const lines: string[] = [
    meta.storeName ?? DEFAULT_RECEIPT_META.storeName!,
    meta.storePhone ?? DEFAULT_RECEIPT_META.storePhone!,
  ]
  if (meta.gstin) lines.push(`GSTIN: ${meta.gstin}`)
  if (meta.address) lines.push(meta.address)
  lines.push(
    '--------------------------------',
    'SUPPLIER PURCHASE BILL',
    `No.  ${purchase.purchaseNo}`,
    `Date  ${formatDate(purchase.billDate)}`,
    purchase.dueDate ? `Due   ${formatDate(purchase.dueDate)}` : '',
    `Status  ${statusLabel(purchase.status)}`,
    '--------------------------------',
    `Supplier: ${purchase.supplierName}`,
  )
  if (purchase.supplierGstin) lines.push(`GSTIN: ${purchase.supplierGstin}`)
  if (purchase.supplierPhone) lines.push(`Phone: ${purchase.supplierPhone}`)
  lines.push('--------------------------------')
  for (const line of purchase.lines) {
    lines.push(line.name)
    lines.push(`  ${line.quantity} ${line.unitLabel} x ${money(line.rate)}  ${money(line.lineTotal)}`)
  }
  lines.push('--------------------------------')
  lines.push(`Subtotal${' '.repeat(16)}${money(purchase.subtotal)}`)
  lines.push(`GST${' '.repeat(20)}${money(purchase.gstTotal)}`)
  lines.push(`TOTAL${' '.repeat(19)}${money(purchase.grandTotal)}`)
  if (purchase.notes) {
    lines.push('--------------------------------')
    lines.push(`Note: ${purchase.notes}`)
  }
  lines.push('--------------------------------')
  lines.push(meta.billFooter?.trim() || 'Internal purchase record')
  return lines.filter(Boolean)
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`Failed to load logo: ${src}`))
    img.src = src
  })
}

async function renderCanvas(
  purchase: PurchaseDetail,
  meta: ReceiptMeta,
  options: ReceiptPrintOptions = DEFAULT_RECEIPT_PRINT,
): Promise<HTMLCanvasElement> {
  const widthMm = options.widthMm === 58 ? 58 : 80
  const width = Math.round(widthMm * 4)
  const lines = purchaseLines(purchase, meta)
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
    const isTitle = i === 0 || line === 'SUPPLIER PURCHASE BILL'
    ctx.font = isTitle ? 'bold 14px sans-serif' : '13px monospace'
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

export async function savePurchaseJpeg(
  purchase: PurchaseDetail,
  meta: ReceiptMeta = DEFAULT_RECEIPT_META,
  options: ReceiptPrintOptions = DEFAULT_RECEIPT_PRINT,
) {
  const canvas = await renderCanvas(purchase, meta, options)
  canvas.toBlob(blob => {
    if (blob) downloadBlob(blob, `${purchase.purchaseNo}.jpg`)
  }, 'image/jpeg', 0.92)
}

export async function savePurchasePdf(
  purchase: PurchaseDetail,
  meta: ReceiptMeta = DEFAULT_RECEIPT_META,
  options: ReceiptPrintOptions = DEFAULT_RECEIPT_PRINT,
) {
  const canvas = await renderCanvas(purchase, meta, options)
  const imgData = canvas.toDataURL('image/png')
  const { jsPDF } = await import('jspdf')
  const widthMm = options.widthMm === 58 ? 58 : 80
  const heightMm = (canvas.height / canvas.width) * widthMm
  const pdf = new jsPDF({ unit: 'mm', format: [widthMm, heightMm], orientation: 'portrait' })
  pdf.addImage(imgData, 'PNG', 0, 0, widthMm, heightMm)
  pdf.save(`${purchase.purchaseNo}.pdf`)
}

export async function printPurchase(
  purchase: PurchaseDetail,
  meta: ReceiptMeta = DEFAULT_RECEIPT_META,
  options: ReceiptPrintOptions = DEFAULT_RECEIPT_PRINT,
) {
  const canvas = await renderCanvas(purchase, meta, options)
  const dataUrl = canvas.toDataURL('image/png')
  const widthMm = options.widthMm === 58 ? 58 : 80
  const win = window.open('', '_blank', 'noopener,noreferrer,width=360,height=720')
  if (!win) return
  win.document.write(`<!DOCTYPE html>
<html><head><title>${purchase.purchaseNo}</title>
<style>
  body { margin: 0; display: flex; justify-content: center; background: #fff; }
  img { width: ${widthMm}mm; max-width: 100%; height: auto; }
  @media print { body { margin: 0; } img { width: ${widthMm}mm; } }
</style></head>
<body><img src="${dataUrl}" alt="Purchase bill" onload="window.print(); window.close();" /></body></html>`)
  win.document.close()
}
