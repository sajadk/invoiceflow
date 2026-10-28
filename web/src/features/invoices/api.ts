import { api, type ApiResource, type Paginated } from '@/lib/api'
import type { Invoice, InvoiceAction, InvoiceDetail, InvoiceListParams, InvoicePayload } from './types'

export const INVOICES_PER_PAGE = 10

export async function fetchInvoices(params: InvoiceListParams): Promise<Paginated<Invoice>> {
  const { data } = await api.get<Paginated<Invoice>>('/invoices', {
    params: {
      page: params.page,
      per_page: INVOICES_PER_PAGE,
      sort: params.sort,
      search: params.search || undefined,
      status: params.status ?? undefined,
    },
  })
  return data
}

export async function fetchInvoice(id: number): Promise<InvoiceDetail> {
  const { data } = await api.get<ApiResource<InvoiceDetail>>(`/invoices/${id}`)
  return data.data
}

export async function createInvoice(payload: InvoicePayload): Promise<InvoiceDetail> {
  const { data } = await api.post<ApiResource<InvoiceDetail>>('/invoices', payload)
  return data.data
}

export async function updateInvoice(id: number, payload: InvoicePayload): Promise<InvoiceDetail> {
  const { data } = await api.put<ApiResource<InvoiceDetail>>(`/invoices/${id}`, payload)
  return data.data
}

export async function deleteInvoice(id: number): Promise<void> {
  await api.delete(`/invoices/${id}`)
}

/** send | mark-paid | void */
export async function runInvoiceAction(id: number, action: InvoiceAction): Promise<InvoiceDetail> {
  const { data } = await api.post<ApiResource<InvoiceDetail>>(`/invoices/${id}/${action}`)
  return data.data
}

/**
 * The PDF comes through axios (not a plain <a href>) so it uses the same session,
 * CSRF and error handling as every other request; the Blob is then saved as a file.
 */
export async function downloadInvoicePdf(invoice: Pick<Invoice, 'id' | 'number'>): Promise<void> {
  const response = await api.get<Blob>(`/invoices/${invoice.id}/pdf`, { responseType: 'blob' })

  const url = URL.createObjectURL(response.data)
  const link = document.createElement('a')
  link.href = url
  link.download = `${invoice.number ?? `draft-${invoice.id}`}.pdf`
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
