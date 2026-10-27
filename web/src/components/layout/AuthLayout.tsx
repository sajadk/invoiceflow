import { Outlet } from 'react-router'

export function AuthLayout() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <div className="mb-8 flex items-center gap-2">
        <span className="grid size-9 place-items-center rounded-lg bg-brand-700 text-sm font-bold text-white">
          IF
        </span>
        <span className="text-xl font-semibold tracking-tight">InvoiceFlow</span>
      </div>

      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <Outlet />
      </div>

      <p className="mt-8 text-xs text-slate-400">VAT invoicing &amp; receivables for UAE businesses</p>
    </div>
  )
}
