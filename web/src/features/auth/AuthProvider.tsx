import { useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { useCallback, useEffect, useMemo, type ReactNode } from 'react'
import { api } from '@/lib/api'
import { AuthContext, type AuthContextValue } from './AuthContext'
import { fetchCurrentUser, loginRequest, logoutRequest, registerRequest } from './api'
import { authUserQueryKey } from './queryKeys'
import type { LoginPayload, RegisterPayload, User } from './types'

/**
 * The user lives in the TanStack Query cache (so it's fetched once and shared);
 * Context exposes it together with the login/register/logout actions.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()

  const { data: user, isPending } = useQuery({
    queryKey: authUserQueryKey,
    queryFn: fetchCurrentUser,
    staleTime: Infinity,
    retry: false,
  })

  // If any request comes back 401 (session expired), drop the user;
  // <ProtectedRoute> then redirects to /login. The cleanup function is
  // React's version of onUnmounted: it removes the interceptor again.
  useEffect(() => {
    const interceptorId = api.interceptors.response.use(undefined, (error: unknown) => {
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        queryClient.setQueryData(authUserQueryKey, null)
      }
      return Promise.reject(error)
    })
    return () => api.interceptors.response.eject(interceptorId)
  }, [queryClient])

  // useCallback keeps the same function identity between renders,
  // so components that receive these don't re-render needlessly.
  const login = useCallback(
    async (payload: LoginPayload): Promise<User> => {
      const loggedIn = await loginRequest(payload)
      queryClient.setQueryData(authUserQueryKey, loggedIn)
      return loggedIn
    },
    [queryClient],
  )

  const register = useCallback(
    async (payload: RegisterPayload): Promise<User> => {
      const created = await registerRequest(payload)
      queryClient.setQueryData(authUserQueryKey, created)
      return created
    },
    [queryClient],
  )

  const logout = useCallback(async () => {
    await logoutRequest()
    queryClient.setQueryData(authUserQueryKey, null)
    // Forget every other cached response so the next user never sees this user's data.
    queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== 'auth' })
  }, [queryClient])

  const value = useMemo<AuthContextValue>(
    () => ({ user: user ?? null, isLoading: isPending, login, register, logout }),
    [user, isPending, login, register, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
