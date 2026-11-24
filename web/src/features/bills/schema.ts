import { z } from 'zod'
import { isoDate, itemsToForm, itemsToPayload, lineItemSchema, emptyLine } from '@/features/invoices/schema'
import type { BillDetail, BillPayload } from './types'

/** Mirrors BillRequest.php. All inputs are strings; toBillPayload() converts them. */
export const billFormSchema = z
  .object({
    supplier_name: z.string().trim().min(1, 'Who sent this invoice?').max(255),
    supplier_trn: z
      .string()
      .trim()
      .regex(/^$|^[\d\s-]+$/, 'Digits only.')
      .refine((value) => {
        const digits = value.replace(/\D/g, '')
        return digits === '' || (digits.length === 15 && digits.startsWith('100'))
      }, 'A UAE TRN is 15 digits and starts with 100.'),
    supplier_invoice_number: z.string().trim().min(1, 'The number printed on their invoice.').max(64),
    issue_date: isoDate,
    due_date: z.union([z.literal(''), isoDate]),
    notes: z.string().max(2000),
    items: z.array(lineItemSchema).min(1, 'Add at least one line item.').max(100, 'Up to 100 lines per bill.'),
  })
  .refine((values) => values.due_date === '' || values.due_date >= values.issue_date, {
    message: 'The due date can’t be before the invoice date.',
    path: ['due_date'],
  })

export type BillFormValues = z.infer<typeof billFormSchema>

export function newBillForm(issueDate: string): BillFormValues {
  return {
    supplier_name: '',
    supplier_trn: '',
    supplier_invoice_number: '',
    issue_date: issueDate,
    due_date: '',
    notes: '',
    items: [{ ...emptyLine }],
  }
}

export function toBillFormValues(bill: BillDetail): BillFormValues {
  return {
    supplier_name: bill.supplier_name,
    supplier_trn: bill.supplier_trn ?? '',
    supplier_invoice_number: bill.supplier_invoice_number,
    issue_date: bill.issue_date,
    due_date: bill.due_date ?? '',
    notes: bill.notes ?? '',
    items: itemsToForm(bill.items),
  }
}

export function toBillPayload(values: BillFormValues): BillPayload {
  const trn = values.supplier_trn.replace(/\D/g, '')
  return {
    supplier_name: values.supplier_name.trim(),
    supplier_trn: trn === '' ? null : trn,
    supplier_invoice_number: values.supplier_invoice_number.trim(),
    issue_date: values.issue_date,
    due_date: values.due_date === '' ? null : values.due_date,
    notes: values.notes.trim() === '' ? null : values.notes.trim(),
    items: itemsToPayload(values.items),
  }
}
