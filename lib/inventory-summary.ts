import type { Product } from './erp-data'
import { stockStatus } from './erp-data'

export interface InventorySummary {
  totalProducts: number
  inStockCount: number
  lowStockCount: number
  outOfStockCount: number
  totalUnits: number
  costValue: number
  sellingValue: number
  mrpValue: number
  productsWithCost: number
}

export function computeInventorySummary(products: Product[]): InventorySummary {
  let inStockCount = 0
  let lowStockCount = 0
  let outOfStockCount = 0
  let totalUnits = 0
  let costValue = 0
  let sellingValue = 0
  let mrpValue = 0
  let productsWithCost = 0

  for (const p of products) {
    const st = stockStatus(p)
    if (st === 'in') inStockCount++
    else if (st === 'low') lowStockCount++
    else outOfStockCount++

    totalUnits += p.stock
    sellingValue += p.stock * p.price
    mrpValue += p.stock * p.mrp
    if (p.cost > 0) {
      productsWithCost++
      costValue += p.stock * p.cost
    }
  }

  return {
    totalProducts: products.length,
    inStockCount,
    lowStockCount,
    outOfStockCount,
    totalUnits,
    costValue,
    sellingValue,
    mrpValue,
    productsWithCost,
  }
}
