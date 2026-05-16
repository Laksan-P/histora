import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useEffect, useState } from 'react'
import AuroraBackground from './AuroraBackground'
import { HistoraLogoMark } from './HistoraLogoMark'

const LOADING_PHRASES = [
  'Opening the archive…',
  'Recovering voices from history…',
  'Preparing a source-grounded experience…',
  'Restoring the archive…',
] as const

const PHRASE_INTERVAL_MS = 1400

/**
 * Cinematic boot splash shown the first time the app mounts. Sits as a
 * fixed overlay on top of the actual app body so the underlying
 * AuthGate / HistoraApp can hydrate behind it; once the parent flips
 * `isOpen` to `false` the splash fades out and the prepared screen is
 * already in place — no white flash, no second load.
 *
 * Layered Framer Motion entrance:
 *   1. Logo crest scales in.
 *   2. Wordmark fades up.
 *   3. Tagline fades up.
 *   4. Cycling loading phrase crossfades.
 * A subtle gold light-sweep glides across the crest while it's visible.
 *
 * Honors `prefers-reduced-motion` by skipping the sweep, the orb spin,
 * and the slow background drift while still showing the entrance fades.
 */
export default function BootSplash({ isOpen }: { isOpen: boolean }) {
  const reduce = useReducedMotion()
  const [phraseIndex, setPhraseIndex] = useState(0)

  useEffect(() => {
    if (!isOpen) return
    const interval = window.setInterval(() => {
      setPhraseIndex(
        (current) => (current + 1) % LOADING_PHRASES.length,
      )
    }, PHRASE_INTERVAL_MS)
    return () => window.clearInterval(interval)
  }, [isOpen])

  return (
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          key="boot-splash"
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.015 }}
          transition={{ duration: 0.7, ease: [0.22, 0.61, 0.36, 1] }}
          className="fixed inset-0 z-90 flex items-center justify-center overflow-hidden bg-(--background)"
          aria-hidden="true"
        >
          <AuroraBackground />

          {/* Soft vignette so the center stays luminous against the grid. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 [background:radial-gradient(ellipse_at_center,color-mix(in_srgb,var(--accent)_8%,transparent)_0%,transparent_55%)]"
          />

          {/* Center stack */}
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="relative z-10 flex w-full max-w-md flex-col items-center gap-6 px-6 text-center sm:gap-7"
          >
            {/* Crest with rotating archive ring */}
            <div className="relative grid h-32 w-32 place-items-center sm:h-36 sm:w-36">
              {/* Outer rotating ring (paused for reduce-motion) */}
              {reduce ? null : (
                <motion.span
                  aria-hidden
                  className="absolute inset-0 rounded-full border border-(--accent)/40"
                  animate={{ rotate: 360 }}
                  transition={{
                    duration: 14,
                    repeat: Infinity,
                    ease: 'linear',
                  }}
                  style={{
                    backgroundImage:
                      'conic-gradient(from 0deg, transparent 0deg, color-mix(in srgb, var(--accent) 65%, transparent) 60deg, transparent 140deg, transparent 360deg)',
                    WebkitMaskImage:
                      'radial-gradient(circle, transparent 62%, black 63%, black 100%)',
                    maskImage:
                      'radial-gradient(circle, transparent 62%, black 63%, black 100%)',
                  }}
                />
              )}

              {/* Inner softer ring */}
              <span
                aria-hidden
                className="absolute inset-3 rounded-full border border-(--accent)/25"
              />

              {/* Pulsing halo */}
              <motion.span
                aria-hidden
                className="absolute inset-2 rounded-full bg-(--accent)/20 blur-2xl"
                animate={
                  reduce
                    ? { opacity: 0.5 }
                    : { opacity: [0.35, 0.6, 0.35], scale: [0.95, 1.05, 0.95] }
                }
                transition={
                  reduce
                    ? { duration: 0 }
                    : { duration: 3.4, repeat: Infinity, ease: 'easeInOut' }
                }
              />

              {/* Logo with cinematic entrance */}
              <motion.div
                initial={{ opacity: 0, scale: 0.85, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{
                  duration: 0.85,
                  delay: 0.1,
                  ease: [0.22, 0.61, 0.36, 1],
                }}
                className="relative"
              >
                <HistoraLogoMark variant="bootSplash" />

                {/* Diagonal light sweep over the crest */}
                {reduce ? null : (
                  <motion.span
                    aria-hidden
                    className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl"
                  >
                    <motion.span
                      className="absolute inset-y-0 -left-1/3 w-1/3 -skew-x-12 bg-linear-to-r from-transparent via-white/45 to-transparent dark:via-white/30"
                      initial={{ x: '-120%' }}
                      animate={{ x: '420%' }}
                      transition={{
                        duration: 2.4,
                        ease: 'easeInOut',
                        repeat: Infinity,
                        repeatDelay: 0.9,
                        delay: 0.45,
                      }}
                    />
                  </motion.span>
                )}
              </motion.div>
            </div>

            {/* Wordmark */}
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.65,
                delay: 0.45,
                ease: [0.22, 0.61, 0.36, 1],
              }}
              className="flex flex-col items-center gap-2"
            >
              <span className="font-mono text-[10px] uppercase tracking-[0.42em] text-(--text-muted)">
                Source-grounded · est. archive
              </span>
              <h1 className="font-display text-5xl font-semibold leading-none tracking-tight text-(--text-primary) sm:text-6xl">
                <span className="text-gradient-gold">Histora</span>
              </h1>
            </motion.div>

            {/* Tagline */}
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.6,
                delay: 0.85,
                ease: [0.22, 0.61, 0.36, 1],
              }}
              className="font-display text-base italic text-(--text-secondary) sm:text-lg"
            >
              Interview the Past.
            </motion.p>

            {/* Cycling loading phrase */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 1.15 }}
              className="flex h-6 items-center justify-center"
              role="status"
              aria-live="polite"
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={phraseIndex}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.42, ease: 'easeOut' }}
                  className="text-xs uppercase tracking-[0.32em] text-(--text-muted)"
                >
                  {LOADING_PHRASES[phraseIndex]}
                </motion.span>
              </AnimatePresence>
            </motion.div>

            {/* Equalizer-style waveform pulse */}
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 1.35 }}
              className="flex items-end gap-1 leading-none"
              aria-hidden
            >
              {[0, 1, 2, 3, 4, 5, 6].map((bar) => (
                <span
                  key={bar}
                  className="block w-0.5 origin-bottom rounded-full bg-(--accent)/70"
                  style={{
                    height: '14px',
                    animation: reduce
                      ? undefined
                      : 'histora-thinking-wave 1.3s ease-in-out infinite',
                    animationDelay: `${bar * 110}ms`,
                  }}
                />
              ))}
            </motion.div>
          </motion.div>

          {/* Bottom credit ribbon */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 0.85, y: 0 }}
            transition={{ duration: 0.6, delay: 1.55 }}
            className="absolute bottom-6 left-1/2 -translate-x-1/2 px-4 text-center sm:bottom-8"
          >
            <span className="font-mono text-[10px] uppercase tracking-[0.32em] text-(--text-muted)">
              Loading the archive
            </span>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
