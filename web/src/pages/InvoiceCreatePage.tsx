import { Link, useNavigate } from 'react-router'
import { InvoiceForm } from '@/features/invoices/InvoiceForm'

export function InvoiceCreatePage() {
  const navigate = useNavigate()

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <Link to="/invoices" className="text-sm text-slate-500 hover:text-slate-800">
          ← Invoices
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">New invoice</h1>
        <p className="mt-1 text-sm text-slate-500">
          Saved as a draft. You can edit it freely until you send it.
        </p>
      </div>

      <InvoiceForm
        invoice={null}
        onSaved={(invoice) => navigate(`/invoices/${invoice.id}`, { replace: true })}
        onCancel={() => navigate('/invoices')}
      />
    </div>
  )
}
