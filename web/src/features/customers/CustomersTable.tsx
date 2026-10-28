import { formatDate, formatTrn } from '@/lib/format'
import type { Customer, CustomerSort } from './types'

type SortableColumn = 'name' | 'created_at'

type CustomersTableProps = {
  customers: Customer[]
  sort: CustomerSort
  onSortChange: (sort: CustomerSort) => void
  onEdit: (customer: Customer) => void
  onDelete: (customer: Customer) => void
}

function SortHeader({
  column,
  label,
  sort,
  onSortChange,
}: {
  column: SortableColumn
  label: string
  sort: CustomerSort
  onSortChange: (sort: CustomerSort) => void
}) {
  const isActive = sort === column || sort === `-${column}`
  const isDescending = sort === `-${column}`
  const next = (isActive && !isDescending ? `-${column}` : column) as CustomerSort

  return (
    <th scope="col" aria-sort={isActive ? (isDescending ? 'descending' : 'ascending') : 'none'} className="px-4 py-3">
      <button
        type="button"
        onClick={() => onSortChange(next)}
        className="inline-flex items-center gap-1 font-medium hover:text-slate-900"
      >
        {label}
        <span aria-hidden="true" className={isActive ? 'text-slate-700' : 'text-slate-300'}>
          {isActive && isDescending ? '↓' : '↑'}
        </span>
      </button>
    </th>
  )
}

export function CustomersTable({ customers, sort, onSortChange, onEdit, onDelete }: CustomersTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <SortHeader column="name" label="Customer" sort={sort} onSortChange={onSortChange} />
            <th scope="col" className="px-4 py-3 font-medium">TRN</th>
            <th scope="col" className="px-4 py-3 font-medium">Emirate</th>
            <th scope="col" className="px-4 py-3 font-medium">Phone</th>
            <SortHeader column="created_at" label="Added" sort={sort} onSortChange={onSortChange} />
            <th scope="col" className="px-4 py-3">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {customers.map((customer) => (
            <tr key={customer.id} className="transition-colors hover:bg-slate-50">
              <td className="px-4 py-3">
                <p className="font-medium text-slate-900">{customer.name}</p>
                {customer.email && <p className="text-xs text-slate-500">{customer.email}</p>}
              </td>
              <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-slate-700">
                {customer.trn ? formatTrn(customer.trn) : <span className="font-sans text-slate-400">Not registered</span>}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-slate-600">{customer.emirate_label ?? '—'}</td>
              <td className="whitespace-nowrap px-4 py-3 text-slate-600">{customer.phone ?? '—'}</td>
              <td className="whitespace-nowrap px-4 py-3 text-slate-500">{formatDate(customer.created_at)}</td>
              <td className="whitespace-nowrap px-4 py-3 text-right">
                <button
                  type="button"
                  onClick={() => onEdit(customer)}
                  className="rounded-md px-2 py-1 font-medium text-brand-700 hover:bg-brand-50"
                >
                  Edit<span className="sr-only">, {customer.name}</span>
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(customer)}
                  className="ml-1 rounded-md px-2 py-1 font-medium text-rose-600 hover:bg-rose-50"
                >
                  Delete<span className="sr-only">, {customer.name}</span>
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
