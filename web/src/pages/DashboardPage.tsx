import { Link, useNavigate } from 'react-router'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/features/auth/useAuth'
import { AgingCard } from '@/features/dashboard/AgingCard'
import { useDashboard } from '@/features/dashboard/hooks'
import { RevenueChart } from '@/features/dashboard/RevenueChart'
import { StatTile } from '@/features/dashboard/StatTile'
import type { DashboardSummary } from '@/features/dashboard/types'
import { formatMoney } from '@/features/invoices/money'
import { formatIsoDate } from '@/lib/dates'
import { getErrorMessage } from '@/lib/errors'

function plural(count: number, noun: string) {
  return `${count} ${noun}${count === 1 ? '' : 's'}`
}

/** "+12% vs last month", or nothing if there's no baseline to compare with. */
function monthOverMonth({ this_month, last_month }: DashboardSummary['collected']) {
  if (last_month === 0) return this_month > 0 ? 'Nothing collected last month' : null
  const change = Math.round(((this_month - last_month) / last_month) * 100)
  return (
    <span className={change >= 0 ? 'text-emerald-700' : 'text-rose-600'}>
      {change >= 0 ? '▲' : '▼'} {Math.abs(change)}% vs last month
    </span>
  )
}

export function DashboardPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { data, isPending, isError, error } = useDashboard()
  const firstName = user?.name.split(' ')[0]

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {firstName ? `Welcome back, ${firstName}` : 'Dashboard'}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {data ? `Your receivables as of ${formatIsoDate(data.as_of)}` : 'Your receivables at a glance'}
          </p>
        </div>
        <Button onClick={() => navigate('/invoices/new')}>New invoice</Button>
      </div>

      {isPending ? (
        <DashboardSkeleton />
      ) : isError ? (
        <Alert>{getErrorMessage(error, 'Couldn’t load the dashboard.')}</Alert>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile
              label="Outstanding"
              value={formatMoney(data.outstanding.amount)}
              detail={plural(data.outstanding.count, 'unpaid invoice')}
              to="/invoices?status=sent"
            />
            <StatTile
              label="Overdue"
              value={formatMoney(data.overdue.amount)}
              detail={data.overdue.count > 0 ? plural(data.overdue.count, 'invoice') + ' past due' : 'Nothing overdue'}
              tone={data.overdue.amount > 0 ? 'alert' : 'default'}
              to="/invoices?status=overdue"
            />
            <StatTile
              label="Collected this month"
              value={formatMoney(data.collected.this_month)}
              detail={monthOverMonth(data.collected)}
              to="/payments"
            />
            <StatTile
              label={`VAT on invoices · ${data.vat.period}`}
              value={formatMoney(data.vat.amount)}
              detail="Output VAT on invoices issued this quarter"
            />
          </div>

          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-base font-semibold">Invoiced vs collected</h2>
            <p className="mt-1 mb-4 text-sm text-slate-500">Last 12 months, {data.currency} incl. VAT</p>
            <RevenueChart monthly={data.monthly} />
          </section>

          <div className="grid gap-6 lg:grid-cols-3">
            <AgingCard aging={data.aging} />

            <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-base font-semibold">Who owes you most</h2>
              <p className="mt-1 text-sm text-slate-500">Top customers by unpaid balance</p>
              {data.top_debtors.length === 0 ? (
                <p className="mt-6 text-sm text-slate-500">No unpaid invoices.</p>
              ) : (
                <ol className="mt-4 divide-y divide-slate-100">
                  {data.top_debtors.map((debtor) => (
                    <li key={debtor.customer_id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                      <Link
                        to={`/invoices?status=sent&search=${encodeURIComponent(debtor.name)}`}
                        className="min-w-0 hover:text-brand-700"
                      >
                        <span className="block truncate font-medium">{debtor.name}</span>
                        <span className="text-xs text-slate-500">{plural(debtor.invoices, 'invoice')}</span>
                      </Link>
                      <span className="font-medium whitespace-nowrap tabular-nums">{formatMoney(debtor.amount)}</span>
                    </li>
                  ))}
                </ol>
              )}
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-baseline justify-between">
                <h2 className="text-base font-semibold">Recent payments</h2>
                <Link to="/payments" className="text-sm font-medium text-brand-700 hover:underline">
                  View all
                </Link>
              </div>
              {data.recent_payments.length === 0 ? (
                <p className="mt-6 text-sm text-slate-500">No payments recorded yet.</p>
              ) : (
                <ul className="mt-4 divide-y divide-slate-100">
                  {data.recent_payments.map((payment) => (
                    <li key={payment.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                      <div className="min-w-0">
                        {payment.invoice ? (
                          <Link to={`/invoices/${payment.invoice.id}`} className="block truncate font-medium hover:text-brand-700">
                            {payment.invoice.customer_name}
                          </Link>
                        ) : null}
                        <span className="text-xs text-slate-500">
                          {formatIsoDate(payment.paid_on)} · {payment.invoice?.number}
                        </span>
                      </div>
                      <span className="font-medium whitespace-nowrap text-emerald-700 tabular-nums">
                        +{formatMoney(payment.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading dashboard">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-xl bg-slate-100" />
        ))}
      </div>
      <div className="h-96 animate-pulse rounded-xl bg-slate-100" />
    </div>
  )
}
