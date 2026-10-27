import axios from 'axios'

/** One message per field, e.g. { email: 'These credentials do not match our records.' } */
export type FieldErrors = Partial<Record<string, string>>

type LaravelErrorBody = {
  message?: string
  errors?: Record<string, string[]>
}

/** Turns Laravel's 422 response ({ errors: { field: [msg, ...] } }) into first-message-per-field. */
export function getFieldErrors(error: unknown): FieldErrors {
  if (!axios.isAxiosError<LaravelErrorBody>(error) || error.response?.status !== 422) {
    return {}
  }
  const errors = error.response?.data?.errors ?? {}
  return Object.fromEntries(
    Object.entries(errors).map(([field, messages]) => [field, messages[0]]),
  )
}

export function getErrorMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (axios.isAxiosError<LaravelErrorBody>(error)) {
    if (!error.response) return "Can't reach the server. Check that the API is running."
    return error.response.data?.message || fallback
  }
  return fallback
}
