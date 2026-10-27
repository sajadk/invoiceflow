import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/features/auth/useAuth'

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

export function UserMenu({ compact = false }: { compact?: boolean }) {
  const { user, logout } = useAuth()
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  if (!user) return null

  async function handleLogout() {
    setIsLoggingOut(true)
    try {
      await logout() // <ProtectedRoute> notices user === null and redirects to /login
    } finally {
      setIsLoggingOut(false)
    }
  }

  if (compact) {
    return (
      <Button variant="ghost" onClick={handleLogout} isLoading={isLoggingOut} className="px-2 py-1.5">
        Log out
      </Button>
    )
  }

  return (
    <div className="border-t border-slate-200 p-3">
      <div className="flex items-center gap-3 px-2 py-2">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-100 text-sm font-semibold text-brand-900">
          {initials(user.name)}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-900">{user.name}</p>
          <p className="truncate text-xs text-slate-500">{user.email}</p>
        </div>
      </div>
      <Button variant="ghost" onClick={handleLogout} isLoading={isLoggingOut} className="mt-1 w-full justify-start">
        Log out
      </Button>
    </div>
  )
}
