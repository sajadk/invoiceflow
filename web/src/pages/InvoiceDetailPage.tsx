import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { FullPageSpinner } from '@/components/routing/FullPageSpinner'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { downloadInvoicePdf } from '@/features/invoices/api'
import { useDeleteInvoice, useInvoice, useInvoiceAction } from '@/features/invoices/hooks'
import { InvoiceStatusBadge } from '@/features/invoices/InvoiceStatusBadge'
import { InvoiceTotals } from '@/features/invoices/InvoiceTotals'
import { formatAmount, formatMoney, formatQuantity, VAT_RATES } from '@/features/invoices/money'
import type { BilledTo, InvoiceAction, InvoiceDetail } from '@/features/invoices/types'
import { useDeletePayment } from '@/features/payments/hooks'
import { RecordPaymentDialog } from '@/features/payments/RecordPaymentDialog'
import type { Payment } from '@/features/payments/types'
import { formatTrn } from '@/lib/format'
import { formatIsoDate } from '@/lib/dates'
import { getErrorMessage } from '@/lib/errors'

type PendingConfirm = InvoiceAction | 'delete' | null

const vatLabel = (rate: string) => VAT_RATES.find((r) => r.value === rate)?.label ?? rate

export function InvoiceDetailPage() {
  const { invoiceId } = useParams()
  const id = Number(invoiceId)
  const navigate = useNavigate()

  const { data: invoice, isPending, isError, error } = useInvoice(id)
  const invoiceAction = useInvoiceAction()
  const deleteInvoice = useDeleteInvoice()

  const deletePayment = useDeletePayment()

  const [confirm, setConfirm] = useState<PendingConfirm>(null)
  const [isRecordingPayment, setIsRecordingPayment] = useState(false)
  const [paymentToDelete, setPaymentToDelete] = useState<Payment | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [isDownloading, setIsDownloading] = useState(false)

  if (!Number.isInteger(id) || id <= 0) return <Alert>Invoice not found.</Alert>
  if (isPending) return <FullPageSpinner />
  if (isError) return <Alert>{getErrorMessage(error, 'Invoice not found.')}</Alert>

  function run(action: InvoiceAction) {
    setActionError(null)
    invoiceAction.mutate(
      { id, action },
      {
        onSettled: () => setConfirm(null),
        onError: (err) => setActionError(getErrorMessage(err)),
      },
    )
  }

  function removePayment() {
    if (!paymentToDelete) return
    setActionError(null)
    deletePayment.mutate(paymentToDelete.id, {
      onSuccess: () => setNotice(`Payment of ${formatMoney(paymentToDelete.amount)} deleted.`),
      onError: (err) => setActionError(getErrorMessage(err)),
      onSettled: () => setPaymentToDelete(null),
    })
  }

  function remove() {
    setActionError(null)
    deleteInvoice.mutate(id, {
      onSuccess: () => navigate('/invoices', { replace: true }),
      onError: (err) => {
        setConfirm(null)
        setActionError(getErrorMessage(err))
      },
    })
  }

  async function download(current: InvoiceDetail) {
    setActionError(null)
    setIsDownloading(true)
    try {
      await downloadInvoicePdf(current)
    } catch (err) {
      setActionError(getErrorMessage(err, 'Couldn’t generate the PDF.'))
    } finally {
      setIsDownloading(false)
    }
  }

  // Sent invoices show the details frozen at send time.
  const billedTo: BilledTo = invoice.billed_to ?? {
    name: invoice.customer.name,
    email: invoice.customer.email,
    trn: invoice.customer.trn,
    emirate: invoice.customer.emirate_label,
    address: invoice.customer.address,
  }
  const isDraft = invoice.status === 'draft'
  const isSent = invoice.status === 'sent'

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <Link to="/invoices" className="text-sm text-slate-500 hover:text-slate-800">
          ← Invoices
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{invoice.number ?? `Draft #${invoice.id}`}</h1>
            <InvoiceStatusBadge status={invoice.display_status} />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => download(invoice)} isLoading={isDownloading}>
              Download PDF
            </Button>
            {isDraft && (
              <>
                <Button variant="ghost" onClick={() => setConfirm('delete')}>
                  Delete
                </Button>
                <Button variant="secondary" onClick={() => navigate(`/invoices/${invoice.id}/edit`)}>
                  Edit
                </Button>
                <Button onClick={() => setConfirm('send')}>Send invoice</Button>
              </>
            )}
            {isSent && (
              <>
                {/* An invoice with money received against it can't be voided. */}
                {invoice.amount_paid === 0 && (
                  <Button variant="ghost" onClick={() => setConfirm('void')}>
                    Void
                  </Button>
                )}
                <Button onClick={() => setIsRecordingPayment(true)}>Record payment</Button>
              </>
            )}
          </div>
        </div>
      </div>

      {actionError && <Alert>{actionError}</Alert>}
      {notice && <Alert tone="info">{notice}</Alert>}
      {invoice.is_overdue && (
        <Alert>This invoice was due on {formatIsoDate(invoice.due_date)} and hasn&apos;t been paid.</Alert>
      )}
      {isDraft && (
        <Alert tone="info">
          This is a draft. Sending it assigns the next invoice number and locks it for editing.
        </Alert>
      )}

      {/* The invoice, laid out like the document the customer receives */}
      <article className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <header className="flex flex-wrap justify-between gap-6">
          <div>
            <p className="text-xs font-semibold tracking-widest text-brand-700 uppercase">Tax invoice</p>
            <p className="mt-4 text-xs font-medium tracking-wide text-slate-500 uppercase">Billed to</p>
            <p className="mt-1 font-medium">{billedTo.name}</p>
            <div className="text-sm text-slate-600">
              {billedTo.address && <p>{billedTo.address}</p>}
              {billedTo.emirate && <p>{billedTo.emirate}, UAE</p>}
              {billedTo.email && <p>{billedTo.email}</p>}
              {billedTo.trn && <p className="mt-1 font-mono text-xs">TRN {formatTrn(billedTo.trn)}</p>}
            </div>
          </div>
          <dl className="grid grid-cols-[auto_auto] gap-x-6 gap-y-1.5 self-start text-sm">
            <dt className="text-slate-500">Invoice no.</dt>
            <dd className="text-right font-medium">{invoice.number ?? '—'}</dd>
            <dt className="text-slate-500">Issue date</dt>
            <dd className="text-right">{formatIsoDate(invoice.issue_date)}</dd>
            <dt className="text-slate-500">Due date</dt>
            <dd className={`text-right ${invoice.is_overdue ? 'font-medium text-rose-600' : ''}`}>
              {formatIsoDate(invoice.due_date)}
            </dd>
            <dt className="text-slate-500">Currency</dt>
            <dd className="text-right">{invoice.currency}</dd>
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
              {invoice.items.map((item) => (
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
            {invoice.notes && (
              <>
                <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">Notes</p>
                <p className="mt-1 text-sm whitespace-pre-line text-slate-600">{invoice.notes}</p>
              </>
            )}
          </div>
          <div>
            <InvoiceTotals totals={invoice} />
            {invoice.amount_paid > 0 && (
              <dl className="mt-3 space-y-2 border-t border-slate-200 pt-3 text-sm">
                <div className="flex justify-between gap-6">
                  <dt className="text-slate-500">Amount paid</dt>
                  <dd className="tabular-nums text-emerald-700">−{formatMoney(invoice.amount_paid)}</dd>
                </div>
                <div className="flex justify-between gap-6 font-semibold">
                  <dt>Balance due</dt>
                  <dd className="tabular-nums">{formatMoney(invoice.balance_due)}</dd>
                </div>
              </dl>
            )}
          </div>
        </div>
      </article>

      {(isSent || invoice.status === 'paid') && (
        <PaymentsSection
          invoice={invoice}
          onRecord={() => setIsRecordingPayment(true)}
          onDelete={setPaymentToDelete}
        />
      )}

      <Timeline invoice={invoice} />

      <ConfirmDialog
        open={confirm === 'send'}
        title="Send this invoice?"
        confirmLabel="Send invoice"
        isLoading={invoiceAction.isPending}
        onConfirm={() => run('send')}
        onClose={() => setConfirm(null)}
      >
        It will get the next invoice number and the customer&apos;s current details will be printed on it. After
        sending, the invoice can&apos;t be edited, only voided.
      </ConfirmDialog>

      <ConfirmDialog
        open={confirm === 'void'}
        title="Void this invoice?"
        confirmLabel="Void invoice"
        tone="danger"
        isLoading={invoiceAction.isPending}
        onConfirm={() => run('void')}
        onClose={() => setConfirm(null)}
      >
        The invoice keeps its number for your records but no longer counts as owed. This can&apos;t be undone.
      </ConfirmDialog>

      <ConfirmDialog
        open={paymentToDelete !== null}
        title="Delete this payment?"
        confirmLabel="Delete payment"
        tone="danger"
        isLoading={deletePayment.isPending}
        onConfirm={removePayment}
        onClose={() => setPaymentToDelete(null)}
      >
        {paymentToDelete && (
          <>
            The {formatMoney(paymentToDelete.amount)} received on {formatIsoDate(paymentToDelete.paid_on)} will be
            removed and added back to the balance due. Use this for payments recorded by mistake.
          </>
        )}
      </ConfirmDialog>

      {isSent && (
        <RecordPaymentDialog
          invoice={invoice}
          open={isRecordingPayment}
          onClose={() => setIsRecordingPayment(false)}
          onRecorded={(updated) => {
            setIsRecordingPayment(false)
            setNotice(updated.status === 'paid' ? 'Payment recorded. The invoice is now fully paid.' : 'Payment recorded.')
          }}
        />
      )}

      <ConfirmDialog
        open={confirm === 'delete'}
        title="Delete this draft?"
        confirmLabel="Delete draft"
        tone="danger"
        isLoading={deleteInvoice.isPending}
        onConfirm={remove}
        onClose={() => setConfirm(null)}
      >
        The draft and its line items will be removed permanently.
      </ConfirmDialog>
    </div>
  )
}

function PaymentsSection({
  invoice,
  onRecord,
  onDelete,
}: {
  invoice: InvoiceDetail
  onRecord: () => void
  onDelete: (payment: Payment) => void
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-sm font-semibold">Payments</h2>
        {invoice.balance_due > 0 && (
          <p className="text-sm text-slate-500">
            Balance due <span className="font-medium text-slate-900">{formatMoney(invoice.balance_due)}</span>
          </p>
        )}
      </div>

      {invoice.payments.length === 0 ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed border-slate-300 p-4">
          <p className="text-sm text-slate-500">No payments yet. Record full or partial payments as they arrive.</p>
          <Button variant="secondary" size="sm" onClick={onRecord}>
            Record payment
          </Button>
        </div>
      ) : (
        <ul className="mt-3 divide-y divide-slate-100">
          {invoice.payments.map((payment) => (
            <li key={payment.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
              <div>
                <p className="font-medium tabular-nums">{formatMoney(payment.amount)}</p>
                <p className="text-xs text-slate-500">
                  {formatIsoDate(payment.paid_on)} · {payment.method_label}
                  {payment.reference && <> · Ref {payment.reference}</>}
                </p>
                {payment.notes && <p className="mt-0.5 text-xs text-slate-500">{payment.notes}</p>}
              </div>
              <button
                type="button"
                onClick={() => onDelete(payment)}
                className="rounded-md px-2 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50"
              >
                Delete<span className="sr-only"> payment of {formatMoney(payment.amount)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function Timeline({ invoice }: { invoice: InvoiceDetail }) {
  const events = [
    { label: 'Draft created', at: invoice.created_at },
    { label: `Sent as ${invoice.number ?? ''}`, at: invoice.sent_at },
    { label: 'Fully paid', at: invoice.paid_at },
    { label: 'Voided', at: invoice.voided_at },
  ].filter((event): event is { label: string; at: string } => Boolean(event.at))

  const formatter = new Intl.DateTimeFormat('en-AE', { dateStyle: 'medium', timeStyle: 'short' })

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-sm font-semibold">History</h2>
      <ol className="mt-3 space-y-2 text-sm">
        {events.map((event) => (
          <li key={event.label} className="flex justify-between gap-4">
            <span className="text-slate-700">{event.label}</span>
            <time dateTime={event.at} className="text-slate-500">
              {formatter.format(new Date(event.at))}
            </time>
          </li>
        ))}
      </ol>
    </section>
  )
}
