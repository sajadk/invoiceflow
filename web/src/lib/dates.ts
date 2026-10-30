/**
 * Invoice dates are calendar dates ("2026-03-15"), not instants. Parsing them with
 * new Date("2026-03-15") treats them as UTC midnight, which can display as the
 * previous day in some timezones, so these helpers build local dates explicitly.
 */

function toIso(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

function fromIso(iso: string): Date {
  const [year = 1970, month = 1, day = 1] = iso.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export function todayIso(): string {
  return toIso(new Date())
}

export function addDaysIso(iso: string, days: number): string {
  const date = fromIso(iso)
  date.setDate(date.getDate() + days)
  return toIso(date)
}

const displayFormatter = new Intl.DateTimeFormat('en-AE', { day: 'numeric', month: 'short', year: 'numeric' })

/** "2026-03-15" → "15 Mar 2026" */
export function formatIsoDate(iso: string): string {
  return displayFormatter.format(fromIso(iso))
}

/** Whole days from today until the date (negative = in the past). */
export function daysFromToday(iso: string): number {
  const today = fromIso(todayIso())
  return Math.round((fromIso(iso).getTime() - today.getTime()) / 86_400_000)
}
