import { AnimatePresence, motion } from 'framer-motion'
import { Compass, MessageSquareQuote, Mic2, Sparkles, X } from 'lucide-react'
import { useState } from 'react'

const STORAGE_KEY = 'histora.onboarding.dismissed.v1'

function readInitialVisibility(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== '1'
  } catch {
    // localStorage may be blocked (private mode, embedded preview); show
    // the guide for the session anyway — it's still dismissible.
    return true
  }
}

const STEPS = [
  {
    icon: Compass,
    label: 'Step 01',
    title: 'Choose a historical event',
    body: 'Pick the moment in history you want to walk into.',
  },
  {
    icon: MessageSquareQuote,
    label: 'Step 02',
    title: 'Select a perspective',
    body: 'A leader, witness, or scholar who lived the moment.',
  },
  {
    icon: Mic2,
    label: 'Step 03',
    title: 'Ask a question and hear history respond',
    body: 'Every reply is source-grounded, cited, and spoken aloud.',
  },
] as const

/**
 * Compact, dismissible first-visit guide. Renders nothing on subsequent
 * sessions thanks to a `localStorage` flag. The component is fully
 * controlled by its own state — no parent props needed — so dropping it
 * onto a view is a one-liner.
 */
export default function OnboardingGuide() {
  // Initialise from localStorage during the very first render so the guide
  // never flashes on for returning visitors. The lazy initializer keeps the
  // read off the hot render path on subsequent renders.
  const [visible, setVisible] = useState<boolean>(readInitialVisibility)

  const dismiss = () => {
    setVisible(false)
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(STORAGE_KEY, '1')
    } catch {
      /* no-op when storage is unavailable */
    }
  }

  return (
    <AnimatePresence initial={false}>
      {visible ? (
        <motion.aside
          key="onboarding"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8, scale: 0.99 }}
          transition={{ duration: 0.5, ease: [0.22, 0.61, 0.36, 1] }}
          className="relative mx-auto mt-8 box-border w-full min-w-0 max-w-7xl px-4 sm:mt-10 sm:px-8"
          aria-label="How to interview history with Histora"
        >
          <div className="glass relative overflow-hidden rounded-3xl px-5 py-5 sm:px-7">
            <span
              aria-hidden
              className="pointer-events-none absolute -right-20 -top-20 h-48 w-48 rounded-full bg-(--accent)/15 blur-3xl"
            />

            <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
              <div className="flex items-start gap-3 sm:max-w-sm">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-(--accent-soft) text-(--accent)">
                  <Sparkles size={18} />
                </span>
                <div className="min-w-0">
                  <span className="font-mono text-[10px] uppercase tracking-[0.32em] text-(--text-muted)">
                    First time here?
                  </span>
                  <h3 className="font-display mt-1 text-lg font-semibold leading-tight text-(--text-primary)">
                    Three steps to interview the past.
                  </h3>
                  <p className="mt-1 text-xs leading-relaxed text-(--text-secondary)">
                    Tap a card to begin. You can revisit this guide from the
                    "How it works" section.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={dismiss}
                className="ml-auto inline-flex shrink-0 items-center gap-1 self-start rounded-full border border-(--border-soft) bg-(--surface-strong) px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-(--text-muted) transition hover:border-(--accent) hover:text-(--accent)"
                aria-label="Dismiss the onboarding guide"
              >
                <X size={11} />
                Got it
              </button>
            </div>

            <ol className="relative mt-5 grid gap-3 sm:grid-cols-3">
              {STEPS.map((step, index) => (
                <motion.li
                  key={step.label}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.4,
                    delay: 0.08 + index * 0.07,
                    ease: 'easeOut',
                  }}
                  className="group relative flex flex-col gap-2 rounded-2xl border border-(--border-soft) bg-(--surface-strong)/70 p-4 transition hover:border-(--accent)/50"
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-(--text-muted)">
                      {step.label}
                    </span>
                    <span className="grid h-8 w-8 place-items-center rounded-xl bg-(--accent-soft) text-(--accent) transition group-hover:scale-105">
                      <step.icon size={15} />
                    </span>
                  </span>
                  <span className="text-sm font-semibold leading-snug text-(--text-primary)">
                    {step.title}
                  </span>
                  <span className="text-[11px] leading-relaxed text-(--text-muted)">
                    {step.body}
                  </span>
                </motion.li>
              ))}
            </ol>
          </div>
        </motion.aside>
      ) : null}
    </AnimatePresence>
  )
}
