import { zodResolver } from '@hookform/resolvers/zod'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { SelectField, TextField } from '@/components/ui/FormField'
import { Modal } from '@/components/ui/Modal'
import { filsToInput, formatMoney } from '@/features/invoices/money'
import type { InvoiceDetail } from '@/features/invoices/types'
import { todayIso } from '@/lib/dates'
import { getErrorMessage, getFieldErrors } from '@/lib/errors'
import { useRecordPayment } from './hooks'
import { PAYMENT_METHODS } from './methods'
import { paymentFormSchema, toPaymentPayload, type PaymentFormValues } from './schema'

type RecordPaymentDialogProps = {
  invoice: InvoiceDetail
  open: boolean
  onClose: () => void
  onRecorded: (invoice: InvoiceDetail) => void
}

/** The Modal only renders its children while open, so the form mounts fresh each time. */
export function RecordPaymentDialog({ invoice, open, onClose, onRecorded }: RecordPaymentDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Record payment"
      description={`${invoice.number} · balance due ${formatMoney(invoice.balance_due)}`}
    >
      <PaymentForm invoice={invoice} onCancel={onClose} onRecorded={onRecorded} />
    </Modal>
  )
}

const FIELDS = ['amount', 'paid_on', 'method', 'reference', 'notes'] as const

function isField(field: string): field is (typeof FIELDS)[number] {
  return (FIELDS as readonly string[]).includes(field)
}

function PaymentForm({
  invoice,
  onCancel,
  onRecorded,
}: {
  invoice: InvoiceDetail
  onCancel: () => void
  onRecorded: (invoice: InvoiceDetail) => void
}) {
  const recordPayment = useRecordPayment()
  const [formError, setFormError] = useState<string | null>(null)

  // Memoised so the resolver isn't rebuilt on every render.
  const schema = useMemo(
    () => paymentFormSchema({ balanceDue: invoice.balance_due, issueDate: invoice.issue_date }),
    [invoice.balance_due, invoice.issue_date],
  )

  const {
    register,
    handleSubmit,
    setError,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<PaymentFormValues>({
    resolver: zodResolver(schema),
    // The most common case is "they paid the rest", so that's the default.
    defaultValues: {
      amount: filsToInput(invoice.balance_due),
      paid_on: todayIso(),
      method: 'bank_transfer',
      reference: '',
      notes: '',
    },
  })

  async function onSubmit(values: PaymentFormValues) {
    setFormError(null)
    try {
      const updated = await recordPayment.mutateAsync({ invoiceId: invoice.id, payload: toPaymentPayload(values) })
      onRecorded(updated)
    } catch (error) {
      const serverErrors = Object.entries(getFieldErrors(error))
      if (serverErrors.length === 0) {
        setFormError(getErrorMessage(error))
        return
      }
      for (const [field, message] of serverErrors) {
        if (!message) continue
        if (isField(field)) setError(field, { type: 'server', message })
        else setFormError(message)
      }
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
      {formError && <Alert>{formError}</Alert>}

      <div>
        <TextField
          label="Amount (AED)"
          inputMode="decimal"
          autoFocus
          {...register('amount')}
          error={errors.amount?.message}
        />
        <div className="mt-2 flex gap-1.5">
          <QuickAmount label="Full balance" onClick={() => setValue('amount', filsToInput(invoice.balance_due), { shouldValidate: true })} />
          <QuickAmount
            label="Half"
            onClick={() => setValue('amount', filsToInput(Math.floor(invoice.balance_due / 2)), { shouldValidate: true })}
          />
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <TextField label="Date received" type="date" max={todayIso()} {...register('paid_on')} error={errors.paid_on?.message} />
        <SelectField label="Method" {...register('method')} error={errors.method?.message}>
          {PAYMENT_METHODS.map((method) => (
            <option key={method.value} value={method.value}>
              {method.label}
            </option>
          ))}
        </SelectField>
      </div>

      <TextField
        label="Reference"
        placeholder="Bank reference, cheque number…"
        {...register('reference')}
        error={errors.reference?.message}
      />

      <TextField label="Notes" {...register('notes')} error={errors.notes?.message} />

      <div className="flex justify-end gap-3 border-t border-slate-200 pt-5">
        <Button variant="secondary" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" isLoading={isSubmitting}>
          Record payment
        </Button>
      </div>
    </form>
  )
}

function QuickAmount({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-md border border-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
    >
      {label}
    </button>
  )
}
