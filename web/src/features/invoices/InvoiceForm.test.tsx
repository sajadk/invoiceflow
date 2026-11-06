import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { customerFixture, invoiceDetailFixture, paginated } from '@/test/fixtures'
import { renderWithProviders } from '@/test/render'
import { server } from '@/test/server'
import { addDaysIso, todayIso } from '@/lib/dates'
import { InvoiceForm } from './InvoiceForm'
import { formatMoney } from './money'

/**
 * Tested the way a user uses it: find fields by their labels, type, click, and
 * check what appears on screen and what is sent to the (mocked) API. No test
 * reaches into component state, so refactoring the internals won't break them.
 */
describe('InvoiceForm', () => {
  beforeEach(() => {
    server.use(http.get('/api/customers', () => HttpResponse.json(paginated([customerFixture]))))
  })

  async function renderForm() {
    const onSaved = vi.fn()
    const user = userEvent.setup()
    renderWithProviders(<InvoiceForm invoice={null} onSaved={onSaved} onCancel={vi.fn()} />)
    // Wait for the customer picker to load.
    await screen.findByRole('option', { name: /Al Noor Trading LLC/ })
    return { user, onSaved }
  }

  async function fillValidInvoice(user: ReturnType<typeof userEvent.setup>) {
    await user.selectOptions(screen.getByLabelText('Customer'), String(customerFixture.id))
    await user.type(screen.getByLabelText('Description, line 1'), 'Consulting')
    const quantity = screen.getByLabelText('Quantity')
    await user.clear(quantity)
    await user.type(quantity, '1.5')
    await user.type(screen.getByLabelText('Unit price (AED)'), '1,000')
  }

  it('updates the totals live as line items are typed', async () => {
    const { user } = await renderForm()

    await fillValidInvoice(user)

    // 1.5 × AED 1,000 = 1,500 + 5% VAT = 1,575
    expect(screen.getByText(formatMoney(150000))).toBeInTheDocument()
    expect(screen.getByText(formatMoney(7500))).toBeInTheDocument()
    expect(screen.getByText(formatMoney(157500))).toBeInTheDocument()

    // Switching the line to zero-rated removes the VAT.
    await user.selectOptions(screen.getByLabelText('VAT treatment'), 'zero')
    expect(screen.queryByText(formatMoney(157500))).not.toBeInTheDocument()
    expect(screen.getAllByText(formatMoney(150000)).length).toBeGreaterThan(0)
  })

  it('shows validation errors and sends nothing when the form is incomplete', async () => {
    let requests = 0
    server.use(
      http.post('/api/invoices', () => {
        requests++
        return HttpResponse.json({}, { status: 500 })
      }),
    )
    const { user, onSaved } = await renderForm()

    await user.click(screen.getByRole('button', { name: 'Save draft' }))

    expect(await screen.findByText('Choose a customer.')).toBeInTheDocument()
    expect(screen.getByText(/Describe this item\./)).toBeInTheDocument()
    expect(screen.getByText(/Price: e\.g\. 1500/)).toBeInTheDocument()
    expect(requests).toBe(0)
    expect(onSaved).not.toHaveBeenCalled()
  })

  it('sends money as integer fils and quantities as decimal strings', async () => {
    let body: unknown
    server.use(
      http.post('/api/invoices', async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({ data: invoiceDetailFixture() }, { status: 201 })
      }),
    )
    const { user, onSaved } = await renderForm()

    await fillValidInvoice(user)
    await user.click(screen.getByRole('button', { name: 'Save draft' }))

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ id: 42 })))
    expect(body).toEqual({
      customer_id: customerFixture.id,
      issue_date: todayIso(),
      due_date: addDaysIso(todayIso(), 30),
      notes: null,
      items: [{ description: 'Consulting', quantity: '1.500', unit_price: 100000, vat_rate: 'standard' }],
    })
  })

  it('puts server validation errors on the matching fields', async () => {
    server.use(
      http.post('/api/invoices', () =>
        HttpResponse.json(
          {
            message: 'The given data was invalid.',
            errors: {
              customer_id: ['Choose one of your customers.'],
              'items.0.quantity': ['Up to 3 decimal places.'],
            },
          },
          { status: 422 },
        ),
      ),
    )
    const { user, onSaved } = await renderForm()

    await fillValidInvoice(user)
    await user.click(screen.getByRole('button', { name: 'Save draft' }))

    expect(await screen.findByText('Choose one of your customers.')).toBeInTheDocument()
    expect(screen.getByText('Qty: Up to 3 decimal places.')).toBeInTheDocument()
    expect(onSaved).not.toHaveBeenCalled()
  })
})
