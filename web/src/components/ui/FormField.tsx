import { useId, type ComponentProps, type ReactNode } from 'react'

/**
 * Shared label + control + message wiring for every form control.
 * The control is passed as a render function so it receives the generated
 * ids (Vue equivalent: a scoped slot).
 */
function FieldShell({
  label,
  id,
  error,
  hint,
  className = '',
  children,
}: {
  label: string
  id?: string
  error?: string
  hint?: string
  className?: string
  children: (control: { id: string; describedBy?: string; invalid: boolean }) => ReactNode
}) {
  const generatedId = useId()
  const controlId = id ?? generatedId
  const messageId = `${controlId}-message`
  const message = error ?? hint

  return (
    <div className={className}>
      <label htmlFor={controlId} className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      {children({ id: controlId, describedBy: message ? messageId : undefined, invalid: Boolean(error) })}
      {message && (
        <p id={messageId} className={`mt-1.5 text-sm ${error ? 'text-rose-600' : 'text-slate-500'}`}>
          {message}
        </p>
      )}
    </div>
  )
}

const controlClass = (invalid: boolean) =>
  `mt-1.5 block w-full rounded-lg border bg-white px-3 py-2 text-sm shadow-sm outline-none transition placeholder:text-slate-400 focus:ring-2 ${
    invalid
      ? 'border-rose-300 focus:border-rose-400 focus:ring-rose-100'
      : 'border-slate-300 focus:border-brand-500 focus:ring-brand-100'
  }`

type FieldProps = { label: string; error?: string; hint?: string; className?: string }

// ComponentProps<'input'> includes `ref` in React 19, so {...register('name')}
// from React Hook Form can be spread straight onto these components.

export function TextField({ label, error, hint, className, id, ...props }: FieldProps & ComponentProps<'input'>) {
  return (
    <FieldShell label={label} error={error} hint={hint} className={className} id={id}>
      {(control) => (
        <input
          id={control.id}
          aria-invalid={control.invalid || undefined}
          aria-describedby={control.describedBy}
          className={controlClass(control.invalid)}
          {...props}
        />
      )}
    </FieldShell>
  )
}

export function SelectField({
  label,
  error,
  hint,
  className,
  id,
  children,
  ...props
}: FieldProps & ComponentProps<'select'>) {
  return (
    <FieldShell label={label} error={error} hint={hint} className={className} id={id}>
      {(control) => (
        <select
          id={control.id}
          aria-invalid={control.invalid || undefined}
          aria-describedby={control.describedBy}
          className={controlClass(control.invalid)}
          {...props}
        >
          {children}
        </select>
      )}
    </FieldShell>
  )
}

export function TextAreaField({ label, error, hint, className, id, ...props }: FieldProps & ComponentProps<'textarea'>) {
  return (
    <FieldShell label={label} error={error} hint={hint} className={className} id={id}>
      {(control) => (
        <textarea
          id={control.id}
          aria-invalid={control.invalid || undefined}
          aria-describedby={control.describedBy}
          className={controlClass(control.invalid)}
          rows={3}
          {...props}
        />
      )}
    </FieldShell>
  )
}
