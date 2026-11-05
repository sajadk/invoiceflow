import type { PaymentMethod } from './types'

export const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'card', label: 'Card' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'cash', label: 'Cash' },
]

export const PAYMENT_METHOD_VALUES = PAYMENT_METHODS.map((m) => m.value) as [PaymentMethod, ...PaymentMethod[]]

export function isPaymentMethod(value: string | null): value is PaymentMethod {
  return PAYMENT_METHODS.some((m) => m.value === value)
}
