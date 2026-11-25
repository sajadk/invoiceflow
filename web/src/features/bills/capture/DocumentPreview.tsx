import { useEffect, useState } from 'react'

/**
 * Shows the uploaded file next to the form, straight from the browser's memory
 * (an object URL): the document is never downloaded back from the server, which
 * deletes it once read.
 */
export function DocumentPreview({ file }: { file: File }) {
  const url = useObjectUrl(file)
  if (!url) return null

  if (file.type === 'application/pdf') {
    return (
      <object data={url} type="application/pdf" aria-label={`Preview of ${file.name}`} className="h-full min-h-[32rem] w-full rounded-lg">
        <p className="p-4 text-sm text-slate-500">
          Your browser can’t show PDFs inline.{' '}
          <a href={url} target="_blank" rel="noreferrer" className="text-brand-700 underline">
            Open {file.name}
          </a>
        </p>
      </object>
    )
  }

  return <img src={url} alt={`Preview of ${file.name}`} className="mx-auto max-h-full w-auto rounded-lg object-contain" />
}

/** An object URL for the file, revoked when the file changes or the component unmounts (no memory leak). */
function useObjectUrl(file: File): string | null {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    const objectUrl = URL.createObjectURL(file)
    setUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [file])

  return url
}
