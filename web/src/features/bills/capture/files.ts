export const ACCEPTED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']

/** Checked in the browser for a quick answer; the API checks the real contents again. */
export function checkFile(file: File, maxFileKb: number): string | null {
  if (!ACCEPTED_TYPES.includes(file.type)) return 'Upload a PDF, JPG, PNG or WebP file.'
  if (file.size > maxFileKb * 1024) return `The file is too large. The limit is ${Math.round(maxFileKb / 1024)} MB.`
  return null
}
