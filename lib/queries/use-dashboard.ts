'use client'

import { useEffect, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  composeDashboard,
  dashboardFiltersKey,
  emptyDashboardMetrics,
  fetchDashboardLive,
  fetchDashboardMetrics,
  fetchDashboardShell,
  hasDashboardLivePoll,
  mergeMetricsLive,
  type DashboardData,
  type DashboardFilters,
  type DashboardMetricsData,
} from '@/lib/dashboard-api'
import { useAuth } from '@/lib/auth-context'
import { queryKeys } from './keys'

const SHELL_STALE_MS = 10 * 60_000
const METRICS_STALE_MS = 120_000
const DASHBOARD_POLL_MS = 90_000

export interface DashboardQueryResult {
  data: DashboardData | undefined
  shellReady: boolean
  metricsReady: boolean
  metricsFetching: boolean
  shellFetching: boolean
  isLoading: boolean
  error: string | null
  refetch: () => void
}

export function useDashboardQuery(filters: DashboardFilters, active = true): DashboardQueryResult {
  const { user } = useAuth()
  const qc = useQueryClient()
  const filtersKey = dashboardFiltersKey(filters)
  const livePoll = hasDashboardLivePoll(filters)
  const metricsEnabled = Boolean(user)
    && (filters.preset !== 'custom' || Boolean(filters.from && filters.to))

  const shell = useQuery({
    queryKey: queryKeys.dashboardShell(),
    queryFn: fetchDashboardShell,
    enabled: Boolean(user),
    staleTime: SHELL_STALE_MS,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })

  const metrics = useQuery({
    queryKey: queryKeys.dashboardMetrics(filtersKey),
    queryFn: () => fetchDashboardMetrics(filters),
    enabled: metricsEnabled,
    staleTime: METRICS_STALE_MS,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    placeholderData: prev => prev,
  })

  const data = useMemo(() => {
    if (!shell.data) return undefined
    const metricsData = metrics.data ?? emptyDashboardMetrics(filters)
    return composeDashboard(shell.data, metricsData)
  }, [shell.data, metrics.data, filters])

  useEffect(() => {
    if (!user || !active || !livePoll || !metrics.isSuccess) return

    let cancelled = false
    const tick = async () => {
      if (cancelled) return
      try {
        const live = await fetchDashboardLive(filters)
        if (cancelled) return
        qc.setQueryData<DashboardMetricsData>(queryKeys.dashboardMetrics(filtersKey), old =>
          old ? mergeMetricsLive(old, live) : old,
        )
      } catch {
        // Background poll — ignore failures.
      }
    }

    const id = window.setInterval(() => void tick(), DASHBOARD_POLL_MS)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [user, active, livePoll, metrics.isSuccess, filtersKey, filters, qc])

  const error = shell.error?.message ?? metrics.error?.message ?? null

  return {
    data,
    shellReady: Boolean(shell.data),
    metricsReady: Boolean(metrics.data),
    metricsFetching: metrics.isFetching,
    shellFetching: shell.isFetching,
    isLoading: shell.isLoading || (metricsEnabled && metrics.isLoading && !metrics.data),
    error,
    refetch: () => {
      void shell.refetch()
      if (metricsEnabled) void metrics.refetch()
    },
  }
}

export function useInvalidateDashboard() {
  const qc = useQueryClient()
  return () => {
    void qc.invalidateQueries({ queryKey: ['dashboard'] })
  }
}
