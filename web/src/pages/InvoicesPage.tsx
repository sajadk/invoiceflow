import { useCallback, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { Button } from '@/components/ui/Button'
import { Pagination } from '@/components/ui/Pagination'
import { useInvoices } from '@/features/invoices/hooks'
import { InvoiceStatusBadge } from '@/features/invoices/InvoiceStatusBadge'
import { formatAmount } from '@/features/invoices/money'
import type { InvoiceListParams, InvoiceSort, InvoiceStatusFilter } from '@/features/invoices/types'
import { useDebouncedCallback } from '@/hooks/useDebouncedCallback'
import { daysFromToday, formatIsoDate } from '@/lib/dates'

const TABS: { value: InvoiceStatusFilter | null; label: string }[] = [
  { value: null, label: 'All' },
  { value: 'draft', label: 'Drafts' },
  { value: 'sent', label: 'Sent' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'paid', label: 'Paid' },
  { value: 'void', label: 'Void' },
]

const SORTS: InvoiceSort[] = ['issue_date', '-issue_date', 'due_date', '-due_date', 'total', '-total']

function parseParams(searchParams: URLSearchParams): InvoiceListParams {
  const page = Number.parseInt(searchParams.get('page') ?? '1', 10)
  const status = searchParams.get('status')
  const sort = searchParams.get('sort')
  return {
    page: Number.isFinite(page) && page > 0 ? page : 1,
    search: searchParams.get('search') ?? '',
    status: TABS.some((tab) => tab.value === status) ? (status as InvoiceStatusFilter) : null,
    sort: SORTS.includes(sort as InvoiceSort) ? (sort as InvoiceSort) : '-issue_date',
  }
}

function dueLabel(dueDate: string, isOverdue: boolean, status: string): string | null {
  if (status !== 'sent') return null
  const days = daysFromToday(dueDate)
  if (isOverdue) return `${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} overdue`
  if (days === 0) return 'Due today'
  return `Due in ${days} day${days === 1 ? '' : 's'}`
}

export function InvoicesPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const params = parseParams(searchParams)
  const { data, isPending, isError, isFetching, refetch } = useInvoices(params)
  const [searchInput, setSearchInput] = useState(params.search)

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

  function toggleSort(column: 'issue_date' | 'due_date' | 'total') {
    const next: InvoiceSort = params.sort === `-${column}` ? column : `-${column}`
    updateParams({ sort: next === '-issue_date' ? null : next })
  }

  function sortIndicator(column: string) {
    if (params.sort === column) return '↑'
    if (params.sort === `-${column}`) return '↓'
    return ''
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Invoices</h1>
          <p className="mt-1 text-sm text-slate-500">Drafts, sent tax invoices and what&apos;s still unpaid.</p>
        </div>
        <Button onClick={() => navigate('/invoices/new')}>New invoice</Button>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 pt-3">
          <nav aria-label="Filter by status" className="-mb-px flex gap-1 overflow-x-auto">
            {TABS.map((tab) => {
              const active = params.status === tab.value
              return (
                <button
                  key={tab.label}
                  type="button"
                  aria-current={active ? 'page' : undefined}
                  onClick={() => updateParams({ status: tab.value })}
                  className={`border-b-2 px-3 pb-3 text-sm font-medium whitespace-nowrap transition ${
                    active
                      ? 'border-brand-600 text-brand-700'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {tab.label}
                </button>
              )
            })}
          </nav>
          <label className="mb-3 w-full sm:w-72">
            <span className="sr-only">Search invoices</span>
            <input
              type="search"
              value={searchInput}
              onChange={(event) => {
                setSearchInput(event.target.value)
                commitSearch(event.target.value)
              }}
              placeholder="Search number or customer"
              className="block w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm shadow-sm outline-none placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
          </label>
        </div>

        {isPending ? (
          <div className="space-y-3 p-4" aria-busy="true">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="h-10 animate-pulse rounded-md bg-slate-100" />
            ))}
          </div>
        ) : isError ? (
          <div className="space-y-3 p-8 text-center">
            <p className="text-sm text-slate-600">Couldn&apos;t load invoices.</p>
            <Button variant="secondary" size="sm" onClick={() => refetch()}>
              Try again
            </Button>
          </div>
        ) : data.data.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="font-medium text-slate-900">
              {params.status || params.search ? 'No invoices match' : 'No invoices yet'}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {params.status || params.search
                ? 'Try another status or search.'
                : 'Create a draft, add line items, and send it when it’s ready.'}
            </p>
            {!params.status && !params.search && (
              <Button className="mt-5" onClick={() => navigate('/invoices/new')}>
                Create your first invoice
              </Button>
            )}
          </div>
        ) : (
          <>
            <div className={`overflow-x-auto transition-opacity ${isFetching ? 'opacity-60' : ''}`}>
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-medium">Invoice</th>
                    <th scope="col" className="px-4 py-3 font-medium">Customer</th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      <button type="button" onClick={() => toggleSort('issue_date')} className="uppercase hover:text-slate-900">
                        Issued {sortIndicator('issue_date')}
                      </button>
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      <button type="button" onClick={() => toggleSort('due_date')} className="uppercase hover:text-slate-900">
                        Due {sortIndicator('due_date')}
                      </button>
                    </th>
                    <th scope="col" className="px-4 py-3 text-right font-medium">
                      <button type="button" onClick={() => toggleSort('total')} className="uppercase hover:text-slate-900">
                        Total (AED) {sortIndicator('total')}
                      </button>
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.data.map((invoice) => {
                    const due = dueLabel(invoice.due_date, invoice.is_overdue, invoice.status)
                    return (
                      <tr key={invoice.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 whitespace-nowrap">
                          <Link to={`/invoices/${invoice.id}`} className="font-medium text-brand-700 hover:underline">
                            {invoice.number ?? `Draft #${invoice.id}`}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-slate-700">{invoice.billed_to?.name ?? invoice.customer.name}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-slate-500">{formatIsoDate(invoice.issue_date)}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="text-slate-500">{formatIsoDate(invoice.due_date)}</span>
                          {due && (
                            <span className={`block text-xs ${invoice.is_overdue ? 'text-rose-600' : 'text-slate-400'}`}>
                              {due}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-medium whitespace-nowrap tabular-nums">
                          {formatAmount(invoice.total)}
                          {invoice.status === 'sent' && invoice.amount_paid > 0 && (
                            <span className="block text-xs font-normal text-slate-500">
                              {formatAmount(invoice.balance_due)} due
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <InvoiceStatusBadge status={invoice.display_status} />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <Pagination
              meta={data.meta}
              noun="invoices"
              onPageChange={(page) => updateParams({ page: page > 1 ? String(page) : null }, { resetPage: false })}
            />
          </>
        )}
      </section>
    </div>
  )
}
