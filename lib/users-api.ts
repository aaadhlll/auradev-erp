import { apiFetch } from './api'

export type UserRole =
  | 'SUPER_ADMIN'
  | 'TENANT_ADMIN'
  | 'MANAGER'
  | 'CASHIER'
  | 'INVENTORY_STAFF'
  | 'ACCOUNTANT'

export type UserStatus = 'ACTIVE' | 'INACTIVE'

export interface TenantUser {
  id: string
  name: string
  email: string
  role: UserRole
  status: UserStatus
  lastLoginAt: string | null
  createdAt: string
}

export interface CreateUserPayload {
  name: string
  email: string
  role: UserRole
  password: string
}

export interface UpdateUserPayload {
  name?: string
  role?: UserRole
  status?: UserStatus
  password?: string
}

export const ASSIGNABLE_ROLES: { value: UserRole; label: string }[] = [
  { value: 'TENANT_ADMIN', label: 'Tenant Admin' },
  { value: 'MANAGER', label: 'Manager' },
  { value: 'CASHIER', label: 'Cashier' },
  { value: 'INVENTORY_STAFF', label: 'Inventory Staff' },
  { value: 'ACCOUNTANT', label: 'Accountant' },
]

export async function fetchUsers(): Promise<TenantUser[]> {
  return apiFetch<TenantUser[]>('/api/v1/users')
}

export async function createUser(payload: CreateUserPayload): Promise<TenantUser> {
  return apiFetch<TenantUser>('/api/v1/users', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function updateUser(id: string, payload: UpdateUserPayload): Promise<TenantUser> {
  return apiFetch<TenantUser>(`/api/v1/users/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export function formatLastLogin(iso: string | null): string {
  if (!iso) return 'Never'
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}
