import axios from 'axios'

/**
 * Single axios instance for the whole app.
 *
 * - baseURL '/api' works in dev (Vite proxy) and prod (CloudFront routes /api to Laravel).
 * - withCredentials + withXSRFToken let Sanctum's session and XSRF-TOKEN cookies
 *   travel with every request. Auth wiring lands in milestone 2.
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
