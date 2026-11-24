import type { BillDisplayStatus } from './types'

const styles: Record<BillDisplayStatus, { label: string; className: string }> = {
  unpaid: { label: 'Unpaid', className: 'bg-sky-50 text-sky-700 ring-sky-200' },
  overdue: { label: 'Overdue', className: 'bg-rose-50 text-rose-700 ring-rose-200' },
  paid: { label: 'Paid', className: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
}

export function BillStatusBadge({ status }: { status: BillDisplayStatus }) {
  const style = styles[status]
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${style.className}`}>
      {style.label}
    </span>
  )
}
