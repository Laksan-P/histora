import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion'
import { ArrowDown, ArrowRight, Mic, Sparkles } from 'lucide-react'
import { useRef } from 'react'

type HeroSectionProps = {
  onBegin: () => void
}

const floatingOrbs = [
  { className: 'left-[6%] top-[18%] h-44 w-44 bg-(--accent)/30', delay: 0 },
  {
    className: 'right-[10%] top-[28%] h-56 w-56 bg-indigo-400/25 dark:bg-indigo-500/25',
    delay: 1.4,
  },
  {
    className: 'left-[20%] bottom-[12%] h-40 w-40 bg-rose-300/30 dark:bg-rose-500/25',
    delay: 2.6,
  },
]

const heroChips = [
  'AI-led conversations',
  'Source-grounded answers',
  'Cinematic voice playback',
]

export default function HeroSection({ onBegin }: HeroSectionProps) {
  const reduce = useReducedMotion()
  const heroRef = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ['start start', 'end start'],
  })
  const titleY = useTransform(scrollYProgress, [0, 1], ['0%', '-30%'])
  const subtitleY = useTransform(scrollYProgress, [0, 1], ['0%', '-12%'])
  const orbsOpacity = useTransform(scrollYProgress, [0, 1], [1, 0])

  return (
    <section
      ref={heroRef}
      className="relative mx-auto flex w-full max-w-7xl flex-col items-center px-5 pt-14 pb-20 sm:px-8 sm:pt-20 sm:pb-28"
    >
      <motion.div
        aria-hidden
        style={reduce ? undefined : { opacity: orbsOpacity }}
        className="pointer-events-none absolute inset-0"
      >
        {floatingOrbs.map((orb, index) => (
          <motion.span
            key={index}
            className={`pointer-events-none absolute rounded-full blur-3xl ${orb.className}`}
            animate={
              reduce
                ? undefined
                : {
                    y: [0, -22, 0],
                    x: [0, 14, 0],
                    scale: [1, 1.08, 1],
                  }
            }
            transition={{
              duration: 9 + index,
              repeat: Infinity,
              ease: 'easeInOut',
              delay: orb.delay,
            }}
          />
        ))}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7 }}
        style={reduce ? undefined : { y: titleY, willChange: 'transform' }}
        className="relative z-10 flex flex-col items-center text-center"
      >
        <motion.span
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="inline-flex items-center gap-2 rounded-full border border-(--border-soft) bg-(--surface) px-4 py-1.5 text-xs font-medium uppercase tracking-[0.32em] text-(--text-secondary)"
        >
          <Sparkles size={13} className="text-(--accent)" />
          AI history lab · MVP preview
        </motion.span>

        <motion.h1
          initial={{ opacity: 0, y: 36 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.1, ease: [0.22, 0.61, 0.36, 1] }}
          className="font-display mt-8 text-balance text-[clamp(3rem,9vw,7.5rem)] font-semibold leading-[0.92] tracking-tight text-(--text-primary)"
        >
          Interview the{' '}
          <span className="text-gradient-gold italic">Past.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.3 }}
          style={reduce ? undefined : { y: subtitleY, willChange: 'transform' }}
          className="mt-6 max-w-2xl text-pretty text-base leading-relaxed text-(--text-secondary) sm:text-lg"
        >
          Explore history through cinematic, source-grounded conversations with
          the leaders, witnesses, and scholars who shaped it — powered by AI and
          spoken with a real human voice.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.45 }}
          className="mt-9 flex flex-col items-center gap-4 sm:flex-row"
        >
          <motion.button
            type="button"
            onClick={onBegin}
            whileHover={reduce ? undefined : { scale: 1.04 }}
            whileTap={{ scale: 0.97 }}
            className="group relative inline-flex items-center gap-3 overflow-hidden rounded-full bg-(--text-primary) px-7 py-4 text-base font-semibold text-(--background) shadow-(--shadow-cinema) transition hover:shadow-(--shadow-glow)"
          >
            {!reduce ? (
              <motion.span
                aria-hidden
                animate={{ opacity: [0, 0.35, 0] }}
                transition={{ duration: 3.4, repeat: Infinity, ease: 'easeInOut' }}
                className="pointer-events-none absolute -inset-px rounded-full bg-(--accent)/40 blur-md"
              />
            ) : null}
            <span className="relative">Begin Exploring</span>
            <span className="relative grid h-7 w-7 place-items-center rounded-full bg-(--background)/15 transition group-hover:translate-x-1">
              <ArrowRight size={15} />
            </span>
          </motion.button>

          <div className="inline-flex items-center gap-3 rounded-full border border-(--border-soft) bg-(--surface) px-5 py-3 text-sm text-(--text-secondary)">
            <Mic size={14} className="text-(--accent)" />
            ElevenLabs voice ready
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.7 }}
          className="mt-10 flex flex-wrap items-center justify-center gap-2"
        >
          {heroChips.map((chip, index) => (
            <motion.span
              key={chip}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.75 + index * 0.07 }}
              className="rounded-full border border-(--border-soft) bg-(--surface) px-3 py-1 text-xs font-medium text-(--text-secondary)"
            >
              {chip}
            </motion.span>
          ))}
        </motion.div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.85 }}
        className="relative z-10 mt-16 grid w-full max-w-5xl grid-cols-1 gap-4 sm:grid-cols-3"
      >
        {[
          { label: 'Era voices', value: '6+' },
          { label: 'Source notes per chat', value: '3' },
          { label: 'Quiz questions generated', value: '∞' },
        ].map((stat, index) => (
          <motion.div
            key={stat.label}
            whileHover={reduce ? undefined : { y: -4 }}
            transition={{ duration: 0.3 }}
            className="glass group relative overflow-hidden rounded-3xl px-6 py-5 text-left"
            style={{ animationDelay: `${index * 0.08}s` }}
          >
            <span
              aria-hidden
              className="pointer-events-none absolute -top-12 right-0 h-28 w-28 rounded-full bg-(--accent)/20 opacity-0 blur-3xl transition group-hover:opacity-100"
            />
            <div className="font-display text-4xl text-(--text-primary)">
              {stat.value}
            </div>
            <div className="mt-2 text-xs uppercase tracking-[0.28em] text-(--text-muted)">
              {stat.label}
            </div>
          </motion.div>
        ))}
      </motion.div>

      <motion.a
        href="#how-it-works"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.1, duration: 0.8 }}
        className="relative z-10 mt-14 flex flex-col items-center gap-2 text-xs uppercase tracking-[0.32em] text-(--text-muted)"
      >
        Scroll to learn
        <motion.span
          animate={reduce ? undefined : { y: [0, 8, 0] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
          className="grid h-9 w-9 place-items-center rounded-full border border-(--border-soft) bg-(--surface) text-(--accent)"
        >
          <ArrowDown size={14} />
        </motion.span>
      </motion.a>
    </section>
  )
}
