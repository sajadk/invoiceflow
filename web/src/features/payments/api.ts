import { api, type ApiResource, type Paginated } from '@/lib/api'
import type { InvoiceDetail } from '@/features/invoices/types'
import type { Payment, PaymentListParams, PaymentPayload } from './types'

export const PAYMENTS_PER_PAGE = 15

export async function fetchPayments(params: PaymentListParams): Promise<Paginated<Payment>> {
  const { data } = await api.get<Paginated<Payment>>('/payments', {
    params: {
      page: params.page,
      per_page: PAYMENTS_PER_PAGE,
      search: params.search || undefined,
      method: params.method ?? undefined,
      from: params.from ?? undefined,
      to: params.to ?? undefined,
    },
  })
  return data
}

/** Returns the updated invoice: new balance, status and payment list in one response. */
export async function recordPayment(invoiceId: number, payload: PaymentPayload): Promise<InvoiceDetail> {
  const { data } = await api.post<ApiResource<InvoiceDetail>>(`/invoices/${invoiceId}/payments`, payload)
  return data.data
}

export async function deletePayment(paymentId: number): Promise<InvoiceDetail> {
  const { data } = await api.delete<ApiResource<InvoiceDetail>>(`/payments/${paymentId}`)
  return data.data
}
