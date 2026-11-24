import { api, type ApiResource, type Paginated } from '@/lib/api'
import type { Bill, BillAction, BillDetail, BillListParams, BillPayload } from './types'

export const BILLS_PER_PAGE = 10

export async function fetchBills(params: BillListParams): Promise<Paginated<Bill>> {
  const { data } = await api.get<Paginated<Bill>>('/bills', {
    params: {
      page: params.page,
      per_page: BILLS_PER_PAGE,
      sort: params.sort,
      search: params.search || undefined,
      status: params.status ?? undefined,
    },
  })
  return data
}

export async function fetchBill(id: number): Promise<BillDetail> {
  const { data } = await api.get<ApiResource<BillDetail>>(`/bills/${id}`)
  return data.data
}

export async function createBill(payload: BillPayload): Promise<BillDetail> {
  const { data } = await api.post<ApiResource<BillDetail>>('/bills', payload)
  return data.data
}

export async function updateBill(id: number, payload: BillPayload): Promise<BillDetail> {
  const { data } = await api.put<ApiResource<BillDetail>>(`/bills/${id}`, payload)
  return data.data
}

export async function deleteBill(id: number): Promise<void> {
  await api.delete(`/bills/${id}`)
}

export async function runBillAction(id: number, action: BillAction): Promise<BillDetail> {
  const { data } = await api.post<ApiResource<BillDetail>>(`/bills/${id}/${action}`)
  return data.data
}
