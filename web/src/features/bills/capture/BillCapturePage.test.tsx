import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'
import { BillCapturePage } from '@/pages/BillCapturePage'
import { renderWithProviders } from '@/test/render'
import { server } from '@/test/server'
import type { BillPayload } from '../types'
import type { BillExtraction, ExtractionUsage } from './types'

const usage: ExtractionUsage = {
  enabled: true,
  limit: 10,
  used: 1,
  remaining: 9,
  resets_at: '2026-03-16T00:00:00+04:00',
  max_file_kb: 5120,
  max_pages: 3,
}

const pending: BillExtraction = {
  id: '01JTESTEXTRACTION0000000000',
  status: 'pending',
  original_filename: 'invoice.pdf',
  mime: 'application/pdf',
  size: 4,
  result: null,
  warnings: [],
  error: null,
  model: null,
  duration_ms: null,
  completed_at: null,
  created_at: new Date().toISOString(),
}

const completed: BillExtraction = {
  ...pending,
  status: 'completed',
  model: 'gemini-2.5-flash',
  duration_ms: 6200,
  result: {
    supplier_name: 'Example Office Supplies LLC',
    supplier_trn: null,
    supplier_invoice_number: 'EOS-2026-0412',
    issue_date: '2026-03-12',
    due_date: '2026-04-11',
    currency: 'AED',
    items: [{ description: 'A4 copier paper', quantity: '10.000', unit_price: 2250, vat_rate: 'standard' }],
    document_totals: { subtotal: 22500, vat_total: 1125, total: 23625 },
    totals: { subtotal: 22500, vat_total: 1125, total: 23625 },
    duplicate_bill_id: null,
  },
  warnings: [
    { field: 'supplier_trn', message: 'VAT is charged but no supplier TRN was found.' },
    { field: 'items.0.vat_rate', message: 'The VAT rate isn’t shown, so VAT 5% was assumed.' },
  ],
}

describe('AI invoice capture', () => {
  beforeEach(() => {
    // jsdom has no object URLs; the preview only needs a string.
    URL.createObjectURL = () => 'blob:preview'
    URL.revokeObjectURL = () => {}
  })

  it('uploads a document, waits for the AI, and saves the checked bill', async () => {
    let saved: BillPayload | null = null
    server.use(
      http.get('/api/bill-extractions/usage', () => HttpResponse.json({ data: usage })),
      http.post('/api/bill-extractions', () => HttpResponse.json({ data: pending }, { status: 202 })),
      // Still working on the first poll, done on the next.
      http.get('/api/bill-extractions/:id', () => HttpResponse.json({ data: { ...pending, status: 'processing' } }), { once: true }),
      http.get('/api/bill-extractions/:id', () => HttpResponse.json({ data: completed })),
      http.post('/api/bills', async ({ request }) => {
        saved = (await request.json()) as BillPayload
        return HttpResponse.json({ data: { id: 42, items: [], vat_breakdown: [] } }, { status: 201 })
      }),
    )
    const user = userEvent.setup()
    renderWithProviders(<BillCapturePage />, { route: '/bills/capture' })

    expect(await screen.findByText(/9 of 10 uploads left today/)).toBeInTheDocument()
    await user.upload(screen.getByLabelText('Supplier invoice file'), new File(['%PDF'], 'invoice.pdf', { type: 'application/pdf' }))

    expect(await screen.findByText(/Reading invoice.pdf/)).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'Check the details' }, { timeout: 5000 })).toBeInTheDocument()

    // Pre-filled, with what to check listed and shown on the fields.
    expect(screen.getByLabelText('Supplier')).toHaveValue('Example Office Supplies LLC')
    expect(screen.getByLabelText('Their invoice number')).toHaveValue('EOS-2026-0412')
    expect(screen.getByLabelText('Unit price (AED)')).toHaveValue('22.50')
    const summary = screen.getByText(/Please check these 2 things/).closest('[role="status"]') as HTMLElement
    expect(within(summary).getByText('Line 1 VAT:')).toBeInTheDocument()
    expect(screen.getAllByText('VAT is charged but no supplier TRN was found.')).toHaveLength(2)
    expect(screen.getByText(/Total on the invoice/)).toHaveTextContent('matches')

    // Correcting a field removes its warning.
    await user.type(screen.getByLabelText('Supplier TRN'), '100000000012345')
    expect(screen.getAllByText('VAT is charged but no supplier TRN was found.')).toHaveLength(1)

    await user.click(screen.getByRole('button', { name: 'Record bill' }))

    await expect.poll(() => saved).not.toBeNull()
    expect(saved).toMatchObject({
      supplier_name: 'Example Office Supplies LLC',
      supplier_trn: '100000000012345',
      supplier_invoice_number: 'EOS-2026-0412',
      issue_date: '2026-03-12',
      items: [{ description: 'A4 copier paper', quantity: '10.000', unit_price: 2250, vat_rate: 'standard' }],
    })
  }, 15000)

  it('says why the AI couldn’t read it and offers a way out', async () => {
    server.use(
      http.get('/api/bill-extractions/usage', () => HttpResponse.json({ data: usage })),
      http.get('/api/bill-extractions/:id', () =>
        HttpResponse.json({ data: { ...pending, status: 'failed', error: 'This doesn’t look like an invoice.' } }),
      ),
    )
    renderWithProviders(<BillCapturePage />, { route: `/bills/capture?extraction=${pending.id}` })

    expect(await screen.findByText('This doesn’t look like an invoice.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try another file' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Enter by hand' })).toHaveAttribute('href', '/bills/new')
  })

  it('blocks uploads when the daily limit is used up', async () => {
    server.use(http.get('/api/bill-extractions/usage', () => HttpResponse.json({ data: { ...usage, used: 10, remaining: 0 } })))
    renderWithProviders(<BillCapturePage />, { route: '/bills/capture' })

    expect(await screen.findByText(/used today’s AI uploads/)).toBeInTheDocument()
    expect(screen.getByLabelText('Supplier invoice file')).toBeDisabled()
  })

  it('rejects files it can’t read before uploading', async () => {
    server.use(http.get('/api/bill-extractions/usage', () => HttpResponse.json({ data: usage })))
    const user = userEvent.setup({ applyAccept: false })
    renderWithProviders(<BillCapturePage />, { route: '/bills/capture' })

    await screen.findByText(/9 of 10 uploads left today/)
    await user.upload(screen.getByLabelText('Supplier invoice file'), new File(['hello'], 'notes.txt', { type: 'text/plain' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Upload a PDF, JPG, PNG or WebP file.')
  })
})
