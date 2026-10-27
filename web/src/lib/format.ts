const dateFormatter = new Intl.DateTimeFormat('en-AE', { day: 'numeric', month: 'short', year: 'numeric' })

export function formatDate(iso: string): string {
  return dateFormatter.format(new Date(iso))
}

/** 100123456789012 → "100 1234 5678 9012" (easier to read aloud and compare). */
export function formatTrn(trn: string): string {
  return trn.replace(/^(\d{3})(\d{4})(\d{4})(\d{4})$/, '$1 $2 $3 $4')
}
