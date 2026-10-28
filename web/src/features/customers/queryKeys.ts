import type { CustomerListParams } from './types'

/**
 * Hierarchical keys: invalidating customerKeys.lists() refetches every
 * page/search/filter combination at once, while each list stays cached separately.
 */
export const customerKeys = {
  all: ['customers'] as const,
  lists: () => [...customerKeys.all, 'list'] as const,
  list: (params: CustomerListParams) => [...customerKeys.lists(), params] as const,
  options: () => [...customerKeys.all, 'options'] as const,
}
