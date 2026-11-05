import type { ReactNode } from 'react'
import { Link } from 'react-router'

type StatTileProps = {
  label: string
  value: string
  detail?: ReactNode
  tone?: 'default' | 'alert'
  to?: string
}

export function StatTile({ label, value, detail, tone = 'default', to }: StatTileProps) {
  const body = (
    <>
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`mt-2 text-2xl font-semibold tracking-tight tabular-nums ${tone === 'alert' ? 'text-rose-600' : ''}`}>
        {value}
      </p>
      {detail && <div className="mt-1 text-xs text-slate-500">{detail}</div>}
    </>
  )

  const className = 'block rounded-xl border border-slate-200 bg-white p-5 shadow-sm'

  return to ? (
    <Link to={to} className={`${className} transition hover:border-brand-500 hover:shadow`}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  )
}
