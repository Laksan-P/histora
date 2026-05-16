import { motion } from 'framer-motion'
import { Crown, MessageSquareQuote, Trash2, Users } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import {
  deleteAdminConversation,
  listAllConversations,
  listProfiles,
  type AdminConversation,
  type AdminProfile,
} from '../../lib/adminApi'
import { cn } from '../../lib/cn'
import {
  AdminEmpty,
  AdminInlineSelect,
  AdminListSkeleton,
  AdminSearchInput,
  AdminSection,
  AdminToastBanner,
  ConfirmDialog,
} from './AdminUI'
import { useAdminToast } from './useAdminToast'

type AdminUsersTabProps = {
  refreshSignal: number
  onAfterMutate: () => void
}

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

function shortenId(value: string | null): string {
  if (!value) return '—'
  return value.length <= 10 ? value : `${value.slice(0, 8)}…`
}

export default function AdminUsersTab({
  refreshSignal,
  onAfterMutate,
}: AdminUsersTabProps) {
  const [profiles, setProfiles] = useState<AdminProfile[]>([])
  const [conversations, setConversations] = useState<AdminConversation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [profileSearch, setProfileSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'user'>('all')
  const [conversationSearch, setConversationSearch] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<AdminConversation | null>(
    null,
  )
  const [deleting, setDeleting] = useState(false)
  const [trackedSignal, setTrackedSignal] = useState(refreshSignal)
  const toast = useAdminToast()

  if (trackedSignal !== refreshSignal) {
    setTrackedSignal(refreshSignal)
    setLoading(true)
    setError(null)
  }

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const [nextProfiles, nextConversations] = await Promise.all([
          listProfiles(),
          listAllConversations(),
        ])
        if (cancelled) return
        setProfiles(nextProfiles)
        setConversations(nextConversations)
      } catch (caught) {
        if (cancelled) return
        setError(
          caught instanceof Error
            ? caught.message
            : 'Could not load users and logs.',
        )
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [refreshSignal])

  const filteredProfiles = useMemo(() => {
    const term = profileSearch.trim().toLowerCase()
    return profiles.filter((profile) => {
      if (roleFilter !== 'all' && profile.role !== roleFilter) return false
      if (!term) return true
      return (profile.email ?? '').toLowerCase().includes(term)
    })
  }, [profiles, profileSearch, roleFilter])

  const filteredConversations = useMemo(() => {
    const term = conversationSearch.trim().toLowerCase()
    if (!term) return conversations
    return conversations.filter((conversation) =>
      [
        conversation.title,
        conversation.eventId,
        conversation.characterId,
        conversation.userId,
      ]
        .filter((value): value is string => Boolean(value))
        .join(' ')
        .toLowerCase()
        .includes(term),
    )
  }, [conversations, conversationSearch])

  const handleDeleteConversation = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteAdminConversation(deleteTarget.id)
      setConversations((prev) =>
        prev.filter((row) => row.id !== deleteTarget.id),
      )
      toast.success('Conversation deleted.')
      setDeleteTarget(null)
      onAfterMutate()
    } catch (caught) {
      toast.error(
        caught instanceof Error
          ? caught.message
          : 'Could not delete conversation.',
      )
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <AdminToastBanner toast={toast.toast} onDismiss={toast.dismiss} />

      {error ? (
        <div className="glass rounded-3xl border border-rose-400/30 p-5 text-sm text-rose-200">
          <p className="font-semibold">Could not load users and logs.</p>
          <p className="mt-1 text-xs leading-relaxed text-rose-100/80">{error}</p>
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[1.1fr_1fr]">
        <AdminSection
          eyebrow="Identity"
          title="Profiles"
          description="Read-only view. Admin promotion happens in the Supabase dashboard."
          actions={
            <>
              <AdminInlineSelect
                ariaLabel="Filter by role"
                value={roleFilter}
                onChange={(event) =>
                  setRoleFilter(event.target.value as typeof roleFilter)
                }
              >
                <option value="all">All roles</option>
                <option value="user">Users</option>
                <option value="admin">Admins</option>
              </AdminInlineSelect>
              <AdminSearchInput
                ariaLabel="Search profiles by email"
                value={profileSearch}
                onChange={(event) => setProfileSearch(event.target.value)}
                placeholder="Search by email"
              />
            </>
          }
        >
          {loading ? (
            <AdminListSkeleton rows={6} />
          ) : filteredProfiles.length === 0 ? (
            <AdminEmpty
              icon={Users}
              title={
                profileSearch || roleFilter !== 'all'
                  ? 'No profiles match this filter.'
                  : 'No profiles yet.'
              }
              message={
                profileSearch || roleFilter !== 'all'
                  ? 'Adjust the filter or clear the search to see everyone.'
                  : 'New signups will appear here automatically.'
              }
            />
          ) : (
            <ul className="scrollbar-thin -mr-2 flex max-h-128 flex-col gap-2 overflow-y-auto pr-2">
              {filteredProfiles.map((profile) => (
                <li
                  key={profile.id}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-(--border-soft) bg-(--surface-strong) px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-(--text-primary)">
                      {profile.email ?? '(no email)'}
                    </p>
                    <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-(--text-muted)">
                      {shortenId(profile.id)} · joined {formatDate(profile.createdAt)}
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
          eyebrow="Activity"
          title="Conversations"
          description="Inspect every chat in the archive. Deletion removes the conversation and its messages."
          actions={
            <AdminSearchInput
              ariaLabel="Search conversations"
              value={conversationSearch}
              onChange={(event) => setConversationSearch(event.target.value)}
              placeholder="Search conversations"
            />
          }
        >
          {loading ? (
            <AdminListSkeleton rows={6} />
          ) : filteredConversations.length === 0 ? (
            <AdminEmpty
              icon={MessageSquareQuote}
              title={
                conversationSearch
                  ? 'No conversations match your search.'
                  : 'No conversations yet.'
              }
              message="Conversations show up here as users chat with perspectives."
            />
          ) : (
            <ul className="scrollbar-thin -mr-2 flex max-h-128 flex-col gap-2 overflow-y-auto pr-2">
              {filteredConversations.map((conversation) => (
                <motion.li
                  key={conversation.id}
                  whileHover={{ y: -1 }}
                  transition={{ type: 'spring', stiffness: 320, damping: 26 }}
                  className="flex items-start justify-between gap-3 rounded-2xl border border-(--border-soft) bg-(--surface-strong) px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="line-clamp-2 text-sm font-semibold leading-snug text-(--text-primary)">
                      {conversation.title}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px] uppercase tracking-[0.22em] text-(--text-muted)">
                      <span>User {shortenId(conversation.userId)}</span>
                      <span>· Event {conversation.eventId ?? '—'}</span>
                      <span>· Char {conversation.characterId ?? '—'}</span>
                      <span>· {formatDate(conversation.updatedAt)}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(conversation)}
                    aria-label="Delete conversation"
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-(--surface) text-(--text-secondary) transition hover:bg-rose-500/15 hover:text-rose-300"
                  >
                    <Trash2 size={13} />
                  </button>
                </motion.li>
              ))}
            </ul>
          )}
        </AdminSection>
      </div>

      <ConfirmDialog
        open={deleteTarget !== null}
        tone="danger"
        title="Delete this conversation?"
        description={
          <span>
            This permanently removes the conversation <em>and</em> every
            message inside it. The owner will not see it in their history
            anymore.
          </span>
        }
        confirmLabel="Delete conversation"
        loading={deleting}
        onCancel={() => (deleting ? undefined : setDeleteTarget(null))}
        onConfirm={handleDeleteConversation}
      />
    </div>
  )
}
