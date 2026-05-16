import { motion, useReducedMotion } from 'framer-motion'

export default function AuroraBackground() {
  const reduce = useReducedMotion()

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      <div className="absolute inset-0 opacity-90 [background:radial-gradient(circle_at_top,color-mix(in_srgb,var(--accent)_18%,transparent)_0%,transparent_45%)]" />

      <div
        className={cnAurora(
          'absolute top-1/2 left-1/2 h-[160vmin] w-[160vmin] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-60',
          reduce ? 'aurora-static' : 'aurora-conic',
        )}
      />

      <motion.div
        animate={
          reduce
            ? undefined
            : {
                y: [0, -30, 0],
                x: [0, 24, 0],
              }
        }
        transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
        style={{ willChange: 'transform' }}
        className="absolute -top-32 right-[8%] h-72 w-72 rounded-full bg-(--accent)/30 blur-3xl dark:bg-(--accent)/35"
      />
      <motion.div
        animate={
          reduce
            ? undefined
            : {
                y: [0, 28, 0],
                x: [0, -18, 0],
              }
        }
        transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
        style={{ willChange: 'transform' }}
        className="absolute bottom-[-10%] left-[6%] h-80 w-80 rounded-full bg-indigo-400/25 blur-3xl dark:bg-indigo-500/30"
      />
      <motion.div
        animate={
          reduce
            ? undefined
            : {
                y: [0, -22, 0],
                x: [0, -14, 0],
              }
        }
        transition={{ duration: 19, repeat: Infinity, ease: 'easeInOut' }}
        style={{ willChange: 'transform' }}
        className="absolute top-[35%] left-[42%] h-64 w-64 rounded-full bg-rose-300/20 blur-3xl dark:bg-rose-500/20"
      />

      <div className="absolute inset-0 [background:radial-gradient(ellipse_at_center,transparent_55%,color-mix(in_srgb,var(--background)_85%,transparent)_100%)]" />
    </div>
  )
}

function cnAurora(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ')
}
