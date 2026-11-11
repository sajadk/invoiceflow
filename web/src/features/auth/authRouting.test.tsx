import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import { GuestRoute } from '@/components/routing/GuestRoute'
import { ProtectedRoute } from '@/components/routing/ProtectedRoute'
import { LoginPage } from '@/pages/LoginPage'
import { userFixture } from '@/test/fixtures'
import { createTestQueryClient } from '@/test/render'
import { server } from '@/test/server'
import { AuthProvider } from './AuthProvider'

/** The real guards and login page, with stand-ins for the app's pages. */
function renderApp(initialPath: string) {
  const router = createMemoryRouter(
    [
      { element: <GuestRoute />, children: [{ path: '/login', element: <LoginPage /> }] },
      {
        element: <ProtectedRoute />,
        children: [
          { path: '/', element: <h1>Dashboard page</h1> },
          { path: '/invoices', element: <h1>Invoices page</h1> },
        ],
      },
    ],
    { initialEntries: [initialPath] },
  )

  render(
    <QueryClientProvider client={createTestQueryClient()}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>,
  )
  return { router, user: userEvent.setup() }
}

const guest = () => http.get('/api/user', () => HttpResponse.json({ message: 'Unauthenticated.' }, { status: 401 }))
const loggedIn = () => http.get('/api/user', () => HttpResponse.json({ data: userFixture }))
const csrfCookie = () => http.get('/sanctum/csrf-cookie', () => new HttpResponse(null, { status: 204 }))

describe('auth routing', () => {
  it('sends guests from a protected page to the login page', async () => {
    server.use(guest())
    const { router } = renderApp('/invoices')

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/login')
  })

  it('shows protected pages to a logged-in user', async () => {
    server.use(loggedIn())
    renderApp('/invoices')

    expect(await screen.findByRole('heading', { name: 'Invoices page' })).toBeInTheDocument()
  })

  it('sends a logged-in user away from the login page', async () => {
    server.use(loggedIn())
    renderApp('/login')

    expect(await screen.findByRole('heading', { name: 'Dashboard page' })).toBeInTheDocument()
  })

  it('shows the server’s error under the email field when the login fails', async () => {
    server.use(
      guest(),
      csrfCookie(),
      http.post('/api/login', () =>
        HttpResponse.json(
          { message: 'Invalid.', errors: { email: ['These credentials do not match our records.'] } },
          { status: 422 },
        ),
      ),
    )
    const { user } = renderApp('/login')

    await user.type(await screen.findByLabelText('Email'), 'demo@invoiceflow.test')
    await user.type(screen.getByLabelText('Password'), 'wrong')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByText('These credentials do not match our records.')).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true')
  })

  it('returns the user to the page they asked for after logging in', async () => {
    let csrfFetched = false
    server.use(
      guest(),
      http.get('/sanctum/csrf-cookie', () => {
        csrfFetched = true
        return new HttpResponse(null, { status: 204 })
      }),
      http.post('/api/login', () => HttpResponse.json({ data: userFixture })),
    )
    const { user, router } = renderApp('/invoices')

    await user.type(await screen.findByLabelText('Email'), 'demo@invoiceflow.test')
    await user.type(screen.getByLabelText('Password'), 'password')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByRole('heading', { name: 'Invoices page' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/invoices')
    expect(csrfFetched).toBe(true) // the CSRF cookie is fetched before the login POST
  })
})
