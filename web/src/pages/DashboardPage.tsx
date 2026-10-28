import { useAuth } from '@/features/auth/useAuth'
import { HealthStatusCard } from '@/features/health/HealthStatusCard'

const milestones = [
  { title: 'Scaffold + health check', done: true },
  { title: 'Authentication (Sanctum)', done: true },
  { title: 'Customers', done: true },
  { title: 'Invoices + VAT', done: true },
  { title: 'Payments + dashboard', done: false },
  { title: 'Tests + CI', done: false },
  { title: 'AWS deploy', done: false },
]

export function DashboardPage() {
  const { user } = useAuth()
  const firstName = user?.name.split(' ')[0]

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {firstName ? `Welcome back, ${firstName}` : 'Dashboard'}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Revenue, outstanding balances and overdue invoices will live here.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <HealthStatusCard />

        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold">Build progress</h2>
          <ol className="mt-4 space-y-2">
            {milestones.map((m, i) => (
              <li key={m.title} className="flex items-center gap-3 text-sm">
                <span
                  className={`grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold ${
                    m.done ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {m.done ? '✓' : i + 1}
                </span>
                <span className={m.done ? 'text-slate-900' : 'text-slate-500'}>{m.title}</span>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  )
}
