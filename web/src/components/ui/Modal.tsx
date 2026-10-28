import { useEffect, useId, useRef, type ReactNode } from 'react'

type ModalProps = {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  /** 'panel' slides in from the right (forms); 'dialog' is centred (confirmations). */
  variant?: 'panel' | 'dialog'
  children: ReactNode
  footer?: ReactNode
}

/**
 * Built on the native <dialog> element: focus trapping, Esc to close and the
 * backdrop come from the browser, so there's no focus-trap library to maintain.
 *
 * React is declarative but showModal() is imperative, so a ref + effect
 * bridges the two (same idea as a template ref + watch in Vue).
 */
export function Modal({ open, onClose, title, description, variant = 'dialog', children, footer }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  const position =
    variant === 'panel'
      ? 'm-0 ml-auto h-dvh max-h-none w-full max-w-lg rounded-none'
      : 'm-auto w-full max-w-md rounded-2xl'

  return (
    <dialog
      ref={dialogRef}
      // Esc key: let React state drive closing instead of the browser.
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      // A click on the backdrop lands on the <dialog> itself, not its content.
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
      aria-labelledby={titleId}
      className={`bg-white p-0 text-slate-900 shadow-xl backdrop:bg-slate-900/40 ${position}`}
    >
      {open && (
        <div className="flex h-full flex-col">
          <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-4">
            <div>
              <h2 id={titleId} className="text-lg font-semibold tracking-tight">
                {title}
              </h2>
              {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="size-5" aria-hidden="true">
                <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
              </svg>
            </button>
          </header>

          <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>

          {footer && (
            <footer className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">{footer}</footer>
          )}
        </div>
      )}
    </dialog>
  )
}
