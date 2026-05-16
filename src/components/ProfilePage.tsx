import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowLeft,
  BookOpenText,
  Calendar,
  Camera,
  Crown,
  Loader2,
  MapPin,
  MessageSquareQuote,
  Save,
  ShieldCheck,
  Sparkles,
  User as UserIcon,
  Users,
  X,
} from 'lucide-react'
import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
} from 'react'
import AuroraBackground from './AuroraBackground'
import UserAvatar from './UserAvatar'
import { uploadAvatar } from '../lib/avatarStorage'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/useAuth'
import { useToast } from '../lib/useToast'
import { cn } from '../lib/cn'
import type { Profile, ProfileUsageType } from '../lib/authContext'

type ProfilePageProps = {
  profile: Profile
  userEmail: string | null
  isAdmin: boolean
  onBack: () => void
  onOpenAdmin?: () => void
  onSignOut?: () => void
}

const USAGE_OPTIONS: Array<{ value: ProfileUsageType; label: string }> = [
  { value: 'student', label: 'Student' },
  { value: 'teacher', label: 'Teacher' },
  { value: 'researcher', label: 'Researcher' },
  { value: 'enthusiast', label: 'History enthusiast' },
  { value: 'other', label: 'Other' },
]

const PRESET_USAGE_VALUES = new Set<ProfileUsageType>([
  'student',
  'teacher',
  'researcher',
  'enthusiast',
  'other',
])

/**
 * Split the stored `usage_type` string into the dropdown selection plus
 * the free-text value the "Other" branch shows. If the stored value is
 * one of the known presets we use it directly and clear the free text;
 * otherwise it's a custom string the user typed when they picked Other,
 * so we surface it in the input and pin the dropdown to "other".
 */
function deriveUsageState(stored: string | null | undefined): {
  preset: ProfileUsageType
  other: string
} {
  if (!stored) return { preset: 'student', other: '' }
  const trimmed = stored.trim()
  if (!trimmed) return { preset: 'student', other: '' }
  if (PRESET_USAGE_VALUES.has(trimmed as ProfileUsageType)) {
    return { preset: trimmed as ProfileUsageType, other: '' }
  }
  return { preset: 'other', other: trimmed }
}

const USERNAME_PATTERN = /^[a-zA-Z0-9_.-]{3,32}$/

