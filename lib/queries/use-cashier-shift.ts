'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchCurrentShift, type CashierShift } from '@/lib/cashier-shift-api'
import { useAuth } from '@/lib/auth-context'

const currentShiftKey = ['cashier-shift', 'current'] as const
const CURRENT_SHIFT_POLL_MS = 30_000

/** A short cache prevents duplicate checks while the cashier moves around POS. */
export function useCurrentCashierShiftQuery(active = true) {
  const { user } = useAuth()
  return useQuery({
    queryKey: currentShiftKey,
    queryFn: fetchCurrentShift,
    enabled: Boolean(user) && active,
    staleTime: 15_000,
    refetchOnWindowFocus: false,
    refetchInterval: active ? CURRENT_SHIFT_POLL_MS : false,
    refetchIntervalInBackground: false,
  })
}

export function useSetCurrentCashierShift() {
  const queryClient = useQueryClient()
  return (shift: CashierShift | null) => {
    queryClient.setQueryData<CashierShift | null>(currentShiftKey, shift)
  }
}
