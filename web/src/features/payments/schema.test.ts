import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { paymentFormSchema, toPaymentPayload, type PaymentFormValues } from './schema'

const valid: PaymentFormValues = {
  amount: '650',
  paid_on: '2026-03-10',
  method: 'bank_transfer',
  reference: ' FT123 ',
  notes: '',
}

// Balance AED 650.00 on an invoice issued 1 March; "today" is 15 March.
const schema = paymentFormSchema({ balanceDue: 65000, issueDate: '2026-03-01' })

function errorsFor(values: PaymentFormValues) {
  const result = schema.safeParse(values)
  return result.success ? [] : result.error.issues.map((issue) => [issue.path.join('.'), issue.message])
}

describe('paymentFormSchema', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 2, 15, 10, 0))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('accepts a payment of the full balance', () => {
    expect(errorsFor(valid)).toEqual([])
  })

  it('rejects more than the balance due', () => {
    expect(errorsFor({ ...valid, amount: '650.01' })).toEqual([
      ['amount', expect.stringContaining('more than the balance due')],
    ])
  })

  it('rejects zero and malformed amounts', () => {
    expect(errorsFor({ ...valid, amount: '0' })[0]?.[0]).toBe('amount')
    expect(errorsFor({ ...valid, amount: 'six hundred' })[0]?.[0]).toBe('amount')
  })

  it('rejects dates in the future or before the invoice', () => {
    expect(errorsFor({ ...valid, paid_on: '2026-03-16' })).toEqual([
      ['paid_on', 'The payment date can’t be in the future.'],
    ])
    expect(errorsFor({ ...valid, paid_on: '2026-02-28' })).toEqual([
      ['paid_on', 'The payment date can’t be before the invoice date.'],
    ])
  })

  it('converts form values into the API payload', () => {
    expect(toPaymentPayload({ ...valid, amount: '1,250.5' })).toEqual({
      amount: 125050,
      paid_on: '2026-03-10',
      method: 'bank_transfer',
      reference: 'FT123',
      notes: null,
    })
  })
})
