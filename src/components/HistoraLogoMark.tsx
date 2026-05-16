import { cn } from '../lib/cn'

/** Served from `public/histora.png` — favicon, PWA, and inline branding. */
export const HISTORA_LOGO_SRC = '/histora.png'

type LogoVariant =
  | 'navbar'
  | 'authHeader'
  | 'authCard'
  | 'footer'
  | 'admin'
  | 'bootSplash'

const shell =
  'relative overflow-hidden rounded-xl bg-white shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)] dark:ring-1 dark:ring-white/12'

const frame: Record<LogoVariant, string> = {
  navbar: 'h-9 w-9 shrink-0 sm:h-10 sm:w-10',
  authHeader: 'h-10 w-10 shrink-0 sm:h-11 sm:w-11',
  authCard: 'mx-auto h-[4.25rem] w-[4.25rem] shrink-0 sm:h-[4.75rem] sm:w-[4.75rem]',
  footer: 'h-10 w-10 shrink-0 sm:h-11 sm:w-11',
  admin: 'h-8 w-8 shrink-0 sm:h-9 sm:w-9',
  bootSplash:
    'mx-auto h-[5.25rem] w-[5.25rem] shrink-0 rounded-2xl sm:h-[6.25rem] sm:w-[6.25rem]',
}

type HistoraLogoMarkProps = {
  variant: LogoVariant
  className?: string
  /** Below-the-fold marks default lazy; navbar/header stay eager. */
  lazy?: boolean
}

export function HistoraLogoMark({
  variant,
  className,
  lazy,
}: HistoraLogoMarkProps) {
  const loadLazy = lazy ?? variant === 'footer'

  return (
    <span className={cn(shell, frame[variant], className)}>
      <img
        src={HISTORA_LOGO_SRC}
        alt="Histora logo"
        className="box-border h-full w-full object-contain object-center p-[10%]"
        loading={loadLazy ? 'lazy' : 'eager'}
        decoding="async"
      />
    </span>
  )
}
