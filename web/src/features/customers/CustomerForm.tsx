import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { SelectField, TextAreaField, TextField } from '@/components/ui/FormField'
import { getErrorMessage, getFieldErrors } from '@/lib/errors'
import { EMIRATES } from './emirates'
import { useCreateCustomer, useUpdateCustomer } from './hooks'
import {
  customerFormSchema,
  emptyCustomerForm,
  toFormValues,
  toPayload,
  type CustomerFormValues,
} from './schema'
import type { Customer } from './types'

type CustomerFormProps = {
  /** null = create a new customer */
  customer: Customer | null
  onCancel: () => void
  onSaved: (customer: Customer) => void
}

const formFields = Object.keys(emptyCustomerForm) as (keyof CustomerFormValues)[]

function isFormField(field: string): field is keyof CustomerFormValues {
  return (formFields as string[]).includes(field)
}

/**
 * React Hook Form keeps inputs *uncontrolled* (the DOM holds the values, RHF reads
 * them via refs), so typing doesn't re-render the whole form on every keystroke.
 * Compare with the hand-written controlled inputs on the login page.
 */
export function CustomerForm({ customer, onCancel, onSaved }: CustomerFormProps) {
  const createCustomer = useCreateCustomer()
  const updateCustomer = useUpdateCustomer()
  const [formError, setFormError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CustomerFormValues>({
    resolver: zodResolver(customerFormSchema),
    defaultValues: customer ? toFormValues(customer) : emptyCustomerForm,
  })

  // Only runs once Zod validation has passed.
  async function onSubmit(values: CustomerFormValues) {
    setFormError(null)
    const payload = toPayload(values)

    try {
      const saved = customer
        ? await updateCustomer.mutateAsync({ id: customer.id, payload })
        : await createCustomer.mutateAsync(payload)
      onSaved(saved)
    } catch (error) {
      // Server-side rules the client can't check (e.g. duplicate TRN) land on the same fields.
      const serverErrors = Object.entries(getFieldErrors(error))
      if (serverErrors.length === 0) {
        setFormError(getErrorMessage(error))
        return
      }
      for (const [field, message] of serverErrors) {
        if (isFormField(field) && message) setError(field, { type: 'server', message })
        else if (message) setFormError(message)
      }
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
      {formError && <Alert>{formError}</Alert>}

      <TextField label="Company or customer name" autoFocus {...register('name')} error={errors.name?.message} />

      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          label="Email"
          type="email"
          placeholder="accounts@company.ae"
          {...register('email')}
          error={errors.email?.message}
        />
        <TextField
          label="Phone"
          type="tel"
          placeholder="+971 50 123 4567"
          {...register('phone')}
          error={errors.phone?.message}
        />
      </div>

      <TextField
        label="TRN (Tax Registration Number)"
        inputMode="numeric"
        placeholder="100 1234 5678 9012"
        {...register('trn')}
        error={errors.trn?.message}
        hint="15 digits starting with 100. Leave empty if the customer isn't VAT-registered."
      />

      <SelectField label="Emirate" {...register('emirate')} error={errors.emirate?.message}>
        <option value="">Not specified</option>
        {EMIRATES.map((emirate) => (
          <option key={emirate.value} value={emirate.value}>
            {emirate.label}
          </option>
        ))}
      </SelectField>

      <TextAreaField label="Address" {...register('address')} error={errors.address?.message} />

      <div className="flex justify-end gap-3 border-t border-slate-200 pt-5">
        <Button variant="secondary" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" isLoading={isSubmitting}>
          {customer ? 'Save changes' : 'Create customer'}
        </Button>
      </div>
    </form>
  )
}
