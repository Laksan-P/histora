import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from './supabaseClient'
import {
  AuthContext,
  type AuthResult,
  type AuthState,
  type Profile,
  type ProfileRole,
  type ProfileUpdate,
  type SignUpDetails,
} from './authContext'

type ProfileRow = {
  id: string
  email: string | null
  role: string | null
  full_name: string | null
  username: string | null
  country: string | null
  usage_type: string | null
  favorite_history: string | null
  avatar_url: string | null
  bio: string | null
  created_at: string
  updated_at: string | null
}

const PROFILE_COLUMNS =
  'id, email, role, full_name, username, country, usage_type, favorite_history, avatar_url, bio, created_at, updated_at'

function nullIfBlank(value: string | null | undefined): string | null {
  if (value == null) return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function coerceRole(value: string | null | undefined): ProfileRole {
  return value === 'admin' ? 'admin' : 'user'
}

/**
 * Normalize email for the underlying Supabase auth lookup. Supabase auth
 * itself is case-insensitive (it stores `auth.users.email` lowercased),
 * so we always send the lowercased form to `signInWithPassword` /
 * `signUp`. Case-sensitivity is enforced separately at sign-in time by
 * comparing the user-typed email against the original-case copy we
 * preserve in `profiles.email` and `user_metadata.original_email`.
 */
function normalizeAuthEmail(email: string): string {
  return email.trim().toLowerCase()
}

/** Trim whitespace but preserve casing — what the user actually typed. */
function preserveCaseEmail(email: string): string {
  return email.trim()
}

/**
 * Pull the original-case email the user signed up with from Supabase user
 * metadata. We store this in `options.data.original_email` during signup
 * so the case-sensitive check works even if the user verifies on a
 * different device and the profile row is created lazily later.
 */
function getOriginalEmailFromUser(user: User): string | null {
  const meta = user.user_metadata as { original_email?: unknown } | null
  if (!meta) return null
  const value = meta.original_email
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function mapProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    // Profile email is preserved with original case so it round-trips
    // back to the UI exactly as the user typed it at signup.
    email: row.email ? preserveCaseEmail(row.email) : null,
    role: coerceRole(row.role),
    fullName: row.full_name,
    username: row.username,
    country: row.country,
    usageType: row.usage_type,
    favoriteHistory: row.favorite_history,
    avatarUrl: row.avatar_url,
    bio: row.bio,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/**
 * Fetch the caller's profile row. If the row is missing — e.g. an existing
 * Supabase user who signed up before Phase 2 shipped — we lazily insert one
 * with role='user'. The RLS policy `profiles self insert` enforces that the
 * role cannot be elevated from the client.
 */
/**
 * Pull any extended signup metadata that was stashed on the auth user at
 * signup time (full_name / username / country / usage_type /
 * favorite_history / avatar_url). This is what lets us seed the profile
 * row with rich data even when email confirmation is required and the
 * profile has to be created lazily on first sign-in.
 */
function getSignupMetadataFromUser(user: User) {
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>
  const readString = (key: string): string | null => {
    const raw = meta[key]
    if (typeof raw !== 'string') return null
    const trimmed = raw.trim()
    return trimmed.length > 0 ? trimmed : null
  }
  return {
    fullName: readString('full_name'),
    username: readString('username'),
    country: readString('country'),
    usageType: readString('usage_type'),
    favoriteHistory: readString('favorite_history'),
    avatarUrl: readString('avatar_url'),
  }
}

async function loadOrCreateProfile(user: User): Promise<Profile | null> {
  if (!supabase) return null

  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('id', user.id)
    .maybeSingle<ProfileRow>()

  if (error) {
    console.error('[histora] could not load profile:', error.message)
    return null
  }
  if (data) return mapProfile(data)

  // First-time profile creation. Prefer the original-case email captured
  // in user metadata at signup — that's what the user actually typed —
  // and only fall back to `user.email` (which Supabase stores lowercased)
  // for legacy accounts created before this column existed.
  const originalEmail = getOriginalEmailFromUser(user)
  const profileEmail =
    originalEmail ?? (user.email ? preserveCaseEmail(user.email) : null)
  const seed = getSignupMetadataFromUser(user)

  const { data: created, error: insertError } = await supabase
    .from('profiles')
    .insert({
      id: user.id,
      email: profileEmail,
      role: 'user',
      full_name: seed.fullName,
      username: seed.username,
      country: seed.country,
      usage_type: seed.usageType,
      favorite_history: seed.favoriteHistory,
      avatar_url: seed.avatarUrl,
    })
    .select(PROFILE_COLUMNS)
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

/**
 * Translate raw Supabase auth errors to the messages the spec calls for.
 * We deliberately collapse "wrong email" and "wrong password" into the
 * same string so the login form doesn't help with account enumeration.
 */
function mapSignInError(message: string): string {
  const lower = message.toLowerCase()
  if (
    lower.includes('invalid login credentials') ||
    lower.includes('invalid_credentials') ||
    lower.includes('user not found') ||
    lower.includes('email not registered')
  ) {
    return 'Incorrect email or password.'
  }
  if (
    lower.includes('email not confirmed') ||
    lower.includes('email_not_confirmed')
  ) {
    return 'Please confirm your email address before signing in.'
  }
  if (lower.includes('too many requests') || lower.includes('rate limit')) {
    return 'Too many sign-in attempts. Please wait a moment and try again.'
  }
  return message.trim() || 'Could not sign in.'
}

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(
    supabase ? { status: 'loading' } : { status: 'unavailable' },
  )

  // Hold a stable ref to the currently observed user id so onAuthStateChange
  // callbacks can ignore stale events that arrive after a faster sign-out /
  // sign-in flip.
  const activeUserIdRef = useRef<string | null>(null)
  // While true, the auth listener is muted: signIn drives every state
  // transition itself so the case-sensitive verification can complete
  // before we ever flash the signed-in dashboard. Without this guard
  // Supabase fires SIGNED_IN the instant the password matches, which
  // briefly flips us into HistoraApp before we can validate the email
  // casing and sign the user back out.
  const verificationInFlightRef = useRef<boolean>(false)

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

    // Prefer profile.email (already case-preserved). If that's missing,
    // fall back to the original-case email captured in user metadata at
    // signup, then to the lowercased Supabase email as a last resort so
    // legacy accounts still surface something usable.
    const fallbackEmail =
      getOriginalEmailFromUser(user) ??
      (user.email ? preserveCaseEmail(user.email) : null)

    setState({
      status: 'signed-in',
      userId: user.id,
      email: profile.email ?? fallbackEmail,
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
        // While signIn is mid-verification, ignore the SIGNED_IN /
        // SIGNED_OUT it emits — signIn will applySession (or set
        // 'signed-out') itself once the case check finishes. This is
        // what prevents the dashboard from flickering for users who
        // typed the wrong email casing.
        if (verificationInFlightRef.current) return
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
      const typedEmail = preserveCaseEmail(email)
      const normalizedEmail = normalizeAuthEmail(email)

      // Mute the auth listener and flip into 'verifying' BEFORE Supabase
      // ever emits SIGNED_IN. This is the contract that protects against
      // the flicker: while this ref is true, nothing else can promote
      // the auth state to 'signed-in'.
      verificationInFlightRef.current = true
      setState({ status: 'verifying' })

      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        })
        if (error) {
          // Wrong email or wrong password both surface here. Spec wants
          // a single, non-leaking message.
          return { ok: false, error: mapSignInError(error.message) }
        }

        const signedInUser = data.user
        if (!signedInUser || !data.session) {
          return { ok: false, error: 'Incorrect email or password.' }
        }

        // Resolve the canonical signup email. Prefer the user-metadata
        // copy (set on every fresh signup, roams across devices), then
        // the profiles row. Admins and regular users go through the
        // same path — both must type the email with the exact same
        // casing as the stored value or the login is rejected.
        let storedEmail = getOriginalEmailFromUser(signedInUser)
        if (!storedEmail) {
          const { data: profileRow, error: profileError } = await supabase
            .from('profiles')
            .select('email')
            .eq('id', signedInUser.id)
            .maybeSingle<{ email: string | null }>()
          if (profileError) {
            console.warn(
              '[histora] could not verify email casing from profiles:',
              profileError.message,
            )
          }
          storedEmail = profileRow?.email
            ? preserveCaseEmail(profileRow.email)
            : null
        }

        if (storedEmail && storedEmail !== typedEmail) {
          // Case mismatch. We must:
          //   1. Sign the user out so the Supabase session is wiped.
          //   2. Keep the listener muted so the SIGNED_OUT event it
          //      fires doesn't race with our explicit state update in
          //      the `finally` block below.
          //   3. Return ok:false with the case-sensitive message.
          await supabase.auth.signOut()
          activeUserIdRef.current = null
          return {
            ok: false,
            error:
              'Email is case-sensitive. Please use the exact email you signed up with.',
          }
        }

        // Casing matches — now it's safe to release the listener guard
        // and apply the session ourselves so the transition straight
        // to 'signed-in' is atomic from the UI's point of view.
        verificationInFlightRef.current = false
        await applySession(data.session)
        return { ok: true }
      } catch (caught) {
        console.error('[histora] sign-in failed:', caught)
        return {
          ok: false,
          error:
            caught instanceof Error
              ? caught.message
              : 'Could not sign in.',
        }
      } finally {
        // If we returned through any error branch the verification ref
        // is still true here — drop it and snap back to 'signed-out' so
        // App.tsx re-mounts AuthGate and the user can retry. On the
        // happy path we already cleared the ref above and applySession
        // moved us to 'signed-in', so this block is a no-op.
        if (verificationInFlightRef.current) {
          verificationInFlightRef.current = false
          activeUserIdRef.current = null
          setState({ status: 'signed-out' })
        }
      }
    },
    [applySession],
  )

  const signUp = useCallback(
    async (
      email: string,
      password: string,
      details: SignUpDetails,
    ): Promise<AuthResult> => {
      if (!supabase) {
        return { ok: false, error: 'Authentication is not configured.' }
      }
      if (!details.acceptedTerms) {
        return {
          ok: false,
          error: 'Please accept the Terms & Consent before creating an account.',
        }
      }
      const typedEmail = preserveCaseEmail(email)
      const normalizedEmail = normalizeAuthEmail(email)

      const fullName = nullIfBlank(details.fullName)
      const username = nullIfBlank(details.username)
      const country = nullIfBlank(details.country ?? null)
      const usageType = nullIfBlank(details.usageType ?? null)
      const favoriteHistory = nullIfBlank(details.favoriteHistory ?? null)
      const avatarUrl = nullIfBlank(details.avatarUrl ?? null)

      // Stash the user-typed email exactly as entered in user metadata so
      // every device (and the lazy profile creation path) can recover the
      // original case after email confirmation. The lowercased form is
      // what Supabase actually stores in `auth.users.email`. The other
      // fields are stashed too so the profile row can be lazily seeded
      // with the right data on first sign-in even if confirmation is on.
      const { data, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          data: {
            original_email: typedEmail,
            full_name: fullName,
            username,
            country,
            usage_type: usageType,
            favorite_history: favoriteHistory,
            avatar_url: avatarUrl,
          },
        },
      })
      if (error) {
        return { ok: false, error: describeAuthError(error, 'Could not sign up.') }
      }

      // Eagerly seed the profile row so the first session load doesn't have
      // to round-trip through `loadOrCreateProfile`. If a session already
      // exists (auto-confirm enabled) the upsert succeeds immediately;
      // otherwise the user must verify their email and the row gets created
      // on first sign-in instead — at which point `loadOrCreateProfile`
      // pulls the original case from `user_metadata.original_email`.
      if (data.user && data.session) {
        const { error: insertError } = await supabase
          .from('profiles')
          .insert({
            id: data.user.id,
            email: typedEmail,
            role: 'user',
            full_name: fullName,
            username,
            country,
            usage_type: usageType,
            favorite_history: favoriteHistory,
            avatar_url: avatarUrl,
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

  /**
   * Persist edits to the signed-in user's profile row. The `role` column is
   * deliberately not updatable from this path — the WITH CHECK clause on
   * the "profiles self update" policy would reject the write anyway, but
   * we strip the field client-side so the helper has a safer surface.
   */
  const updateProfile = useCallback(
    async (patch: ProfileUpdate): Promise<AuthResult> => {
      if (!supabase) {
        return { ok: false, error: 'Authentication is not configured.' }
      }
      // Build the row-shaped payload, preserving the "set to null" intent
      // when a caller explicitly passes null (e.g. clearing an avatar).
      const payload: Record<string, unknown> = {}
      if (patch.fullName !== undefined) payload.full_name = nullIfBlank(patch.fullName)
      if (patch.username !== undefined) payload.username = nullIfBlank(patch.username)
      if (patch.country !== undefined) payload.country = nullIfBlank(patch.country)
      if (patch.usageType !== undefined) payload.usage_type = nullIfBlank(patch.usageType)
      if (patch.favoriteHistory !== undefined)
        payload.favorite_history = nullIfBlank(patch.favoriteHistory)
      if (patch.avatarUrl !== undefined) payload.avatar_url = nullIfBlank(patch.avatarUrl)
      if (patch.bio !== undefined) payload.bio = nullIfBlank(patch.bio)

      if (Object.keys(payload).length === 0) {
        return { ok: true }
      }

      const userId = activeUserIdRef.current
      if (!userId) {
        return { ok: false, error: 'You are signed out. Please sign in again.' }
      }

      const { data, error } = await supabase
        .from('profiles')
        .update(payload)
        .eq('id', userId)
        .select(PROFILE_COLUMNS)
        .single<ProfileRow>()

      if (error) {
        return {
          ok: false,
          error: describeAuthError(error, 'Could not update profile.'),
        }
      }
      if (data) {
        const next = mapProfile(data)
        setState((prev) =>
          prev.status === 'signed-in' && prev.userId === userId
            ? { ...prev, profile: next }
            : prev,
        )
      }
      return { ok: true }
    },
    [],
  )

  const value = useMemo(
    () => ({ state, signIn, signUp, signOut, refreshProfile, updateProfile }),
    [state, signIn, signUp, signOut, refreshProfile, updateProfile],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
