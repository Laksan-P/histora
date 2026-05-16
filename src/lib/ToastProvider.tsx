import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { cn } from './cn'
import {
  ToastContext,
  type ToastEntry,
  type ToastType,
} from './toastContext'

const DEFAULT_DURATION_MS = 3500

/**
 * Lightweight toast system. Toasts stack vertically along the top-right
 * edge, slide in from the right with a soft spring, and auto-dismiss.
 * Used today for auth events (login, signup, sign-out) but the
 * `showToast` API is generic so any feature can adopt it.
 */
export default function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastEntry[]>([])
  // Track per-toast timers so we can cancel them when a toast is dismissed
  // manually. Using a ref keeps the cleanup cheap and avoids stale state.
  const timersRef = useRef<Map<string, number>>(new Map())

  const dismissToast = useCallback((id: string) => {
    const timer = timersRef.current.get(id)
    if (timer !== undefined) {
      window.clearTimeout(timer)
      timersRef.current.delete(id)
    }
    setToasts((prev) => prev.filter((entry) => entry.id !== id))
  }, [])

  const showToast = useCallback(
    (type: ToastType, message: string) => {
      const trimmed = message.trim()
      if (!trimmed) return
      const id =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `toast-${Date.now()}-${Math.random().toString(16).slice(2)}`
      const entry: ToastEntry = { id, type, message: trimmed }
      setToasts((prev) => [...prev, entry])
      const timer = window.setTimeout(() => {
        dismissToast(id)
      }, DEFAULT_DURATION_MS)
      timersRef.current.set(id, timer)
    },
    [dismissToast],
  )

  // Drop every pending timer when the provider unmounts so we never call
  // setState on a removed tree.
  useEffect(() => {
    const timers = timersRef.current
    return () => {
      timers.forEach((timer) => window.clearTimeout(timer))
      timers.clear()
    }
  }, [])

  const value = useMemo(
    () => ({ showToast, dismissToast }),
    [showToast, dismissToast],
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-y-0 right-0 z-70 flex w-full max-w-sm flex-col items-end gap-3 px-4 py-6 sm:px-6"
        aria-live="polite"
        aria-atomic="false"
      >
        <AnimatePresence initial={false}>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              layout
              initial={{ x: 80, opacity: 0, scale: 0.96 }}
              animate={{ x: 0, opacity: 1, scale: 1 }}
              exit={{ x: 60, opacity: 0, scale: 0.96 }}
              transition={{
                type: 'spring',
                stiffness: 380,
                damping: 32,
              }}
              className={cn(
                'glass-strong pointer-events-auto flex w-full items-start gap-3 rounded-2xl border px-4 py-3 text-sm shadow-(--shadow-cinema)',
                toast.type === 'success' && 'border-emerald-400/40',
                toast.type === 'error' && 'border-rose-400/40',
                toast.type === 'info' && 'border-(--accent)/40',
              )}
              role={toast.type === 'error' ? 'alert' : 'status'}
            >
              <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center">
                {toast.type === 'success' ? (
                  <CheckCircle2 size={16} className="text-emerald-400" />
                ) : toast.type === 'error' ? (
                  <AlertTriangle size={16} className="text-rose-400" />
                ) : (
                  <Info size={16} className="text-(--accent)" />
                )}
              </span>
              <p className="min-w-0 flex-1 wrap-break-word leading-relaxed text-(--text-primary)">
                {toast.message}
              </p>
              <button
                type="button"
                onClick={() => dismissToast(toast.id)}
                className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-(--text-muted) transition hover:bg-(--surface-strong) hover:text-(--text-primary)"
                aria-label="Dismiss notification"
              >
                <X size={12} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}
