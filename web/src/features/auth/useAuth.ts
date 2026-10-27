import { useContext } from 'react'
import { AuthContext } from './AuthContext'

/** Vue equivalent: const auth = inject(AuthKey) */
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth() must be used inside <AuthProvider>')
  }
  return context
}
