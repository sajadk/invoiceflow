import { describe, expect, it } from 'vitest'
import { extractionToFormValues, warningLabel, warningsByField } from './mapping'
import type { ExtractionResult } from './types'

const result: ExtractionResult = {
  supplier_name: 'Example Office Supplies LLC',
  supplier_trn: '100000000012345',
  supplier_invoice_number: 'EOS-2026-0412',
  issue_date: '2026-03-12',
  due_date: null,
  currency: 'AED',
  items: [
    { description: 'A4 copier paper', quantity: '10.000', unit_price: 2250, vat_rate: 'standard' },
    { description: 'Freight', quantity: '1.500', unit_price: null, vat_rate: 'zero' },
  ],
  document_totals: { subtotal: 22500, vat_total: 1125, total: 23625 },
  totals: null,
  duplicate_bill_id: null,
}

describe('AI capture mapping', () => {
  it('turns the API result into bill form values', () => {
    expect(extractionToFormValues(result, '2026-03-15')).toEqual({
      supplier_name: 'Example Office Supplies LLC',
      supplier_trn: '100000000012345',
      supplier_invoice_number: 'EOS-2026-0412',
      issue_date: '2026-03-12',
      due_date: '',
      notes: '',
      items: [
        { description: 'A4 copier paper', quantity: '10', unit_price: '22.50', vat_rate: 'standard' },
        { description: 'Freight', quantity: '1.5', unit_price: '', vat_rate: 'zero' },
      ],
    })
  })

  it('leaves gaps empty and always gives the form one line', () => {
    const values = extractionToFormValues(
      { ...result, supplier_name: null, supplier_trn: null, issue_date: null, items: [] },
      '2026-03-15',
    )
    expect(values.supplier_name).toBe('')
    expect(values.supplier_trn).toBe('')
    expect(values.issue_date).toBe('2026-03-15')
    expect(values.items).toHaveLength(1)
  })

  it('keeps inline warnings per field and leaves the rest for the summary', () => {
    expect(
      warningsByField([
        { field: 'supplier_trn', message: 'Check the TRN.' },
        { field: 'supplier_trn', message: 'Second note.' },
        { field: 'items.1.unit_price', message: 'Price unreadable.' },
        { field: 'totals', message: 'Totals differ.' },
      ]),
    ).toEqual({ supplier_trn: 'Check the TRN. Second note.', 'items.1.unit_price': 'Price unreadable.' })
  })

  it('labels warnings for people', () => {
    expect(warningLabel('items.1.unit_price')).toBe('Line 2 price')
    expect(warningLabel('supplier_trn')).toBe('Supplier TRN')
    expect(warningLabel('totals')).toBe('Totals')
  })
})
