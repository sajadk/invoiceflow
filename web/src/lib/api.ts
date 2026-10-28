import axios, { type InternalAxiosRequestConfig } from 'axios'

/**
 * Single axios instance for the whole app.
 *
 * - baseURL '/api' works in dev (Vite proxy) and prod (CloudFront routes /api to Laravel).
 * - withCredentials + withXSRFToken send Sanctum's session cookie and copy the
 *   XSRF-TOKEN cookie into the X-XSRF-TOKEN header on every request.
 */
export const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  withXSRFToken: true,
  headers: {
    Accept: 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  },
})

/** Laravel API Resources wrap single models in { data: ... } */
export type ApiResource<T> = { data: T }

/** Shape of ResourceCollection::collection($paginator) */
export type Paginated<T> = {
  data: T[]
  meta: {
    current_page: number
    last_page: number
    per_page: number
    total: number
    from: number | null
    to: number | null
  }
}

/** Asks Laravel to set the XSRF-TOKEN cookie. Call before the first state-changing request. */
export async function ensureCsrfCookie(): Promise<void> {
  await api.get('/sanctum/csrf-cookie', { baseURL: '/' })
}

type RetriableConfig = InternalAxiosRequestConfig & { _csrfRetried?: boolean }

// 419 = CSRF token missing or expired (e.g. the tab sat open past the session lifetime).
// Fetch a fresh cookie and replay the request once, so the user never sees it.
api.interceptors.response.use(undefined, async (error: unknown) => {
  if (axios.isAxiosError(error) && error.response?.status === 419 && error.config) {
    const config = error.config as RetriableConfig
    if (!config._csrfRetried) {
      config._csrfRetried = true
      await ensureCsrfCookie()
      return api(config)
    }
  }
  return Promise.reject(error)
})
