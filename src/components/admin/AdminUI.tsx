import { AnimatePresence, motion, type Variants } from 'framer-motion'
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Loader2,
  X,
  type LucideIcon,
} from 'lucide-react'
import {
  forwardRef,
  useEffect,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'
import { cn } from '../../lib/cn'
import type { AdminToast, AdminToastTone } from './useAdminToast'

export type { AdminToast, AdminToastTone } from './useAdminToast'

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------

export type AdminTabKey =
  | 'overview'
  | 'events'
  | 'characters'
  | 'sourceNotes'
  | 'users'

export type AdminTab = {
  key: AdminTabKey
  label: string
  icon: LucideIcon
  hint?: string
}

type AdminTabsProps = {
  tabs: AdminTab[]
  activeKey: AdminTabKey
  onChange: (key: AdminTabKey) => void
}

export function AdminTabs({ tabs, activeKey, onChange }: AdminTabsProps) {
  return (
    <nav
      role="tablist"
      aria-label="Admin sections"
      className="scrollbar-thin -mx-1 flex min-w-0 max-w-full gap-1 overflow-x-auto rounded-3xl border border-(--border-soft) bg-(--surface) p-1 sm:gap-2"
    >
      {tabs.map((tab) => {
        const active = tab.key === activeKey
        return (
          <motion.button
            key={tab.key}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(tab.key)}
            whileHover={active ? undefined : { scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 380, damping: 26 }}
            className={cn(
              'relative inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] transition-colors',
              active
                ? 'bg-(--text-primary) text-(--background) shadow-sm'
                : 'text-(--text-muted) hover:bg-(--surface-strong) hover:text-(--text-primary)',
            )}
          >
            <tab.icon size={13} />
            <span>{tab.label}</span>
          </motion.button>
        )
      })}
    </nav>
  )
}

// ---------------------------------------------------------------------------
// Toast / inline banner
// ---------------------------------------------------------------------------

type AdminToastBannerProps = {
  toast: AdminToast | null
  onDismiss: () => void
}

const TONE_STYLES: Record<AdminToastTone, string> = {
  success: 'border-emerald-400/40 bg-emerald-400/10 text-emerald-200',
  error: 'border-rose-400/40 bg-rose-400/10 text-rose-200',
  info: 'border-(--accent)/40 bg-(--accent-soft) text-(--accent)',
}

const TONE_ICON: Record<AdminToastTone, LucideIcon> = {
  success: CheckCircle2,
  error: AlertTriangle,
  info: AlertTriangle,
}

export function AdminToastBanner({ toast, onDismiss }: AdminToastBannerProps) {
  useEffect(() => {
    if (!toast) return
    if (toast.tone === 'error') return
    const timer = window.setTimeout(onDismiss, 4500)
    return () => window.clearTimeout(timer)
  }, [toast, onDismiss])

  return (
    <AnimatePresence>
      {toast ? (
        <motion.div
          key={toast.id}
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          role={toast.tone === 'error' ? 'alert' : 'status'}
          className={cn(
            'flex items-start gap-3 rounded-2xl border px-4 py-3 text-xs leading-relaxed shadow-sm',
            TONE_STYLES[toast.tone],
          )}
        >
          {(() => {
            const Icon = TONE_ICON[toast.tone]
            return <Icon size={14} className="mt-0.5 shrink-0" />
          })()}
          <span className="flex-1">{toast.message}</span>
          <button
            type="button"
            onClick={onDismiss}
            className="-m-1 rounded-full p-1 text-current/70 transition hover:bg-current/10 hover:text-current"
            aria-label="Dismiss notification"
          >
            <X size={12} />
          </button>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}

// ---------------------------------------------------------------------------
// Confirm dialog (delete confirmation, etc.)
// ---------------------------------------------------------------------------

type ConfirmDialogProps = {
  open: boolean
  title: string
  description?: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  loading?: boolean
  tone?: 'danger' | 'default'
  onConfirm: () => void
  onCancel: () => void
}

const overlayVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.18 } },
}

