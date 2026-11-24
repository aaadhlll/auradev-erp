'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchHeldBills } from '@/lib/billing-api'
import { useAuth } from '@/lib/auth-context'
import { queryKeys } from './keys'

const HELD_BILLS_STALE_MS = 30_000
const HELD_BILLS_POLL_MS = 30_000

export function useHeldBillsQuery(active = true) {
  const { user } = useAuth()
  return useQuery({
    queryKey: queryKeys.heldBills(),
    queryFn: fetchHeldBills,
    enabled: Boolean(user) && active,
    staleTime: HELD_BILLS_STALE_MS,
    refetchOnWindowFocus: false,
    refetchInterval: active ? HELD_BILLS_POLL_MS : false,
    refetchIntervalInBackground: false,
  })
}

export function useInvalidateHeldBills() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: queryKeys.heldBills() })
}
