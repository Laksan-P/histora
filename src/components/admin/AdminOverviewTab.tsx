import { motion } from 'framer-motion'
import {
  ArrowRight,
  BookOpenText,
  Crown,
  Library,
  MessageSquareQuote,
  Users,
  UsersRound,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import {
  fetchAdminCounts,
  listAllConversations,
  listProfiles,
  type AdminConversation,
  type AdminCounts,
  type AdminProfile,
} from '../../lib/adminApi'
import { cn } from '../../lib/cn'
import {
  AdminEmpty,
  AdminListSkeleton,
  AdminSection,
  type AdminTabKey,
} from './AdminUI'

type AdminOverviewTabProps = {
  refreshSignal: number
  onJumpTo: (key: AdminTabKey) => void
}

type Stat = {
  key: keyof AdminCounts
  eyebrow: string
  icon: LucideIcon
  accent?: boolean
  cta?: { label: string; tab: AdminTabKey }
}

const STATS: Stat[] = [
  {
    key: 'events',
    eyebrow: 'Events',
    icon: BookOpenText,
    cta: { label: 'Manage events', tab: 'events' },
  },
  {
    key: 'characters',
    eyebrow: 'Characters',
    icon: UsersRound,
    cta: { label: 'Manage characters', tab: 'characters' },
  },
  {
    key: 'sourceNotes',
    eyebrow: 'Source notes',
    icon: Library,
    cta: { label: 'Manage notes', tab: 'sourceNotes' },
  },
  {
    key: 'conversations',
    eyebrow: 'Conversations',
    icon: MessageSquareQuote,
    cta: { label: 'Inspect logs', tab: 'users' },
  },
  {
    key: 'profiles',
    eyebrow: 'Accounts',
    icon: Users,
    cta: { label: 'Inspect users', tab: 'users' },
  },
  {
    key: 'admins',
    eyebrow: 'Admins',
    icon: Crown,
    accent: true,
  },
]

function formatDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function AdminOverviewTab({
  refreshSignal,
  onJumpTo,
}: AdminOverviewTabProps) {
  const [counts, setCounts] = useState<AdminCounts | null>(null)
  const [profiles, setProfiles] = useState<AdminProfile[]>([])
  const [conversations, setConversations] = useState<AdminConversation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [trackedSignal, setTrackedSignal] = useState(refreshSignal)

  // When the parent fires Refresh, flip the tab back into a loading state at
  // render time. This avoids calling setState() synchronously inside the
  // effect body (which the React rules-of-hooks lint forbids) while still
  // showing skeletons immediately.
  if (trackedSignal !== refreshSignal) {
    setTrackedSignal(refreshSignal)
    setLoading(true)
    setError(null)
  }

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const [nextCounts, nextProfiles, nextConversations] = await Promise.all([
          fetchAdminCounts(),
          listProfiles(8),
          listAllConversations(8),
        ])
        if (cancelled) return
        setCounts(nextCounts)
        setProfiles(nextProfiles)
        setConversations(nextConversations)
      } catch (caught) {
        if (cancelled) return
        setError(
          caught instanceof Error
            ? caught.message
            : 'Could not load admin overview.',
        )
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [refreshSignal])

  return (
    <div className="flex flex-col gap-5">
      {error ? (
        <div className="glass rounded-3xl border border-rose-400/30 p-5 text-sm text-rose-200">
          <p className="font-semibold">Could not load overview.</p>
          <p className="mt-1 text-xs leading-relaxed text-rose-100/80">{error}</p>
        </div>
      ) : null}

      <div className="grid auto-rows-fr gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {STATS.map((stat) => {
          const value = counts ? counts[stat.key] : null
          return (
            <motion.div
              key={stat.key}
              whileHover={{ y: -3 }}
              transition={{ type: 'spring', stiffness: 320, damping: 24 }}
              className="glass flex h-full flex-col justify-between gap-4 rounded-3xl p-5 transition-shadow hover:shadow-(--shadow-cinema)"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <span className="font-mono text-[10px] uppercase tracking-[0.32em] text-(--text-muted)">
                    {stat.eyebrow}
                  </span>
                  <p className="font-display mt-1 text-3xl font-semibold text-(--text-primary) sm:text-4xl">
                    {loading || value === null ? '—' : value}
                  </p>
                </div>
                <span
                  className={cn(
                    'grid h-11 w-11 shrink-0 place-items-center rounded-2xl',
                    stat.accent
                      ? 'bg-(--accent-soft) text-(--accent)'
                      : 'bg-(--surface-strong) text-(--text-secondary)',
                  )}
                >
                  <stat.icon size={18} />
                </span>
              </div>
              {stat.cta ? (
                <button
                  type="button"
                  onClick={() => onJumpTo(stat.cta!.tab)}
                  className="group inline-flex items-center gap-1 self-start rounded-full px-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-(--text-secondary) transition hover:text-(--accent)"
                >
                  {stat.cta.label}
                  <ArrowRight
                    size={12}
                    className="transition-transform group-hover:translate-x-0.5"
                  />
                </button>
              ) : null}
            </motion.div>
          )
        })}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <AdminSection
          eyebrow="Recent profiles"
          title="People joining Histora"
          actions={
            <button
              type="button"
              onClick={() => onJumpTo('users')}
              className="inline-flex items-center gap-1 rounded-full bg-(--surface-strong) px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-(--text-secondary) transition hover:text-(--accent)"
            >
              View all
              <ArrowRight size={11} />
            </button>
          }
        >
          {loading ? (
            <AdminListSkeleton rows={4} />
          ) : profiles.length === 0 ? (
            <AdminEmpty
              icon={Users}
              title="No profiles yet."
              message="The first signup will appear here."
            />
          ) : (
            <ul className="flex flex-col gap-2">
              {profiles.map((profile) => (
                <li
                  key={profile.id}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-(--border-soft) bg-(--surface-strong) px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-(--text-primary)">
                      {profile.email ?? '(no email)'}
                    </p>
                    <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-(--text-muted)">
                      Joined {formatDate(profile.createdAt)}
                    </p>
                  </div>
                  <span
                    className={cn(
                      'inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.22em]',
                      profile.role === 'admin'
                        ? 'bg-(--accent-soft) text-(--accent)'
                        : 'bg-(--surface) text-(--text-muted)',
                    )}
                  >
                    {profile.role === 'admin' ? (
                      <Crown size={11} />
                    ) : (
                      <Users size={11} />
                    )}
                    {profile.role}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </AdminSection>

        <AdminSection
          eyebrow="Recent conversations"
          title="Across the archive"
          actions={
            <button
              type="button"
              onClick={() => onJumpTo('users')}
              className="inline-flex items-center gap-1 rounded-full bg-(--surface-strong) px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-(--text-secondary) transition hover:text-(--accent)"
            >
              View all
              <ArrowRight size={11} />
            </button>
          }
        >
          {loading ? (
            <AdminListSkeleton rows={4} />
          ) : conversations.length === 0 ? (
            <AdminEmpty
              icon={MessageSquareQuote}
              title="No conversations yet."
              message="Conversations show up here as users chat with perspectives."
            />
          ) : (
            <ul className="flex flex-col gap-2">
              {conversations.map((conv) => (
                <li
                  key={conv.id}
                  className="flex flex-col gap-1 rounded-2xl border border-(--border-soft) bg-(--surface-strong) px-4 py-3"
                >
                  <p className="line-clamp-2 text-sm font-semibold leading-snug text-(--text-primary)">
                    {conv.title}
                  </p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px] uppercase tracking-[0.22em] text-(--text-muted)">
                    <span>Event {conv.eventId ?? '—'}</span>
                    <span>Char {conv.characterId ?? '—'}</span>
                    <span>{formatDate(conv.updatedAt)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </AdminSection>
      </div>
    </div>
  )
}
