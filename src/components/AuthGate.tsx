import { AnimatePresence, motion } from 'framer-motion'
import {
  AlertTriangle,
  ArrowRight,
  BookOpenText,
  Camera,
  Loader2,
  Lock,
  Mail,
  MapPin,
  ShieldCheck,
  Sparkles,
  Trash2,
  User,
  Users,
} from 'lucide-react'
import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react'
import AuroraBackground from './AuroraBackground'
import { HistoraLogoMark } from './HistoraLogoMark'
import TermsConsentPage from './TermsConsentPage'
import ThemeToggle from './ThemeToggle'
import UserAvatar from './UserAvatar'
import { uploadAvatar } from '../lib/avatarStorage'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/useAuth'
import { useToast } from '../lib/useToast'
import { cn } from '../lib/cn'
import type { ProfileUsageType } from '../lib/authContext'

type Mode = 'login' | 'signup'

const HIGHLIGHTS = [
  {
    icon: BookOpenText,
    title: 'Cited every reply',
    body: 'Every answer links to the primary archive it drew from.',
  },
  {
    icon: ShieldCheck,
    title: 'Source-grounded',
    body: 'The model only speaks from curated notes — no hallucinations.',
  },
  {
    icon: Sparkles,
    title: 'Quiz on demand',
    body: 'Turn any conversation into a cinematic study session.',
  },
]

const USAGE_OPTIONS: Array<{ value: ProfileUsageType; label: string }> = [
  { value: 'student', label: 'Student' },
  { value: 'teacher', label: 'Teacher' },
  { value: 'researcher', label: 'Researcher' },
  { value: 'enthusiast', label: 'History enthusiast' },
  { value: 'other', label: 'Other' },
]

const USERNAME_PATTERN = /^[a-zA-Z0-9_.-]{3,32}$/

function describeMinPasswordLength(): string {
  return 'Password must be at least 6 characters.'
}