function formatDate(value: string | null | undefined): string {
  if (!value) return 'Unknown'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return 'Unknown'
  return parsed.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function usageLabel(value: string | null | undefined): string {
  if (!value) return 'Member'
  const found = USAGE_OPTIONS.find((option) => option.value === value)
  if (found) return found.label
  return value.charAt(0).toUpperCase() + value.slice(1)
}

type ActivityStats = {
  loading: boolean
  conversations: number
  messages: number
  lastConversationTitle: string | null
  lastConversationAt: string | null
}

const INITIAL_STATS: ActivityStats = {
  loading: true,
  conversations: 0,
  messages: 0,
  lastConversationTitle: null,
  lastConversationAt: null,
}

export default function ProfilePage({
  profile,
  userEmail,
  isAdmin,
  onBack,
  onOpenAdmin,
  onSignOut,
}: ProfilePageProps) {
  const { updateProfile } = useAuth()
  const { showToast } = useToast()

  const [isEditing, setIsEditing] = useState(false)
  const [savingProfile, setSavingProfile] = useState(false)
  const [savingAvatar, setSavingAvatar] = useState(false)
  // When Supabase is not configured we want the activity tile to render
  // its empty state immediately. Otherwise it starts in `loading` and the
  // effect below replaces it once the queries resolve.
  const [activity, setActivity] = useState<ActivityStats>(() =>
    supabase
      ? INITIAL_STATS
      : {
          loading: false,
          conversations: 0,
          messages: 0,
          lastConversationTitle: null,
          lastConversationAt: null,
        },
  )

  // Editable state — initialised from the live profile and reset whenever
  // the user opens or cancels the edit form. Strings are nullable-empty so
  // controlled inputs always have a string value.
  const initialUsage = deriveUsageState(profile.usageType ?? null)
  const [fullName, setFullName] = useState(profile.fullName ?? '')
  const [username, setUsername] = useState(profile.username ?? '')
  const [country, setCountry] = useState(profile.country ?? '')
  const [usageType, setUsageType] = useState<ProfileUsageType>(initialUsage.preset)
  // Free-text follow-up shown when the dropdown is set to "Other". On
  // save we collapse this back into a single string for `usage_type`.
  const [usageTypeOther, setUsageTypeOther] = useState(initialUsage.other)
  const [favoriteHistory, setFavoriteHistory] = useState(
    profile.favoriteHistory ?? '',
  )
  const [bio, setBio] = useState(profile.bio ?? '')
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // Reset all editable fields whenever a fresh profile row arrives (e.g.
  // after a successful save the parent re-renders with the new profile).
  // We use the render-time reconciliation pattern — comparing the current
  // profile version against a tracked version held in state — so we don't
  // trip the `react-hooks/set-state-in-effect` lint rule.
  const profileVersion = `${profile.id}::${profile.updatedAt ?? profile.createdAt}`
  const [trackedProfileVersion, setTrackedProfileVersion] =
    useState(profileVersion)
  if (profileVersion !== trackedProfileVersion) {
    setTrackedProfileVersion(profileVersion)
    setFullName(profile.fullName ?? '')
    setUsername(profile.username ?? '')
    setCountry(profile.country ?? '')
    const nextUsage = deriveUsageState(profile.usageType ?? null)
    setUsageType(nextUsage.preset)
    setUsageTypeOther(nextUsage.other)
    setFavoriteHistory(profile.favoriteHistory ?? '')
    setBio(profile.bio ?? '')
  }

  // Fetch lightweight activity stats for the dashboard header.
  useEffect(() => {
    if (!supabase) return
    let cancelled = false

    void (async () => {
      try {
        const [convoCount, latestConvo] = await Promise.all([
          supabase!
            .from('conversations')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', profile.id),
          supabase!
            .from('conversations')
            .select('id, title, updated_at')
            .eq('user_id', profile.id)
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle<{
              id: string
              title: string | null
              updated_at: string | null
            }>(),
        ])

        let messageCount = 0
        const convoId = latestConvo.data?.id
        if (convoCount.count != null) {
          // Fetch the message count via a join filter. We can't easily
          // join from REST, so we count messages whose conversation is
          // owned by this user. Falling back to per-conversation counts
          // would be heavier; the RLS already restricts to owner rows.
          const { data: convoIds } = await supabase!
            .from('conversations')
            .select('id')
            .eq('user_id', profile.id)
          const ids = (convoIds ?? []).map((row) => row.id as string)
          if (ids.length > 0) {
            const { count } = await supabase!
              .from('conversation_messages')
              .select('id', { count: 'exact', head: true })
              .in('conversation_id', ids)
            messageCount = count ?? 0
          }
        }

        if (cancelled) return
        setActivity({
          loading: false,
          conversations: convoCount.count ?? 0,
          messages: messageCount,
          lastConversationTitle:
            latestConvo.data?.title?.trim() && convoId
              ? latestConvo.data.title.trim()
              : null,
          lastConversationAt: latestConvo.data?.updated_at ?? null,
        })
      } catch (error) {
        if (cancelled) return
        console.warn('[histora] could not load profile activity:', error)
        setActivity({
          loading: false,
          conversations: 0,
          messages: 0,
          lastConversationTitle: null,
          lastConversationAt: null,
        })
      }
    })()

    return () => {
      cancelled = true
    }
  }, [profile.id])

  const beginEdit = () => {
    setIsEditing(true)
  }

  const cancelEdit = () => {
    setIsEditing(false)
    setFullName(profile.fullName ?? '')
    setUsername(profile.username ?? '')
    setCountry(profile.country ?? '')
    const nextUsage = deriveUsageState(profile.usageType ?? null)
    setUsageType(nextUsage.preset)
    setUsageTypeOther(nextUsage.other)
    setFavoriteHistory(profile.favoriteHistory ?? '')
    setBio(profile.bio ?? '')
  }

  const handleAvatarPick = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      showToast('error', 'Please choose an image file for your avatar.')
      return
    }
    if (file.size > 4 * 1024 * 1024) {
      showToast('error', 'Avatar image must be under 4 MB.')
      return
    }
    setSavingAvatar(true)
    try {
      const upload = await uploadAvatar(profile.id, file)
      if (upload.ok === false) {
        const reason: string = upload.error
        showToast('error', reason)
        return
      }
      const result = await updateProfile({ avatarUrl: upload.publicUrl })
      if (result.ok === false) {
        const reason: string = result.error
        showToast('error', reason)
        return
      }
      showToast('success', 'Avatar updated.')
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Could not update avatar.'
      showToast('error', message)
    } finally {
      setSavingAvatar(false)
    }
  }

  const handleRemoveAvatar = async () => {
    if (!profile.avatarUrl) return
    setSavingAvatar(true)
    try {
      const result = await updateProfile({ avatarUrl: null })
      if (result.ok === false) {
        const reason: string = result.error
        showToast('error', reason)
        return
      }
      showToast('success', 'Avatar removed.')
    } finally {
      setSavingAvatar(false)
    }
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (savingProfile) return

    const trimmedName = fullName.trim()
    const trimmedUsername = username.trim()
    if (!trimmedName) {
      showToast('error', 'Full name cannot be empty.')
      return
    }
    if (!trimmedUsername) {
      showToast('error', 'Username cannot be empty.')
      return
    }
    if (!USERNAME_PATTERN.test(trimmedUsername)) {
      showToast(
        'error',
        'Username must be 3–32 characters: letters, numbers, dot, underscore, or dash.',
      )
      return
    }

    setSavingProfile(true)
    // Collapse the dropdown + free-text Other field back into a single
    // string for the `usage_type` column. If the user picked "Other" but
    // didn't describe it, persist the literal sentinel so the dropdown
    // round-trips correctly on next load.
    const trimmedOtherUsage = usageTypeOther.trim()
    const resolvedUsageType =
      usageType === 'other' && trimmedOtherUsage.length > 0
        ? trimmedOtherUsage
        : usageType

    try {
      const result = await updateProfile({
        fullName: trimmedName,
        username: trimmedUsername,
        country: country.trim(),
        usageType: resolvedUsageType,
        favoriteHistory: favoriteHistory.trim(),
        bio: bio.trim(),
      })
      if (result.ok === false) {
        const reason: string = result.error
        showToast('error', reason)
        return
      }
      showToast('success', 'Profile saved.')
      setIsEditing(false)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Could not save profile.'
      showToast('error', message)
    } finally {
      setSavingProfile(false)
    }
  }

  const displayEmail = profile.email ?? userEmail
  const displayName = profile.fullName ?? profile.username ?? displayEmail

  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      <AuroraBackground />

      <header className="relative z-20 mx-auto flex w-full min-w-0 max-w-5xl items-center justify-between gap-3 px-4 py-4 sm:px-8 sm:py-6">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-full border border-(--border-soft) bg-(--surface) px-3 py-1.5 text-xs font-semibold text-(--text-primary) transition hover:border-(--accent)/50 hover:text-(--accent)"
        >
          <ArrowLeft size={14} />
          Back to Histora
        </button>
        <div className="flex items-center gap-2">
          {isAdmin && onOpenAdmin ? (
            <button
              type="button"
              onClick={onOpenAdmin}
              className="hidden items-center gap-2 rounded-full border border-(--accent)/40 bg-(--accent-soft) px-3 py-1.5 text-xs font-semibold text-(--accent) transition hover:border-(--accent) sm:inline-flex"
            >
              <Crown size={13} />
              Admin
            </button>
          ) : null}
          {onSignOut ? (
            <button
              type="button"
              onClick={onSignOut}
              className="inline-flex items-center gap-2 rounded-full border border-(--border-soft) bg-(--surface) px-3 py-1.5 text-xs font-semibold text-(--text-primary) transition hover:border-rose-400/50 hover:text-rose-300"
            >
              Sign out
            </button>
          ) : null}
        </div>
      </header>

      <main className="relative z-10 mx-auto flex w-full min-w-0 max-w-5xl flex-col gap-8 px-4 pb-16 sm:px-8">
        {/* Hero header */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55 }}
          className="glass-strong relative overflow-hidden rounded-3xl p-6 sm:p-8"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-(--accent)/20 blur-3xl"
          />

          <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center">
            <div className="relative">
              <UserAvatar
                src={profile.avatarUrl}
                fullName={profile.fullName}
                username={profile.username}
                email={displayEmail}
                size="2xl"
                ringed
                eager
                alt={`${displayName ?? 'Histora'} avatar`}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={savingAvatar}
                className="absolute -bottom-1 -right-1 inline-flex items-center justify-center rounded-full border border-(--border-soft) bg-(--surface-strong) p-2 shadow transition hover:border-(--accent)/60 hover:text-(--accent) disabled:cursor-not-allowed disabled:opacity-60"
                aria-label="Change avatar"
              >
                {savingAvatar ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Camera size={14} />
                )}
              </button>
              {profile.avatarUrl ? (
                <button
                  type="button"
                  onClick={handleRemoveAvatar}
                  disabled={savingAvatar}
                  className="absolute -top-1 -right-1 inline-flex items-center justify-center rounded-full border border-rose-400/30 bg-rose-400/15 p-1.5 text-rose-300 shadow transition hover:border-rose-400/50 disabled:cursor-not-allowed disabled:opacity-60"
                  aria-label="Remove avatar"
                >
                  <X size={12} />
                </button>
              ) : null}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={handleAvatarPick}
                className="hidden"
              />
            </div>

            <div className="flex min-w-0 flex-1 flex-col gap-3">
              <span className="font-mono text-[10px] uppercase tracking-[0.32em] text-(--text-muted)">
                Histora profile
              </span>
              <div className="flex flex-col gap-1">
                <h1 className="font-display text-balance text-3xl font-semibold text-(--text-primary) sm:text-4xl">
                  {displayName ?? 'Histora member'}
                </h1>
                {profile.username ? (
                  <p className="font-mono text-xs text-(--text-muted) sm:text-sm">
                    @{profile.username}
                  </p>
                ) : null}
                {displayEmail ? (
                  <p className="text-sm text-(--text-secondary)">{displayEmail}</p>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge tone={isAdmin ? 'accent' : 'neutral'}>
                  {isAdmin ? <Crown size={11} /> : <ShieldCheck size={11} />}
                  {isAdmin ? 'Admin' : 'Member'}
                </Badge>
                <Badge tone="muted">
                  <Users size={11} />
                  {usageLabel(profile.usageType)}
                </Badge>
                {profile.country ? (
                  <Badge tone="muted">
                    <MapPin size={11} />
                    {profile.country}
                  </Badge>
                ) : null}
              </div>
            </div>
          </div>
        </motion.section>

        {/* About + Account details (two columns) */}
        <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
          <SectionCard
            title="About"
            description="A short note about you and what you love about history."
            icon={Sparkles}
          >
            <DefinitionList>
              <DefinitionRow label="Bio">
                <p className="text-sm leading-relaxed text-(--text-secondary)">
                  {profile.bio?.trim() || 'No bio yet — add one in Edit profile.'}
                </p>
              </DefinitionRow>
              <DefinitionRow label="Favourite era / topic">
                <p className="text-sm leading-relaxed text-(--text-secondary)">
                  {profile.favoriteHistory?.trim() || 'Not set'}
                </p>
              </DefinitionRow>
              <DefinitionRow label="Country">
                <p className="text-sm leading-relaxed text-(--text-secondary)">
                  {profile.country?.trim() || 'Not set'}
                </p>
              </DefinitionRow>
            </DefinitionList>
          </SectionCard>

          <SectionCard
            title="Account details"
            description="Identity Histora uses to personalise your experience."
            icon={UserIcon}
          >
            <DefinitionList>
              <DefinitionRow label="Full name">
                <p className="text-sm text-(--text-secondary)">
                  {profile.fullName?.trim() || 'Not set'}
                </p>
              </DefinitionRow>
              <DefinitionRow label="Username">
                <p className="text-sm text-(--text-secondary)">
                  {profile.username?.trim() || 'Not set'}
                </p>
              </DefinitionRow>
              <DefinitionRow label="Email">
                <p className="text-sm text-(--text-secondary)">
                  {displayEmail ?? 'Not set'}
                </p>
              </DefinitionRow>
              <DefinitionRow label="Joined">
                <p className="inline-flex items-center gap-2 text-sm text-(--text-secondary)">
                  <Calendar size={13} className="text-(--text-muted)" />
                  {formatDate(profile.createdAt)}
                </p>
              </DefinitionRow>
            </DefinitionList>
          </SectionCard>
        </div>

        {/* Activity */}
        <SectionCard
          title="Histora activity"
          description="Your conversations and engagement at a glance."
          icon={MessageSquareQuote}
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <StatCard
              label="Conversations"
              value={activity.loading ? '—' : activity.conversations.toLocaleString()}
              icon={MessageSquareQuote}
            />
            <StatCard
              label="Messages exchanged"
              value={activity.loading ? '—' : activity.messages.toLocaleString()}
              icon={Sparkles}
            />
            <StatCard
              label="Member since"
              value={formatDate(profile.createdAt)}
              icon={Calendar}
            />
          </div>
          {activity.lastConversationTitle ? (
            <div className="mt-4 flex items-start gap-3 rounded-2xl border border-(--border-soft) bg-(--surface) px-4 py-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-(--accent-soft) text-(--accent)">
                <BookOpenText size={15} />
              </span>
              <div className="flex min-w-0 flex-col">
                <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-(--text-muted)">
                  Most recent conversation
                </span>
                <span className="truncate text-sm font-semibold text-(--text-primary)">
                  {activity.lastConversationTitle}
                </span>
                {activity.lastConversationAt ? (
                  <span className="text-xs text-(--text-muted)">
                    Last touched {formatDate(activity.lastConversationAt)}
                  </span>
                ) : null}
              </div>
            </div>
          ) : null}
        </SectionCard>

        {/* Edit profile */}
        <SectionCard
          title="Edit profile"
          description="Update the public-facing parts of your Histora identity. Email and role are immutable."
          icon={UserIcon}
          action={
            !isEditing ? (
              <button
                type="button"
                onClick={beginEdit}
                className="inline-flex items-center gap-2 rounded-full bg-(--text-primary) px-4 py-2 text-xs font-semibold text-(--background) shadow-sm transition hover:opacity-95"
              >
                Edit profile
              </button>
            ) : null
          }
        >
          {isEditing ? (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Full name" required>
                  <input
                    type="text"
                    autoComplete="name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full rounded-2xl border border-(--border-soft) bg-(--surface) px-4 py-3 text-sm text-(--text-primary) focus:border-(--accent) focus:outline-none"
                  />
                </Field>
                <Field label="Username" required>
                  <input
                    type="text"
                    autoComplete="username"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    value={username}
                    onChange={(e) =>
                      setUsername(e.target.value.replace(/\s/g, ''))
                    }
                    className="w-full rounded-2xl border border-(--border-soft) bg-(--surface) px-4 py-3 text-sm text-(--text-primary) focus:border-(--accent) focus:outline-none"
                  />
                </Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Country">
                  <input
                    type="text"
                    autoComplete="country-name"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    className="w-full rounded-2xl border border-(--border-soft) bg-(--surface) px-4 py-3 text-sm text-(--text-primary) focus:border-(--accent) focus:outline-none"
                  />
                </Field>
                <Field label="I am a">
                  <select
                    value={usageType}
                    onChange={(e) =>
                      setUsageType(e.target.value as ProfileUsageType)
                    }
                    className="w-full appearance-none rounded-2xl border border-(--border-soft) bg-(--surface) px-4 py-3 text-sm text-(--text-primary) focus:border-(--accent) focus:outline-none"
                  >
                    {USAGE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <AnimatePresence initial={false}>
                {usageType === 'other' ? (
                  <motion.div
                    key="usage-other"
                    initial={{ opacity: 0, y: -6, height: 0 }}
                    animate={{ opacity: 1, y: 0, height: 'auto' }}
                    exit={{ opacity: 0, y: -6, height: 0 }}
                    transition={{ duration: 0.22, ease: 'easeOut' }}
                    className="overflow-hidden"
                  >
                    <Field label="Tell us a bit more">
                      <input
                        type="text"
                        value={usageTypeOther}
                        onChange={(e) => setUsageTypeOther(e.target.value)}
                        placeholder="e.g. Museum curator, Documentary maker, Hobbyist…"
                        maxLength={60}
                        className="w-full rounded-2xl border border-(--border-soft) bg-(--surface) px-4 py-3 text-sm text-(--text-primary) placeholder:text-(--text-muted) focus:border-(--accent) focus:outline-none"
                      />
                    </Field>
                  </motion.div>
                ) : null}
              </AnimatePresence>

              <Field label="Favourite era / topic">
                <input
                  type="text"
                  value={favoriteHistory}
                  onChange={(e) => setFavoriteHistory(e.target.value)}
                  className="w-full rounded-2xl border border-(--border-soft) bg-(--surface) px-4 py-3 text-sm text-(--text-primary) focus:border-(--accent) focus:outline-none"
                />
              </Field>
              <Field label="Bio">
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={4}
                  maxLength={500}
                  placeholder="Tell other learners what draws you to history."
                  className="w-full resize-none rounded-2xl border border-(--border-soft) bg-(--surface) px-4 py-3 text-sm text-(--text-primary) placeholder:text-(--text-muted) focus:border-(--accent) focus:outline-none"
                />
              </Field>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-(--text-primary) px-5 py-2.5 text-sm font-semibold text-(--background) shadow-sm transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {savingProfile ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Save size={14} />
                  )}
                  Save changes
                </button>
                <button
                  type="button"
                  onClick={cancelEdit}
                  disabled={savingProfile}
                  className="inline-flex items-center gap-2 rounded-2xl border border-(--border-soft) bg-(--surface) px-5 py-2.5 text-sm font-semibold text-(--text-primary) transition hover:border-(--accent)/50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancel
                </button>
              </div>
              <p className="text-[11px] leading-relaxed text-(--text-muted)">
                Your role and email are managed by Histora administrators and
                cannot be changed from this form.
              </p>
            </form>
          ) : (
            <p className="text-sm leading-relaxed text-(--text-secondary)">
              Click <span className="font-semibold text-(--text-primary)">Edit profile</span>{' '}
              to update your name, username, country, favourite topic, or bio.
              Avatar changes are made directly from the profile photo above.
            </p>
          )}
        </SectionCard>

      </main>
    </div>
  )
}

