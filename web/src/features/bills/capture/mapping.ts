import { filsToInput, formatQuantity } from '@/features/invoices/money'
import { emptyLine } from '@/features/invoices/schema'
import type { BillFormValues } from '../schema'
import type { ExtractionResult, ExtractionWarning } from './types'

/** What the AI read → the bill form's string values. Gaps stay empty for the user to fill in. */
export function extractionToFormValues(result: ExtractionResult, today: string): BillFormValues {
  return {
    supplier_name: result.supplier_name ?? '',
    supplier_trn: result.supplier_trn ?? '',
    supplier_invoice_number: result.supplier_invoice_number ?? '',
    issue_date: result.issue_date ?? today,
    due_date: result.due_date ?? '',
    notes: '',
    items:
      result.items.length > 0
        ? result.items.map((item) => ({
            description: item.description,
            quantity: formatQuantity(item.quantity),
            unit_price: item.unit_price === null ? '' : filsToInput(item.unit_price),
            vat_rate: item.vat_rate,
          }))
        : [{ ...emptyLine }],
  }
}

/** Fields that can carry a warning inline; anything else ("totals", "document", "items") is listed above the form. */
const INLINE_FIELD = /^(supplier_name|supplier_trn|supplier_invoice_number|issue_date|due_date|items\.\d+\.(description|quantity|unit_price|vat_rate))$/

export function warningsByField(warnings: ExtractionWarning[]): Partial<Record<string, string>> {
  const byField: Partial<Record<string, string>> = {}
  for (const { field, message } of warnings) {
    if (!INLINE_FIELD.test(field)) continue
    byField[field] = byField[field] ? `${byField[field]} ${message}` : message
  }
  return byField
}

const FIELD_LABELS: Record<string, string> = {
  supplier_name: 'Supplier',
  supplier_trn: 'Supplier TRN',
  supplier_invoice_number: 'Invoice number',
  issue_date: 'Invoice date',
  due_date: 'Due date',
  currency: 'Currency',
  totals: 'Totals',
  items: 'Line items',
  document: 'Document',
}

/** For the "please check" summary: "Line 2 price", "Supplier TRN"… */
export function warningLabel(field: string): string {
  const line = /^items\.(\d+)\.(\w+)$/.exec(field)
  if (line) {
    const what = { description: 'description', quantity: 'quantity', unit_price: 'price', vat_rate: 'VAT' }[line[2] ?? ''] ?? ''
    return `Line ${Number(line[1]) + 1} ${what}`.trim()
  }
  return FIELD_LABELS[field] ?? field
}
