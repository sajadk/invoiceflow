import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { dashboardKeys } from './queryKeys'
import type { DashboardSummary } from './types'

async function fetchDashboard(): Promise<DashboardSummary> {
  const { data } = await api.get<{ data: DashboardSummary }>('/dashboard')
  return data.data
}

export function useDashboard() {
  return useQuery({
    queryKey: dashboardKeys.all,
    queryFn: fetchDashboard,
    // Invoice and payment mutations invalidate this, so it can be cached for a while.
    staleTime: 5 * 60_000,
  })
}
