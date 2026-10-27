export type User = {
  id: number
  name: string
  email: string
  created_at: string
}

export type LoginPayload = {
  email: string
  password: string
  remember: boolean
}

export type RegisterPayload = {
  name: string
  email: string
  password: string
  password_confirmation: string
}
