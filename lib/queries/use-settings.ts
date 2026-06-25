'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  fetchStoreProfile,
  fetchPrinterSettings,
  fetchBillingSettings,
  storeProfileToReceiptMeta,
  type PrinterSettings,
  type BillingSettings,
} from '@/lib/settings-api'
import { useAuth } from '@/lib/auth-context'
import {
  DEFAULT_RECEIPT_META,
  DEFAULT_RECEIPT_PRINT,
  type ReceiptMeta,
  type ReceiptPrintOptions,
} from '@/lib/receipt-export'

export function useStoreProfileQuery() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['store-profile'],
    queryFn: fetchStoreProfile,
    enabled: Boolean(user),
    staleTime: 5 * 60_000,
  })
}

export function usePrinterSettingsQuery() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['printer-settings'],
    queryFn: fetchPrinterSettings,
    enabled: Boolean(user),
    staleTime: 5 * 60_000,
  })
}

export function useBillingSettingsQuery() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['billing-settings'],
    queryFn: fetchBillingSettings,
    enabled: Boolean(user),
    staleTime: 5 * 60_000,
  })
}

export function useReceiptMeta(): ReceiptMeta {
  const { data } = useStoreProfileQuery()
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

export function useReceiptPrintOptions(): ReceiptPrintOptions {
  const printer = usePrinterSettingsQuery().data
  const billing = useBillingSettingsQuery().data
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
    showCashier: billing.showCashierOnReceipt,
    showGstBreakup: billing.showGstBreakupOnReceipt,
    showCustomer: billing.showCustomerOnReceipt,
  }
}

export function printerToPrintOptions(settings: PrinterSettings | null | undefined): ReceiptPrintOptions {
  if (!settings) return DEFAULT_RECEIPT_PRINT
  return {
    widthMm: settings.widthMm === 58 ? 58 : 80,
    showLogo: settings.showLogo,
    copies: settings.copies,
    showCashier: DEFAULT_RECEIPT_PRINT.showCashier,
    showGstBreakup: DEFAULT_RECEIPT_PRINT.showGstBreakup,
    showCustomer: DEFAULT_RECEIPT_PRINT.showCustomer,
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
