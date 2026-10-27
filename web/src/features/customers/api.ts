import { api, type ApiResource, type Paginated } from '@/lib/api'
import type { Customer, CustomerListParams, CustomerPayload } from './types'

export const CUSTOMERS_PER_PAGE = 10

export async function fetchCustomers(params: CustomerListParams): Promise<Paginated<Customer>> {
  const { data } = await api.get<Paginated<Customer>>('/customers', {
    params: {
      page: params.page,
      per_page: CUSTOMERS_PER_PAGE,
      sort: params.sort,
      // undefined params are dropped by axios, so empty filters don't appear in the URL
      search: params.search || undefined,
      emirate: params.emirate ?? undefined,
    },
  })
  return data
}

export async function createCustomer(payload: CustomerPayload): Promise<Customer> {
  const { data } = await api.post<ApiResource<Customer>>('/customers', payload)
  return data.data
}

export async function updateCustomer(id: number, payload: CustomerPayload): Promise<Customer> {
  const { data } = await api.put<ApiResource<Customer>>(`/customers/${id}`, payload)
  return data.data
}

export async function deleteCustomer(id: number): Promise<void> {
  await api.delete(`/customers/${id}`)
}
