import { Link, useNavigate } from 'react-router'
import { BillForm } from '@/features/bills/BillForm'

export function BillCreatePage() {
  const navigate = useNavigate()

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <Link to="/bills" className="text-sm text-slate-500 hover:text-slate-800">
          ← Bills
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Record a bill</h1>
        <p className="mt-1 text-sm text-slate-500">Copy the details from the supplier&apos;s invoice.</p>
      </div>

      <BillForm
        bill={null}
        onSaved={(bill) => navigate(`/bills/${bill.id}`, { replace: true })}
        onCancel={() => navigate('/bills')}
      />
    </div>
  )
}
