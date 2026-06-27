import type { ViewId } from '@/components/erp/shell'
import type { AuthUser } from './api'
import { hasAnyPermission, hasPermission, type Permission } from './permissions'

export type { Permission }

export function canAccessView(user: AuthUser | null | undefined, view: ViewId): boolean {
  if (!user) return false
  switch (view) {
    case 'dashboard':
      return hasPermission(user, 'DASHBOARD_VIEW')
    case 'pos':
      return hasPermission(user, 'BILL_CREATE')
    case 'bills':
      return hasPermission(user, 'BILL_VIEW')
    case 'inventory':
      return hasPermission(user, 'INVENTORY_VIEW')
    case 'purchases':
      return hasPermission(user, 'PURCHASE_VIEW')
    case 'settings':
      return hasAnyPermission(
        user,
        'SETTINGS_STORE_VIEW',
        'SETTINGS_STORE_EDIT',
        'SETTINGS_BILLING_VIEW',
        'SETTINGS_BILLING_EDIT',
        'SETTINGS_PRINTER_VIEW',
        'SETTINGS_PRINTER_EDIT',
        'SETTINGS_USERS_MANAGE',
        'AUDIT_VIEW',
      )
    default:
      return false
  }
}

export function canManageUsers(user: AuthUser | null | undefined): boolean {
  return hasPermission(user, 'SETTINGS_USERS_MANAGE')
}

export function canViewAudit(user: AuthUser | null | undefined): boolean {
  return hasPermission(user, 'AUDIT_VIEW')
}

export function canEditInventory(user: AuthUser | null | undefined): boolean {
  return hasAnyPermission(user, 'INVENTORY_EDIT', 'PRODUCT_MANAGE')
}

export function canManagePurchases(user: AuthUser | null | undefined): boolean {
  return hasPermission(user, 'PURCHASE_MANAGE')
}

export function canManageSuppliers(user: AuthUser | null | undefined): boolean {
  return hasPermission(user, 'SUPPLIER_MANAGE')
}

export function canCreateBill(user: AuthUser | null | undefined): boolean {
  return hasPermission(user, 'BILL_CREATE')
}

export function canHoldBill(user: AuthUser | null | undefined): boolean {
  return hasPermission(user, 'BILL_HOLD')
}

export function canImportInventory(user: AuthUser | null | undefined): boolean {
  return hasPermission(user, 'INVENTORY_IMPORT')
}

export function canExportInventory(user: AuthUser | null | undefined): boolean {
  return hasPermission(user, 'INVENTORY_EXPORT')
}

export function canViewInventoryCost(user: AuthUser | null | undefined): boolean {
  if (!user) return false
  return user.role !== 'CASHIER'
}

const VIEW_ORDER: ViewId[] = ['dashboard', 'pos', 'bills', 'inventory', 'purchases', 'settings']

export function firstAccessibleView(user: AuthUser | null | undefined): ViewId {
  if (!user) return 'dashboard'
  return VIEW_ORDER.find(v => canAccessView(user, v)) ?? 'dashboard'
}

export function formatRoleLabel(role: string): string {
  return role
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, c => c.toUpperCase())
}

export type SettingsSectionId = 'store' | 'billing' | 'users' | 'tax' | 'payments' | 'printer' | 'audit'

export function canAccessSettingsSection(user: AuthUser | null | undefined, section: SettingsSectionId): boolean {
  if (!user) return false
  switch (section) {
    case 'store':
      return hasAnyPermission(user, 'SETTINGS_STORE_VIEW', 'SETTINGS_STORE_EDIT')
    case 'billing':
      return hasAnyPermission(user, 'SETTINGS_BILLING_VIEW', 'SETTINGS_BILLING_EDIT')
    case 'printer':
      return hasAnyPermission(user, 'SETTINGS_PRINTER_VIEW', 'SETTINGS_PRINTER_EDIT')
    case 'users':
      return hasPermission(user, 'SETTINGS_USERS_MANAGE')
    case 'audit':
      return hasPermission(user, 'AUDIT_VIEW')
    case 'tax':
    case 'payments':
      return false
    default:
      return false
  }
}

export function canEditSettingsSection(user: AuthUser | null | undefined, section: SettingsSectionId): boolean {
  if (!user) return false
  switch (section) {
    case 'store':
      return hasPermission(user, 'SETTINGS_STORE_EDIT')
    case 'billing':
      return hasPermission(user, 'SETTINGS_BILLING_EDIT')
    case 'printer':
      return hasPermission(user, 'SETTINGS_PRINTER_EDIT')
    case 'users':
      return hasPermission(user, 'SETTINGS_USERS_MANAGE')
    default:
      return false
  }
}
