import type { Customer } from '@/features/customers/types'
import type { VatBreakdownRow, VatRate } from './money'

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'void'

/** What the UI shows. "overdue" is derived by the API (sent + past due). */
export type DisplayStatus = InvoiceStatus | 'overdue'

export type InvoiceItem = {
  id: number
  position: number
  description: string
  quantity: string // "1.500"
  unit_price: number // fils
  vat_rate: VatRate
  line_total: number // fils, excl. VAT
}

/** Customer details frozen when the invoice was sent. */
export type BilledTo = {
  name: string
  email: string | null
  trn: string | null
  emirate: string | null
  address: string | null
}

/** As returned by the list endpoint (customer included, no items). */
export type Invoice = {
  id: number
  number: string | null
  status: InvoiceStatus
  display_status: DisplayStatus
  is_overdue: boolean
  issue_date: string
  due_date: string
  currency: string
  subtotal: number
  vat_total: number
  total: number
  notes: string | null
  billed_to: BilledTo | null
  customer: Customer
  sent_at: string | null
  paid_at: string | null
  voided_at: string | null
  created_at: string
  updated_at: string
}

/** As returned by show/create/update and the status actions. */
export type InvoiceDetail = Invoice & {
  items: InvoiceItem[]
  vat_breakdown: VatBreakdownRow[]
}

export type InvoicePayload = {
  customer_id: number
  issue_date: string
  due_date: string
  notes: string | null
  items: {
    description: string
    quantity: string
    unit_price: number
    vat_rate: VatRate
  }[]
}

export type InvoiceStatusFilter = 'draft' | 'sent' | 'overdue' | 'paid' | 'void'

export type InvoiceSort = 'issue_date' | '-issue_date' | 'due_date' | '-due_date' | 'total' | '-total'

export type InvoiceListParams = {
  page: number
  search: string
  status: InvoiceStatusFilter | null
  sort: InvoiceSort
}

export type InvoiceAction = 'send' | 'mark-paid' | 'void'
