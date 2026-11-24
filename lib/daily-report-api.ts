import { apiFetch } from './api'

export type DailyBusinessReport = {
  businessDate: string
  sales: number
  bills: number
  itemsSold: number
  cash: number
  upi: number
  card: number
  creditSales: number
  returnCount: number
  refundTotal: number
  purchaseValue: number
  purchasePayments: number
  lowStockCount: number
  expiringBatchCount: number
  closedShifts: number
  shiftVariance: number
}

export function fetchDailyBusinessReport(date: string) {
  return apiFetch<DailyBusinessReport>(`/api/v1/dashboard/daily-report?date=${encodeURIComponent(date)}`)
}