export default function AuthGate() {
  const { state, signIn, signUp } = useAuth()
  const { showToast } = useToast()
  const [mode, setMode] = useState<Mode>('login')
  const [showTerms, setShowTerms] = useState(false)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [username, setUsername] = useState('')
  const [country, setCountry] = useState('')
  const [usageType, setUsageType] = useState<ProfileUsageType>('student')
  // When the user picks "Other" in the I-am-a dropdown we reveal a free
  // text field so they can describe their actual role (e.g. "Museum
  // curator"). On submit, that custom string becomes the `usage_type`
  // value persisted to Supabase, falling back to literal 'other' if the
  // user leaves it blank.
  const [usageTypeOther, setUsageTypeOther] = useState('')
  const [favoriteHistory, setFavoriteHistory] = useState('')
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null)
  const [acceptedTerms, setAcceptedTerms] = useState(false)

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const isLoading = state.status === 'loading'
  const isUnavailable = state.status === 'unavailable'

  // Revoke any blob URL we created for the avatar preview when it changes
  // or when the form unmounts so we don't leak object URLs.
  useEffect(() => {
    return () => {
      if (avatarPreviewUrl && avatarPreviewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(avatarPreviewUrl)
      }
    }
  }, [avatarPreviewUrl])

  const handleAvatarPick = (event: ChangeEvent<HTMLInputElement>) => {
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
    if (avatarPreviewUrl && avatarPreviewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(avatarPreviewUrl)
    }
    const url = URL.createObjectURL(file)
    setAvatarFile(file)
    setAvatarPreviewUrl(url)
  }

  const clearAvatar = () => {
    if (avatarPreviewUrl && avatarPreviewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(avatarPreviewUrl)
    }
    setAvatarFile(null)
    setAvatarPreviewUrl(null)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (submitting) return

    const trimmedEmail = email.trim()
    if (!trimmedEmail || !password) {
      const message = 'Enter an email and password to continue.'
      setError(message)
      showToast('error', message)
      return
    }
    if (password.length < 6) {
      const message = describeMinPasswordLength()
      setError(message)
      showToast('error', message)
      return
    }

    if (mode === 'signup') {
      const trimmedFullName = fullName.trim()
      const trimmedUsername = username.trim()
      if (!trimmedFullName) {
        const message = 'Please tell us your full name.'
        setError(message)
        showToast('error', message)
        return
      }
      if (!trimmedUsername) {
        const message = 'Please choose a username.'
        setError(message)
        showToast('error', message)
        return
      }
      if (!USERNAME_PATTERN.test(trimmedUsername)) {
        const message =
          'Username must be 3–32 characters: letters, numbers, dot, underscore, or dash.'
        setError(message)
        showToast('error', message)
        return
      }
      if (password !== confirmPassword) {
        const message = 'Passwords do not match.'
        setError(message)
        showToast('error', message)
        return
      }
      if (!acceptedTerms) {
        const message =
          'Please review and accept the Terms & Consent before signing up.'
        setError(message)
        showToast('error', message)
        return
      }
    }

    setSubmitting(true)
    setError(null)
    setInfo(null)
    try {
      if (mode === 'login') {
        const result = await signIn(trimmedEmail, password)
        if (result.ok === false) {
          const reason: string = result.error
          setError(reason)
          // AuthProvider already returns the user-facing message:
          //   - "Incorrect email or password." for wrong email/password
          //   - "Email is case-sensitive…" for case mismatches
          //   - friendlier text for confirmation/rate-limit errors
          // so the toast just surfaces that string verbatim.
          showToast('error', reason)
          return
        }
        // The toast persists across the AuthGate → AuthLoadingScreen →
        // HistoraApp chain because ToastProvider is mounted at the
        // root, so the user lands on the dashboard with the
        // confirmation already on screen.
        showToast('success', 'Logged in successfully.')
        return
      }

      // ---- signup path ----
      // If the user picked "Other" and described their role, persist the
      // free-text value so the profile carries something meaningful (e.g.
      // "Museum curator") instead of the literal sentinel "other".
      const trimmedOtherUsage = usageTypeOther.trim()
      const resolvedUsageType =
        usageType === 'other' && trimmedOtherUsage.length > 0
          ? trimmedOtherUsage
          : usageType

      const result = await signUp(trimmedEmail, password, {
        fullName: fullName.trim(),
        username: username.trim(),
        country: country.trim(),
        usageType: resolvedUsageType,
        favoriteHistory: favoriteHistory.trim(),
        avatarUrl: null,
        acceptedTerms,
      })
      if (result.ok === false) {
        const reason: string = result.error
        setError(reason)
        showToast('error', reason)
        return
      }

      // If the project has email confirmation off, Supabase already has a
      // session here — try to upload the avatar and patch profile.avatar_url.
      // If confirmation is on, we'll defer the upload to the Profile page
      // after first sign-in, so the success message tells the user that.
      let avatarUploaded = false
      let avatarFailedReason: string | null = null
      if (avatarFile && supabase) {
        const { data: userResult } = await supabase.auth.getUser()
        const uid = userResult?.user?.id
        if (uid) {
          const upload = await uploadAvatar(uid, avatarFile)
          if (upload.ok === false) {
            avatarFailedReason = upload.error
          } else {
            const { error: avatarError } = await supabase
              .from('profiles')
              .update({ avatar_url: upload.publicUrl })
              .eq('id', uid)
            if (avatarError) {
              avatarFailedReason = avatarError.message
            } else {
              avatarUploaded = true
            }
          }
        }
      }

      const baseMessage =
        'Account created. Check your inbox if confirmation is required, then sign in.'
      const message =
        avatarFile && !avatarUploaded
          ? `${baseMessage} You can upload your avatar from the Profile page after signing in.`
          : baseMessage
      setInfo(message)
      showToast('success', message)
      if (avatarFailedReason) {
        console.warn('[histora] avatar upload skipped:', avatarFailedReason)
      }

      // Reset signup-only fields and bounce back to the login form so the
      // user can sign in straight away.
      setMode('login')
      setPassword('')
      setConfirmPassword('')
      setFullName('')
      setUsername('')
      setCountry('')
      setUsageType('student')
      setUsageTypeOther('')
      setFavoriteHistory('')
      setAcceptedTerms(false)
      clearAvatar()
    } catch (caught) {
      const message =
        caught instanceof Error
          ? caught.message
          : 'Something went wrong. Please try again.'
      setError(message)
      showToast('error', message)
    } finally {
      setSubmitting(false)
    }
  }

  const swapMode = (next: Mode) => {
    if (next === mode) return
    setMode(next)
    setError(null)
    setInfo(null)
  }

  if (showTerms) {
    return (
      <TermsConsentPage
        onBack={() => setShowTerms(false)}
        backLabel="Back to signup"
        onAccept={() => {
          setAcceptedTerms(true)
          setShowTerms(false)
        }}
      />
    )
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
      <AuroraBackground />

      <header className="relative z-20 mx-auto flex w-full min-w-0 max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-8 sm:py-6">
        <div className="flex min-w-0 items-center gap-3 transition-opacity duration-300 hover:opacity-85">
          <HistoraLogoMark variant="authHeader" />
          <span className="flex flex-col leading-tight">
            <span className="font-display text-2xl font-semibold tracking-tight text-(--text-primary)">
              Histora
            </span>
            <span className="text-[10px] font-medium uppercase tracking-[0.32em] text-(--text-muted)">
              Interview the past
            </span>
          </span>
        </div>
        <ThemeToggle variant="icon" />
      </header>

      <main className="relative z-10 mx-auto flex w-full min-w-0 max-w-7xl flex-col gap-10 px-4 pb-16 pt-6 sm:px-8 lg:grid lg:grid-cols-[1.05fr_1fr] lg:gap-14 lg:pt-10">
        <section className="relative flex flex-col gap-8">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55 }}
            className="flex flex-col gap-5"
          >
            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-(--border-soft) bg-(--surface) px-4 py-1 text-[10px] font-semibold uppercase tracking-[0.32em] text-(--text-muted)">
              <ShieldCheck size={12} className="text-(--accent)" />
              Source-grounded AI
            </span>
            <h1 className="font-display text-balance text-5xl font-semibold leading-[1.05] text-(--text-primary) sm:text-6xl">
              Sign in to{' '}
              <span className="text-gradient-gold">interview history</span>
            </h1>
            <p className="max-w-xl text-pretty text-sm leading-relaxed text-(--text-secondary) sm:text-base">
              Histora is a cinematic, source-grounded chat with the people who
              shaped the world. Sign in to save your conversations, archive
              sources, and generate quizzes from any moment in history.
            </p>
          </motion.div>

          <motion.ul
            initial="hidden"
            animate="show"
            variants={{
              hidden: {},
              show: { transition: { staggerChildren: 0.07, delayChildren: 0.15 } },
            }}
            className="grid gap-3 sm:grid-cols-3"
          >
            {HIGHLIGHTS.map((item) => (
              <motion.li
                key={item.title}
                variants={{
                  hidden: { opacity: 0, y: 14 },
                  show: { opacity: 1, y: 0 },
                }}
                className="glass flex flex-col gap-2 rounded-2xl p-4"
              >
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-(--accent-soft) text-(--accent)">
                  <item.icon size={16} />
                </span>
                <span className="text-sm font-semibold text-(--text-primary)">
                  {item.title}
                </span>
                <span className="text-xs leading-relaxed text-(--text-muted)">
                  {item.body}
                </span>
              </motion.li>
            ))}
          </motion.ul>
        </section>

        <motion.section
          initial={{ opacity: 0, y: 18, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.55, ease: [0.22, 0.61, 0.36, 1] }}
          className="glass-strong relative w-full min-w-0 max-w-full overflow-hidden rounded-3xl p-6 sm:p-9"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute -right-24 -top-24 h-56 w-56 rounded-full bg-(--accent)/20 blur-3xl"
          />

          <div className="relative flex flex-col gap-6">
            <HistoraLogoMark variant="authCard" />

            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <span className="font-mono text-[10px] uppercase tracking-[0.32em] text-(--text-muted)">
                  {mode === 'login' ? 'Welcome back' : 'Create account'}
                </span>
                <h2 className="font-display mt-1 text-2xl font-semibold text-(--text-primary) sm:text-3xl">
                  {mode === 'login' ? 'Sign in' : 'Sign up'}
                </h2>
              </div>
              <div
                role="tablist"
                aria-label="Authentication mode"
                className="inline-flex shrink-0 self-start rounded-full border border-(--border-soft) bg-(--surface-strong) p-1 text-[11px] font-semibold uppercase tracking-[0.22em]"
              >
                {(['login', 'signup'] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    role="tab"
                    aria-selected={mode === value}
                    onClick={() => swapMode(value)}
                    className={cn(
                      'rounded-full px-3 py-1 transition',
                      mode === value
                        ? 'bg-(--text-primary) text-(--background)'
                        : 'text-(--text-muted) hover:text-(--text-primary)',
                    )}
                  >
                    {value === 'login' ? 'Login' : 'Signup'}
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              {mode === 'signup' ? (
                <>
                  <div className="flex flex-col gap-3 rounded-2xl border border-(--border-soft) bg-(--surface) p-4 sm:flex-row sm:items-center sm:gap-4">
                    <UserAvatar
                      src={avatarPreviewUrl}
                      fullName={fullName}
                      username={username}
                      email={email}
                      size="xl"
                      ringed
                      eager
                      alt="Avatar preview"
                    />
                    <div className="flex min-w-0 flex-1 flex-col gap-2">
                      <span className="text-xs font-semibold uppercase tracking-[0.22em] text-(--text-muted)">
                        Profile photo
                      </span>
                      <p className="text-xs leading-relaxed text-(--text-muted)">
                        Optional. PNG, JPG, WEBP, or GIF — up to 4 MB.
                        Cropped into a circle automatically.
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="inline-flex items-center gap-1.5 rounded-full border border-(--border-soft) bg-(--surface-strong) px-3 py-1.5 text-xs font-semibold text-(--text-primary) transition hover:border-(--accent)/50 hover:text-(--accent)"
                        >
                          <Camera size={13} />
                          {avatarFile ? 'Replace' : 'Upload image'}
                        </button>
                        {avatarFile ? (
                          <button
                            type="button"
                            onClick={clearAvatar}
                            className="inline-flex items-center gap-1.5 rounded-full border border-rose-400/30 bg-rose-400/10 px-3 py-1.5 text-xs font-semibold text-rose-300 transition hover:border-rose-400/50"
                          >
                            <Trash2 size={13} />
                            Remove
                          </button>
                        ) : null}
                      </div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/gif"
                        onChange={handleAvatarPick}
                        className="hidden"
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <FieldShell label="Full name">
                      <FieldIcon icon={User} />
                      <input
                        type="text"
                        autoComplete="name"
                        required
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Ada Lovelace"
                        className="w-full rounded-2xl border border-(--border-soft) bg-(--surface) px-10 py-3 text-sm text-(--text-primary) placeholder:text-(--text-muted) focus:border-(--accent) focus:outline-none"
                      />
                    </FieldShell>
                    <FieldShell label="Username">
                      <FieldIcon icon={Sparkles} />
                      <input
                        type="text"
                        autoComplete="username"
                        required
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck={false}
                        value={username}
                        onChange={(e) =>
                          setUsername(e.target.value.replace(/\s/g, ''))
                        }
                        placeholder="ada.lovelace"
                        className="w-full rounded-2xl border border-(--border-soft) bg-(--surface) px-10 py-3 text-sm text-(--text-primary) placeholder:text-(--text-muted) focus:border-(--accent) focus:outline-none"
                      />
                    </FieldShell>
                  </div>
                </>
              ) : null}

              <FieldShell label="Email">
                <FieldIcon icon={Mail} />
                <input
                  type="email"
                  autoComplete="email"
                  required
                  inputMode="email"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  value={email}
                  onChange={(event) =>
                    setEmail(event.target.value.replace(/\s/g, ''))
                  }
                  placeholder="you@archive.org"
                  className="w-full max-w-full rounded-2xl border border-(--border-soft) bg-(--surface) px-10 py-3 text-sm text-(--text-primary) placeholder:text-(--text-muted) focus:border-(--accent) focus:outline-none"
                />
              </FieldShell>
              <p className="-mt-2 text-[11px] leading-relaxed text-(--text-muted)">
                Email and password are case-sensitive. Use the exact email and
                password you signed up with — spaces are removed automatically.
              </p>

              <FieldShell label="Password">
                <FieldIcon icon={Lock} />
                <input
                  type="password"
                  autoComplete={
                    mode === 'login' ? 'current-password' : 'new-password'
                  }
                  required
                  minLength={6}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="At least 6 characters"
                  className="w-full rounded-2xl border border-(--border-soft) bg-(--surface) px-10 py-3 text-sm text-(--text-primary) placeholder:text-(--text-muted) focus:border-(--accent) focus:outline-none"
                />
              </FieldShell>

              {mode === 'signup' ? (
                <>
                  <FieldShell label="Confirm password">
                    <FieldIcon icon={Lock} />
                    <input
                      type="password"
                      autoComplete="new-password"
                      required
                      minLength={6}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-type your password"
                      className="w-full rounded-2xl border border-(--border-soft) bg-(--surface) px-10 py-3 text-sm text-(--text-primary) placeholder:text-(--text-muted) focus:border-(--accent) focus:outline-none"
                    />
                  </FieldShell>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <FieldShell label="Country (optional)">
                      <FieldIcon icon={MapPin} />
                      <input
                        type="text"
                        autoComplete="country-name"
                        value={country}
                        onChange={(e) => setCountry(e.target.value)}
                        placeholder="United Kingdom"
                        className="w-full rounded-2xl border border-(--border-soft) bg-(--surface) px-10 py-3 text-sm text-(--text-primary) placeholder:text-(--text-muted) focus:border-(--accent) focus:outline-none"
                      />
                    </FieldShell>
                    <FieldShell label="I am a">
                      <FieldIcon icon={Users} />
                      <select
                        value={usageType}
                        onChange={(e) =>
                          setUsageType(e.target.value as ProfileUsageType)
                        }
                        className="w-full appearance-none rounded-2xl border border-(--border-soft) bg-(--surface) px-10 py-3 text-sm text-(--text-primary) focus:border-(--accent) focus:outline-none"
                      >
                        {USAGE_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </FieldShell>
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
                        <FieldShell label="Tell us a bit more">
                          <FieldIcon icon={Sparkles} />
                          <input
                            type="text"
                            value={usageTypeOther}
                            onChange={(e) => setUsageTypeOther(e.target.value)}
                            placeholder="e.g. Museum curator, Documentary maker, Hobbyist…"
                            maxLength={60}
                            className="w-full rounded-2xl border border-(--border-soft) bg-(--surface) px-10 py-3 text-sm text-(--text-primary) placeholder:text-(--text-muted) focus:border-(--accent) focus:outline-none"
                          />
                        </FieldShell>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>

                  <FieldShell label="Favourite era or topic (optional)">
                    <FieldIcon icon={BookOpenText} />
                    <input
                      type="text"
                      value={favoriteHistory}
                      onChange={(e) => setFavoriteHistory(e.target.value)}
                      placeholder="The Age of Exploration"
                      className="w-full rounded-2xl border border-(--border-soft) bg-(--surface) px-10 py-3 text-sm text-(--text-primary) placeholder:text-(--text-muted) focus:border-(--accent) focus:outline-none"
                    />
                  </FieldShell>

                  <label className="flex items-start gap-3 rounded-2xl border border-(--border-soft) bg-(--surface) px-4 py-3 text-xs leading-relaxed text-(--text-secondary)">
                    <input
                      type="checkbox"
                      required
                      checked={acceptedTerms}
                      onChange={(e) => setAcceptedTerms(e.target.checked)}
                      className="mt-0.5 h-4 w-4 shrink-0 rounded border-(--border-soft) text-(--accent) focus:ring-(--accent)"
                    />
                    <span>
                      I have read and agree to the{' '}
                      <button
                        type="button"
                        onClick={() => setShowTerms(true)}
                        className="font-semibold text-(--accent) underline-offset-4 hover:underline"
                      >
                        Histora Terms &amp; Consent
                      </button>
                      . I understand Histora generates AI responses grounded in
                      curated historical sources, and I will use the platform
                      respectfully and lawfully.
                    </span>
                  </label>
                </>
              ) : null}

              <AnimatePresence initial={false}>
                {error ? (
                  <motion.p
                    key="error"
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    className="inline-flex items-start gap-2 rounded-2xl border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-xs leading-relaxed text-rose-300"
                    role="alert"
                  >
                    <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                    <span>{error}</span>
                  </motion.p>
                ) : null}
                {info ? (
                  <motion.p
                    key="info"
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    className="inline-flex items-start gap-2 rounded-2xl border border-(--accent)/30 bg-(--accent-soft) px-3 py-2 text-xs leading-relaxed text-(--accent)"
                    role="status"
                  >
                    <Sparkles size={13} className="mt-0.5 shrink-0" />
                    <span>{info}</span>
                  </motion.p>
                ) : null}
              </AnimatePresence>

              <motion.button
                type="submit"
                disabled={submitting || isLoading || isUnavailable}
                whileHover={
                  submitting || isLoading || isUnavailable
                    ? undefined
                    : { scale: 1.015 }
                }
                whileTap={
                  submitting || isLoading || isUnavailable
                    ? undefined
                    : { scale: 0.97 }
                }
                transition={{ type: 'spring', stiffness: 380, damping: 26 }}
                className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-(--text-primary) px-5 py-3 text-sm font-semibold text-(--background) shadow-sm transition hover:opacity-95 hover:shadow-(--shadow-cinema) disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <ArrowRight size={15} />
                )}
                {mode === 'login' ? 'Sign in to Histora' : 'Create my account'}
              </motion.button>

              <p className="text-center text-[11px] text-(--text-muted)">
                {mode === 'login' ? (
                  <>
                    New to Histora?{' '}
                    <button
                      type="button"
                      onClick={() => swapMode('signup')}
                      className="font-semibold text-(--accent) underline-offset-4 hover:underline"
                    >
                      Create an account
                    </button>
                  </>
                ) : (
                  <>
                    Already have an account?{' '}
                    <button
                      type="button"
                      onClick={() => swapMode('login')}
                      className="font-semibold text-(--accent) underline-offset-4 hover:underline"
                    >
                      Sign in
                    </button>
                  </>
                )}
              </p>
            </form>

            <AnimatePresence>
              {isLoading ? (
                <motion.div
                  key="auth-loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-3xl bg-(--background)/80 backdrop-blur-sm"
                  role="status"
                >
                  <span className="grid h-12 w-12 place-items-center rounded-2xl bg-(--accent-soft) text-(--accent)">
                    <Loader2 size={22} className="animate-spin" />
                  </span>
                  <p className="font-display text-base font-semibold text-(--text-primary)">
                    Restoring session…
                  </p>
                </motion.div>
              ) : null}
              {isUnavailable ? (
                <motion.div
                  key="auth-unavailable"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-3xl bg-(--background)/85 px-6 text-center backdrop-blur-sm"
                  role="status"
                >
                  <span className="grid h-12 w-12 place-items-center rounded-2xl bg-rose-500/15 text-rose-300">
                    <AlertTriangle size={22} />
                  </span>
                  <p className="font-display text-base font-semibold text-(--text-primary)">
                    Authentication is not configured.
                  </p>
                  <p className="max-w-xs text-xs leading-relaxed text-(--text-muted)">
                    Add <span className="font-mono">VITE_SUPABASE_URL</span> and{' '}
                    <span className="font-mono">VITE_SUPABASE_ANON_KEY</span> to
                    your <span className="font-mono">.env.local</span> and
                    restart the dev server.
                  </p>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        </motion.section>
      </main>
    </div>
  )
}

function FieldShell({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-(--text-muted)">
      {label}
      <span className="relative">{children}</span>
    </label>
  )
}

function FieldIcon({
  icon: Icon,
}: {
  icon: typeof Mail
}) {
  return (
    <Icon
      size={14}
      className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-(--text-muted)"
    />
  )
}
