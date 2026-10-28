import type { Paginated } from '@/lib/api'
import { Button } from './Button'

type PaginationProps = {
  meta: Paginated<unknown>['meta']
  onPageChange: (page: number) => void
  noun?: string
}

export function Pagination({ meta, onPageChange, noun = 'results' }: PaginationProps) {
  if (meta.total === 0) return null

  return (
    <nav aria-label="Pagination" className="flex items-center justify-between gap-4 border-t border-slate-200 px-4 py-3">
      <p className="text-sm text-slate-500">
        Showing <span className="font-medium text-slate-700">{meta.from}</span>–
        <span className="font-medium text-slate-700">{meta.to}</span> of{' '}
        <span className="font-medium text-slate-700">{meta.total}</span> {noun}
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={meta.current_page <= 1}
          onClick={() => onPageChange(meta.current_page - 1)}
        >
          Previous
        </Button>
        <span className="text-sm text-slate-500">
          {meta.current_page} / {meta.last_page}
        </span>
        <Button
          variant="secondary"
          size="sm"
          disabled={meta.current_page >= meta.last_page}
          onClick={() => onPageChange(meta.current_page + 1)}
        >
          Next
        </Button>
      </div>
    </nav>
  )
}
