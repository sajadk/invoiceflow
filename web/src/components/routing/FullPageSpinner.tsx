import { Spinner } from '@/components/ui/Button'

export function FullPageSpinner() {
  return (
    <div className="grid min-h-screen place-items-center text-brand-700" role="status" aria-label="Loading">
      <Spinner className="size-6" />
    </div>
  )
}
