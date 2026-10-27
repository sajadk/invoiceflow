export const EMIRATES = [
  { value: 'abu_dhabi', label: 'Abu Dhabi' },
  { value: 'dubai', label: 'Dubai' },
  { value: 'sharjah', label: 'Sharjah' },
  { value: 'ajman', label: 'Ajman' },
  { value: 'umm_al_quwain', label: 'Umm Al Quwain' },
  { value: 'ras_al_khaimah', label: 'Ras Al Khaimah' },
  { value: 'fujairah', label: 'Fujairah' },
] as const

export type Emirate = (typeof EMIRATES)[number]['value']

export const EMIRATE_VALUES = EMIRATES.map((e) => e.value) as [Emirate, ...Emirate[]]

export function isEmirate(value: string | null): value is Emirate {
  return EMIRATES.some((e) => e.value === value)
}
