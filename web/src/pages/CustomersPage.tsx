import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Pagination } from '@/components/ui/Pagination'
import { CustomerForm } from '@/features/customers/CustomerForm'
import { CustomersTable } from '@/features/customers/CustomersTable'
import { EMIRATES, isEmirate } from '@/features/customers/emirates'
import { useCustomers, useDeleteCustomer } from '@/features/customers/hooks'
import type { Customer, CustomerListParams, CustomerSort } from '@/features/customers/types'
import { useDebouncedCallback } from '@/hooks/useDebouncedCallback'
import { getErrorMessage } from '@/lib/errors'

const SORTS: CustomerSort[] = ['name', '-name', 'created_at', '-created_at']

/**
 * The URL is the single source of truth for filters (?search=&emirate=&sort=&page=),
 * so a filtered view can be bookmarked, shared, and survives a refresh.
 */
function parseParams(searchParams: URLSearchParams): CustomerListParams {
  const page = Number.parseInt(searchParams.get('page') ?? '1', 10)
  const sort = searchParams.get('sort')
  const emirate = searchParams.get('emirate')

  return {
    page: Number.isFinite(page) && page > 0 ? page : 1,
    search: searchParams.get('search') ?? '',
    emirate: isEmirate(emirate) ? emirate : null,
    sort: SORTS.includes(sort as CustomerSort) ? (sort as CustomerSort) : 'name',
  }
}

type Notice = { tone: 'info' | 'error'; text: string }

type FormState = { open: false } | { open: true; customer: Customer | null }

