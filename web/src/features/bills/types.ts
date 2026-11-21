import type { InvoiceItem } from '@/features/invoices/types'
import type { VatBreakdownRow } from '@/features/invoices/money'

export type BillStatus = 'unpaid' | 'paid'

/** "overdue" is derived by the API (unpaid + past due). */
export type BillDisplayStatus = BillStatus | 'overdue'

/** As returned by the list endpoint (no items). */
export type Bill = {
  id: number
  supplier_name: string
  supplier_trn: string | null
  supplier_invoice_number: string
  status: BillStatus
  display_status: BillDisplayStatus
  is_overdue: boolean
  issue_date: string
  due_date: string | null
  currency: string
  subtotal: number
  vat_total: number
  total: number
  notes: string | null
  paid_at: string | null
  created_at: string
  updated_at: string
}

/** Show, create, update and the status actions return the lines too (same shape as invoice lines). */
export type BillDetail = Bill & {
  items: InvoiceItem[]
  vat_breakdown: VatBreakdownRow[]
}

export type BillPayload = {
  supplier_name: string
  supplier_trn: string | null
  supplier_invoice_number: string
  issue_date: string
  due_date: string | null
  notes: string | null
  items: {
    description: string
    quantity: string
    unit_price: number
    vat_rate: InvoiceItem['vat_rate']
  }[]
}

export type BillStatusFilter = 'unpaid' | 'overdue' | 'paid'

export type BillSort = 'issue_date' | '-issue_date' | 'due_date' | '-due_date' | 'total' | '-total'

export type BillListParams = {
  page: number
  search: string
  status: BillStatusFilter | null
  sort: BillSort
}

export type BillAction = 'mark-paid' | 'mark-unpaid'
