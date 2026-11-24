import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { FullPageSpinner } from '@/components/routing/FullPageSpinner'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { BillStatusBadge } from '@/features/bills/BillStatusBadge'
import { useBill, useBillAction, useDeleteBill } from '@/features/bills/hooks'
import type { BillAction } from '@/features/bills/types'
import { InvoiceTotals } from '@/features/invoices/InvoiceTotals'
import { formatAmount, formatQuantity, VAT_RATES } from '@/features/invoices/money'
import { formatIsoDate } from '@/lib/dates'
import { getErrorMessage } from '@/lib/errors'
import { formatTrn } from '@/lib/format'

const vatLabel = (rate: string) => VAT_RATES.find((r) => r.value === rate)?.label ?? rate

export function BillDetailPage() {
  const { billId } = useParams()
  const id = Number(billId)
  const navigate = useNavigate()

  const { data: bill, isPending, isError, error } = useBill(id)
  const billAction = useBillAction()
  const deleteBill = useDeleteBill()

  const [confirmDelete, setConfirmDelete] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  if (!Number.isInteger(id) || id <= 0) return <Alert>Bill not found.</Alert>
  if (isPending) return <FullPageSpinner />
  if (isError) return <Alert>{getErrorMessage(error, 'Bill not found.')}</Alert>

  function run(action: BillAction) {
    setActionError(null)
    billAction.mutate({ id, action }, { onError: (err) => setActionError(getErrorMessage(err)) })
  }

  function remove() {
    deleteBill.mutate(id, {
      onSuccess: () => navigate('/bills', { replace: true }),
      onError: (err) => {
        setConfirmDelete(false)
        setActionError(getErrorMessage(err))
      },
    })
  }

  const isUnpaid = bill.status === 'unpaid'

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <Link to="/bills" className="text-sm text-slate-500 hover:text-slate-800">
          ← Bills
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{bill.supplier_name}</h1>
            <BillStatusBadge status={bill.display_status} />
          </div>
          <div className="flex flex-wrap gap-2">
            {isUnpaid ? (
              <>
                <Button variant="ghost" onClick={() => setConfirmDelete(true)}>
                  Delete
                </Button>
                <Button variant="secondary" onClick={() => navigate(`/bills/${bill.id}/edit`)}>
                  Edit
                </Button>
                <Button onClick={() => run('mark-paid')} isLoading={billAction.isPending}>
                  Mark as paid
                </Button>
              </>
            ) : (
              <Button variant="secondary" onClick={() => run('mark-unpaid')} isLoading={billAction.isPending}>
                Mark as unpaid
              </Button>
            )}
          </div>
        </div>
      </div>

      {actionError && <Alert>{actionError}</Alert>}
      {bill.is_overdue && bill.due_date && <Alert>This bill was due on {formatIsoDate(bill.due_date)}.</Alert>}
      {!bill.supplier_trn && bill.vat_total > 0 && (
        <Alert tone="info">
          No supplier TRN recorded. You generally need the supplier&apos;s TRN on a valid tax invoice to reclaim this VAT.
        </Alert>
      )}

      <article className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <header className="flex flex-wrap justify-between gap-6">
          <div>
            <p className="text-xs font-semibold tracking-widest text-brand-700 uppercase">Supplier invoice</p>
            <p className="mt-3 font-medium">{bill.supplier_name}</p>
            {bill.supplier_trn && <p className="mt-1 font-mono text-xs text-slate-600">TRN {formatTrn(bill.supplier_trn)}</p>}
          </div>
          <dl className="grid grid-cols-[auto_auto] gap-x-6 gap-y-1.5 self-start text-sm">
            <dt className="text-slate-500">Their invoice no.</dt>
            <dd className="text-right font-medium">{bill.supplier_invoice_number}</dd>
            <dt className="text-slate-500">Invoice date</dt>
            <dd className="text-right">{formatIsoDate(bill.issue_date)}</dd>
            <dt className="text-slate-500">Due date</dt>
            <dd className={`text-right ${bill.is_overdue ? 'font-medium text-rose-600' : ''}`}>
              {bill.due_date ? formatIsoDate(bill.due_date) : '—'}
            </dd>
            {bill.paid_at && (
              <>
                <dt className="text-slate-500">Paid</dt>
                <dd className="text-right">{new Intl.DateTimeFormat('en-AE', { dateStyle: 'medium' }).format(new Date(bill.paid_at))}</dd>
              </>
            )}
          </dl>
        </header>

        <div className="mt-8 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="border-b border-slate-200 text-xs tracking-wide text-slate-500 uppercase">
              <tr>
                <th scope="col" className="py-2 pr-4 text-left font-medium">Description</th>
                <th scope="col" className="px-4 py-2 text-right font-medium">Qty</th>
                <th scope="col" className="px-4 py-2 text-right font-medium">Unit price</th>
                <th scope="col" className="px-4 py-2 text-left font-medium">VAT</th>
                <th scope="col" className="py-2 pl-4 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {bill.items.map((item) => (
                <tr key={item.id}>
                  <td className="py-3 pr-4">{item.description}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatQuantity(item.quantity)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatAmount(item.unit_price)}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-slate-500">{vatLabel(item.vat_rate)}</td>
                  <td className="py-3 pl-4 text-right font-medium tabular-nums">{formatAmount(item.line_total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-6 grid gap-8 md:grid-cols-[minmax(0,1fr)_20rem]">
          <div>
            {bill.notes && (
              <>
                <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">Notes</p>
                <p className="mt-1 text-sm whitespace-pre-line text-slate-600">{bill.notes}</p>
              </>
            )}
          </div>
          <InvoiceTotals totals={bill} />
        </div>
      </article>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this bill?"
        confirmLabel="Delete bill"
        tone="danger"
        isLoading={deleteBill.isPending}
        onConfirm={remove}
        onClose={() => setConfirmDelete(false)}
      >
        The bill and its line items will be removed, and its VAT no longer counts towards your input VAT.
      </ConfirmDialog>
    </div>
  )
}
