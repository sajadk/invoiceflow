import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/TextField'
import { useAuth } from '@/features/auth/useAuth'
import type { RegisterPayload } from '@/features/auth/types'
import { getErrorMessage, getFieldErrors, type FieldErrors } from '@/lib/errors'

const emptyForm: RegisterPayload = { name: '', email: '', password: '', password_confirmation: '' }

export function RegisterPage() {
  const { register } = useAuth()
  const navigate = useNavigate()

  const [form, setForm] = useState<RegisterPayload>(emptyForm)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  function updateField(field: keyof RegisterPayload, value: string) {
    setForm((previous) => ({ ...previous, [field]: value }))
    setErrors((previous) => ({ ...previous, [field]: undefined }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmitting(true)
    setErrors({})
    setFormError(null)

    try {
      await register(form)
      navigate('/', { replace: true })
    } catch (error) {
      const fieldErrors = getFieldErrors(error)
      if (Object.keys(fieldErrors).length > 0) {
        setErrors(fieldErrors)
      } else {
        setFormError(getErrorMessage(error))
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <h1 className="text-xl font-semibold tracking-tight">Create your account</h1>
      <p className="mt-1 text-sm text-slate-500">Start sending VAT-ready invoices in minutes.</p>

      <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
        {formError && <Alert>{formError}</Alert>}

        <TextField
          label="Full name"
          autoComplete="name"
          required
          value={form.name}
          onChange={(e) => updateField('name', e.target.value)}
          error={errors.name}
        />

        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          required
          value={form.email}
          onChange={(e) => updateField('email', e.target.value)}
          error={errors.email}
        />

        <TextField
          label="Password"
          type="password"
          autoComplete="new-password"
          required
          value={form.password}
          onChange={(e) => updateField('password', e.target.value)}
          error={errors.password}
          hint="At least 8 characters."
        />

        <TextField
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          required
          value={form.password_confirmation}
          onChange={(e) => updateField('password_confirmation', e.target.value)}
          error={errors.password_confirmation}
        />

        <Button type="submit" isLoading={isSubmitting} className="w-full">
          Create account
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-500">
        Already have an account?{' '}
        <Link to="/login" className="font-medium text-brand-700 hover:underline">
          Sign in
        </Link>
      </p>
    </>
  )
}
