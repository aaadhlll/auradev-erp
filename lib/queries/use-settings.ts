'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  fetchStoreProfile,
  fetchPrinterSettings,
  fetchBillingSettings,
  fetchTaxSettings,
  fetchDatabaseBackupStatus,
  storeProfileToReceiptMeta,
  type PrinterSettings,
  type BillingSettings,
  type TaxSettings,
} from '@/lib/settings-api'
import { setCurrency } from '@/lib/erp-data'
import { useAuth } from '@/lib/auth-context'
import {
  DEFAULT_RECEIPT_META,
  DEFAULT_RECEIPT_PRINT,
  type ReceiptMeta,
  type ReceiptPrintOptions,
} from '@/lib/receipt-export'

export function useStoreProfileQuery(enabled = true) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['store-profile'],
    queryFn: async () => {
      const profile = await fetchStoreProfile()
      setCurrency(profile.currency)
      return profile
    },
    enabled: Boolean(user) && enabled,
    staleTime: 5 * 60_000,
  })
}

export function usePrinterSettingsQuery(enabled = true) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['printer-settings'],
    queryFn: fetchPrinterSettings,
    enabled: Boolean(user) && enabled,
    staleTime: 5 * 60_000,
  })
}

export function useBillingSettingsQuery(enabled = true) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['billing-settings'],
    queryFn: fetchBillingSettings,
    enabled: Boolean(user) && enabled,
    staleTime: 5 * 60_000,
  })
}

export function useTaxSettingsQuery(enabled = true) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['tax-settings'],
    queryFn: fetchTaxSettings,
    enabled: Boolean(user) && enabled,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  })
}

export function useDatabaseBackupStatusQuery() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['database-backups'],
    queryFn: fetchDatabaseBackupStatus,
    enabled: Boolean(user),
    staleTime: 10_000,
    refetchInterval: query => query.state.data?.history.some(item => item.status === 'QUEUED' || item.status === 'RUNNING') ? 5_000 : false,
  })
}

export function useReceiptMeta(enabled = true): ReceiptMeta {
  const { data } = useStoreProfileQuery(enabled)
  const fromStore = storeProfileToReceiptMeta(data)
  return {
    storeName: fromStore?.storeName ?? DEFAULT_RECEIPT_META.storeName,
    storePhone: fromStore?.storePhone ?? DEFAULT_RECEIPT_META.storePhone,
    logoUrl: fromStore?.logoUrl ?? DEFAULT_RECEIPT_META.logoUrl,
    billFooter: fromStore?.billFooter,
    gstin: fromStore?.gstin,
    address: fromStore?.address,
  }
}

export function useReceiptPrintOptions(enabled = true): ReceiptPrintOptions {
  const printer = usePrinterSettingsQuery(enabled).data
  const billing = useBillingSettingsQuery(enabled).data
  return mergePrintOptions(printer, billing)
}

export function mergePrintOptions(
  printer: PrinterSettings | null | undefined,
  billing: BillingSettings | null | undefined,
): ReceiptPrintOptions {
  const base = printerToPrintOptions(printer)
  if (!billing) return base
  return {
    ...base,
    showTax: billing.taxEnabled,
    showGstBreakup: billing.taxEnabled && base.showGstBreakup,
  }
}

export function printerToPrintOptions(settings: PrinterSettings | null | undefined): ReceiptPrintOptions {
  if (!settings) return DEFAULT_RECEIPT_PRINT
  return {
    widthMm: settings.widthMm === 58 ? 58 : 80,
    showLogo: settings.showLogo,
    copies: settings.copies,
    showCashier: settings.showCashier,
    showTax: DEFAULT_RECEIPT_PRINT.showTax,
    showGstBreakup: settings.showTaxBreakup,
    showCustomer: settings.showCustomer,
    showStorePhone: settings.showStorePhone,
    showStoreAddress: settings.showStoreAddress,
    showStoreTin: settings.showStoreTin,
    showBillDate: settings.showBillDate,
    showPayment: settings.showPayment,
    showTendered: settings.showTendered,
    showChange: settings.showChange,
    receiptTitle: settings.receiptTitle,
  }
}

export function useInvalidateStoreProfile() {
  const qc = useQueryClient()
  return () => void qc.invalidateQueries({ queryKey: ['store-profile'] })
}

export function useInvalidatePrinterSettings() {
  const qc = useQueryClient()
  return () => void qc.invalidateQueries({ queryKey: ['printer-settings'] })
}

export function useInvalidateBillingSettings() {
  const qc = useQueryClient()
  return () => void qc.invalidateQueries({ queryKey: ['billing-settings'] })
}

export function useInvalidateTaxSettings() {
  const qc = useQueryClient()
  return () => void qc.invalidateQueries({ queryKey: ['tax-settings'] })
}

export function useInvalidateDatabaseBackups() {
  const qc = useQueryClient()
  return () => void qc.invalidateQueries({ queryKey: ['database-backups'] })
}
