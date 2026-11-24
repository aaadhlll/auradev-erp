import { useQuery } from '@tanstack/react-query'
import { fetchBill, fetchBills, fetchSalesReturnsReport } from '@/lib/billing-api'

export function useBillsQuery(q: string, page: number, customerId = '', enabled = true, dateFrom = '', dateTo = '') {
  return useQuery({
    queryKey: ['bills', q, page, customerId, dateFrom, dateTo],
    queryFn: () => fetchBills(q, page, 25, customerId, dateFrom, dateTo),
    placeholderData: prev => prev,
    enabled,
  })
}

export function useBillQuery(id: string | null) {
  return useQuery({
    queryKey: ['bill', id],
    queryFn: () => fetchBill(id!),
    enabled: Boolean(id),
  })
}

export function useSalesReturnsReportQuery(q: string, page: number, enabled = true) {
  return useQuery({
    queryKey: ['sales-returns-report', q, page],
    queryFn: () => fetchSalesReturnsReport(q, page),
    placeholderData: prev => prev,
    enabled,
  })
}
