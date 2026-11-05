export type PaymentMethod = 'bank_transfer' | 'cash' | 'card' | 'cheque'

export type Payment = {
  id: number
  amount: number // fils
  paid_on: string // YYYY-MM-DD
  method: PaymentMethod
  method_label: string
  reference: string | null
  notes: string | null
  /** Only present on the payments list. */
  invoice?: {
    id: number
    number: string | null
    customer_name: string
  }
  created_at: string
}

export type PaymentPayload = {
  amount: number
  paid_on: string
  method: PaymentMethod
  reference: string | null
  notes: string | null
}

export type PaymentListParams = {
  page: number
  search: string
  method: PaymentMethod | null
  from: string | null
  to: string | null
}
