import { apiFetch } from './api'

export interface AuditEntry {
  id: string
  action: string
  userName: string
  entityType: string | null
  entityId: string | null
  metadata: Record<string, unknown> | null
  ipAddress: string | null
  createdAt: string
}

export async function fetchAuditLog(limit = 50): Promise<AuditEntry[]> {
  return apiFetch<AuditEntry[]>(`/api/v1/audit?limit=${limit}`)
}

export function formatAuditAction(entry: AuditEntry): string {
  const m = entry.metadata ?? {}
  switch (entry.action) {
    case 'LOGIN_SUCCESS':
      return 'Login success'
    case 'STORE_PROFILE_UPDATED':
      return `Store profile updated${m.name ? ` (${m.name})` : ''}`
    case 'LOGO_UPLOADED':
      return 'Store logo uploaded'
    case 'PRINTER_SETTINGS_UPDATED':
      return `Printer settings updated (${m.widthMm ?? 80} mm${m.autoPrint ? ', auto-print on' : ''})`
    case 'USER_CREATED':
      return `User created: ${m.email ?? 'new user'} (${String(m.role ?? '').replace(/_/g, ' ').toLowerCase()})`
    case 'USER_UPDATED':
      return `User updated: ${m.email ?? 'user'} · ${String(m.status ?? '').toLowerCase()}`
    case 'BILL_CREATED':
      return `Bill ${m.billNo ?? ''} · ₹${Number(m.grandTotal ?? 0).toLocaleString('en-IN')} · ${m.customer ?? 'customer'}`
    default:
      return entry.action.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
  }
}

export function formatAuditTime(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  })
}
