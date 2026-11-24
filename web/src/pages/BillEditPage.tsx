import { Link, Navigate, useNavigate, useParams } from 'react-router'
import { FullPageSpinner } from '@/components/routing/FullPageSpinner'
import { Alert } from '@/components/ui/Alert'
import { BillForm } from '@/features/bills/BillForm'
import { useBill } from '@/features/bills/hooks'
import { getErrorMessage } from '@/lib/errors'

export function BillEditPage() {
  const { billId } = useParams()
  const id = Number(billId)
  const navigate = useNavigate()
  const { data: bill, isPending, isError, error } = useBill(id)

  if (!Number.isInteger(id) || id <= 0) return <Alert>Bill not found.</Alert>
  if (isPending) return <FullPageSpinner />
  if (isError) return <Alert>{getErrorMessage(error, 'Bill not found.')}</Alert>

  // Paid bills are locked; mark as unpaid first.
  if (bill.status !== 'unpaid') return <Navigate to={`/bills/${bill.id}`} replace />

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <Link to={`/bills/${bill.id}`} className="text-sm text-slate-500 hover:text-slate-800">
          ← Back to bill
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Edit bill {bill.supplier_invoice_number}</h1>
      </div>

      <BillForm bill={bill} onSaved={(saved) => navigate(`/bills/${saved.id}`)} onCancel={() => navigate(`/bills/${bill.id}`)} />
    </div>
  )
}
