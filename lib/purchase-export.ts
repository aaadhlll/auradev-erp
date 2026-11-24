import type { PurchaseDetail, PurchaseLine } from './purchases-api'
import { statusLabel } from './purchases-api'
import { money2 } from './erp-data'
import { DEFAULT_RECEIPT_META, type ReceiptMeta, type ReceiptPrintOptions } from './receipt-export'

const PAGE_WIDTH = 1123
const PAGE_HEIGHT = 794
const MARGIN = 34
const BRAND = '#1f7a63'
const INK = '#17211d'
const MUTED = '#64706a'
const GRID = '#cfd7d2'
const HEADER = '#e9f3ee'
// Keep the final-page totals, notes, and approval signatures clear even when
// item descriptions wrap to a second line.
const ROWS_PER_PAGE = 6

function formatDate(iso: string): string {
  return new Date(iso.includes('T') ? iso : `${iso}T00:00:00`).toLocaleDateString('en-QA', { day: 'numeric', month: 'short', year: 'numeric' })
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

function text(ctx: CanvasRenderingContext2D, value: string, x: number, y: number, size = 13, weight = 400, align: CanvasTextAlign = 'left', color = INK) {
  ctx.font = `${weight} ${size}px Arial, sans-serif`
  ctx.textAlign = align
  ctx.fillStyle = color
  ctx.fillText(value, x, y)
}

function wrap(ctx: CanvasRenderingContext2D, value: string, width: number, size = 13, weight = 400): string[] {
  ctx.font = `${weight} ${size}px Arial, sans-serif`
  const lines: string[] = []
  let current = ''
  for (const word of value.trim().split(/\s+/).filter(Boolean)) {
    const candidate = current ? `${current} ${word}` : word
    if (current && ctx.measureText(candidate).width > width) { lines.push(current); current = word } else current = candidate
  }
  if (current) lines.push(current)
  return lines.length ? lines : ['—']
}

function rule(ctx: CanvasRenderingContext2D, x1: number, y: number, x2: number, color = GRID) {
  ctx.strokeStyle = color
  ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(x1, y); ctx.lineTo(x2, y); ctx.stroke()
}

function documentLabel(purchase: PurchaseDetail) {
  if (purchase.status === 'PENDING_GRN') return 'PURCHASE ORDER'
  if (purchase.status === 'CANCELLED') return 'CANCELLED PURCHASE ORDER'
  return 'PURCHASE RECEIPT'
}

function drawHeader(ctx: CanvasRenderingContext2D, purchase: PurchaseDetail, meta: ReceiptMeta, page: number, pageCount: number) {
  ctx.fillStyle = BRAND; ctx.fillRect(0, 0, PAGE_WIDTH, 8)
  ctx.fillStyle = BRAND; ctx.fillRect(MARGIN, 30, 48, 48)
  text(ctx, 'M', MARGIN + 24, 63, 25, 700, 'center', '#ffffff')
  text(ctx, meta.storeName ?? DEFAULT_RECEIPT_META.storeName!, MARGIN + 64, 49, 17, 700)
  const identity = [meta.address, meta.storePhone, meta.gstin ? `CR / TIN: ${meta.gstin}` : null].filter(Boolean).join('  •  ')
  if (identity) text(ctx, identity, MARGIN + 64, 69, 10, 400, 'left', MUTED)
  text(ctx, documentLabel(purchase), PAGE_WIDTH - MARGIN, 52, 24, 700, 'right', BRAND)
  text(ctx, purchase.purchaseNo, PAGE_WIDTH - MARGIN, 75, 14, 700, 'right')
  rule(ctx, MARGIN, 98, PAGE_WIDTH - MARGIN, BRAND)
  if (pageCount > 1) text(ctx, `Page ${page} of ${pageCount}`, PAGE_WIDTH - MARGIN, 116, 10, 400, 'right', MUTED)
}

function drawDetails(ctx: CanvasRenderingContext2D, purchase: PurchaseDetail) {
  const left = MARGIN, right = PAGE_WIDTH / 2 + 20
  const label = (value: string, x: number, y: number) => text(ctx, value.toUpperCase(), x, y, 10, 700, 'left', MUTED)
  const value = (content: string, x: number, y: number) => text(ctx, content || '—', x, y, 13, 600)
  label('Supplier', left, 132); value(purchase.supplierName, left, 151)
  label('Supplier phone', left, 174); value(purchase.supplierPhone ?? '—', left, 193)
  label('Supplier CR / TIN', left, 216); value(purchase.supplierGstin ?? '—', left, 235)
  label('Invoice date', right, 132); value(formatDate(purchase.billDate), right, 151)
  label('Due date', right, 174); value(purchase.dueDate ? formatDate(purchase.dueDate) : '—', right, 193)
  label('Status', right, 216); value(statusLabel(purchase.status), right, 235)
}

function drawTable(ctx: CanvasRenderingContext2D, lines: PurchaseLine[], startY: number, showTax: boolean) {
  const columns = [
    { label: '#', width: 28, align: 'center' as const }, { label: 'ITEM DESCRIPTION', width: 285, align: 'left' as const },
    { label: 'SKU', width: 125, align: 'left' as const }, { label: 'UNIT', width: 64, align: 'left' as const },
    { label: 'QTY', width: 64, align: 'right' as const }, { label: 'RATE', width: 118, align: 'right' as const },
    ...(showTax ? [{ label: 'TAX', width: 64, align: 'right' as const }] : []),
    { label: 'TOTAL', width: showTax ? 107 : 171, align: 'right' as const },
  ]
  const tableWidth = columns.reduce((total, column) => total + column.width, 0)
  let x = MARGIN
  ctx.fillStyle = HEADER; ctx.fillRect(MARGIN, startY, tableWidth, 29)
  ctx.strokeStyle = GRID; ctx.strokeRect(MARGIN, startY, tableWidth, 29)
  for (const column of columns) {
    text(ctx, column.label, column.align === 'right' ? x + column.width - 8 : column.align === 'center' ? x + column.width / 2 : x + 8, startY + 19, 10, 700, column.align)
    x += column.width; rule(ctx, x, startY, x)
  }
  let y = startY + 29
  lines.forEach((line, index) => {
    const description = wrap(ctx, line.name, 270, 12, 600).slice(0, 2)
    const rowHeight = Math.max(38, 18 + description.length * 15)
    x = MARGIN; ctx.strokeStyle = GRID; ctx.strokeRect(MARGIN, y, tableWidth, rowHeight)
    const values = [
      String(index + 1), description[0], line.sku, line.unitLabel, `${line.quantity}`, money2(line.rate),
      ...(showTax ? [line.gstRate > 0 ? `${line.gstRate}%` : '—'] : []), money2(line.lineTotal),
    ]
    columns.forEach((column, columnIndex) => {
      text(ctx, values[columnIndex], column.align === 'right' ? x + column.width - 8 : column.align === 'center' ? x + column.width / 2 : x + 8, y + 22, 11.5, columnIndex === 1 ? 600 : 400, column.align)
      if (columnIndex === 1 && description[1]) text(ctx, description[1], x + 8, y + 37, 11.5, 600)
      x += column.width; rule(ctx, x, y, x)
    })
    y += rowHeight
  })
  return y
}

function drawSummary(ctx: CanvasRenderingContext2D, purchase: PurchaseDetail, startY: number, showTax: boolean) {
  const width = 300, x = PAGE_WIDTH - MARGIN - width
  const height = showTax ? 112 : 82
  ctx.fillStyle = '#f3f7f4'; ctx.fillRect(x, startY, width, height)
  const row = (label: string, amount: string, offset: number, bold = false) => { text(ctx, label, x + 16, startY + offset, 12, bold ? 700 : 400); text(ctx, amount, x + width - 16, startY + offset, 12, bold ? 700 : 600, 'right') }
  row('Subtotal', money2(purchase.subtotal), 25)
  if (showTax) {
    row('Tax', money2(purchase.gstTotal), 50)
    rule(ctx, x + 16, startY + 65, x + width - 16, BRAND); row('NET AMOUNT', money2(purchase.grandTotal), 91, true)
  } else {
    rule(ctx, x + 16, startY + 42, x + width - 16, BRAND); row('NET AMOUNT', money2(purchase.grandTotal), 68, true)
  }
}

function drawFooter(ctx: CanvasRenderingContext2D, purchase: PurchaseDetail, meta: ReceiptMeta) {
  const y = PAGE_HEIGHT - 76
  if (purchase.notes) {
    text(ctx, 'NOTES', MARGIN, y - 27, 10, 700, 'left', MUTED)
    wrap(ctx, purchase.notes, 520, 11).slice(0, 2).forEach((line, index) => text(ctx, line, MARGIN, y - 10 + index * 14, 11))
  }
  const positions = [MARGIN + 105, PAGE_WIDTH / 2, PAGE_WIDTH - MARGIN - 105]
  ;['Prepared by', 'Verified by', 'Authorized by'].forEach((label, index) => { rule(ctx, positions[index] - 74, y, positions[index] + 74, INK); text(ctx, label, positions[index], y + 18, 11, 700, 'center') })
  text(ctx, `Generated by Mercantile · ${meta.storeName ?? DEFAULT_RECEIPT_META.storeName}`, MARGIN, PAGE_HEIGHT - 20, 9, 400, 'left', MUTED)
}

async function renderPurchasePages(purchase: PurchaseDetail, meta: ReceiptMeta, options: ReceiptPrintOptions): Promise<HTMLCanvasElement[]> {
  const chunks: PurchaseLine[][] = []
  for (let index = 0; index < purchase.lines.length; index += ROWS_PER_PAGE) chunks.push(purchase.lines.slice(index, index + ROWS_PER_PAGE))
  if (!chunks.length) chunks.push([])
  return chunks.map((lines, index) => {
    const canvas = document.createElement('canvas'); canvas.width = PAGE_WIDTH; canvas.height = PAGE_HEIGHT
    const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT)
    drawHeader(ctx, purchase, meta, index + 1, chunks.length)
    const tableY = index === 0 ? 258 : 132
    if (index === 0) drawDetails(ctx, purchase)
    const tableEnd = drawTable(ctx, lines, tableY, options.showTax === true)
    if (index === chunks.length - 1) { drawSummary(ctx, purchase, Math.min(tableEnd + 20, PAGE_HEIGHT - 225), options.showTax === true); drawFooter(ctx, purchase, meta) }
    return canvas
  })
}

