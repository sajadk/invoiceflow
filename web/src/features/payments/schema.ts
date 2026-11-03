import { z } from 'zod'
import { formatMoney, parseMoney } from '@/features/invoices/money'
import { todayIso } from '@/lib/dates'
import { PAYMENT_METHOD_VALUES } from './methods'
import type { PaymentPayload } from './types'

/**
 * A schema *factory*: the rules depend on the invoice being paid (its balance and
 * issue date), so the schema is built per invoice. Mirrors PaymentRequest.php;
 * the server re-checks the balance under a row lock.
 */
export function paymentFormSchema({ balanceDue, issueDate }: { balanceDue: number; issueDate: string }) {
  return z
    .object({
      amount: z.string().refine((value) => {
        const fils = parseMoney(value)
        return fils !== null && fils > 0
      }, 'Enter an amount above 0, e.g. 1500 or 1,250.50'),
      paid_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick a date.'),
      method: z.enum(PAYMENT_METHOD_VALUES),
      reference: z.string().trim().max(100),
      notes: z.string().trim().max(500),
    })
    .refine((values) => (parseMoney(values.amount) ?? 0) <= balanceDue, {
      message: `That’s more than the balance due (${formatMoney(balanceDue)}).`,
      path: ['amount'],
    })
    .refine((values) => values.paid_on <= todayIso(), {
      message: 'The payment date can’t be in the future.',
      path: ['paid_on'],
    })
    .refine((values) => values.paid_on >= issueDate, {
      message: 'The payment date can’t be before the invoice date.',
      path: ['paid_on'],
    })
}

export type PaymentFormValues = z.infer<ReturnType<typeof paymentFormSchema>>

export function toPaymentPayload(values: PaymentFormValues): PaymentPayload {
  return {
    amount: parseMoney(values.amount) ?? 0,
    paid_on: values.paid_on,
    method: values.method,
    reference: values.reference.trim() || null,
    notes: values.notes.trim() || null,
  }
}