const dialogVariants: Variants = {
  hidden: { opacity: 0, scale: 0.96, y: 8 },
  visible: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.22 } },
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  loading,
  tone = 'default',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !loading) onCancel()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, loading, onCancel])

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="overlay"
          variants={overlayVariants}
          initial="hidden"
          animate="visible"
          exit="hidden"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
        >
          <motion.div
            variants={dialogVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            className="glass-strong relative w-full max-w-md overflow-hidden rounded-3xl p-6"
          >
            <div className="flex items-start gap-3">
              <span
                className={cn(
                  'grid h-10 w-10 shrink-0 place-items-center rounded-2xl',
                  tone === 'danger'
                    ? 'bg-rose-500/15 text-rose-300'
                    : 'bg-(--accent-soft) text-(--accent)',
                )}
              >
                <AlertTriangle size={18} />
              </span>
              <div>
                <h3 className="font-display text-lg font-semibold text-(--text-primary)">
                  {title}
                </h3>
                {description ? (
                  <div className="mt-2 text-xs leading-relaxed text-(--text-secondary)">
                    {description}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={onCancel}
                disabled={loading}
                className="rounded-full border border-(--border-soft) bg-(--surface) px-4 py-2 text-xs font-semibold text-(--text-secondary) transition hover:border-(--accent) hover:text-(--text-primary) disabled:opacity-60"
              >
                {cancelLabel}
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={loading}
                className={cn(
                  'inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60',
                  tone === 'danger'
                    ? 'bg-rose-500/85 text-white hover:bg-rose-500'
                    : 'bg-(--text-primary) text-(--background) hover:opacity-95',
                )}
              >
                {loading ? <Loader2 size={13} className="animate-spin" /> : null}
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}

// ---------------------------------------------------------------------------
// Form primitives
// ---------------------------------------------------------------------------

type FieldShellProps = {
  label: string
  hint?: string
  required?: boolean
  error?: string | null
  children: ReactNode
}

function FieldShell({ label, hint, required, error, children }: FieldShellProps) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.22em] text-(--text-muted)">
        <span>
          {label}
          {required ? (
            <span className="ml-1 text-(--accent)" aria-hidden>
              *
            </span>
          ) : null}
        </span>
        {hint ? <span className="font-mono normal-case text-(--text-muted)">{hint}</span> : null}
      </span>
      {children}
      {error ? (
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-rose-300">
          {error}
        </span>
      ) : null}
    </label>
  )
}

const fieldInputClass =
  'w-full rounded-2xl border border-(--border-soft) bg-(--surface) px-4 py-2.5 text-sm text-(--text-primary) placeholder:text-(--text-muted) transition focus:border-(--accent) focus:outline-none disabled:opacity-60'

type AdminTextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string
  hint?: string
  error?: string | null
}

export const AdminTextField = forwardRef<HTMLInputElement, AdminTextFieldProps>(
  function AdminTextField(
    { label, hint, error, required, className, ...rest },
    ref,
  ) {
    return (
      <FieldShell label={label} hint={hint} required={required} error={error}>
        <input
          ref={ref}
          required={required}
          {...rest}
          className={cn(fieldInputClass, className)}
        />
      </FieldShell>
    )
  },
)

type AdminTextAreaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string
  hint?: string
  error?: string | null
}

export const AdminTextArea = forwardRef<HTMLTextAreaElement, AdminTextAreaProps>(
  function AdminTextArea(
    { label, hint, error, required, className, rows = 4, ...rest },
    ref,
  ) {
    return (
      <FieldShell label={label} hint={hint} required={required} error={error}>
        <textarea
          ref={ref}
          rows={rows}
          required={required}
          {...rest}
          className={cn(fieldInputClass, 'resize-y leading-relaxed', className)}
        />
      </FieldShell>
    )
  },
)

type AdminSelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string
  hint?: string
  error?: string | null
}

export const AdminSelect = forwardRef<HTMLSelectElement, AdminSelectProps>(
  function AdminSelect({ label, hint, error, required, className, ...rest }, ref) {
    return (
      <FieldShell label={label} hint={hint} required={required} error={error}>
        <span className="relative block">
          <select
            ref={ref}
            required={required}
            {...rest}
            className={cn(
              fieldInputClass,
              'appearance-none pr-10 [&>option]:bg-(--surface) [&>option]:text-(--text-primary)',
              className,
            )}
          />
          <ChevronDown
            size={14}
            aria-hidden
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-(--text-muted)"
          />
        </span>
      </FieldShell>
    )
  },
)

// ---------------------------------------------------------------------------
// Inline select (used inside section headers / filter rows)
// ---------------------------------------------------------------------------

type AdminInlineSelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  ariaLabel: string
}

export const AdminInlineSelect = forwardRef<
  HTMLSelectElement,
  AdminInlineSelectProps
>(function AdminInlineSelect({ ariaLabel, className, ...rest }, ref) {
  return (
    <span className="relative inline-flex w-full sm:w-auto">
      <select
        ref={ref}
        aria-label={ariaLabel}
        {...rest}
        className={cn(
          'min-w-0 flex-1 appearance-none truncate rounded-full border border-(--border-soft) bg-(--surface-strong) py-2 pl-4 pr-9 text-xs font-medium text-(--text-primary) transition focus:border-(--accent) focus:outline-none disabled:cursor-not-allowed disabled:opacity-60 [&>option]:bg-(--surface) [&>option]:text-(--text-primary) sm:min-w-48',
          className,
        )}
      />
      <ChevronDown
        size={13}
        aria-hidden
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-(--text-muted)"
      />
    </span>
  )
})

// ---------------------------------------------------------------------------
// Inline search (matches the inline select styling)
// ---------------------------------------------------------------------------

