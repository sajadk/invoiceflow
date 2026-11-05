import type { Payment } from '@/features/payments/types'

type Balance = { count: number; amount: number }

/** GET /api/dashboard. All amounts are fils. */
export type DashboardSummary = {
  currency: string
  as_of: string
  outstanding: Balance
  overdue: Balance
  collected: { this_month: number; last_month: number }
  vat: { period: string; amount: number }
  monthly: { month: string; invoiced: number; collected: number }[]
  aging: { bucket: 'current' | '1_30' | '31_60' | '61_90' | '90_plus'; label: string; count: number; amount: number }[]
  top_debtors: { customer_id: number; name: string; amount: number; invoices: number }[]
  recent_payments: Payment[]
}
