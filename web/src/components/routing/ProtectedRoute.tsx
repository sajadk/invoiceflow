import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from '@/features/auth/useAuth'
import { FullPageSpinner } from './FullPageSpinner'

/**
 * Layout route that guards everything nested inside it.
 * Vue Router equivalent: a beforeEach guard checking meta.requiresAuth.
 * In React Router, a guard is just a component that renders <Outlet/> or <Navigate/>.
 */
export function ProtectedRoute() {
  const { user, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) return <FullPageSpinner />

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  }

  return <Outlet />
}
