import { formatMoney } from '@/features/invoices/money'
import type { DashboardSummary } from './types'

// From "fine" to "chase this now".
const BUCKET_COLORS: Record<DashboardSummary['aging'][number]['bucket'], string> = {
  current: 'bg-emerald-500',
  '1_30': 'bg-amber-400',
  '31_60': 'bg-orange-500',
  '61_90': 'bg-rose-500',
  '90_plus': 'bg-rose-700',
}

/** Receivables aging: unpaid balances grouped by how many days past due. */
export function AgingCard({ aging }: { aging: DashboardSummary['aging'] }) {
  const max = Math.max(...aging.map((row) => row.amount), 1)
  const total = aging.reduce((sum, row) => sum + row.amount, 0)

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-base font-semibold">Receivables aging</h2>
      <p className="mt-1 text-sm text-slate-500">Unpaid balances by days past due</p>

      {total === 0 ? (
        <p className="mt-6 text-sm text-slate-500">Nothing outstanding. Every sent invoice is paid.</p>
      ) : (
        <ul className="mt-5 space-y-3.5">
          {aging.map((row) => (
            <li key={row.bucket}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="text-slate-600">
                  {row.label}
                  {row.count > 0 && (
                    <span className="text-slate-400">
                      {' '}
                      · {row.count} invoice{row.count === 1 ? '' : 's'}
                    </span>
                  )}
                </span>
                <span className="font-medium tabular-nums">{formatMoney(row.amount)}</span>
              </div>
              <div className="mt-1.5 h-2 rounded-full bg-slate-100">
                <div
                  className={`h-2 rounded-full ${BUCKET_COLORS[row.bucket]}`}
                  style={{ width: `${(row.amount / max) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