async function purchasePdf(purchase: PurchaseDetail, meta: ReceiptMeta, options: ReceiptPrintOptions) {
  const pages = await renderPurchasePages(purchase, meta, options)
  const { jsPDF } = await import('jspdf')
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' })
  pages.forEach((page, index) => { if (index) pdf.addPage('a4', 'landscape'); pdf.addImage(page.toDataURL('image/png'), 'PNG', 0, 0, 297, 210) })
  return { pdf, pages }
}

export async function savePurchaseJpeg(purchase: PurchaseDetail, meta: ReceiptMeta = DEFAULT_RECEIPT_META, options: ReceiptPrintOptions = {}) {
  const pages = await renderPurchasePages(purchase, meta, options)
  pages[0].toBlob(blob => { if (blob) download(blob, `${purchase.purchaseNo}.jpg`) }, 'image/jpeg', 0.94)
}

export async function savePurchasePdf(purchase: PurchaseDetail, meta: ReceiptMeta = DEFAULT_RECEIPT_META, options: ReceiptPrintOptions = {}) {
  const { pdf } = await purchasePdf(purchase, meta, options)
  pdf.save(`${purchase.purchaseNo}.pdf`)
}

export async function printPurchase(purchase: PurchaseDetail, meta: ReceiptMeta = DEFAULT_RECEIPT_META, options: ReceiptPrintOptions = {}) {
  const pages = await renderPurchasePages(purchase, meta, options)
  // Do not use `noopener` here: Chromium/Electron can open the tab but deny
  // access to its document, which leaves the user with a blank print page.
  const win = window.open('', '_blank', 'width=1200,height=850')
  if (!win) throw new Error('The print window was blocked')
  win.opener = null
  const images = pages.map(page => `<img src="${page.toDataURL('image/png')}" alt="${purchase.purchaseNo}" />`).join('')
  win.document.open()
  win.document.write(`<!doctype html><html><head><title>${purchase.purchaseNo}</title><style>@page{size:A4 landscape;margin:0}body{margin:0;background:#eee}img{display:block;width:297mm;height:210mm;margin:0 auto 8px;background:#fff;page-break-after:always}@media print{body{background:#fff}img{margin:0;page-break-after:always}}</style></head><body>${images}</body></html>`)
  win.document.close()
  const ready = () => Array.from(win.document.images).every(image => image.complete && image.naturalWidth > 0)
  const printWhenReady = () => {
    if (!ready()) { window.setTimeout(printWhenReady, 50); return }
    win.focus()
    win.print()
  }
  printWhenReady()
}
