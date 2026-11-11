import { useQuery } from '@tanstack/react-query'
import { fetchBill, fetchBills, fetchSalesReturnsReport } from '@/lib/billing-api'

export function useBillsQuery(q: string, page: number) {
  return useQuery({
    queryKey: ['bills', q, page],
    queryFn: () => fetchBills(q, page),
    placeholderData: prev => prev,
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
