import { createBrowserRouter } from 'react-router'
import { AppLayout } from '@/components/layout/AppLayout'
import { AuthLayout } from '@/components/layout/AuthLayout'
import { GuestRoute } from '@/components/routing/GuestRoute'
import { ProtectedRoute } from '@/components/routing/ProtectedRoute'
import { CustomersPage } from '@/pages/CustomersPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { LoginPage } from '@/pages/LoginPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { RegisterPage } from '@/pages/RegisterPage'

/**
 * Routes without a `path` are "layout routes": they wrap their children
 * (guard or shared chrome) and render them through <Outlet/>.
 */
export const router = createBrowserRouter([
  {
    element: <GuestRoute />,
    children: [
      {
        element: <AuthLayout />,
        children: [
          { path: '/login', element: <LoginPage /> },
          { path: '/register', element: <RegisterPage /> },
        ],
      },
    ],
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        path: '/',
        element: <AppLayout />,
        children: [
          { index: true, element: <DashboardPage /> },
          { path: 'customers', element: <CustomersPage /> },
        ],
      },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
])
