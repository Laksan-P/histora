import { createContext } from 'react'

export type ProfileRole = 'user' | 'admin'

export type Profile = {
  id: string
  email: string | null
  role: ProfileRole
  createdAt: string
}

export type AuthState =
  | { status: 'loading' }
  | { status: 'unavailable' }
  | { status: 'signed-out' }
  | {
      status: 'signed-in'
      userId: string
      email: string | null
      profile: Profile
    }

export type AuthResult =
  | { ok: true }
  | { ok: false; error: string }

export type AuthContextValue = {
  state: AuthState
  signIn: (email: string, password: string) => Promise<AuthResult>
  signUp: (email: string, password: string) => Promise<AuthResult>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
