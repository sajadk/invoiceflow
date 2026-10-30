import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Paginated } from '@/lib/api'
import { createCustomer, deleteCustomer, fetchCustomerOptions, fetchCustomers, updateCustomer } from './api'
import { customerKeys } from './queryKeys'
import type { Customer, CustomerListParams, CustomerPayload } from './types'

export function useCustomers(params: CustomerListParams) {
  return useQuery({
    queryKey: customerKeys.list(params),
    queryFn: () => fetchCustomers(params),
    // Keep showing the current page while the next one loads, instead of flashing a spinner.
    placeholderData: keepPreviousData,
  })
}

/** Customer picker options. Invalidated with every customer change (customerKeys.all). */
export function useCustomerOptions() {
  return useQuery({
    queryKey: customerKeys.options(),
    queryFn: fetchCustomerOptions,
    staleTime: 60_000,
  })
}

export function useCreateCustomer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: CustomerPayload) => createCustomer(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: customerKeys.all }),
  })
}

export function useUpdateCustomer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: CustomerPayload }) => updateCustomer(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: customerKeys.all }),
  })
}

/**
 * Optimistic delete: the row disappears immediately, and comes back if the API refuses.
 */
export function useDeleteCustomer() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: number) => deleteCustomer(id),

    onMutate: async (id) => {
      // Stop in-flight refetches from overwriting the optimistic update.
      await queryClient.cancelQueries({ queryKey: customerKeys.lists() })

      const snapshots = queryClient.getQueriesData<Paginated<Customer>>({ queryKey: customerKeys.lists() })

      queryClient.setQueriesData<Paginated<Customer>>({ queryKey: customerKeys.lists() }, (old) =>
        old
          ? {
              ...old,
              data: old.data.filter((customer) => customer.id !== id),
              meta: { ...old.meta, total: Math.max(0, old.meta.total - 1) },
            }
          : old,
      )

      return { snapshots } // becomes `context` in onError
    },

    onError: (_error, _id, context) => {
      context?.snapshots.forEach(([queryKey, data]) => queryClient.setQueryData(queryKey, data))
    },

    // Success or failure, re-sync with the server (pages shift by one after a delete).
    onSettled: () => queryClient.invalidateQueries({ queryKey: customerKeys.all }),
  })
}
