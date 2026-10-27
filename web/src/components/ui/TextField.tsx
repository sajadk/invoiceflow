import { useId, type InputHTMLAttributes } from 'react'

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string
  error?: string
  hint?: string
}

/**
 * Label + input + error message, wired up for screen readers.
 * `...inputProps` forwards everything else (value, onChange, type, autoComplete...)
 * to the <input>, much like Vue's attribute fallthrough ($attrs).
 */
export function TextField({ label, error, hint, id, className = '', ...inputProps }: TextFieldProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const messageId = `${inputId}-message`
  const message = error ?? hint

  return (
    <div className={className}>
      <label htmlFor={inputId} className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={message ? messageId : undefined}
        className={`mt-1.5 block w-full rounded-lg border bg-white px-3 py-2 text-sm shadow-sm outline-none transition placeholder:text-slate-400 focus:ring-2 ${
          error
            ? 'border-rose-300 focus:border-rose-400 focus:ring-rose-100'
            : 'border-slate-300 focus:border-brand-500 focus:ring-brand-100'
        }`}
        {...inputProps}
      />
      {message && (
        <p id={messageId} className={`mt-1.5 text-sm ${error ? 'text-rose-600' : 'text-slate-500'}`}>
          {message}
        </p>
      )}
    </div>
  )
}
