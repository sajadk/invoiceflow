import type { Emirate } from './emirates'

export type Customer = {
  id: number
  name: string
  email: string | null
  phone: string | null
  trn: string | null
  emirate: Emirate | null
  emirate_label: string | null
  address: string | null
  created_at: string
  updated_at: string
}

/** What the API accepts on create/update. Empty optional fields are sent as null. */
export type CustomerPayload = {
  name: string
  email: string | null
  phone: string | null
  trn: string | null
  emirate: Emirate | null
  address: string | null
}

export type CustomerSort = 'name' | '-name' | 'created_at' | '-created_at'

export type CustomerListParams = {
  page: number
  search: string
  emirate: Emirate | null
  sort: CustomerSort
}
