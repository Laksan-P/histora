import { AnimatePresence, motion } from 'framer-motion'
import {
  AlertTriangle,
  ArrowRight,
  BookOpenText,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { useState, type FormEvent } from 'react'
import AuroraBackground from './AuroraBackground'
import { HistoraLogoMark } from './HistoraLogoMark'
import ThemeToggle from './ThemeToggle'
import { useAuth } from '../lib/useAuth'
import { cn } from '../lib/cn'

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

function describeMinPasswordLength(): string {
  return 'Password must be at least 6 characters.'
}

export default function AuthGate() {
  const { state, signIn, signUp } = useAuth()
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  const isLoading = state.status === 'loading'
  const isUnavailable = state.status === 'unavailable'

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (submitting) return

    const trimmedEmail = email.trim()
    if (!trimmedEmail || !password) {
      setError('Enter an email and password to continue.')
      return
    }
    if (password.length < 6) {
      setError(describeMinPasswordLength())
      return
    }

    setSubmitting(true)
    setError(null)
    setInfo(null)
    try {
      const result =
        mode === 'login'
          ? await signIn(trimmedEmail, password)
          : await signUp(trimmedEmail, password)

      if (!result.ok) {
        setError(result.error)
        return
      }

      if (mode === 'signup') {
        // Supabase may require email confirmation depending on project
        // settings — surface a hint so the user knows what to do next.
        setInfo(
          'Check your inbox for a confirmation link, then sign in to begin.',
        )
        setMode('login')
        setPassword('')
      }
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Something went wrong. Please try again.',
      )
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
              <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-(--text-muted)">
                Email
                <span className="relative">
                  <Mail
                    size={14}
                    className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-(--text-muted)"
                  />
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
                </span>
              </label>
              <p className="-mt-2 text-[11px] leading-relaxed text-(--text-muted)">
                Use the same email address you signed up with. Spaces are removed
                automatically.
              </p>

              <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-(--text-muted)">
                Password
                <span className="relative">
                  <Lock
                    size={14}
                    className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-(--text-muted)"
                  />
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
                </span>
              </label>

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
