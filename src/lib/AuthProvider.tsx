import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from './supabaseClient'
import {
  AuthContext,
  type AuthResult,
  type AuthState,
  type Profile,
  type ProfileRole,
} from './authContext'

type ProfileRow = {
  id: string
  email: string | null
  role: string | null
  created_at: string
}

function coerceRole(value: string | null | undefined): ProfileRole {
  return value === 'admin' ? 'admin' : 'user'
}

/** Normalize email for Auth + profiles: trim + lowercase (Supabase treats login case-insensitively). */
function normalizeAuthEmail(email: string): string {
  return email.trim().toLowerCase()
}

function mapProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    email: row.email ? normalizeAuthEmail(row.email) : null,
    role: coerceRole(row.role),
    createdAt: row.created_at,
  }
}

/**
 * Fetch the caller's profile row. If the row is missing — e.g. an existing
 * Supabase user who signed up before Phase 2 shipped — we lazily insert one
 * with role='user'. The RLS policy `profiles self insert` enforces that the
 * role cannot be elevated from the client.
 */
async function loadOrCreateProfile(user: User): Promise<Profile | null> {
  if (!supabase) return null

  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, role, created_at')
    .eq('id', user.id)
    .maybeSingle<ProfileRow>()

  if (error) {
    console.error('[histora] could not load profile:', error.message)
    return null
  }
  if (data) return mapProfile(data)

  const { data: created, error: insertError } = await supabase
    .from('profiles')
    .insert({
      id: user.id,
      email: user.email ? normalizeAuthEmail(user.email) : null,
      role: 'user',
    })
    .select('id, email, role, created_at')
    .single<ProfileRow>()

  if (insertError) {
    console.error('[histora] could not create profile:', insertError.message)
    return null
  }
  return created ? mapProfile(created) : null
}

function describeAuthError(error: unknown, fallback: string): string {
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message
    if (typeof message === 'string' && message.trim().length > 0) {
      return message
    }
  }
  return fallback
}

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(
    supabase ? { status: 'loading' } : { status: 'unavailable' },
  )

  // Hold a stable ref to the currently observed user id so onAuthStateChange
  // callbacks can ignore stale events that arrive after a faster sign-out /
  // sign-in flip.
  const activeUserIdRef = useRef<string | null>(null)

  const applySession = useCallback(async (session: Session | null) => {
    if (!session?.user) {
      activeUserIdRef.current = null
      setState({ status: 'signed-out' })
      return
    }
    const user = session.user
    activeUserIdRef.current = user.id
    const profile = await loadOrCreateProfile(user)
    if (activeUserIdRef.current !== user.id) return

    if (!profile) {
      // Profile could not be loaded or created — surface as signed-out so the
      // user can retry. The error has already been logged above.
      setState({ status: 'signed-out' })
      return
    }

    setState({
      status: 'signed-in',
      userId: user.id,
      email: profile.email ?? (user.email ? normalizeAuthEmail(user.email) : null),
      profile,
    })
  }, [])

  useEffect(() => {
    if (!supabase) return

    let cancelled = false

    void (async () => {
      const { data, error } = await supabase!.auth.getSession()
      if (cancelled) return
      if (error) {
        console.error('[histora] could not restore session:', error.message)
        setState({ status: 'signed-out' })
        return
      }
      await applySession(data.session)
    })()

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (cancelled) return
        void applySession(session)
      },
    )

    return () => {
      cancelled = true
      subscription.subscription.unsubscribe()
    }
  }, [applySession])

  const signIn = useCallback(
    async (email: string, password: string): Promise<AuthResult> => {
      if (!supabase) {
        return { ok: false, error: 'Authentication is not configured.' }
      }
      const normalizedEmail = normalizeAuthEmail(email)
      const { error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      })
      if (error) {
        return { ok: false, error: describeAuthError(error, 'Could not sign in.') }
      }
      return { ok: true }
    },
    [],
  )

  const signUp = useCallback(
    async (email: string, password: string): Promise<AuthResult> => {
      if (!supabase) {
        return { ok: false, error: 'Authentication is not configured.' }
      }
      const normalizedEmail = normalizeAuthEmail(email)
      const { data, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
      })
      if (error) {
        return { ok: false, error: describeAuthError(error, 'Could not sign up.') }
      }

      // Eagerly seed the profile row so the first session load doesn't have
      // to round-trip through `loadOrCreateProfile`. If a session already
      // exists (auto-confirm enabled) the upsert succeeds immediately;
      // otherwise the user must verify their email and the row gets created
      // on first sign-in instead.
      if (data.user && data.session) {
        const { error: insertError } = await supabase
          .from('profiles')
          .insert({
            id: data.user.id,
            email: normalizedEmail,
            role: 'user',
          })
        // 23505 = unique_violation, harmless if the row already exists.
        if (
          insertError &&
          'code' in insertError &&
          (insertError as { code?: string }).code !== '23505'
        ) {
          console.warn(
            '[histora] could not pre-create profile on signup:',
            insertError.message,
          )
        }
      }

      return { ok: true }
    },
    [],
  )

  const signOut = useCallback(async () => {
    if (!supabase) return
    const { error } = await supabase.auth.signOut()
    if (error) {
      console.error('[histora] sign out failed:', error.message)
    }
    activeUserIdRef.current = null
    setState({ status: 'signed-out' })
  }, [])

  const refreshProfile = useCallback(async () => {
    if (!supabase) return
    const { data } = await supabase.auth.getUser()
    if (!data.user) return
    const profile = await loadOrCreateProfile(data.user)
    if (!profile) return
    setState((prev) =>
      prev.status === 'signed-in' && prev.userId === data.user!.id
        ? { ...prev, profile }
        : prev,
    )
  }, [])

  const value = useMemo(
    () => ({ state, signIn, signUp, signOut, refreshProfile }),
    [state, signIn, signUp, signOut, refreshProfile],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
