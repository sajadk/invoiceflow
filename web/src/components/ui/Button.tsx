import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  size?: 'sm' | 'md'
  isLoading?: boolean
}

// Padding lives in sizes (not in className overrides) because two conflicting
// Tailwind classes on one element don't reliably let the later one win.
const sizes = {
  sm: 'px-3 py-1.5',
  md: 'px-4 py-2',
}

const variants: Record<Variant, string> = {
  primary: 'bg-brand-700 text-white shadow-sm hover:bg-brand-900 focus-visible:ring-brand-500',
  secondary: 'border border-slate-300 bg-white text-slate-700 shadow-sm hover:bg-slate-50 focus-visible:ring-slate-400',
  ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-slate-400',
  danger: 'bg-rose-600 text-white shadow-sm hover:bg-rose-700 focus-visible:ring-rose-500',
}

export function Button({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  disabled,
  className = '',
  children,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      className={`inline-flex items-center justify-center gap-2 rounded-lg text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${sizes[size]} ${variants[variant]} ${className}`}
      {...props}
    >
      {isLoading && <Spinner />}
      {children}
    </button>
  )
}

export function Spinner({ className = 'size-4' }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="4" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    </svg>
  )
}
