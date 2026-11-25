import { useId, useRef, useState, type DragEvent } from 'react'
import { ACCEPTED_TYPES, checkFile } from './files'

type CaptureDropzoneProps = {
  maxFileKb: number
  disabled?: boolean
  onFile: (file: File) => void
  onReject: (message: string) => void
}

/** Drag and drop, or a normal file picker (keyboard and mobile camera friendly). */
export function CaptureDropzone({ maxFileKb, disabled = false, onFile, onReject }: CaptureDropzoneProps) {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  function take(file: File | undefined) {
    if (!file || disabled) return
    const problem = checkFile(file, maxFileKb)
    if (problem) onReject(problem)
    else onFile(file)
  }

  function onDrop(event: DragEvent) {
    event.preventDefault()
    setDragging(false)
    take(event.dataTransfer.files[0])
  }

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault()
        if (!disabled) setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-14 text-center transition ${
        disabled
          ? 'border-slate-200 bg-slate-50 opacity-60'
          : dragging
            ? 'border-brand-500 bg-brand-50'
            : 'border-slate-300 bg-white hover:border-brand-500'
      }`}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="size-10 text-slate-400" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 16V4m0 0-4 4m4-4 4 4M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
      </svg>
      <p className="mt-4 text-sm font-medium text-slate-900">Drop a supplier invoice here</p>
      <p className="mt-1 text-sm text-slate-500">PDF or photo (JPG, PNG, WebP), up to {Math.round(maxFileKb / 1024)} MB</p>
      <label
        htmlFor={inputId}
        className={`mt-5 inline-flex cursor-pointer items-center rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-900 focus-within:ring-2 focus-within:ring-brand-500 focus-within:ring-offset-2 ${
          disabled ? 'pointer-events-none' : ''
        }`}
      >
        Choose file
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept={ACCEPTED_TYPES.join(',')}
          className="sr-only"
          disabled={disabled}
          aria-label="Supplier invoice file"
          onChange={(event) => {
            take(event.target.files?.[0])
            // Allow picking the same file again after an error.
            if (inputRef.current) inputRef.current.value = ''
          }}
        />
      </label>
    </div>
  )
}
