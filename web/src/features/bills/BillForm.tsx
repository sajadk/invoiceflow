import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm, useWatch, type FieldPath } from 'react-hook-form'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { TextAreaField, TextField } from '@/components/ui/FormField'
import { InvoiceTotals } from '@/features/invoices/InvoiceTotals'
import { LineItemsEditor } from '@/features/invoices/LineItemsEditor'
import { calculateTotals, parseMoney, parseQuantityMilli } from '@/features/invoices/money'
import { todayIso } from '@/lib/dates'
import { getErrorMessage, getFieldErrors } from '@/lib/errors'
import { useCreateBill, useUpdateBill } from './hooks'
import { billFormSchema, newBillForm, toBillFormValues, toBillPayload, type BillFormValues } from './schema'
import type { BillDetail } from './types'

type BillFormProps = {
  /** null = record a new bill */
  bill: BillDetail | null
  onSaved: (bill: BillDetail) => void
  onCancel: () => void
}

// Server error keys look like "items.2.quantity"; only map the ones that exist in the form.
const FORM_FIELD =
  /^(supplier_name|supplier_trn|supplier_invoice_number|issue_date|due_date|notes|items(\.\d+\.(description|quantity|unit_price|vat_rate))?)$/

/** The same form will be pre-filled by AI capture in the next milestone. */
export function BillForm({ bill, onSaved, onCancel }: BillFormProps) {
  const createBill = useCreateBill()
  const updateBill = useUpdateBill()
  const [formError, setFormError] = useState<string | null>(null)

  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<BillFormValues>({
    resolver: zodResolver(billFormSchema),
    defaultValues: bill ? toBillFormValues(bill) : newBillForm(todayIso()),
  })

  const items = useWatch({ control, name: 'items' }) ?? []
  const totals = calculateTotals(
    items.map((item) => ({
      quantityMilli: parseQuantityMilli(item.quantity) ?? 0,
      unitPrice: parseMoney(item.unit_price) ?? 0,
      vatRate: item.vat_rate,
    })),
  )

  async function onSubmit(values: BillFormValues) {
    setFormError(null)
    const payload = toBillPayload(values)

    try {
      const saved = bill
        ? await updateBill.mutateAsync({ id: bill.id, payload })
        : await createBill.mutateAsync(payload)
      onSaved(saved)
    } catch (error) {
      const serverErrors = Object.entries(getFieldErrors(error))
      if (serverErrors.length === 0) {
        setFormError(getErrorMessage(error))
        return
      }
      for (const [field, message] of serverErrors) {
        if (!message) continue
        if (FORM_FIELD.test(field)) setError(field as FieldPath<BillFormValues>, { type: 'server', message })
        else setFormError(message)
      }
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6">
      {formError && <Alert>{formError}</Alert>}

      <section className="grid gap-5 rounded-xl border border-slate-200 bg-white p-6 shadow-sm md:grid-cols-2">
        <TextField label="Supplier" placeholder="As printed on their invoice" {...register('supplier_name')} error={errors.supplier_name?.message} />
        <TextField
          label="Supplier TRN"
          inputMode="numeric"
          placeholder="100 1234 5678 9012"
          hint="Needed to reclaim the VAT. Leave empty if they aren't VAT-registered."
          {...register('supplier_trn')}
          error={errors.supplier_trn?.message}
        />
        <TextField label="Their invoice number" {...register('supplier_invoice_number')} error={errors.supplier_invoice_number?.message} />
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField label="Invoice date" type="date" max={todayIso()} {...register('issue_date')} error={errors.issue_date?.message} />
          <TextField label="Due date" type="date" hint="Optional" {...register('due_date')} error={errors.due_date?.message} />
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-base font-semibold">Line items</h2>
        <LineItemsEditor control={control} register={register} errors={errors} items={items} />
      </section>

      <section className="grid gap-6 md:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <TextAreaField label="Notes" hint="Internal only." rows={4} {...register('notes')} error={errors.notes?.message} />
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <InvoiceTotals totals={totals} />
          <p className="mt-4 text-xs text-slate-400">
            The VAT here is input VAT: it reduces what you owe on your VAT return.
          </p>
        </div>
      </section>

      <div className="flex justify-end gap-3">
        <Button variant="secondary" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" isLoading={isSubmitting}>
          {bill ? 'Save changes' : 'Record bill'}
        </Button>
      </div>
    </form>
  )
}
