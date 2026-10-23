import { useHealth } from './useHealth'

type Tone = 'ok' | 'warn' | 'down'

const toneStyles: Record<Tone, { dot: string; badge: string }> = {
  ok: { dot: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-700' },
  warn: { dot: 'bg-amber-500', badge: 'bg-amber-50 text-amber-700' },
  down: { dot: 'bg-rose-500', badge: 'bg-rose-50 text-rose-700' },
}

function StatusRow({ label, value, tone }: { label: string; value: string; tone: Tone }) {
  const styles = toneStyles[tone]
  return (
    <div className="flex items-center justify-between py-3">
      <span className="text-sm text-slate-600">{label}</span>
      <span className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-medium ${styles.badge}`}>
        <span className={`size-1.5 rounded-full ${styles.dot}`} />
        {value}
      </span>
    </div>
  )
}

export function HealthStatusCard() {
  const { data, isPending, isError, isFetching, refetch, dataUpdatedAt } = useHealth()

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold">System status</h2>
          <p className="mt-1 text-sm text-slate-500">React → Vite proxy → Laravel → MySQL</p>
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          disabled={isFetching}
          className="rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
        >
          {isFetching ? 'Checking…' : 'Recheck'}
        </button>
      </div>

      <div className="mt-4 divide-y divide-slate-100">
        {isPending ? (
          <div className="space-y-3 py-3" aria-busy="true">
            <div className="h-5 w-full animate-pulse rounded bg-slate-100" />
            <div className="h-5 w-full animate-pulse rounded bg-slate-100" />
          </div>
        ) : isError ? (
          <StatusRow label="API" value="Unreachable" tone="down" />
        ) : (
          <>
            <StatusRow
              label={`API (${data.app})`}
              value={data.status === 'ok' ? 'Operational' : 'Degraded'}
              tone={data.status === 'ok' ? 'ok' : 'warn'}
            />
            <StatusRow
              label="Database"
              value={data.checks.database === 'ok' ? 'Connected' : 'Unreachable'}
              tone={data.checks.database === 'ok' ? 'ok' : 'down'}
            />
          </>
        )}
      </div>

      {isError && (
        <p className="mt-3 text-sm text-rose-600">
          Can't reach the API. Is the <code className="font-mono">api</code> container running?
        </p>
      )}
      {dataUpdatedAt > 0 && (
        <p className="mt-3 text-xs text-slate-400">
          Last checked {new Date(dataUpdatedAt).toLocaleTimeString()}
        </p>
      )}
    </section>
  )
}
