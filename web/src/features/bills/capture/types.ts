import type { VatRate } from '@/features/invoices/money'

export type ExtractionStatus = 'pending' | 'processing' | 'completed' | 'failed'

/** A "check this" note on one field ("supplier_trn", "items.2.unit_price", "totals", "document"…). */
export type ExtractionWarning = { field: string; message: string }

export type ExtractionTotals = { subtotal: number; vat_total: number; total: number }

/** What the AI read, already checked and converted by the API (money in fils). */
export type ExtractionResult = {
  supplier_name: string | null
  supplier_trn: string | null
  supplier_invoice_number: string | null
  issue_date: string | null
  due_date: string | null
  currency: string
  items: { description: string; quantity: string; unit_price: number | null; vat_rate: VatRate }[]
  /** As printed on the document. */
  document_totals: { subtotal: number | null; vat_total: number | null; total: number | null }
  /** As InvoiceCalculator works them out from the lines (null when a price is missing). */
  totals: ExtractionTotals | null
  duplicate_bill_id: number | null
}

export type BillExtraction = {
  id: string
  status: ExtractionStatus
  original_filename: string
  mime: string
  size: number
  result: ExtractionResult | null
  warnings: ExtractionWarning[]
  error: string | null
  model: string | null
  duration_ms: number | null
  completed_at: string | null
  created_at: string
}

export type ExtractionUsage = {
  enabled: boolean
  limit: number
  used: number
  remaining: number
  resets_at: string
  max_file_kb: number
  max_pages: number
}
