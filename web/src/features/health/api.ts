import { api } from '@/lib/api'

export type CheckStatus = 'ok' | 'unreachable'

export type HealthResponse = {
  status: 'ok' | 'degraded'
  app: string
  checks: {
    database: CheckStatus
  }
  timestamp: string
}

export async function fetchHealth(): Promise<HealthResponse> {
  // A 503 still carries a useful body, so treat it as data rather than an error.
  const { data } = await api.get<HealthResponse>('/health', {
    validateStatus: (status) => status === 200 || status === 503,
  })
  return data
}
