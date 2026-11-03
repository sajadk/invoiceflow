import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createInvoice,
  deleteInvoice,
  fetchInvoice,
  fetchInvoices,
  runInvoiceAction,
  updateInvoice,
} from './api'
import { dashboardKeys } from '@/features/dashboard/queryKeys'
import { paymentKeys } from '@/features/payments/queryKeys'
import { invoiceKeys } from './queryKeys'
import type { InvoiceAction, InvoiceDetail, InvoiceListParams, InvoicePayload } from './types'

export function useInvoices(params: InvoiceListParams) {
  return useQuery({
    queryKey: invoiceKeys.list(params),
    queryFn: () => fetchInvoices(params),
    placeholderData: keepPreviousData,
  })
}

export function useInvoice(id: number) {
  return useQuery({
    queryKey: invoiceKeys.detail(id),
    queryFn: () => fetchInvoice(id),
    enabled: Number.isInteger(id) && id > 0,
  })
}

/**
 * Every write returns the full invoice, so it goes straight into the detail cache
 * (no refetch when we navigate to it). Everything derived from invoices (lists,
 * payments, dashboard figures) is marked stale and refetches when next shown.
 * Exported for the payment mutations, which also return the updated invoice.
 */
export function useWriteThrough() {
  const queryClient = useQueryClient()
  return (invoice: InvoiceDetail) => {
    queryClient.setQueryData(invoiceKeys.detail(invoice.id), invoice)
    return Promise.all([
      queryClient.invalidateQueries({ queryKey: invoiceKeys.lists() }),
      queryClient.invalidateQueries({ queryKey: paymentKeys.all }),
      queryClient.invalidateQueries({ queryKey: dashboardKeys.all }),
    ])
  }
}

export function useCreateInvoice() {
  const writeThrough = useWriteThrough()
  return useMutation({
    mutationFn: (payload: InvoicePayload) => createInvoice(payload),
    onSuccess: writeThrough,
  })
}

export function useUpdateInvoice() {
  const writeThrough = useWriteThrough()
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: InvoicePayload }) => updateInvoice(id, payload),
    onSuccess: writeThrough,
  })
}

export function useInvoiceAction() {
  const writeThrough = useWriteThrough()
  return useMutation({
    mutationFn: ({ id, action }: { id: number; action: InvoiceAction }) => runInvoiceAction(id, action),
    onSuccess: writeThrough,
  })
}

export function useDeleteInvoice() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => deleteInvoice(id),
    // The detail query isn't removed here: the page is still showing it and would
    // refetch (and 404) before it navigates away. Unused cache entries expire on their own.
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: invoiceKeys.lists() }),
        queryClient.invalidateQueries({ queryKey: dashboardKeys.all }),
      ]),
  })
}
