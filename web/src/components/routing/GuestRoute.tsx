import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from '@/features/auth/useAuth'
import { FullPageSpinner } from './FullPageSpinner'
import { getRedirectTarget } from './redirect'

/** Login/register pages: logged-in users are sent on to the app. */
export function GuestRoute() {
  const { user, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) return <FullPageSpinner />

  if (user) return <Navigate to={getRedirectTarget(location.state)} replace />

  return <Outlet />
}
