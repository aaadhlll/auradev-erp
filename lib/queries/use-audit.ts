'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchAuditLog } from '@/lib/audit-api'
import { useAuth } from '@/lib/auth-context'
import { canViewAudit } from '@/lib/rbac'

export function useAuditLogQuery(limit = 100, dates?: { fromDate?: string; toDate?: string }) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['audit-log', limit, dates?.fromDate ?? '', dates?.toDate ?? ''],
    queryFn: () => fetchAuditLog(limit, dates),
    enabled: Boolean(user && canViewAudit(user)),
    staleTime: 30_000,
  })
}

export function useInvalidateAuditLog() {
  const qc = useQueryClient()
  return () => void qc.invalidateQueries({ queryKey: ['audit-log'] })
}
