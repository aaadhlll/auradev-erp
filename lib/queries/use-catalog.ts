'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchProducts, fetchCategories } from '@/lib/inventory-api'
import { useAuth } from '@/lib/auth-context'
import { queryKeys } from './keys'

const PRODUCTS_STALE_MS = 5 * 60_000
const CATEGORIES_STALE_MS = 30 * 60_000

export function useProductsQuery(enabled = true) {
  const { user } = useAuth()
  return useQuery({
    queryKey: queryKeys.products(),
    queryFn: fetchProducts,
    enabled: Boolean(user) && enabled,
    staleTime: PRODUCTS_STALE_MS,
  })
}

export function useCategoriesQuery(enabled = true) {
  const { user } = useAuth()
  return useQuery({
    queryKey: queryKeys.categories(),
    queryFn: fetchCategories,
    enabled: Boolean(user) && enabled,
    staleTime: CATEGORIES_STALE_MS,
  })
}

export function useInvalidateCatalog() {
  const qc = useQueryClient()
  return {
    products: () => qc.invalidateQueries({ queryKey: queryKeys.products() }),
    categories: () => qc.invalidateQueries({ queryKey: queryKeys.categories() }),
    all: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.products() })
      void qc.invalidateQueries({ queryKey: queryKeys.categories() })
    },
  }
}
