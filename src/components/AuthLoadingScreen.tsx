import { motion } from 'framer-motion'
import { Loader2, ShieldCheck } from 'lucide-react'
import AuroraBackground from './AuroraBackground'
import { HistoraLogoMark } from './HistoraLogoMark'

type AuthLoadingScreenProps = {
  status: 'loading' | 'verifying'
}

const COPY: Record<AuthLoadingScreenProps['status'], { heading: string; detail: string }> = {
  loading: {
    heading: 'Restoring your session…',
    detail: 'Reconnecting to the archive — one moment.',
  },
  verifying: {
    heading: 'Verifying your account…',
    detail:
      'Checking your credentials and confirming the email casing matches your signup.',
  },
}

/**
 * Full-screen polished loader rendered while the auth subsystem is
 * either restoring an existing session (`loading`) or running the
 * case-sensitive sign-in verification (`verifying`). Keeping this in a
 * dedicated component lets App.tsx swap it in without ever flashing
 * AuthGate or HistoraApp during the verification window.
 */
export default function AuthLoadingScreen({ status }: AuthLoadingScreenProps) {
  const { heading, detail } = COPY[status]
  return (
    <div className="relative grid min-h-screen w-full place-items-center overflow-hidden px-4 py-10">
      <AuroraBackground />
      <motion.div
        initial={{ opacity: 0, y: 18, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.45, ease: [0.22, 0.61, 0.36, 1] }}
        className="glass-strong relative z-10 flex w-full max-w-md flex-col items-center gap-5 rounded-3xl px-8 py-10 text-center sm:px-12 sm:py-12"
        role="status"
        aria-live="polite"
      >
        <span
          aria-hidden
          className="pointer-events-none absolute -top-24 -right-12 h-48 w-48 rounded-full bg-(--accent)/25 blur-3xl"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute -bottom-24 -left-12 h-48 w-48 rounded-full bg-indigo-400/20 blur-3xl"
        />

        <HistoraLogoMark variant="authCard" />

        <span className="relative grid h-14 w-14 place-items-center rounded-2xl bg-(--accent-soft) text-(--accent)">
          <Loader2 size={26} className="animate-spin" />
        </span>

        <div className="relative flex flex-col gap-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.32em] text-(--text-muted)">
            {status === 'verifying' ? 'Step 02 · Verification' : 'Step 01 · Session'}
          </span>
          <p className="font-display text-xl font-semibold text-(--text-primary) sm:text-2xl">
            {heading}
          </p>
          <p className="text-pretty text-xs leading-relaxed text-(--text-muted) sm:text-sm">
            {detail}
          </p>
        </div>

        {status === 'verifying' ? (
          <div className="relative inline-flex items-center gap-2 rounded-full bg-(--accent-soft) px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-(--accent)">
            <ShieldCheck size={12} />
            Source-grounded auth
          </div>
        ) : null}
      </motion.div>
    </div>
  )
}
