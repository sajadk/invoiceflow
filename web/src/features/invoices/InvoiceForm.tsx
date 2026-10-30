import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm, useWatch, type FieldPath } from 'react-hook-form'
import { Link } from 'react-router'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { SelectField, TextAreaField, TextField } from '@/components/ui/FormField'
import { useCustomerOptions } from '@/features/customers/hooks'
import { addDaysIso, todayIso } from '@/lib/dates'
import { getErrorMessage, getFieldErrors } from '@/lib/errors'
import { InvoiceTotals } from './InvoiceTotals'
import { LineItemsEditor } from './LineItemsEditor'
import { calculateTotals, parseMoney, parseQuantityMilli } from './money'
import { invoiceFormSchema, newInvoiceForm, toFormValues, toPayload, type InvoiceFormValues } from './schema'
import { useCreateInvoice, useUpdateInvoice } from './hooks'
import type { InvoiceDetail } from './types'

type InvoiceFormProps = {
  /** null = new draft */
  invoice: InvoiceDetail | null
  onSaved: (invoice: InvoiceDetail) => void
  onCancel: () => void
}

const PAYMENT_TERMS = [7, 14, 30]

// Server error keys look like "items.2.quantity"; only map the ones that exist in the form.
const FORM_FIELD = /^(customer_id|issue_date|due_date|notes|items(\.\d+\.(description|quantity|unit_price|vat_rate))?)$/

export function InvoiceForm({ invoice, onSaved, onCancel }: InvoiceFormProps) {
  const createInvoice = useCreateInvoice()
  const updateInvoice = useUpdateInvoice()
  const customers = useCustomerOptions()
  const [formError, setFormError] = useState<string | null>(null)

  const {
    register,
    control,
    handleSubmit,
    setError,
    setValue,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<InvoiceFormValues>({
    resolver: zodResolver(invoiceFormSchema),
    defaultValues: invoice ? toFormValues(invoice) : newInvoiceForm(todayIso(), addDaysIso(todayIso(), 30)),
  })

  // useWatch subscribes to just these values, so the live totals update on every
  // keystroke without the rest of the form re-rendering.
  const items = useWatch({ control, name: 'items' }) ?? []
  const totals = calculateTotals(
    items.map((item) => ({
      quantityMilli: parseQuantityMilli(item.quantity) ?? 0,
      unitPrice: parseMoney(item.unit_price) ?? 0,
      vatRate: item.vat_rate,
    })),
  )

  function applyTerms(days: number) {
    setValue('due_date', addDaysIso(getValues('issue_date'), days), { shouldValidate: true, shouldDirty: true })
  }

  async function onSubmit(values: InvoiceFormValues) {
    setFormError(null)
    const payload = toPayload(values)

    try {
      const saved = invoice
        ? await updateInvoice.mutateAsync({ id: invoice.id, payload })
        : await createInvoice.mutateAsync(payload)
      onSaved(saved)
    } catch (error) {
      const serverErrors = Object.entries(getFieldErrors(error))
      if (serverErrors.length === 0) {
        setFormError(getErrorMessage(error))
        return
      }
      for (const [field, message] of serverErrors) {
        if (!message) continue
        if (FORM_FIELD.test(field)) setError(field as FieldPath<InvoiceFormValues>, { type: 'server', message })
        else setFormError(message)
      }
    }
  }

  // A draft's customer may since have been deleted; keep it selectable so the form still shows it.
  const customerOptions = [...(customers.data ?? [])]
  if (invoice && !customerOptions.some((customer) => customer.id === invoice.customer.id)) {
    customerOptions.unshift(invoice.customer)
  }
  const noCustomers = customers.isSuccess && customerOptions.length === 0

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6">
      {formError && <Alert>{formError}</Alert>}

      <section className="grid gap-5 rounded-xl border border-slate-200 bg-white p-6 shadow-sm md:grid-cols-[minmax(0,1.4fr)_1fr_1fr]">
        <div>
          {/* Only mount the registered <select> once its options exist: RHF writes the
              default value into the DOM when the input registers, and a <select> can't
              hold a value it has no <option> for. */}
          {customers.isPending ? (
            <SelectField label="Customer" disabled>
              <option>Loading customers…</option>
            </SelectField>
          ) : (
            <SelectField label="Customer" {...register('customer_id')} error={errors.customer_id?.message}>
              <option value="">Choose a customer</option>
              {customerOptions.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                  {customer.trn ? ` · TRN ${customer.trn}` : ''}
                </option>
              ))}
            </SelectField>
          )}
          {noCustomers && (
            <p className="mt-1.5 text-sm text-slate-500">
              No customers yet.{' '}
              <Link to="/customers" className="font-medium text-brand-700 hover:underline">
                Add one first
              </Link>
              .
            </p>
          )}
        </div>

        <TextField label="Issue date" type="date" {...register('issue_date')} error={errors.issue_date?.message} />

        <div>
          <TextField label="Due date" type="date" {...register('due_date')} error={errors.due_date?.message} />
          <div className="mt-2 flex gap-1.5">
            {PAYMENT_TERMS.map((days) => (
              <button
                key={days}
                type="button"
                onClick={() => applyTerms(days)}
                className="rounded-md border border-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                Net {days}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-base font-semibold">Line items</h2>
        <LineItemsEditor control={control} register={register} errors={errors} items={items} />
      </section>

      <section className="grid gap-6 md:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <TextAreaField
            label="Notes"
            hint="Shown on the invoice: payment instructions, thank-you note…"
            rows={4}
            {...register('notes')}
            error={errors.notes?.message}
          />
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <InvoiceTotals totals={totals} />
          <p className="mt-4 text-xs text-slate-400">Totals are recalculated by the server when you save.</p>
        </div>
      </section>

      <div className="flex justify-end gap-3">
        <Button variant="secondary" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" isLoading={isSubmitting}>
          {invoice ? 'Save changes' : 'Save draft'}
        </Button>
      </div>
    </form>
  )
}
