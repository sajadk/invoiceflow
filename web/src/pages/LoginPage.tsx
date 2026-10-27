import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { getRedirectTarget } from '@/components/routing/redirect'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/TextField'
import { useAuth } from '@/features/auth/useAuth'
import type { LoginPayload } from '@/features/auth/types'
import { getErrorMessage, getFieldErrors, type FieldErrors } from '@/lib/errors'

const DEMO_CREDENTIALS = { email: 'demo@invoiceflow.test', password: 'password' }

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  // useState = ref(). Calling setForm() replaces the value and re-renders the component.
  const [form, setForm] = useState<LoginPayload>({ email: '', password: '', remember: false })
  const [errors, setErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // A controlled input is v-model done by hand: value={form.x} + onChange -> setForm.
  function updateField<K extends keyof LoginPayload>(field: K, value: LoginPayload[K]) {
    setForm((previous) => ({ ...previous, [field]: value })) // new object, never mutate
    setErrors((previous) => ({ ...previous, [field]: undefined }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmitting(true)
    setErrors({})
    setFormError(null)

    try {
      await login(form)
      navigate(getRedirectTarget(location.state), { replace: true })
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
      <h1 className="text-xl font-semibold tracking-tight">Sign in</h1>
      <p className="mt-1 text-sm text-slate-500">Welcome back. Enter your details to continue.</p>

      <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
        {formError && <Alert>{formError}</Alert>}

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
          autoComplete="current-password"
          required
          value={form.password}
          onChange={(e) => updateField('password', e.target.value)}
          error={errors.password}
        />

        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={form.remember}
            onChange={(e) => updateField('remember', e.target.checked)}
            className="size-4 rounded border-slate-300 accent-brand-700"
          />
          Remember me
        </label>

        <Button type="submit" isLoading={isSubmitting} className="w-full">
          Sign in
        </Button>
      </form>

      <div className="mt-6 rounded-lg border border-dashed border-slate-300 p-3 text-sm text-slate-600">
        <p>
          Just looking around? Use the demo account:{' '}
          <span className="font-mono text-xs">{DEMO_CREDENTIALS.email}</span>
        </p>
        <button
          type="button"
          onClick={() => setForm({ ...DEMO_CREDENTIALS, remember: false })}
          className="mt-1 font-medium text-brand-700 hover:underline"
        >
          Fill in demo credentials
        </button>
      </div>

      <p className="mt-6 text-center text-sm text-slate-500">
        No account yet?{' '}
        <Link to="/register" state={location.state} className="font-medium text-brand-700 hover:underline">
          Create one
        </Link>
      </p>
    </>
  )
}
