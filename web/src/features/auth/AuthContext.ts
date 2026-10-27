import { createContext } from 'react'
import type { LoginPayload, RegisterPayload, User } from './types'

export type AuthContextValue = {
  /** null = guest. Only meaningful once isLoading is false. */
  user: User | null
  /** True while the initial "who am I?" request is in flight. */
  isLoading: boolean
  login: (payload: LoginPayload) => Promise<User>
  register: (payload: RegisterPayload) => Promise<User>
  logout: () => Promise<void>
}

// Like Vue's provide/inject key. The default is null so useAuth() can detect a missing provider.
export const AuthContext = createContext<AuthContextValue | null>(null)
