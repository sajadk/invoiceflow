import type { User } from '@/features/auth/types'
import type { Customer } from '@/features/customers/types'
import type { InvoiceDetail } from '@/features/invoices/types'
import type { Paginated } from '@/lib/api'

export const userFixture: User = {
  id: 1,
  name: 'Demo User',
  email: 'demo@invoiceflow.test',
  created_at: '2026-01-01T00:00:00+04:00',
}

export const customerFixture: Customer = {
  id: 7,
  name: 'Al Noor Trading LLC',
  email: 'accounts@alnoor.ae',
  phone: '+971 50 123 4567',
  trn: '100123456789012',
  emirate: 'dubai',
  emirate_label: 'Dubai',
  address: 'Office 1204, Business Bay',
  created_at: '2026-01-01T00:00:00+04:00',
  updated_at: '2026-01-01T00:00:00+04:00',
}

export function paginated<T>(data: T[]): Paginated<T> {
  return {
    data,
    meta: { current_page: 1, last_page: 1, per_page: 100, total: data.length, from: data.length ? 1 : null, to: data.length || null },
  }
}

export function invoiceDetailFixture(overrides: Partial<InvoiceDetail> = {}): InvoiceDetail {
  return {
    id: 42,
    number: null,
    status: 'draft',
    display_status: 'draft',
    is_overdue: false,
    issue_date: '2026-03-01',
    due_date: '2026-03-31',
    currency: 'AED',
    subtotal: 150000,
    vat_total: 7500,
    total: 157500,
    amount_paid: 0,
    balance_due: 0,
    notes: null,
    billed_to: null,
    customer: customerFixture,
    items: [],
    payments: [],
    vat_breakdown: [],
    sent_at: null,
    paid_at: null,
    voided_at: null,
    created_at: '2026-03-01T09:00:00+04:00',
    updated_at: '2026-03-01T09:00:00+04:00',
    ...overrides,
  }
}
