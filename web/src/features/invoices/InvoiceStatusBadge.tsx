import type { DisplayStatus } from './types'

const styles: Record<DisplayStatus, { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'bg-slate-100 text-slate-700 ring-slate-200' },
  sent: { label: 'Sent', className: 'bg-sky-50 text-sky-700 ring-sky-200' },
  overdue: { label: 'Overdue', className: 'bg-rose-50 text-rose-700 ring-rose-200' },
  paid: { label: 'Paid', className: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  void: { label: 'Void', className: 'bg-slate-50 text-slate-500 line-through ring-slate-200' },
}

export function InvoiceStatusBadge({ status }: { status: DisplayStatus }) {
  const style = styles[status]
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${style.className}`}>
      {style.label}
    </span>
  )
}
