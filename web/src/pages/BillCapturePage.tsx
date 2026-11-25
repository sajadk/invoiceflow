import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { FullPageSpinner } from '@/components/routing/FullPageSpinner'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { BillForm } from '@/features/bills/BillForm'
import { CaptureDropzone } from '@/features/bills/capture/CaptureDropzone'
import { DocumentPreview } from '@/features/bills/capture/DocumentPreview'
import { useExtraction, useExtractionUsage, useUploadForExtraction } from '@/features/bills/capture/hooks'
import { extractionToFormValues, warningLabel } from '@/features/bills/capture/mapping'
import type { BillExtraction, ExtractionResult } from '@/features/bills/capture/types'
import { todayIso } from '@/lib/dates'
import { getErrorMessage } from '@/lib/errors'

/**
 * AI invoice capture: upload a supplier invoice → the API queues it → this page
 * polls until the AI has read it → the user checks a pre-filled bill form next
 * to the document and saves it as a normal bill.
 *
 * The extraction id lives in the URL (?extraction=…), so a reload resumes where
 * it was; only the local preview of the file is lost then.
 */
export function BillCapturePage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const extractionId = searchParams.get('extraction')

  const [file, setFile] = useState<File | null>(null)
  const [progress, setProgress] = useState(0)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const usage = useExtractionUsage()
  const upload = useUploadForExtraction()
  const extraction = useExtraction(extractionId)

  function start(chosen: File) {
    setUploadError(null)
    setFile(chosen)
    setProgress(0)
    upload.mutate(
      { file: chosen, onProgress: setProgress },
      {
        onSuccess: (created) => setSearchParams({ extraction: created.id }, { replace: true }),
        onError: (error) => {
          setFile(null)
          setUploadError(getErrorMessage(error))
        },
      },
    )
  }

  function reset() {
    setFile(null)
    setUploadError(null)
    upload.reset()
    setSearchParams({}, { replace: true })
  }

  const current = extraction.data

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <Link to="/bills" className="text-sm text-slate-500 hover:text-slate-800">
          ← Bills
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          {current?.status === 'completed' ? 'Check the details' : 'Upload a supplier invoice'}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {current?.status === 'completed'
            ? 'AI filled in the form from the document. Compare them, fix anything that’s off, then save.'
            : 'AI reads the supplier, TRN, line items and VAT, and you check them before anything is saved.'}
        </p>
      </div>

      {!extractionId && (
        <UploadStep
          usage={usage.data}
          usageLoading={usage.isPending}
          uploading={upload.isPending}
          progress={progress}
          error={uploadError}
          onFile={start}
          onReject={setUploadError}
        />
      )}

      {extractionId && extraction.isPending && <FullPageSpinner />}

      {extractionId && extraction.isError && (
        <Failed message={getErrorMessage(extraction.error, 'This upload wasn’t found.')} onRetry={reset} />
      )}

      {extractionId && current && current.status !== 'completed' && current.status !== 'failed' && (
        <Reading file={file} extraction={current} />
      )}

      {current?.status === 'failed' && (
        <Failed message={current.error ?? 'Something went wrong reading this invoice.'} onRetry={reset} />
      )}

      {current?.status === 'completed' && current.result && (
        <Review
          extraction={current}
          result={current.result}
          file={file}
          onSaved={(billId) => navigate(`/bills/${billId}`, { replace: true })}
          onCancel={() => navigate('/bills')}
          onStartOver={reset}
        />
      )}
    </div>
  )
}

