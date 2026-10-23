import { NavLink, Outlet } from 'react-router'

type NavItem = {
  label: string
  to: string
  ready: boolean
}

const navItems: NavItem[] = [
  { label: 'Dashboard', to: '/', ready: true },
  { label: 'Customers', to: '/customers', ready: false },
  { label: 'Invoices', to: '/invoices', ready: false },
  { label: 'Payments', to: '/payments', ready: false },
]

export function AppLayout() {
  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 shrink-0 border-r border-slate-200 bg-white md:flex md:flex-col">
        <div className="flex h-16 items-center gap-2 px-6">
          <span className="grid size-8 place-items-center rounded-lg bg-brand-700 text-sm font-bold text-white">
            IF
          </span>
          <span className="text-lg font-semibold tracking-tight">InvoiceFlow</span>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          {navItems.map((item) =>
            item.ready ? (
              <NavLink
                key={item.to}
                to={item.to}
                end
                className={({ isActive }) =>
                  `block rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-brand-50 text-brand-700'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ) : (
              <span
                key={item.to}
                className="flex cursor-not-allowed items-center justify-between rounded-md px-3 py-2 text-sm font-medium text-slate-400"
              >
                {item.label}
                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                  Soon
                </span>
              </span>
            ),
          )}
        </nav>

        <p className="px-6 py-4 text-xs text-slate-400">VAT invoicing · AED</p>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex h-16 items-center border-b border-slate-200 bg-white px-6 md:hidden">
          <span className="text-lg font-semibold tracking-tight">InvoiceFlow</span>
        </header>
        <main className="flex-1 p-6 md:p-10">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
