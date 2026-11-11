'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchPosQuickPicks } from '@/lib/inventory-api'
import { useAuth } from '@/lib/auth-context'
import { queryKeys } from './keys'

const POS_QUICK_PICKS_REFRESH_MS = 15_000

export function usePosQuickPicksQuery() {
  const { user } = useAuth()
  return useQuery({
    queryKey: queryKeys.posQuickPicks(),
    queryFn: () => fetchPosQuickPicks(12),
    enabled: Boolean(user),
    staleTime: 0,
    refetchInterval: POS_QUICK_PICKS_REFRESH_MS,
    refetchOnWindowFocus: true,
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
