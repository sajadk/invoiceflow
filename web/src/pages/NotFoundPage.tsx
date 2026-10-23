import { Link } from 'react-router'

export function NotFoundPage() {
  return (
    <div className="grid min-h-screen place-items-center p-6 text-center">
      <div>
        <p className="text-sm font-semibold text-brand-700">404</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Page not found</h1>
        <Link to="/" className="mt-6 inline-block text-sm font-medium text-brand-700 hover:underline">
          Back to dashboard
        </Link>
      </div>
    </div>
  )
}