function SectionCard({
  title,
  description,
  icon: Icon,
  action,
  children,
}: {
  title: string
  description?: string
  icon: typeof UserIcon
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="glass relative overflow-hidden rounded-3xl p-6 sm:p-7"
    >
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-(--accent-soft) text-(--accent)">
            <Icon size={16} />
          </span>
          <div className="min-w-0">
            <h2 className="font-display text-xl font-semibold text-(--text-primary) sm:text-2xl">
              {title}
            </h2>
            {description ? (
              <p className="mt-1 text-xs leading-relaxed text-(--text-muted) sm:text-sm">
                {description}
              </p>
            ) : null}
          </div>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children}
    </motion.section>
  )
}

function DefinitionList({ children }: { children: ReactNode }) {
  return <dl className="flex flex-col gap-3">{children}</dl>
}

function DefinitionRow({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <div className="grid gap-1 rounded-2xl bg-(--surface) px-4 py-3 sm:grid-cols-[140px_1fr] sm:items-start sm:gap-4">
      <dt className="font-mono text-[10px] uppercase tracking-[0.22em] text-(--text-muted)">
        {label}
      </dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  )
}

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: string
  icon: typeof UserIcon
}) {
  return (
    <div className="rounded-2xl border border-(--border-soft) bg-(--surface) px-4 py-3">
      <div className="flex items-center gap-2 text-(--text-muted)">
        <Icon size={13} />
        <span className="font-mono text-[10px] uppercase tracking-[0.22em]">
          {label}
        </span>
      </div>
      <p className="mt-1 font-display text-2xl font-semibold text-(--text-primary)">
        {value}
      </p>
    </div>
  )
}

function Field({
  label,
  required,
  children,
}: {
  label: string
  required?: boolean
  children: ReactNode
}) {
  return (
    <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-(--text-muted)">
      <span className="flex items-center gap-1">
        {label}
        {required ? <span className="text-rose-300">*</span> : null}
      </span>
      {children}
    </label>
  )
}

function Badge({
  tone,
  children,
}: {
  tone: 'accent' | 'muted' | 'neutral'
  children: ReactNode
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.22em]',
        tone === 'accent' &&
          'border border-(--accent)/40 bg-(--accent-soft) text-(--accent)',
        tone === 'muted' &&
          'border border-(--border-soft) bg-(--surface-strong) text-(--text-secondary)',
        tone === 'neutral' &&
          'border border-(--border-soft) bg-(--surface) text-(--text-secondary)',
      )}
    >
      {children}
    </span>
  )
}
