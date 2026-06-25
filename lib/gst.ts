export type GstScheme = 'PRODUCT' | 'COMPOSITE' | 'CATEGORY'

export interface CategoryGstRate {
  categoryId: string
  categoryName?: string
  ratePct: number
}

export interface TaxSettings {
  scheme: GstScheme
  priceIncludesTax: boolean
  enabledRates: number[]
  compositeRatePct: number
  defaultCategoryRatePct: number
  categoryRates: CategoryGstRate[]
}

export const GST_SCHEME_LABELS: Record<GstScheme, string> = {
  PRODUCT: 'Product-wise (HSN / SKU rate)',
  COMPOSITE: 'Composite scheme (bill total)',
  CATEGORY: 'Category-wise (shelf group rate)',
}

export const GST_SCHEME_HINTS: Record<GstScheme, string> = {
  PRODUCT: 'Each line uses the GST % on the product master — standard for detailed GST invoices with per-HSN rates.',
  COMPOSITE: 'One GST % on the bill total after discounts — matches GST composition scheme (not per line).',
  CATEGORY: 'GST % from category mapping (e.g. Grains 5%, Snacks 18%) — applied per line by category.',
}

export const GST_SCHEME_GUIDE: { title: string; body: string }[] = [
  {
    title: 'When to use product-wise',
    body: 'Default for registered stores issuing proper tax invoices. Each SKU keeps its own GST % aligned with HSN (standard slabs plus any custom rates you enable).',
  },
  {
    title: 'When to use composite',
    body: 'GST composition scheme: pick one rate and apply it once on the taxable bill total (after line and bill discounts), not on each item.',
  },
  {
    title: 'When to use category-wise',
    body: 'Useful when bulk imports have wrong product tax but categories are correct — map Grains, Dairy, Snacks, etc. to slab rates.',
  },
  {
    title: 'POS override',
    body: 'Managers can switch scheme on the billing screen for the current cart without changing store defaults. The scheme is saved on each bill.',
  },
]

export const STANDARD_GST_RATES = [0, 5, 12, 18] as const

export function gstRateSelectOptions(
  enabledRates: number[] | undefined,
  extraRate?: number | string | null,
): { value: string; label: string }[] {
  const base = enabledRates?.length ? [...enabledRates] : [...STANDARD_GST_RATES]
  if (extraRate != null && extraRate !== '') {
    const n = Number(extraRate)
    if (!Number.isNaN(n) && !base.includes(n)) base.push(n)
  }
  return [...new Set(base)].sort((a, b) => a - b).map(r => ({ value: String(r), label: `${r}%` }))
}

export function customGstRates(enabledRates: number[]): number[] {
  const standard = new Set<number>(STANDARD_GST_RATES)
  return enabledRates.filter(r => !standard.has(r)).sort((a, b) => a - b)
}

export function parseGstRateInput(raw: string): number | null {
  const n = Number(raw.trim())
  if (raw.trim() === '' || Number.isNaN(n) || n < 0 || n > 100) return null
  return Math.round(n * 100) / 100
}

export interface GstProductLike {
  tax: number
  categoryId?: string | null
}

export function isBillLevelGstScheme(scheme?: GstScheme | string | null): boolean {
  return scheme === 'COMPOSITE'
}

export function effectiveTaxSettings(
  settings: TaxSettings | null | undefined,
  schemeOverride?: GstScheme | null,
): TaxSettings | null | undefined {
  if (!settings) return settings
  if (!schemeOverride || schemeOverride === settings.scheme) return settings
  return { ...settings, scheme: schemeOverride }
}

/** Per-line display rate — composite returns null (tax is on bill total only). */
export function resolveLineGstRate(
  product: GstProductLike,
  tax: TaxSettings | null | undefined,
): number | null {
  if (!tax) return product.tax
  switch (tax.scheme) {
    case 'COMPOSITE':
      return null
    case 'CATEGORY': {
      const row = tax.categoryRates.find(r => r.categoryId === product.categoryId)
      return row?.ratePct ?? tax.defaultCategoryRatePct ?? product.tax
    }
    default:
      return product.tax
  }
}

export function compositeBillGst(
  taxableBase: number,
  ratePct: number,
  priceIncludesTax: boolean,
): number {
  if (taxableBase <= 0) return 0
  if (priceIncludesTax) {
    const divisor = 1 + ratePct / 100
    return taxableBase - taxableBase / divisor
  }
  return taxableBase * ratePct / 100
}

export function lineGstAmount(
  lineGross: number,
  lineDiscount: number,
  ratePct: number,
  priceIncludesTax: boolean,
): number {
  const net = Math.max(0, lineGross - lineDiscount)
  if (priceIncludesTax) {
    const divisor = 1 + ratePct / 100
    const taxable = net / divisor
    return net - taxable
  }
  return lineGross * ratePct / 100
}

export function cartGstTotal(
  tax: TaxSettings | null | undefined,
  lines: { gross: number; discount: number; ratePct: number }[],
  billDiscount: number,
): number {
  if (!tax) return 0
  if (tax.scheme === 'COMPOSITE') {
    const lineNet = lines.reduce((s, l) => s + l.gross - l.discount, 0)
    const taxableBase = Math.max(0, lineNet - billDiscount)
    return compositeBillGst(taxableBase, tax.compositeRatePct, tax.priceIncludesTax)
  }
  return lines.reduce(
    (sum, l) => sum + lineGstAmount(l.gross, l.discount, l.ratePct, tax.priceIncludesTax),
    0,
  )
}

export function gstSchemeShortLabel(scheme: GstScheme | string | undefined): string {
  switch (scheme) {
    case 'COMPOSITE': return 'Composite (bill total)'
    case 'CATEGORY': return 'Category'
    default: return 'Product-wise'
  }
}
