import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { billKeys } from '../queryKeys'
import { fetchExtraction, fetchExtractionUsage, uploadForExtraction } from './api'
import type { BillExtraction } from './types'

export const POLL_INTERVAL_MS = 1500

export function useExtractionUsage() {
  return useQuery({ queryKey: billKeys.captureUsage(), queryFn: fetchExtractionUsage })
}

export function useUploadForExtraction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ file, onProgress }: { file: File; onProgress?: (percent: number) => void }) =>
      uploadForExtraction(file, onProgress),
    onSuccess: (extraction) => {
      queryClient.setQueryData(billKeys.extraction(extraction.id), extraction)
      return queryClient.invalidateQueries({ queryKey: billKeys.captureUsage() })
    },
    // A 429 (daily limit) also changes what's left.
    onError: () => queryClient.invalidateQueries({ queryKey: billKeys.captureUsage() }),
  })
}

const isWorking = (extraction: BillExtraction | undefined) =>
  extraction?.status === 'pending' || extraction?.status === 'processing'

/**
 * Polls while the queue worker reads the document, and stops by itself once
 * it has finished (refetchInterval returning false).
 */
export function useExtraction(id: string | null) {
  return useQuery({
    queryKey: billKeys.extraction(id ?? ''),
    queryFn: () => fetchExtraction(id as string),
    enabled: Boolean(id),
    refetchInterval: (query) => (isWorking(query.state.data) ? POLL_INTERVAL_MS : false),
    // Keep polling in a background tab too; it ends in seconds anyway.
    refetchIntervalInBackground: true,
    staleTime: Infinity,
  })
}
