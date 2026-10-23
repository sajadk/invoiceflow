import { useQuery } from '@tanstack/react-query'
import { fetchHealth } from './api'

export const healthQueryKey = ['health'] as const

/**
 * Custom hook = Vue composable. Components call useHealth() and get
 * { data, isPending, isError, refetch, ... } without knowing about axios or caching.
 */
export function useHealth() {
  return useQuery({
    queryKey: healthQueryKey,
    queryFn: fetchHealth,
    refetchInterval: 30_000,
  })
}
