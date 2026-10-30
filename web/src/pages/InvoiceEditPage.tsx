import { Link, Navigate, useNavigate, useParams } from 'react-router'
import { FullPageSpinner } from '@/components/routing/FullPageSpinner'
import { Alert } from '@/components/ui/Alert'
import { InvoiceForm } from '@/features/invoices/InvoiceForm'
import { useInvoice } from '@/features/invoices/hooks'
import { getErrorMessage } from '@/lib/errors'

export function InvoiceEditPage() {
  const { invoiceId } = useParams()
  const id = Number(invoiceId)
  const navigate = useNavigate()
  const { data: invoice, isPending, isError, error } = useInvoice(id)

  if (!Number.isInteger(id) || id <= 0) return <Alert>Invoice not found.</Alert>
  if (isPending) return <FullPageSpinner />
  if (isError) return <Alert>{getErrorMessage(error, 'Invoice not found.')}</Alert>

  // Sent invoices are legal documents: no editing, go to the read-only view instead.
  if (invoice.status !== 'draft') return <Navigate to={`/invoices/${invoice.id}`} replace />

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <Link to={`/invoices/${invoice.id}`} className="text-sm text-slate-500 hover:text-slate-800">
          ← Back to draft
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Edit draft #{invoice.id}</h1>
      </div>

      <InvoiceForm
        invoice={invoice}
        onSaved={(saved) => navigate(`/invoices/${saved.id}`)}
        onCancel={() => navigate(`/invoices/${invoice.id}`)}
      />
    </div>
  )
}
