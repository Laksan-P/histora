import { createContext } from 'react'

export type ProfileRole = 'user' | 'admin'

/**
 * Free-form usage_type label captured during signup. Stored as a plain
 * string so future categories can be added without a migration.
 */
export type ProfileUsageType =
  | 'student'
  | 'teacher'
  | 'researcher'
  | 'enthusiast'
  | 'other'
  | string

export type Profile = {
  id: string
  email: string | null
  role: ProfileRole
  fullName: string | null
  username: string | null
  country: string | null
  usageType: ProfileUsageType | null
  favoriteHistory: string | null
  avatarUrl: string | null
  bio: string | null
  createdAt: string
  updatedAt: string | null
}

/**
 * Extra fields collected on the new signup form. Email + password are kept
 * as positional arguments because the signin/signup contract for the auth
 * call has stayed the same.
 */
export type SignUpDetails = {
  fullName: string
  username: string
  country?: string | null
  usageType?: ProfileUsageType | null
  favoriteHistory?: string | null
  avatarUrl?: string | null
  acceptedTerms: boolean
}

/** Fields a regular user is allowed to update on their own profile. */
export type ProfileUpdate = {
  fullName?: string | null
  username?: string | null
  country?: string | null
  usageType?: ProfileUsageType | null
  favoriteHistory?: string | null
  avatarUrl?: string | null
  bio?: string | null
}

export type AuthState =
  | { status: 'loading' }
  | { status: 'unavailable' }
  | { status: 'signed-out' }
  /**
   * Transient state while a sign-in attempt is being checked. Includes
   * the Supabase auth round-trip *and* the case-sensitive email
   * verification step. App.tsx renders a dedicated loading screen for
   * this status so the dashboard never flashes before the user is
   * actually allowed in.
   */
  | { status: 'verifying' }
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
  signUp: (
    email: string,
    password: string,
    details: SignUpDetails,
  ) => Promise<AuthResult>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
  updateProfile: (patch: ProfileUpdate) => Promise<AuthResult>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
