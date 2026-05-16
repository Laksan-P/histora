import { motion } from 'framer-motion'
import {
  History,
  Loader2,
  MessageSquareQuote,
  Plus,
  Trash2,
} from 'lucide-react'
import type { ConversationSummary } from '../lib/conversations'
import { cn } from '../lib/cn'

type HistoryPanelProps = {
  conversations: ConversationSummary[]
  loading: boolean
  error: string | null
  activeConversationId: string | null
  deletingConversationId: string | null
  onSelect: (conversationId: string) => void
  onDelete: (conversationId: string) => void
  onNewChat: () => void
}

function formatRelative(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const diff = (Date.now() - date.getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86_400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 604_800) return `${Math.floor(diff / 86_400)}d ago`
  return date.toLocaleDateString()
}

export default function HistoryPanel({
  conversations,
  loading,
  error,
  activeConversationId,
  deletingConversationId,
  onSelect,
  onDelete,
  onNewChat,
}: HistoryPanelProps) {
  const items = conversations.slice(0, 6)
  const hasItems = items.length > 0

  return (
    <div className="glass flex shrink-0 flex-col gap-4 overflow-hidden rounded-3xl p-4 box-border max-w-full min-w-0 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-display inline-flex items-center gap-2 text-base font-semibold text-(--text-primary)">
          <span className="grid h-7 w-7 place-items-center rounded-xl bg-(--accent-soft) text-(--accent)">
            <History size={14} />
          </span>
          Recent conversations
        </h3>
        <motion.button
          type="button"
          onClick={onNewChat}
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.94 }}
          transition={{ type: 'spring', stiffness: 380, damping: 26 }}
          className="inline-flex items-center gap-1.5 rounded-full bg-(--text-primary) px-3 py-1 text-[11px] font-semibold text-(--background) shadow-sm transition hover:opacity-90"
          aria-label="Start a new conversation"
        >
          <Plus size={12} />
          New
        </motion.button>
      </div>

      {loading && !hasItems ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((row) => (
            <div
              key={row}
              className="shimmer-bar h-12 w-full rounded-2xl opacity-80"
            />
          ))}
        </div>
      ) : null}

      {error && !loading ? (
        <p className="rounded-2xl border border-rose-400/30 bg-rose-400/5 px-3.5 py-2.5 text-[11px] leading-relaxed text-rose-300">
          {error}
        </p>
      ) : null}

      {!loading && !error && !hasItems ? (
        <div className="rounded-2xl border border-dashed border-(--border-soft) bg-(--surface-strong)/60 px-3.5 py-4 text-center">
          <p className="text-xs leading-relaxed text-(--text-muted)">
            No conversations saved yet.
            <br />
            Ask your first question — it'll show up here automatically.
          </p>
        </div>
      ) : null}

      {hasItems ? (
        <ul className="scrollbar-thin -mr-1 flex max-h-60 flex-col gap-2 overflow-y-auto overscroll-contain pr-1">
          {items.map((conv) => {
            const isActive = activeConversationId === conv.id
            const isDeleting = deletingConversationId === conv.id
            return (
              <li key={conv.id}>
                <motion.div
                  whileHover={{ x: 2 }}
                  transition={{ type: 'spring', stiffness: 380, damping: 26 }}
                  className={cn(
                    'group relative flex items-stretch gap-1.5 rounded-2xl border transition',
                    isActive
                      ? 'border-(--accent)/60 bg-(--accent-soft)'
                      : 'border-(--border-soft) bg-(--surface-strong) hover:border-(--accent)/40',
                    isDeleting && 'opacity-60',
                  )}
                  aria-current={isActive ? 'true' : undefined}
                >
                  <button
                    type="button"
                    onClick={() => onSelect(conv.id)}
                    disabled={isDeleting}
                    className="flex flex-1 flex-col items-start gap-1.5 rounded-2xl px-3.5 py-2.5 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-(--accent)/40"
                  >
                    <span className="line-clamp-2 text-sm font-semibold leading-snug text-(--text-primary)">
                      {conv.title}
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.24em] text-(--text-muted)">
                      <MessageSquareQuote size={10} />
                      {formatRelative(conv.updatedAt)}
                    </span>
                  </button>
                  <motion.button
                    type="button"
                    onClick={() => onDelete(conv.id)}
                    disabled={isDeleting}
                    whileHover={isDeleting ? undefined : { scale: 1.08 }}
                    whileTap={isDeleting ? undefined : { scale: 0.92 }}
                    transition={{ type: 'spring', stiffness: 380, damping: 26 }}
                    className="my-2 mr-2 grid h-7 w-7 shrink-0 place-items-center self-center rounded-full text-(--text-muted) opacity-70 transition hover:bg-rose-500/15 hover:text-rose-400 hover:opacity-100 group-hover:opacity-100 focus-visible:opacity-100 disabled:cursor-not-allowed"
                    aria-label={
                      isDeleting ? 'Deleting conversation…' : 'Delete conversation'
                    }
                    title="Delete conversation"
                  >
                    {isDeleting ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Trash2 size={12} />
                    )}
                  </motion.button>
                </motion.div>
              </li>
            )
          })}
          {loading ? (
            <li className="pl-1">
              <span className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.24em] text-(--text-muted)">
                <Loader2 size={10} className="animate-spin" />
                Refreshing…
              </span>
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  )
}
