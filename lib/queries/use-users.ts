'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchUsers } from '@/lib/users-api'
import { useAuth } from '@/lib/auth-context'
import { canManageUsers } from '@/lib/rbac'

export function useUsersQuery() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['users'],
    queryFn: fetchUsers,
    enabled: Boolean(user && canManageUsers(user)),
  })
}

export function useInvalidateUsers() {
  const qc = useQueryClient()
  return () => void qc.invalidateQueries({ queryKey: ['users'] })
}