export function CustomersPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const params = parseParams(searchParams)

  const { data, isPending, isError, isFetching, refetch } = useCustomers(params)
  const deleteCustomer = useDeleteCustomer()

  const [searchInput, setSearchInput] = useState(params.search)
  const [form, setForm] = useState<FormState>({ open: false })
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null)
  const [notice, setNotice] = useState<Notice | null>(null)

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

  // Typing updates the input instantly; the URL (and so the API request) waits 300ms.
  const commitSearch = useDebouncedCallback((value: string) => {
    updateParams({ search: value.trim() || null }, { replace: true })
  }, 300)

  // After deleting the last row on the last page, step back to the new last page.
  useEffect(() => {
    if (data && data.data.length === 0 && data.meta.total > 0 && params.page > data.meta.last_page) {
      updateParams({ page: String(data.meta.last_page) }, { resetPage: false, replace: true })
    }
  }, [data, params.page, updateParams])

  // Notices fade out on their own.
  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(null), 4000)
    return () => clearTimeout(timer)
  }, [notice])

  function handleSaved(customer: Customer, isNew: boolean) {
    setForm({ open: false })
    setNotice({ tone: 'info', text: `${customer.name} ${isNew ? 'added' : 'updated'}.` })
  }

  function confirmDelete() {
    if (!customerToDelete) return
    const customer = customerToDelete
    setCustomerToDelete(null) // close straight away: the row is removed optimistically

    deleteCustomer.mutate(customer.id, {
      onSuccess: () => setNotice({ tone: 'info', text: `${customer.name} deleted.` }),
      onError: (error) =>
        setNotice({ tone: 'error', text: getErrorMessage(error, `Couldn't delete ${customer.name}. It has been restored.`) }),
    })
  }

  function clearFilters() {
    setSearchInput('')
    updateParams({ search: null, emirate: null })
  }

  const hasFilters = params.search !== '' || params.emirate !== null

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Customers</h1>
          <p className="mt-1 text-sm text-slate-500">The businesses you invoice, with their TRN for VAT.</p>
        </div>
        <Button onClick={() => setForm({ open: true, customer: null })}>New customer</Button>
      </div>

      {notice && <Alert tone={notice.tone}>{notice.text}</Alert>}

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 p-4">
          <label className="relative min-w-60 flex-1">
            <span className="sr-only">Search customers</span>
            <svg
              viewBox="0 0 20 20"
              fill="currentColor"
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.45 4.39l3.08 3.08a.75.75 0 1 1-1.06 1.06l-3.08-3.08A7 7 0 0 1 2 9Z"
                clipRule="evenodd"
              />
            </svg>
            <input
              type="search"
              value={searchInput}
              onChange={(event) => {
                setSearchInput(event.target.value)
                commitSearch(event.target.value)
              }}
              placeholder="Search by name, email or TRN"
              className="block w-full rounded-lg border border-slate-300 py-2 pr-3 pl-9 text-sm shadow-sm outline-none placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
          </label>

          <label>
            <span className="sr-only">Filter by emirate</span>
            <select
              value={params.emirate ?? ''}
              onChange={(event) => updateParams({ emirate: event.target.value || null })}
              className="rounded-lg border border-slate-300 bg-white py-2 pr-8 pl-3 text-sm shadow-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            >
              <option value="">All emirates</option>
              {EMIRATES.map((emirate) => (
                <option key={emirate.value} value={emirate.value}>
                  {emirate.label}
                </option>
              ))}
            </select>
          </label>

          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              Clear filters
            </Button>
          )}

          {isFetching && !isPending && <span className="text-xs text-slate-400">Updating…</span>}
        </div>

        {isPending ? (
          <TableSkeleton />
        ) : isError ? (
          <div className="space-y-3 p-8 text-center">
            <p className="text-sm text-slate-600">Couldn&apos;t load customers.</p>
            <Button variant="secondary" size="sm" onClick={() => refetch()}>
              Try again
            </Button>
          </div>
        ) : data.data.length === 0 ? (
          <EmptyState
            filtered={hasFilters}
            onCreate={() => setForm({ open: true, customer: null })}
            onClear={clearFilters}
          />
        ) : (
          <>
            <div className={isFetching ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
              <CustomersTable
                customers={data.data}
                sort={params.sort}
                onSortChange={(sort) => updateParams({ sort: sort === 'name' ? null : sort })}
                onEdit={(customer) => setForm({ open: true, customer })}
                onDelete={setCustomerToDelete}
              />
            </div>
            <Pagination
              meta={data.meta}
              noun="customers"
              onPageChange={(page) => updateParams({ page: page > 1 ? String(page) : null }, { resetPage: false })}
            />
          </>
        )}
      </section>

      <Modal
        open={form.open}
        onClose={() => setForm({ open: false })}
        variant="panel"
        title={form.open && form.customer ? 'Edit customer' : 'New customer'}
        description="Only the name is required. Add a TRN for VAT-registered businesses."
      >
        {form.open && (
          <CustomerForm
            // A new key remounts the form, so its default values reset when switching customers.
            key={form.customer?.id ?? 'new'}
            customer={form.customer}
            onCancel={() => setForm({ open: false })}
            onSaved={(customer) => handleSaved(customer, form.customer === null)}
          />
        )}
      </Modal>

      <Modal
        open={customerToDelete !== null}
        onClose={() => setCustomerToDelete(null)}
        title="Delete customer?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCustomerToDelete(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={confirmDelete}>
              Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600">
          <span className="font-medium text-slate-900">{customerToDelete?.name}</span> will be removed from your
          customer list. Invoices already issued to them will keep their details.
        </p>
      </Modal>
    </div>
  )
}

function TableSkeleton() {
  return (
    <div className="space-y-3 p-4" aria-busy="true" aria-label="Loading customers">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="h-10 animate-pulse rounded-md bg-slate-100" />
      ))}
    </div>
  )
}

function EmptyState({ filtered, onCreate, onClear }: { filtered: boolean; onCreate: () => void; onClear: () => void }) {
  return (
    <div className="px-6 py-16 text-center">
      <p className="font-medium text-slate-900">{filtered ? 'No customers match your filters' : 'No customers yet'}</p>
      <p className="mt-1 text-sm text-slate-500">
        {filtered ? 'Try a different search or emirate.' : 'Add the businesses you invoice to get started.'}
      </p>
      <div className="mt-5">
        {filtered ? (
          <Button variant="secondary" onClick={onClear}>
            Clear filters
          </Button>
        ) : (
          <Button onClick={onCreate}>Add your first customer</Button>
        )}
      </div>
    </div>
  )
}
