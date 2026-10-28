import { z } from 'zod'
import { filsToInput, formatQuantity, milliToQuantity, parseMoney, parseQuantityMilli, VAT_RATE_VALUES } from './money'
import type { InvoiceDetail, InvoicePayload } from './types'

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick a date.')

const lineItemSchema = z.object({
  description: z.string().trim().min(1, 'Describe this item.').max(500),
  quantity: z.string().refine((value) => {
    const milli = parseQuantityMilli(value)
    return milli !== null && milli > 0
  }, 'Above 0, up to 3 decimals.'),
  unit_price: z.string().refine((value) => parseMoney(value) !== null, 'e.g. 1500 or 1,250.50'),
  vat_rate: z.enum(VAT_RATE_VALUES),
})

/** Mirrors InvoiceRequest.php. All inputs are strings; toPayload() converts them. */
export const invoiceFormSchema = z
  .object({
    customer_id: z.string().min(1, 'Choose a customer.'),
    issue_date: isoDate,
    due_date: isoDate,
    notes: z.string().max(2000),
    items: z.array(lineItemSchema).min(1, 'Add at least one line item.').max(100, 'Up to 100 lines per invoice.'),
  })
  // ISO dates compare correctly as strings.
  .refine((values) => values.due_date >= values.issue_date, {
    message: 'The due date can’t be before the issue date.',
    path: ['due_date'],
  })

export type InvoiceFormValues = z.infer<typeof invoiceFormSchema>
export type LineItemFormValues = InvoiceFormValues['items'][number]

export const emptyLine: LineItemFormValues = { description: '', quantity: '1', unit_price: '', vat_rate: 'standard' }

export function newInvoiceForm(issueDate: string, dueDate: string): InvoiceFormValues {
  return { customer_id: '', issue_date: issueDate, due_date: dueDate, notes: '', items: [{ ...emptyLine }] }
}

export function toFormValues(invoice: InvoiceDetail): InvoiceFormValues {
  return {
    customer_id: String(invoice.customer.id),
    issue_date: invoice.issue_date,
    due_date: invoice.due_date,
    notes: invoice.notes ?? '',
    items: invoice.items.map((item) => ({
      description: item.description,
      quantity: formatQuantity(item.quantity),
      unit_price: filsToInput(item.unit_price),
      vat_rate: item.vat_rate,
    })),
  }
}

export function toPayload(values: InvoiceFormValues): InvoicePayload {
  return {
    customer_id: Number(values.customer_id),
    issue_date: values.issue_date,
    due_date: values.due_date,
    notes: values.notes.trim() === '' ? null : values.notes.trim(),
    items: values.items.map((item) => ({
      description: item.description.trim(),
      quantity: milliToQuantity(parseQuantityMilli(item.quantity) ?? 0),
      unit_price: parseMoney(item.unit_price) ?? 0,
      vat_rate: item.vat_rate,
    })),
  }
}
