import { motion } from 'framer-motion'
import {
  ArrowLeft,
  BookOpenText,
  Heart,
  Lock,
  Mic2,
  Scale,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react'
import { useEffect } from 'react'
import AuroraBackground from './AuroraBackground'
import { HistoraLogoMark } from './HistoraLogoMark'
import ThemeToggle from './ThemeToggle'

type TermsConsentPageProps = {
  /** Where to return to. From signup → 'Back to signup'. From in-app → 'Back'. */
  onBack: () => void
  /** Visible label on the back button. Defaults to 'Back to signup'. */
  backLabel?: string
  /**
   * Optional inline accept hook. When provided, a primary CTA is shown
   * that flips the parent's terms checkbox and dismisses the page.
   */
  onAccept?: () => void
}

const SECTIONS: Array<{
  id: string
  icon: typeof BookOpenText
  title: string
  body: string
  bullets?: string[]
}> = [
  {
    id: 'about',
    icon: BookOpenText,
    title: 'About Histora',
    body:
      'Histora is a cinematic, source-grounded learning experience. AI-generated responses are constrained to the historical archives and notes our admins curate, with citations on every reply.',
    bullets: [
      'Replies are grounded in admin-curated source material.',
      'Histora cites the archive each answer drew from.',
      'When the archive is silent, Histora says so instead of guessing.',
    ],
  },
  {
    id: 'responsible-use',
    icon: ShieldCheck,
    title: 'Responsible Use',
    body:
      'Historical figures held views shaped by their time, including views the modern world rejects. Histora may surface that history. Use what you read with intellectual honesty and care.',
    bullets: [
      'Do not use Histora to harass, demean, or harm others.',
      'Do not represent AI-generated text as a primary source.',
      'Do not use the platform to spread hate, misinformation, or unlawful content.',
    ],
  },
  {
    id: 'voice',
    icon: Mic2,
    title: 'Voice & Live Interview',
    body:
      'Histora reads replies aloud and offers a Live Interview mode. Audio is generated on demand and isn\u2019t recorded server-side, but your microphone input is processed in your browser to transcribe what you say.',
    bullets: [
      'You can mute, pause, or end the live session at any time.',
      'Audio is synthesized from text — it is not a recording of any real person.',
      'Voice features are optional. Text chat is fully featured on its own.',
    ],
  },
  {
    id: 'data',
    icon: Lock,
    title: 'Your Account & Data',
    body:
      'Your profile (name, username, email, country, role, interests, optional bio and avatar) is stored to personalize your experience. Conversations are saved so you can pick up where you left off.',
    bullets: [
      'Profile data is stored on Supabase. Only you and admins can read your row.',
      'Conversations are scoped to your account. Other learners cannot see them.',
      'You can edit or delete your profile fields from the Profile page at any time.',
    ],
  },
  {
    id: 'archive',
    icon: Sparkles,
    title: 'Curated Archive',
    body:
      'Admins update the source archive, character roster, and event catalog over time. Citations and context may evolve as new material is added or refined for clarity.',
  },
  {
    id: 'community',
    icon: Users,
    title: 'Community Standards',
    body:
      'Histora is built for students, educators, researchers, and history enthusiasts. Be respectful in any feedback, share content responsibly, and credit the underlying sources.',
  },
  {
    id: 'changes',
    icon: Scale,
    title: 'Changes to These Terms',
    body:
      'We may update these terms as the product grows. When we do, we\u2019ll surface the changes inside Histora before they take effect. Continued use after an update means you accept the revised terms.',
  },
]

export default function TermsConsentPage({
  onBack,
  backLabel = 'Back to signup',
  onAccept,
}: TermsConsentPageProps) {
  useEffect(() => {
    // Scroll to the top of the document whenever the terms page mounts so
    // the layered entrance lands at the cinematic header rather than mid
    // page if the user came back via the browser's restore-scroll.
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [])

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
          {backLabel}
        </button>

        <div className="flex items-center gap-3">
          <HistoraLogoMark variant="authHeader" />
          <span className="hidden flex-col leading-tight sm:flex">
            <span className="font-display text-lg font-semibold tracking-tight text-(--text-primary)">
              Histora
            </span>
            <span className="text-[10px] font-medium uppercase tracking-[0.32em] text-(--text-muted)">
              Terms & Consent
            </span>
          </span>
          <ThemeToggle variant="icon" />
        </div>
      </header>

      <main className="relative z-10 mx-auto flex w-full min-w-0 max-w-3xl flex-col gap-8 px-4 pb-20 sm:px-8">
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55 }}
          className="flex flex-col gap-4"
        >
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-(--border-soft) bg-(--surface) px-4 py-1 text-[10px] font-semibold uppercase tracking-[0.32em] text-(--text-muted)">
            <ShieldCheck size={12} className="text-(--accent)" />
            Source-grounded responsibility
          </span>
          <h1 className="font-display text-balance text-4xl font-semibold leading-[1.05] text-(--text-primary) sm:text-5xl">
            Terms of Use{' '}
            <span className="text-gradient-gold">& Consent</span>
          </h1>
          <p className="text-pretty text-sm leading-relaxed text-(--text-secondary) sm:text-base">
            Before you start interviewing the past with Histora, take a moment
            to understand how the platform works, how your data is handled,
            and the rules of the road for everyone who uses it.
          </p>
        </motion.section>

        <motion.div
          initial="hidden"
          animate="show"
          variants={{
            hidden: {},
            show: {
              transition: { staggerChildren: 0.06, delayChildren: 0.1 },
            },
          }}
          className="flex flex-col gap-4"
        >
          {SECTIONS.map((section) => (
            <motion.article
              key={section.id}
              variants={{
                hidden: { opacity: 0, y: 18 },
                show: { opacity: 1, y: 0 },
              }}
              className="glass relative overflow-hidden rounded-3xl p-6 sm:p-7"
            >
              <div className="flex items-start gap-4">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-(--accent-soft) text-(--accent)">
                  <section.icon size={18} />
                </span>
                <div className="flex flex-col gap-3">
                  <h2 className="font-display text-xl font-semibold text-(--text-primary) sm:text-2xl">
                    {section.title}
                  </h2>
                  <p className="text-sm leading-relaxed text-(--text-secondary)">
                    {section.body}
                  </p>
                  {section.bullets && section.bullets.length > 0 ? (
                    <ul className="mt-1 flex list-none flex-col gap-2 text-sm text-(--text-secondary)">
                      {section.bullets.map((bullet) => (
                        <li
                          key={bullet}
                          className="flex items-start gap-2 leading-relaxed"
                        >
                          <span
                            aria-hidden
                            className="mt-2 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-(--accent)"
                          />
                          <span>{bullet}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </div>
            </motion.article>
          ))}
        </motion.div>

        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="glass-strong relative overflow-hidden rounded-3xl p-6 sm:p-8"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-4">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-(--accent) text-(--background)">
                <Heart size={18} />
              </span>
              <div className="flex flex-col gap-2">
                <h2 className="font-display text-xl font-semibold text-(--text-primary)">
                  Why agreement matters
                </h2>
                <p className="text-sm leading-relaxed text-(--text-secondary)">
                  Histora is a tool for learning and curiosity. By creating an
                  account you agree to use it respectfully and lawfully, to
                  treat AI-generated history as a starting point for further
                  research, and to allow Histora to store the profile and
                  conversation data needed to power your experience.
                </p>
              </div>
            </div>
            {onAccept ? (
              <button
                type="button"
                onClick={onAccept}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-(--text-primary) px-5 py-3 text-sm font-semibold text-(--background) shadow-sm transition hover:opacity-95"
              >
                I have read and agree
              </button>
            ) : null}
          </div>
        </motion.section>

        <p className="text-center text-[11px] leading-relaxed text-(--text-muted)">
          Questions or concerns? Reach out via the project repository so we can
          improve these terms together.
        </p>
      </main>
    </div>
  )
}