function UploadStep({
  usage,
  usageLoading,
  uploading,
  progress,
  error,
  onFile,
  onReject,
}: {
  usage: ReturnType<typeof useExtractionUsage>['data']
  usageLoading: boolean
  uploading: boolean
  progress: number
  error: string | null
  onFile: (file: File) => void
  onReject: (message: string) => void
}) {
  const unavailable = usage && !usage.enabled
  const usedUp = usage && usage.enabled && usage.remaining === 0

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {error && <Alert>{error}</Alert>}
      {unavailable && <Alert tone="info">AI capture isn’t set up on this server. You can still record the bill by hand.</Alert>}
      {usedUp && <Alert tone="info">You’ve used today’s AI uploads. They reset at midnight; you can still record the bill by hand.</Alert>}

      {uploading ? (
        <div className="rounded-xl border border-slate-200 bg-white px-6 py-14 text-center shadow-sm" role="status">
          <p className="text-sm font-medium text-slate-900">Uploading… {progress}%</p>
          <div className="mx-auto mt-3 h-1.5 max-w-xs overflow-hidden rounded-full bg-slate-100">
            <div className="h-full bg-brand-500 transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
      ) : (
        <CaptureDropzone
          maxFileKb={usage?.max_file_kb ?? 5120}
          disabled={usageLoading || Boolean(unavailable) || Boolean(usedUp)}
          onFile={onFile}
          onReject={onReject}
        />
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-500">
        <span>
          {usage?.enabled && `${usage.remaining} of ${usage.limit} uploads left today.`} Multi-page PDFs: the first{' '}
          {usage?.max_pages ?? 3} pages are read.
        </span>
        <Link to="/bills/new" className="font-medium text-brand-700 hover:underline">
          Enter by hand instead
        </Link>
      </div>
      <p className="text-xs text-slate-400">
        This demo uses a free AI tier, where the provider may use uploads to improve its models. Please don’t upload real
        invoices with personal or confidential details. Files are deleted from InvoiceFlow as soon as they’ve been read.
      </p>
    </div>
  )
}

function Reading({ file, extraction }: { file: File | null; extraction: BillExtraction }) {
  const seconds = useSecondsSince(extraction.created_at)

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white px-6 py-16 text-center shadow-sm" role="status">
        <span className="size-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" aria-hidden="true" />
        <p className="mt-4 text-sm font-medium text-slate-900">Reading {extraction.original_filename}…</p>
        <p className="mt-1 text-sm text-slate-500">
          Usually 5 to 20 seconds{seconds > 2 ? ` · ${seconds}s` : ''}. You can leave this page open in the background.
        </p>
      </div>
      {file && (
        <div className="h-[28rem] overflow-hidden rounded-xl border border-slate-200 bg-slate-50 p-3">
          <DocumentPreview file={file} />
        </div>
      )}
    </div>
  )
}

function Failed({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Alert>{message}</Alert>
      <div className="flex gap-3">
        <Button onClick={onRetry}>Try another file</Button>
        <Link
          to="/bills/new"
          className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
        >
          Enter by hand
        </Link>
      </div>
    </div>
  )
}

function Review({
  extraction,
  result,
  file,
  onSaved,
  onCancel,
  onStartOver,
}: {
  extraction: BillExtraction
  result: ExtractionResult
  file: File | null
  onSaved: (billId: number) => void
  onCancel: () => void
  onStartOver: () => void
}) {
  // Computed once: the form owns the values from here on.
  const [initialValues] = useState(() => extractionToFormValues(result, todayIso()))

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <aside className="space-y-3 xl:sticky xl:top-6 xl:self-start">
        <div className="flex h-[28rem] items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50 p-3 xl:h-[calc(100vh-10rem)]">
          {file ? (
            <DocumentPreview file={file} />
          ) : (
            <p className="max-w-xs text-center text-sm text-slate-500">
              The preview of <span className="font-medium">{extraction.original_filename}</span> isn’t available after a
              reload. Open the file on your computer to compare.
            </p>
          )}
        </div>
        <p className="text-xs text-slate-400">
          Read by {extraction.model}
          {extraction.duration_ms ? ` in ${(extraction.duration_ms / 1000).toFixed(1)}s` : ''} ·{' '}
          <button type="button" onClick={onStartOver} className="text-brand-700 hover:underline">
            Upload a different file
          </button>
        </p>
      </aside>

      <div className="space-y-4">
        <ReviewSummary extraction={extraction} />
        <BillForm
          bill={null}
          initialValues={initialValues}
          warnings={extraction.warnings}
          printedTotal={result.document_totals.total}
          onSaved={(bill) => onSaved(bill.id)}
          onCancel={onCancel}
        />
      </div>
    </div>
  )
}

/** Everything to double-check, in one list; the same notes also appear on their fields. */
function ReviewSummary({ extraction }: { extraction: BillExtraction }) {
  const { warnings, result } = extraction

  if (warnings.length === 0) {
    return <Alert tone="info">Everything read cleanly and the totals add up. Still give it a quick look before saving.</Alert>
  }

  return (
    <Alert tone="warning">
      <p className="font-medium">Please check {warnings.length === 1 ? 'this' : `these ${warnings.length} things`} before saving:</p>
      <ul className="mt-1.5 list-disc space-y-0.5 pl-5">
        {warnings.map((warning, index) => (
          <li key={index}>
            <span className="font-medium">{warningLabel(warning.field)}:</span> {warning.message}
            {warning.field === 'supplier_invoice_number' && result?.duplicate_bill_id && (
              <>
                {' '}
                <Link to={`/bills/${result.duplicate_bill_id}`} className="underline">
                  View the existing bill
                </Link>
              </>
            )}
          </li>
        ))}
      </ul>
    </Alert>
  )
}

function useSecondsSince(iso: string): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])
  return Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000))
}