type AdminSearchInputProps = InputHTMLAttributes<HTMLInputElement> & {
  ariaLabel?: string
}

export const AdminSearchInput = forwardRef<
  HTMLInputElement,
  AdminSearchInputProps
>(function AdminSearchInput({ ariaLabel, className, ...rest }, ref) {
  return (
    <span className="relative inline-flex w-full sm:w-auto">
      <span
        aria-hidden
        className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-(--text-muted)"
      >
        {/* keep the icon-free version in sync with parent imports */}
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
      </span>
      <input
        ref={ref}
        type="search"
        aria-label={ariaLabel}
        {...rest}
        className={cn(
          'w-full min-w-0 rounded-full border border-(--border-soft) bg-(--surface-strong) py-2 pl-9 pr-3 text-xs text-(--text-primary) placeholder:text-(--text-muted) focus:border-(--accent) focus:outline-none sm:w-56',
          className,
        )}
      />
    </span>
  )
})

// ---------------------------------------------------------------------------
// Button
// ---------------------------------------------------------------------------

type AdminButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md'
  icon?: LucideIcon
  loading?: boolean
}

const buttonBase =
  'inline-flex items-center justify-center gap-2 rounded-full font-semibold transition disabled:cursor-not-allowed disabled:opacity-60'

const buttonVariant: Record<
  NonNullable<AdminButtonProps['variant']>,
  string
> = {
  primary:
    'bg-(--text-primary) text-(--background) shadow-sm hover:opacity-95 hover:shadow-(--shadow-cinema)',
  secondary:
    'border border-(--border-soft) bg-(--surface) text-(--text-secondary) hover:border-(--accent) hover:text-(--text-primary)',
  ghost:
    'text-(--text-secondary) hover:bg-(--surface) hover:text-(--text-primary)',
  danger:
    'bg-rose-500/85 text-white shadow-sm hover:bg-rose-500',
}

const buttonSize: Record<NonNullable<AdminButtonProps['size']>, string> = {
  sm: 'px-3 py-1.5 text-[11px] uppercase tracking-[0.18em]',
  md: 'px-4 py-2 text-xs uppercase tracking-[0.18em] sm:px-5',
}

export function AdminButton({
  variant = 'primary',
  size = 'md',
  icon: Icon,
  loading,
  children,
  className,
  type = 'button',
  ...rest
}: AdminButtonProps) {
  return (
    <button
      type={type}
      {...rest}
      disabled={rest.disabled || loading}
      className={cn(buttonBase, buttonVariant[variant], buttonSize[size], className)}
    >
      {loading ? (
        <Loader2 size={13} className="animate-spin" />
      ) : Icon ? (
        <Icon size={13} />
      ) : null}
      {children}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Section wrapper
// ---------------------------------------------------------------------------

type AdminSectionProps = {
  eyebrow?: string
  title?: string
  description?: string
  actions?: ReactNode
  children: ReactNode
  className?: string
}

export function AdminSection({
  eyebrow,
  title,
  description,
  actions,
  children,
  className,
}: AdminSectionProps) {
  return (
    <div
      className={cn(
        'glass flex min-w-0 max-w-full flex-col gap-5 overflow-x-clip rounded-3xl p-6 sm:p-7',
        className,
      )}
    >
      {eyebrow || title || actions ? (
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            {eyebrow ? (
              <span className="font-mono text-[10px] uppercase tracking-[0.32em] text-(--text-muted)">
                {eyebrow}
              </span>
            ) : null}
            {title ? (
              <h3 className="font-display mt-1 text-2xl font-semibold text-(--text-primary) sm:text-3xl">
                {title}
              </h3>
            ) : null}
            {description ? (
              <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-(--text-secondary)">
                {description}
              </p>
            ) : null}
          </div>
          {actions ? (
            <div className="flex w-full flex-wrap items-center gap-2 lg:w-auto lg:justify-end">
              {actions}
            </div>
          ) : null}
        </header>
      ) : null}
      {children}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Empty / loading / error states for lists
// ---------------------------------------------------------------------------

export function AdminEmpty({
  icon: Icon,
  title,
  message,
}: {
  icon?: LucideIcon
  title: string
  message?: string
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-(--border-soft) bg-(--surface-strong)/60 px-6 py-10 text-center">
      {Icon ? (
        <span className="grid h-10 w-10 place-items-center rounded-2xl bg-(--surface-strong) text-(--text-muted)">
          <Icon size={18} />
        </span>
      ) : null}
      <p className="text-sm font-semibold text-(--text-primary)">{title}</p>
      {message ? (
        <p className="max-w-sm text-xs leading-relaxed text-(--text-muted)">{message}</p>
      ) : null}
    </div>
  )
}

export function AdminListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className="shimmer-bar h-14 w-full rounded-2xl opacity-80"
        />
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Toast hook (single banner queue)
// ---------------------------------------------------------------------------

