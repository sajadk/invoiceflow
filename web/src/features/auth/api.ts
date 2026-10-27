import axios from 'axios'
import { api, ensureCsrfCookie, type ApiResource } from '@/lib/api'
import type { LoginPayload, RegisterPayload, User } from './types'

/** Returns the logged-in user, or null for guests (a 401 is an expected answer here, not an error). */
export async function fetchCurrentUser(): Promise<User | null> {
  try {
    const { data } = await api.get<ApiResource<User>>('/user')
    return data.data
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 401) return null
    throw error
  }
}

export async function loginRequest(payload: LoginPayload): Promise<User> {
  await ensureCsrfCookie()
  const { data } = await api.post<ApiResource<User>>('/login', payload)
  return data.data
}

export async function registerRequest(payload: RegisterPayload): Promise<User> {
  await ensureCsrfCookie()
  const { data } = await api.post<ApiResource<User>>('/register', payload)
  return data.data
}

export async function logoutRequest(): Promise<void> {
  try {
    await api.post('/logout')
  } catch (error) {
    // Session already expired: the user is logged out either way.
    if (axios.isAxiosError(error) && error.response?.status === 401) return
    throw error
  }
}
