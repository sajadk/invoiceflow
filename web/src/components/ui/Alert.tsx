import type { ReactNode } from 'react'

type Tone = 'error' | 'info'

const tones: Record<Tone, string> = {
  error: 'border-rose-200 bg-rose-50 text-rose-700',
  info: 'border-brand-100 bg-brand-50 text-brand-900',
}

export function Alert({ tone = 'error', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`rounded-lg border px-3 py-2.5 text-sm ${tones[tone]}`}>
      {children}
    </div>
  )
}
