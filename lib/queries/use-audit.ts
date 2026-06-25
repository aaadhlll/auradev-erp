'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchAuditLog } from '@/lib/audit-api'
import { useAuth } from '@/lib/auth-context'
import { canViewAudit } from '@/lib/rbac'

export function useAuditLogQuery(limit = 50) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['audit-log', limit],
    queryFn: () => fetchAuditLog(limit),
    enabled: Boolean(user && canViewAudit(user)),
    staleTime: 30_000,
  })
}

export function useInvalidateAuditLog() {
  const qc = useQueryClient()
  return () => void qc.invalidateQueries({ queryKey: ['audit-log'] })
}
