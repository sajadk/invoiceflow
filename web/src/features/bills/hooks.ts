import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { dashboardKeys } from '@/features/dashboard/queryKeys'
import { createBill, deleteBill, fetchBill, fetchBills, runBillAction, updateBill } from './api'
import { billKeys } from './queryKeys'
import type { BillAction, BillDetail, BillListParams, BillPayload } from './types'

export function useBills(params: BillListParams) {
  return useQuery({
    queryKey: billKeys.list(params),
    queryFn: () => fetchBills(params),
    placeholderData: keepPreviousData,
  })
}

export function useBill(id: number) {
  return useQuery({
    queryKey: billKeys.detail(id),
    queryFn: () => fetchBill(id),
    enabled: Number.isInteger(id) && id > 0,
  })
}

/** Same pattern as invoices: the returned bill goes into its cache entry; lists and the VAT card refetch. */
function useWriteThrough() {
  const queryClient = useQueryClient()
  return (bill: BillDetail) => {
    queryClient.setQueryData(billKeys.detail(bill.id), bill)
    return Promise.all([
      queryClient.invalidateQueries({ queryKey: billKeys.lists() }),
      queryClient.invalidateQueries({ queryKey: dashboardKeys.all }),
    ])
  }
}

export function useCreateBill() {
  const writeThrough = useWriteThrough()
  return useMutation({ mutationFn: (payload: BillPayload) => createBill(payload), onSuccess: writeThrough })
}

export function useUpdateBill() {
  const writeThrough = useWriteThrough()
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: BillPayload }) => updateBill(id, payload),
    onSuccess: writeThrough,
  })
}

export function useBillAction() {
  const writeThrough = useWriteThrough()
  return useMutation({
    mutationFn: ({ id, action }: { id: number; action: BillAction }) => runBillAction(id, action),
    onSuccess: writeThrough,
  })
}

export function useDeleteBill() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => deleteBill(id),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: billKeys.lists() }),
        queryClient.invalidateQueries({ queryKey: dashboardKeys.all }),
      ]),
  })
}
