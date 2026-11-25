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
  warning,
  hint,
  className = '',
  children,
}: {
  label: string
  id?: string
  error?: string
  warning?: string
  hint?: string
  className?: string
  children: (control: { id: string; describedBy?: string; invalid: boolean; tone: Tone }) => ReactNode
}) {
  const generatedId = useId()
  const controlId = id ?? generatedId
  const messageId = `${controlId}-message`
  // An error wins over a warning ("check this"), which wins over the hint.
  const message = error ?? warning ?? hint
  const tone: Tone = error ? 'error' : warning ? 'warning' : 'normal'

  return (
    <div className={className}>
      <label htmlFor={controlId} className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      {children({ id: controlId, describedBy: message ? messageId : undefined, invalid: Boolean(error), tone })}
      {message && (
        <p id={messageId} className={`mt-1.5 text-sm ${messageClass[tone]}`}>
          {message}
        </p>
      )}
    </div>
  )
}

type Tone = 'normal' | 'warning' | 'error'

const messageClass: Record<Tone, string> = {
  normal: 'text-slate-500',
  warning: 'text-amber-700',
  error: 'text-rose-600',
}

const borderClass: Record<Tone, string> = {
  normal: 'border-slate-300 focus:border-brand-500 focus:ring-brand-100',
  warning: 'border-amber-400 focus:border-amber-500 focus:ring-amber-100',
  error: 'border-rose-300 focus:border-rose-400 focus:ring-rose-100',
}

const controlClass = (tone: Tone) =>
  `mt-1.5 block w-full rounded-lg border bg-white px-3 py-2 text-sm shadow-sm outline-none transition placeholder:text-slate-400 focus:ring-2 ${borderClass[tone]}`

/** `warning` is for values to double-check (e.g. read by AI capture), not errors: it doesn't block saving. */
type FieldProps = { label: string; error?: string; warning?: string; hint?: string; className?: string }

// ComponentProps<'input'> includes `ref` in React 19, so {...register('name')}
// from React Hook Form can be spread straight onto these components.

export function TextField({ label, error, warning, hint, className, id, ...props }: FieldProps & ComponentProps<'input'>) {
  return (
    <FieldShell label={label} error={error} warning={warning} hint={hint} className={className} id={id}>
      {(control) => (
        <input
          id={control.id}
          aria-invalid={control.invalid || undefined}
          aria-describedby={control.describedBy}
          className={controlClass(control.tone)}
          {...props}
        />
      )}
    </FieldShell>
  )
}

export function SelectField({
  label,
  error,
  warning,
  hint,
  className,
  id,
  children,
  ...props
}: FieldProps & ComponentProps<'select'>) {
  return (
    <FieldShell label={label} error={error} warning={warning} hint={hint} className={className} id={id}>
      {(control) => (
        <select
          id={control.id}
          aria-invalid={control.invalid || undefined}
          aria-describedby={control.describedBy}
          className={controlClass(control.tone)}
          {...props}
        >
          {children}
        </select>
      )}
    </FieldShell>
  )
}

export function TextAreaField({ label, error, warning, hint, className, id, ...props }: FieldProps & ComponentProps<'textarea'>) {
  return (
    <FieldShell label={label} error={error} warning={warning} hint={hint} className={className} id={id}>
      {(control) => (
        <textarea
          id={control.id}
          aria-invalid={control.invalid || undefined}
          aria-describedby={control.describedBy}
          className={controlClass(control.tone)}
          rows={3}
          {...props}
        />
      )}
    </FieldShell>
  )
}
