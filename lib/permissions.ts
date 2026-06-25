import type { AuthUser } from './api'

/** Must match {@code com.auradev.erp.auth.security.Permission} on the backend. */
export type Permission =
  | 'DASHBOARD_VIEW'
  | 'BILL_CREATE'
  | 'BILL_VIEW'
  | 'BILL_HOLD'
  | 'INVENTORY_VIEW'
  | 'INVENTORY_EDIT'
  | 'INVENTORY_IMPORT'
  | 'INVENTORY_EXPORT'
  | 'PRODUCT_MANAGE'
  | 'PURCHASE_VIEW'
  | 'PURCHASE_MANAGE'
  | 'SUPPLIER_MANAGE'
  | 'CUSTOMER_VIEW'
  | 'SETTINGS_STORE_VIEW'
  | 'SETTINGS_STORE_EDIT'
  | 'SETTINGS_BILLING_VIEW'
  | 'SETTINGS_BILLING_EDIT'
  | 'SETTINGS_PRINTER_VIEW'
  | 'SETTINGS_PRINTER_EDIT'
  | 'SETTINGS_USERS_MANAGE'
  | 'AUDIT_VIEW'

export function hasPermission(user: AuthUser | null | undefined, permission: Permission): boolean {
  if (!user?.permissions?.length) return false
  return user.permissions.includes(permission)
}

export function hasAnyPermission(user: AuthUser | null | undefined, ...permissions: Permission[]): boolean {
  return permissions.some(p => hasPermission(user, p))
}
