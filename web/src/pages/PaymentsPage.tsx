import { useCallback, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Pagination } from '@/components/ui/Pagination'
import { formatAmount, formatMoney } from '@/features/invoices/money'
import { useDeletePayment, usePayments } from '@/features/payments/hooks'
import { isPaymentMethod, PAYMENT_METHODS } from '@/features/payments/methods'
import type { Payment, PaymentListParams } from '@/features/payments/types'
import { useDebouncedCallback } from '@/hooks/useDebouncedCallback'
import { formatIsoDate } from '@/lib/dates'
import { getErrorMessage } from '@/lib/errors'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

function parseParams(searchParams: URLSearchParams): PaymentListParams {
  const page = Number.parseInt(searchParams.get('page') ?? '1', 10)
  const method = searchParams.get('method')
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  return {
    page: Number.isFinite(page) && page > 0 ? page : 1,
    search: searchParams.get('search') ?? '',
    method: isPaymentMethod(method) ? method : null,
    from: from && ISO_DATE.test(from) ? from : null,
    to: to && ISO_DATE.test(to) ? to : null,
  }
}

const controlClass =
  'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100'

export function PaymentsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const params = parseParams(searchParams)
  const { data, isPending, isError, isFetching, refetch } = usePayments(params)
  const deletePayment = useDeletePayment()

  const [searchInput, setSearchInput] = useState(params.search)
  const [paymentToDelete, setPaymentToDelete] = useState<Payment | null>(null)
  const [notice, setNotice] = useState<{ tone: 'info' | 'error'; text: string } | null>(null)

  const updateParams = useCallback(
    (changes: Record<string, string | null>, options: { resetPage?: boolean; replace?: boolean } = {}) => {
      const { resetPage = true, replace = false } = options
      setSearchParams(
        (previous) => {
          const next = new URLSearchParams(previous)
          for (const [key, value] of Object.entries(changes)) {
            if (value) next.set(key, value)
            else next.delete(key)
          }
          if (resetPage) next.delete('page')
          return next
        },
        { replace },
      )
    },
    [setSearchParams],
  )

  const commitSearch = useDebouncedCallback((value: string) => {
    updateParams({ search: value.trim() || null }, { replace: true })
  }, 300)

  function confirmDelete() {
    if (!paymentToDelete) return
    const payment = paymentToDelete
    deletePayment.mutate(payment.id, {
      onSuccess: () => setNotice({ tone: 'info', text: `Payment of ${formatMoney(payment.amount)} deleted.` }),
      onError: (error) => setNotice({ tone: 'error', text: getErrorMessage(error) }),
      onSettled: () => setPaymentToDelete(null),
    })
  }

  const hasFilters = Boolean(params.search || params.method || params.from || params.to)
  // Sum of the rows on this page: a quick sanity check when reconciling with a bank statement.
  const pageTotal = data?.data.reduce((sum, payment) => sum + payment.amount, 0) ?? 0

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Payments</h1>
        <p className="mt-1 text-sm text-slate-500">
          Money received against your invoices. Record payments from an invoice&apos;s page.
        </p>
      </div>

      {notice && <Alert tone={notice.tone}>{notice.text}</Alert>}

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-end gap-3 border-b border-slate-200 p-4">
          <label className="min-w-56 flex-1">
            <span className="mb-1 block text-xs font-medium text-slate-500">Search</span>
            <input
              type="search"
              value={searchInput}
              onChange={(event) => {
                setSearchInput(event.target.value)
                commitSearch(event.target.value)
              }}
              placeholder="Invoice no., customer or reference"
              className={`${controlClass} w-full`}
            />
          </label>
          <label>
            <span className="mb-1 block text-xs font-medium text-slate-500">Method</span>
            <select
              value={params.method ?? ''}
              onChange={(event) => updateParams({ method: event.target.value || null })}
              className={controlClass}
            >
              <option value="">All methods</option>
              {PAYMENT_METHODS.map((method) => (
                <option key={method.value} value={method.value}>
                  {method.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="mb-1 block text-xs font-medium text-slate-500">From</span>
            <input
              type="date"
              value={params.from ?? ''}
              max={params.to ?? undefined}
              onChange={(event) => updateParams({ from: event.target.value || null })}
              className={controlClass}
            />
          </label>
          <label>
            <span className="mb-1 block text-xs font-medium text-slate-500">To</span>
            <input
              type="date"
              value={params.to ?? ''}
              min={params.from ?? undefined}
              onChange={(event) => updateParams({ to: event.target.value || null })}
              className={controlClass}
            />
          </label>
          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchInput('')
                updateParams({ search: null, method: null, from: null, to: null })
              }}
            >
              Clear
            </Button>
          )}
        </div>

        {isPending ? (
          <div className="space-y-3 p-4" aria-busy="true">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="h-10 animate-pulse rounded-md bg-slate-100" />
            ))}
          </div>
        ) : isError ? (
          <div className="space-y-3 p-8 text-center">
            <p className="text-sm text-slate-600">Couldn&apos;t load payments.</p>
            <Button variant="secondary" size="sm" onClick={() => refetch()}>
              Try again
            </Button>
          </div>
        ) : data.data.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="font-medium text-slate-900">{hasFilters ? 'No payments match' : 'No payments yet'}</p>
            <p className="mt-1 text-sm text-slate-500">
              {hasFilters ? 'Try a wider date range or another method.' : 'Open a sent invoice and choose “Record payment”.'}
            </p>
            {!hasFilters && (
              <Link to="/invoices?status=sent" className="mt-5 inline-block text-sm font-medium text-brand-700 hover:underline">
                View unpaid invoices →
              </Link>
            )}
          </div>
        ) : (
          <>
            <div className={`overflow-x-auto transition-opacity ${isFetching ? 'opacity-60' : ''}`}>
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-medium">Date</th>
                    <th scope="col" className="px-4 py-3 font-medium">Invoice</th>
                    <th scope="col" className="px-4 py-3 font-medium">Customer</th>
                    <th scope="col" className="px-4 py-3 font-medium">Method</th>
                    <th scope="col" className="px-4 py-3 font-medium">Reference</th>
                    <th scope="col" className="px-4 py-3 text-right font-medium">Amount (AED)</th>
                    <th scope="col" className="px-4 py-3">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.data.map((payment) => (
                    <tr key={payment.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 whitespace-nowrap text-slate-600">{formatIsoDate(payment.paid_on)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {payment.invoice && (
                          <Link to={`/invoices/${payment.invoice.id}`} className="font-medium text-brand-700 hover:underline">
                            {payment.invoice.number}
                          </Link>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-700">{payment.invoice?.customer_name}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-slate-600">{payment.method_label}</td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-500">{payment.reference ?? '—'}</td>
                      <td className="px-4 py-3 text-right font-medium whitespace-nowrap tabular-nums">
                        {formatAmount(payment.amount)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => setPaymentToDelete(payment)}
                          className="rounded-md px-2 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50"
                        >
                          Delete<span className="sr-only"> payment of {formatMoney(payment.amount)}</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t border-slate-200 bg-slate-50 text-sm">
                  <tr>
                    <td colSpan={5} className="px-4 py-2.5 text-slate-500">
                      Total on this page
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold tabular-nums">{formatAmount(pageTotal)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
            <Pagination
              meta={data.meta}
              noun="payments"
              onPageChange={(page) => updateParams({ page: page > 1 ? String(page) : null }, { resetPage: false })}
            />
          </>
        )}
      </section>

      <ConfirmDialog
        open={paymentToDelete !== null}
        title="Delete this payment?"
        confirmLabel="Delete payment"
        tone="danger"
        isLoading={deletePayment.isPending}
        onConfirm={confirmDelete}
        onClose={() => setPaymentToDelete(null)}
      >
        {paymentToDelete && (
          <>
            {formatMoney(paymentToDelete.amount)} will be added back to the balance of{' '}
            {paymentToDelete.invoice?.number}. If the invoice was fully paid, it goes back to unpaid.
          </>
        )}
      </ConfirmDialog>
    </div>
  )
}
