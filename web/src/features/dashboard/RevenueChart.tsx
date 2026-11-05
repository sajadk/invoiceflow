import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatMoney } from '@/features/invoices/money'
import type { DashboardSummary } from './types'

const INVOICED_COLOR = '#cbd5e1' // slate-300: the context
const COLLECTED_COLOR = '#0d9488' // brand-600: the number that matters

const compactAed = new Intl.NumberFormat('en-AE', { notation: 'compact', maximumFractionDigits: 1 })
const monthFormatter = new Intl.DateTimeFormat('en-AE', { month: 'short' })
const monthYearFormatter = new Intl.DateTimeFormat('en-AE', { month: 'long', year: 'numeric' })

function monthDate(month: string): Date {
  const [year = 1970, m = 1] = month.split('-').map(Number)
  return new Date(year, m - 1, 1)
}

/**
 * Invoiced (by issue date) vs collected (by payment date), last 12 months.
 * Values stay in fils; only the axis and tooltip convert for display.
 */
export function RevenueChart({ monthly }: { monthly: DashboardSummary['monthly'] }) {
  const hasData = monthly.some((row) => row.invoiced > 0 || row.collected > 0)

  if (!hasData) {
    return (
      <div className="grid h-72 place-items-center rounded-lg border border-dashed border-slate-200 text-sm text-slate-500">
        Send your first invoice to see revenue here.
      </div>
    )
  }

  return (
    <figure>
      <div className="h-72" aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={monthly} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2}>
            <CartesianGrid vertical={false} stroke="#f1f5f9" />
            <XAxis
              dataKey="month"
              tickFormatter={(month: string) => monthFormatter.format(monthDate(month))}
              tickLine={false}
              axisLine={false}
              tick={{ fill: '#64748b', fontSize: 12 }}
            />
            <YAxis
              tickFormatter={(fils: number) => compactAed.format(fils / 100)}
              tickLine={false}
              axisLine={false}
              width={48}
              tick={{ fill: '#64748b', fontSize: 12 }}
            />
            <Tooltip
              cursor={{ fill: '#f8fafc' }}
              formatter={(value) => formatMoney(Number(value))}
              labelFormatter={(month) => monthYearFormatter.format(monthDate(String(month)))}
              contentStyle={{ borderRadius: 8, borderColor: '#e2e8f0', fontSize: 13 }}
            />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 13, paddingTop: 8 }} />
            <Bar dataKey="invoiced" name="Invoiced" fill={INVOICED_COLOR} radius={[3, 3, 0, 0]} maxBarSize={22} />
            <Bar dataKey="collected" name="Collected" fill={COLLECTED_COLOR} radius={[3, 3, 0, 0]} maxBarSize={22} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* The chart is hidden from screen readers; this table carries the same numbers. */}
      <table className="sr-only">
        <caption>Invoiced and collected per month, last 12 months</caption>
        <thead>
          <tr>
            <th scope="col">Month</th>
            <th scope="col">Invoiced</th>
            <th scope="col">Collected</th>
          </tr>
        </thead>
        <tbody>
          {monthly.map((row) => (
            <tr key={row.month}>
              <th scope="row">{monthYearFormatter.format(monthDate(row.month))}</th>
              <td>{formatMoney(row.invoiced)}</td>
              <td>{formatMoney(row.collected)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}
