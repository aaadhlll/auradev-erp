'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchPosQuickPicks } from '@/lib/inventory-api'
import { useAuth } from '@/lib/auth-context'
import { queryKeys } from './keys'

// Product availability is checked again when a cashier adds an item to the
// cart, so this short cache improves navigation without allowing overselling.
const POS_QUICK_PICKS_STALE_MS = 30_000
const POS_QUICK_PICKS_POLL_MS = 60_000

export function usePosQuickPicksQuery(active = true) {
  const { user } = useAuth()
  return useQuery({
    queryKey: queryKeys.posQuickPicks(),
    queryFn: () => fetchPosQuickPicks(12),
    enabled: Boolean(user) && active,
    staleTime: POS_QUICK_PICKS_STALE_MS,
    refetchOnWindowFocus: false,
    refetchInterval: active ? POS_QUICK_PICKS_POLL_MS : false,
    refetchIntervalInBackground: false,
  })
}

export function useInvalidatePos() {
  const qc = useQueryClient()
  return {
    quickPicks: () => qc.invalidateQueries({ queryKey: queryKeys.posQuickPicks() }),
    search: () => qc.invalidateQueries({ queryKey: ['pos-search'] }),
    all: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.posQuickPicks() })
      void qc.invalidateQueries({ queryKey: ['pos-search'] })
    },
  }
}
