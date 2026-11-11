import { describe, expect, it } from 'vitest'
import {
  calculateTotals,
  formatQuantity,
  lineTotal,
  milliToQuantity,
  parseMoney,
  parseQuantityMilli,
  type CalculatorLine,
} from './money'

/**
 * The first two blocks use exactly the cases in api/tests/Unit/InvoiceCalculatorTest.php.
 * If either side's rounding changes, one of the two suites fails, so the live
 * totals in the browser can never disagree with what the server saves.
 */
describe('lineTotal (same cases as InvoiceCalculatorTest.php)', () => {
  it.each([
    ['whole quantity', '2', 15000, 30000],
    ['fractional quantity', '1.5', 10000, 15000],
    ['three decimals', '0.333', 100, 33],
    ['rounds half up', '0.005', 100, 1],
    ['just under half', '0.004', 100, 0],
    ['free item', '3', 0, 0],
    ['largest allowed line', '9999.999', 99999999, 999999890000],
  ] as const)('%s: %s × %i fils = %i', (_case, quantity, unitPrice, expected) => {
    const milli = parseQuantityMilli(quantity)
    expect(milli).not.toBeNull()
    expect(lineTotal(milli ?? 0, unitPrice)).toBe(expected)
  })

  it('stays within the safe integer range for the largest allowed line', () => {
    expect(Number.isSafeInteger(9_999_999 * 99_999_999)).toBe(true)
  })
})

describe('calculateTotals (same cases as InvoiceCalculatorTest.php)', () => {
  const line = (quantityMilli: number, unitPrice: number, vatRate: CalculatorLine['vatRate']): CalculatorLine => ({
    quantityMilli,
    unitPrice,
    vatRate,
  })

  it('charges 5% VAT on standard lines only, with a breakdown per rate', () => {
    const totals = calculateTotals([
      line(1000, 100000, 'standard'), // AED 1,000.00
      line(2000, 25000, 'zero'), // AED 500.00
      line(1000, 30000, 'exempt'), // AED 300.00
    ])

    expect(totals.subtotal).toBe(180000)
    expect(totals.vat_total).toBe(5000)
    expect(totals.total).toBe(185000)
    expect(totals.vat_breakdown.map((row) => [row.rate, row.taxable, row.vat])).toEqual([
      ['standard', 100000, 5000],
      ['zero', 50000, 0],
      ['exempt', 30000, 0],
    ])
  })

  it('rounds VAT once on the sum, not per line', () => {
    // Per line: 3 × round(0.5 fils) = 3. On the sum: round(30 × 5%) = round(1.5) = 2.
    const totals = calculateTotals([line(1000, 10, 'standard'), line(1000, 10, 'standard'), line(1000, 10, 'standard')])

    expect(totals.subtotal).toBe(30)
    expect(totals.vat_total).toBe(2)
  })

  it('returns zeros for an empty invoice', () => {
    expect(calculateTotals([])).toEqual({ subtotal: 0, vat_total: 0, total: 0, vat_breakdown: [] })
  })
})

describe('parsing user input', () => {
  it.each([
    ['1500', 150000],
    ['1,250.5', 125050],
    ['1,250.50', 125050],
    [' 15 ', 1500],
    ['0.01', 1],
    ['999999.99', 99999999],
  ] as const)('parseMoney(%j) = %i fils', (input, expected) => {
    expect(parseMoney(input)).toBe(expected)
  })

  it.each(['', 'abc', '1.234', '-5', '1000000', '1e3'])('parseMoney(%j) is invalid', (input) => {
    expect(parseMoney(input)).toBeNull()
  })

  it('never goes through floating point: 0.1 + 0.2 style inputs are exact', () => {
    expect((parseMoney('0.1') ?? 0) + (parseMoney('0.2') ?? 0)).toBe(parseMoney('0.3'))
  })

  it.each([
    ['2.5', 2500],
    ['1', 1000],
    ['0.005', 5],
    ['9999.999', 9999999],
  ] as const)('parseQuantityMilli(%j) = %i', (input, expected) => {
    expect(parseQuantityMilli(input)).toBe(expected)
  })

  it.each(['', '1.2345', '-1', '10000', 'two'])('parseQuantityMilli(%j) is invalid', (input) => {
    expect(parseQuantityMilli(input)).toBeNull()
  })

  it('formats quantities for the API and for display', () => {
    expect(milliToQuantity(2500)).toBe('2.500')
    expect(milliToQuantity(5)).toBe('0.005')
    expect(formatQuantity('2.500')).toBe('2.5')
    expect(formatQuantity('1.000')).toBe('1')
    expect(formatQuantity('10')).toBe('10')
  })
})
