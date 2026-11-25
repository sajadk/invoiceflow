import type { BillListParams } from './types'

export const billKeys = {
  all: ['bills'] as const,
  lists: () => [...billKeys.all, 'list'] as const,
  list: (params: BillListParams) => [...billKeys.lists(), params] as const,
  details: () => [...billKeys.all, 'detail'] as const,
  detail: (id: number) => [...billKeys.details(), id] as const,
  // AI capture
  captureUsage: () => [...billKeys.all, 'capture', 'usage'] as const,
  extraction: (id: string) => [...billKeys.all, 'capture', 'extraction', id] as const,
}
