import { Moon, Sun } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { useTheme } from '../lib/useTheme'
import { cn } from '../lib/cn'

type ThemeToggleProps = {
  variant?: 'pill' | 'icon'
  className?: string
}

export default function ThemeToggle({
  variant = 'pill',
  className,
}: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'

  if (variant === 'icon') {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
        className={cn(
          'relative grid h-10 w-10 place-items-center rounded-full border border-(--border-soft) bg-(--surface) text-(--text-secondary) transition hover:scale-105 hover:text-(--accent)',
          className,
        )}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={theme}
            initial={{ rotate: -90, opacity: 0 }}
            animate={{ rotate: 0, opacity: 1 }}
            exit={{ rotate: 90, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="absolute"
          >
            {isDark ? <Moon size={16} /> : <Sun size={16} />}
          </motion.span>
        </AnimatePresence>
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      className={cn(
        'group relative inline-flex h-10 max-w-full items-center gap-2 rounded-full border border-(--border-soft) bg-(--surface) px-1 pr-3 text-sm font-medium text-(--text-secondary) transition hover:border-(--accent)',
        className,
      )}
    >
      <span className="relative grid h-8 w-16 grid-cols-2 rounded-full bg-(--accent-soft)">
        <motion.span
          aria-hidden
          layout
          transition={{ type: 'spring', stiffness: 360, damping: 30 }}
          className={cn(
            'absolute top-1 h-6 w-6 rounded-full bg-(--accent) shadow-md',
            isDark ? 'left-9' : 'left-1',
          )}
        />
        <span className="z-10 grid h-8 w-8 place-items-center text-(--text-secondary)">
          <Sun size={13} />
        </span>
        <span className="z-10 grid h-8 w-8 place-items-center text-(--text-secondary)">
          <Moon size={13} />
        </span>
      </span>
      <span className="font-display text-base tracking-wide text-(--text-primary)">
        {isDark ? 'Night' : 'Day'}
      </span>
    </button>
  )
}
