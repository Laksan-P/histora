import { AnimatePresence, motion } from 'framer-motion'
import { Compass, Crown, LogOut, UserCircle } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import ThemeToggle from './ThemeToggle'
import { HistoraLogoMark } from './HistoraLogoMark'
import UserAvatar from './UserAvatar'

export type NavLandingSection = 'how-it-works' | 'source-grounded'

type AccountInfo = {
  email: string | null
  isAdmin: boolean
  fullName?: string | null
  username?: string | null
  avatarUrl?: string | null
}

type NavbarProps = {
  onLogoClick: () => void
  onGoToEvents: () => void
  onScrollToLandingSection: (section: NavLandingSection) => void
  onStart: () => void
  account?: AccountInfo | null
  onOpenAdmin?: () => void
  onOpenProfile?: () => void
  onSignOut?: () => void
}

type NavLink =
  | { kind: 'view'; label: string; action: 'events' }
  | { kind: 'section'; label: string; section: NavLandingSection }

const NAV_LINKS: NavLink[] = [
  { kind: 'section', label: 'How it works', section: 'how-it-works' },
  { kind: 'view', label: 'Events', action: 'events' },
  { kind: 'section', label: 'Why source-grounded', section: 'source-grounded' },
]

export default function Navbar({
  onLogoClick,
  onGoToEvents,
  onScrollToLandingSection,
  onStart,
  account,
  onOpenAdmin,
  onOpenProfile,
  onSignOut,
}: NavbarProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)

  // Close the account menu when clicking outside or pressing Escape so it
  // never lingers over the chat dashboard.
  useEffect(() => {
    if (!menuOpen) return
    const handleClick = (event: MouseEvent) => {
      if (!menuRef.current) return
      if (menuRef.current.contains(event.target as Node)) return
      setMenuOpen(false)
    }
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [menuOpen])

  const handleLink = (link: NavLink) => {
    if (link.kind === 'view') {
      onGoToEvents()
    } else {
      onScrollToLandingSection(link.section)
    }
  }

  return (
    <motion.header
      initial={{ y: -16, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="relative z-20 mx-auto flex w-full min-w-0 max-w-7xl items-center gap-2 overflow-x-clip px-4 py-4 sm:gap-3 sm:px-6 lg:gap-6 lg:px-8 lg:py-6"
    >
      <button
        type="button"
        onClick={onLogoClick}
        className="group flex min-w-0 max-w-[min(56%,14rem)] shrink items-center gap-2 rounded-full py-1 text-left transition-opacity duration-300 hover:opacity-85 sm:max-w-none sm:gap-3"
      >
        <HistoraLogoMark variant="navbar" />
        <span className="flex min-w-0 flex-1 flex-col leading-tight">
          <span className="truncate font-display text-lg font-semibold tracking-tight text-(--text-primary) sm:text-2xl">
            Histora
          </span>
          <span className="hidden text-[10px] font-medium uppercase tracking-[0.32em] text-(--text-muted) lg:block">
            Interview the past
          </span>
        </span>
      </button>

      <nav className="hidden flex-1 items-center justify-center gap-1 lg:flex">
        {NAV_LINKS.map((link) => (
          <motion.button
            key={link.label}
            type="button"
            onClick={() => handleLink(link)}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 420, damping: 28 }}
            className="rounded-full px-4 py-2 text-sm font-medium text-(--text-secondary) transition-colors duration-300 hover:bg-(--surface) hover:text-(--text-primary)"
          >
            {link.label}
          </motion.button>
        ))}
      </nav>

      <div className="ml-auto flex min-w-0 shrink-0 items-center gap-1 sm:gap-2 lg:gap-3">
        <ThemeToggle variant="icon" />

        {account?.isAdmin && onOpenAdmin ? (
          <motion.button
            type="button"
            onClick={onOpenAdmin}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.94 }}
            transition={{ type: 'spring', stiffness: 380, damping: 26 }}
            className="hidden items-center gap-2 rounded-full border border-(--accent)/40 bg-(--accent-soft) px-3 py-1.5 text-xs font-semibold text-(--accent) shadow-sm transition hover:border-(--accent) sm:inline-flex"
            aria-label="Open admin dashboard"
          >
            <Crown size={13} />
            Admin
          </motion.button>
        ) : null}

        <motion.button
          type="button"
          onClick={onStart}
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.94 }}
          transition={{ type: 'spring', stiffness: 380, damping: 26 }}
          className="group inline-flex shrink-0 items-center gap-1.5 rounded-full bg-(--text-primary) px-3 py-2 text-xs font-semibold text-(--background) shadow-sm transition-shadow duration-300 hover:opacity-95 hover:shadow-(--shadow-cinema) sm:gap-2 sm:px-5 sm:text-sm"
        >
          <Compass size={14} className="hidden shrink-0 sm:block" />
          <span className="sm:hidden">Begin</span>
          <span className="hidden sm:inline">Begin Exploring</span>
        </motion.button>

        {account ? (
          <div ref={menuRef} className="relative shrink-0">
            <motion.button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.94 }}
              transition={{ type: 'spring', stiffness: 380, damping: 26 }}
              className="rounded-full transition focus:outline-none focus-visible:ring-2 focus-visible:ring-(--accent)/60"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label="Account menu"
            >
              {/* The avatar carries its own circular border via the
                  `ringed` prop, so the button itself is sized exactly
                  to the avatar — no extra padding or outer ring layers
                  that would push it taller than the neighbouring
                  "Begin Exploring" / "Admin" buttons. */}
              <UserAvatar
                src={account.avatarUrl}
                fullName={account.fullName}
                username={account.username}
                email={account.email}
                size="md"
                ringed={account.isAdmin}
                eager
                alt={account.fullName ?? account.email ?? 'Profile avatar'}
              />
            </motion.button>

            <AnimatePresence>
              {menuOpen ? (
                <motion.div
                  key="account-menu"
                  initial={{ opacity: 0, y: -6, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.98 }}
                  transition={{ duration: 0.16, ease: 'easeOut' }}
                  className="glass absolute right-0 top-11 z-40 w-[min(18rem,calc(100vw-2rem))] origin-top-right overflow-hidden rounded-2xl p-2 shadow-(--shadow-cinema) sm:top-12"
                  role="menu"
                >
                  <div className="flex items-center gap-3 rounded-xl bg-(--surface-strong) px-3 py-2.5">
                    <UserAvatar
                      src={account.avatarUrl}
                      fullName={account.fullName}
                      username={account.username}
                      email={account.email}
                      size="md"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-(--text-primary)">
                        {account.fullName ??
                          account.username ??
                          account.email ??
                          'Histora account'}
                      </p>
                      <p className="truncate text-[10px] text-(--text-muted)">
                        {account.email ?? '—'}
                      </p>
                      <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-(--text-muted)">
                        {account.isAdmin ? 'Admin' : 'Member'}
                      </p>
                    </div>
                  </div>

                  {onOpenProfile ? (
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false)
                        onOpenProfile()
                      }}
                      className="mt-1 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-semibold text-(--text-primary) transition hover:bg-(--accent-soft) hover:text-(--accent)"
                      role="menuitem"
                    >
                      <UserCircle size={13} />
                      Profile
                    </button>
                  ) : null}

                  {account.isAdmin && onOpenAdmin ? (
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false)
                        onOpenAdmin()
                      }}
                      className="mt-1 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-semibold text-(--text-primary) transition hover:bg-(--accent-soft) hover:text-(--accent)"
                      role="menuitem"
                    >
                      <Crown size={13} />
                      Admin dashboard
                    </button>
                  ) : null}

                  {onSignOut ? (
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false)
                        onSignOut()
                      }}
                      className="mt-1 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-semibold text-(--text-primary) transition hover:bg-rose-500/15 hover:text-rose-300"
                      role="menuitem"
                    >
                      <LogOut size={13} />
                      Sign out
                    </button>
                  ) : null}
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        ) : null}
      </div>
    </motion.header>
  )
}
