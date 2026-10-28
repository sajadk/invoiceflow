/**
 * Money and VAT maths for the browser: a line-for-line mirror of
 * api/app/Support/InvoiceCalculator.php. Everything is integer fils (1 AED = 100 fils).
 *
 * Rounding is half-up, done as integer division, never Math.round on a float
 * amount, so the live totals in the editor match what the server saves exactly.
 * The largest allowed line (9,999.999 × AED 999,999.99) stays far below
 * Number.MAX_SAFE_INTEGER, so plain numbers are exact here.
 */

export const VAT_RATES = [
  { value: 'standard', label: 'VAT 5%', percent: 5 },
  { value: 'zero', label: 'Zero-rated', percent: 0 },
  { value: 'exempt', label: 'Exempt', percent: 0 },
] as const

export type VatRate = (typeof VAT_RATES)[number]['value']

export const VAT_RATE_VALUES = VAT_RATES.map((rate) => rate.value) as [VatRate, ...VatRate[]]

function vatRateInfo(rate: VatRate) {
  return VAT_RATES.find((r) => r.value === rate) ?? VAT_RATES[0]
}

// --- Parsing user input ------------------------------------------------------

const MONEY_PATTERN = /^\d{1,6}(\.\d{1,2})?$/ // up to AED 999,999.99
const QUANTITY_PATTERN = /^\d{1,4}(\.\d{1,3})?$/ // up to 9,999.999

/** "1,250.5" → 125050 fils. null if it isn't a valid amount. Parsed as text, never via parseFloat. */
export function parseMoney(input: string): number | null {
  const cleaned = input.replace(/[,\s]/g, '')
  if (!MONEY_PATTERN.test(cleaned)) return null
  const [whole = '0', fraction = ''] = cleaned.split('.')
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'))
}

/** "2.5" → 2500 (thousandths). null if invalid. */
export function parseQuantityMilli(input: string): number | null {
  const cleaned = input.trim()
  if (!QUANTITY_PATTERN.test(cleaned)) return null
  const [whole = '0', fraction = ''] = cleaned.split('.')
  return Number(whole) * 1000 + Number(fraction.padEnd(3, '0'))
}

/** 2500 → "2.500", the format the API accepts and returns. */
export function milliToQuantity(milli: number): string {
  return `${Math.floor(milli / 1000)}.${String(milli % 1000).padStart(3, '0')}`
}

// --- Calculation (mirror of InvoiceCalculator.php) --------------------------

export function lineTotal(quantityMilli: number, unitPrice: number): number {
  return Math.floor((quantityMilli * unitPrice + 500) / 1000)
}

export function vatOn(taxable: number, rate: VatRate): number {
  return Math.floor((taxable * vatRateInfo(rate).percent + 50) / 100)
}

export type CalculatorLine = { quantityMilli: number; unitPrice: number; vatRate: VatRate }

export type VatBreakdownRow = {
  rate: VatRate
  label: string
  percent: number
  taxable: number
  vat: number
}

export type Totals = {
  subtotal: number
  vat_total: number
  total: number
  vat_breakdown: VatBreakdownRow[]
}

export function calculateTotals(lines: CalculatorLine[]): Totals {
  const taxableByRate = new Map<VatRate, number>()
  for (const line of lines) {
    taxableByRate.set(line.vatRate, (taxableByRate.get(line.vatRate) ?? 0) + lineTotal(line.quantityMilli, line.unitPrice))
  }

  const vat_breakdown: VatBreakdownRow[] = []
  for (const rate of VAT_RATES) {
    const taxable = taxableByRate.get(rate.value)
    if (taxable === undefined) continue
    vat_breakdown.push({ rate: rate.value, label: rate.label, percent: rate.percent, taxable, vat: vatOn(taxable, rate.value) })
  }

  const subtotal = vat_breakdown.reduce((sum, row) => sum + row.taxable, 0)
  const vat_total = vat_breakdown.reduce((sum, row) => sum + row.vat, 0)
  return { subtotal, vat_total, total: subtotal + vat_total, vat_breakdown }
}

// --- Display -----------------------------------------------------------------

const currencyFormatter = new Intl.NumberFormat('en-AE', { style: 'currency', currency: 'AED' })
const amountFormatter = new Intl.NumberFormat('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** 125050 → "AED 1,250.50" */
export function formatMoney(fils: number): string {
  return currencyFormatter.format(fils / 100)
}

/** 125050 → "1,250.50" (for table cells next to a currency heading) */
export function formatAmount(fils: number): string {
  return amountFormatter.format(fils / 100)
}

/** 125050 → "1250.50" (to put back into an input) */
export function filsToInput(fils: number): string {
  return (fils / 100).toFixed(2)
}

/** "2.500" → "2.5", "1.000" → "1" */
export function formatQuantity(quantity: string): string {
  return quantity.includes('.') ? quantity.replace(/\.?0+$/, '') : quantity
}
