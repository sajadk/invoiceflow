import { useCallback, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { Button } from '@/components/ui/Button'
import { Pagination } from '@/components/ui/Pagination'
import { BillStatusBadge } from '@/features/bills/BillStatusBadge'
import { useBills } from '@/features/bills/hooks'
import type { BillListParams, BillSort, BillStatusFilter } from '@/features/bills/types'
import { formatAmount } from '@/features/invoices/money'
import { useDebouncedCallback } from '@/hooks/useDebouncedCallback'
import { daysFromToday, formatIsoDate } from '@/lib/dates'
import { formatTrn } from '@/lib/format'

const TABS: { value: BillStatusFilter | null; label: string }[] = [
  { value: null, label: 'All' },
  { value: 'unpaid', label: 'Unpaid' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'paid', label: 'Paid' },
]

const SORTS: BillSort[] = ['issue_date', '-issue_date', 'due_date', '-due_date', 'total', '-total']

function parseParams(searchParams: URLSearchParams): BillListParams {
  const page = Number.parseInt(searchParams.get('page') ?? '1', 10)
  const status = searchParams.get('status')
  const sort = searchParams.get('sort')
  return {
    page: Number.isFinite(page) && page > 0 ? page : 1,
    search: searchParams.get('search') ?? '',
    status: TABS.some((tab) => tab.value === status) ? (status as BillStatusFilter) : null,
    sort: SORTS.includes(sort as BillSort) ? (sort as BillSort) : '-issue_date',
  }
}

function dueLabel(dueDate: string | null, isOverdue: boolean, status: string): string | null {
  if (status !== 'unpaid' || !dueDate) return null
  const days = daysFromToday(dueDate)
  if (isOverdue) return `${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} overdue`
  if (days === 0) return 'Due today'
  return `Due in ${days} day${days === 1 ? '' : 's'}`
}

export function BillsPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const params = parseParams(searchParams)
  const { data, isPending, isError, isFetching, refetch } = useBills(params)
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
    const next: BillSort = params.sort === `-${column}` ? column : `-${column}`
    updateParams({ sort: next === '-issue_date' ? null : next })
  }

  function sortIndicator(column: string) {
    if (params.sort === column) return '↑'
    if (params.sort === `-${column}`) return '↓'
    return ''
  }

  const filtered = Boolean(params.status || params.search)

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Bills</h1>
          <p className="mt-1 text-sm text-slate-500">Supplier invoices you&apos;ve received. Their VAT is reclaimable input VAT.</p>
        </div>
        <Button onClick={() => navigate('/bills/new')}>Record bill</Button>
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
                    active ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {tab.label}
                </button>
              )
            })}
          </nav>
          <label className="mb-3 w-full sm:w-72">
            <span className="sr-only">Search bills</span>
            <input
              type="search"
              value={searchInput}
              onChange={(event) => {
                setSearchInput(event.target.value)
                commitSearch(event.target.value)
              }}
              placeholder="Search supplier, number or TRN"
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
            <p className="text-sm text-slate-600">Couldn&apos;t load bills.</p>
            <Button variant="secondary" size="sm" onClick={() => refetch()}>
              Try again
            </Button>
          </div>
        ) : data.data.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="font-medium text-slate-900">{filtered ? 'No bills match' : 'No bills yet'}</p>
            <p className="mt-1 text-sm text-slate-500">
              {filtered ? 'Try another status or search.' : 'Record the invoices your suppliers send you to track input VAT.'}
            </p>
            {!filtered && (
              <Button className="mt-5" onClick={() => navigate('/bills/new')}>
                Record your first bill
              </Button>
            )}
          </div>
        ) : (
          <>
            <div className={`overflow-x-auto transition-opacity ${isFetching ? 'opacity-60' : ''}`}>
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-medium">Supplier</th>
                    <th scope="col" className="px-4 py-3 font-medium">Their invoice</th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      <button type="button" onClick={() => toggleSort('issue_date')} className="uppercase hover:text-slate-900">
                        Dated {sortIndicator('issue_date')}
                      </button>
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      <button type="button" onClick={() => toggleSort('due_date')} className="uppercase hover:text-slate-900">
                        Due {sortIndicator('due_date')}
                      </button>
                    </th>
                    <th scope="col" className="px-4 py-3 text-right font-medium">VAT</th>
                    <th scope="col" className="px-4 py-3 text-right font-medium">
                      <button type="button" onClick={() => toggleSort('total')} className="uppercase hover:text-slate-900">
                        Total (AED) {sortIndicator('total')}
                      </button>
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.data.map((bill) => {
                    const due = dueLabel(bill.due_date, bill.is_overdue, bill.status)
                    return (
                      <tr key={bill.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <Link to={`/bills/${bill.id}`} className="font-medium text-brand-700 hover:underline">
                            {bill.supplier_name}
                          </Link>
                          <span className="block font-mono text-xs text-slate-500">
                            {bill.supplier_trn ? `TRN ${formatTrn(bill.supplier_trn)}` : <span className="font-sans">No TRN</span>}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-slate-700">{bill.supplier_invoice_number}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-slate-500">{formatIsoDate(bill.issue_date)}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="text-slate-500">{bill.due_date ? formatIsoDate(bill.due_date) : '—'}</span>
                          {due && (
                            <span className={`block text-xs ${bill.is_overdue ? 'text-rose-600' : 'text-slate-400'}`}>{due}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap text-slate-600 tabular-nums">{formatAmount(bill.vat_total)}</td>
                        <td className="px-4 py-3 text-right font-medium whitespace-nowrap tabular-nums">{formatAmount(bill.total)}</td>
                        <td className="px-4 py-3">
                          <BillStatusBadge status={bill.display_status} />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <Pagination
              meta={data.meta}
              noun="bills"
              onPageChange={(page) => updateParams({ page: page > 1 ? String(page) : null }, { resetPage: false })}
            />
          </>
        )}
      </section>
    </div>
  )
}
