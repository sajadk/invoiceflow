import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query'
import { useWriteThrough } from '@/features/invoices/hooks'
import { deletePayment, fetchPayments, recordPayment } from './api'
import { paymentKeys } from './queryKeys'
import type { PaymentListParams, PaymentPayload } from './types'

export function usePayments(params: PaymentListParams) {
  return useQuery({
    queryKey: paymentKeys.list(params),
    queryFn: () => fetchPayments(params),
    placeholderData: keepPreviousData,
  })
}

/** Both mutations return the updated invoice, which goes straight into its cache entry. */
export function useRecordPayment() {
  const writeThrough = useWriteThrough()
  return useMutation({
    mutationFn: ({ invoiceId, payload }: { invoiceId: number; payload: PaymentPayload }) =>
      recordPayment(invoiceId, payload),
    onSuccess: writeThrough,
  })
}

export function useDeletePayment() {
  const writeThrough = useWriteThrough()
  return useMutation({
    mutationFn: (paymentId: number) => deletePayment(paymentId),
    onSuccess: writeThrough,
  })
}
