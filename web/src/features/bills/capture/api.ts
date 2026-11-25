import { api, type ApiResource } from '@/lib/api'
import type { BillExtraction, ExtractionUsage } from './types'

export async function fetchExtractionUsage(): Promise<ExtractionUsage> {
  const { data } = await api.get<ApiResource<ExtractionUsage>>('/bill-extractions/usage')
  return data.data
}

/** Multipart upload; axios sets the boundary header itself for FormData. */
export async function uploadForExtraction(file: File, onProgress?: (percent: number) => void): Promise<BillExtraction> {
  const body = new FormData()
  body.append('file', file)
  const { data } = await api.post<ApiResource<BillExtraction>>('/bill-extractions', body, {
    onUploadProgress: (event) => {
      if (onProgress && event.total) onProgress(Math.round((event.loaded / event.total) * 100))
    },
  })
  return data.data
}

export async function fetchExtraction(id: string): Promise<BillExtraction> {
  const { data } = await api.get<ApiResource<BillExtraction>>(`/bill-extractions/${id}`)
  return data.data
}
