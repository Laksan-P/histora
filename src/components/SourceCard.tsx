import { AnimatePresence, motion } from 'framer-motion'
import {
  BookOpenText,
  BookmarkCheck,
  BookmarkPlus,
  ChevronDown,
  ExternalLink,
} from 'lucide-react'
import { useState } from 'react'
import type { SourceNote } from '../lib/types'
import { cn } from '../lib/cn'

type SourceCardProps = {
  note: SourceNote
  index?: number
  compact?: boolean
  archived?: boolean
  onArchive?: () => void
}

export default function SourceCard({
  note,
  index = 0,
  compact = false,
  archived = false,
  onArchive,
}: SourceCardProps) {
  const [expanded, setExpanded] = useState(!compact)
  const cardId = `source-${note.id}`
  const detailId = `${cardId}-detail`

  return (
    <motion.article
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.45, delay: index * 0.07 }}
      whileHover={{ y: -4 }}
      className={cn(
        'group relative max-w-full box-border overflow-hidden rounded-2xl border bg-(--surface) backdrop-blur-xl transition hover:shadow-(--shadow-cinema)',
        compact ? 'p-4 hover:bg-(--surface-strong)' : 'p-5',
        archived
          ? 'border-(--accent)/50 hover:border-(--accent)'
          : 'border-(--border-soft) hover:border-(--accent)/60',
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-(--accent)/15 opacity-0 blur-3xl transition group-hover:opacity-100"
      />

      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        aria-expanded={expanded}
        aria-controls={detailId}
        className="relative flex w-full items-center justify-between gap-2 text-left"
      >
        <span className="flex items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-full bg-(--accent-soft) px-3 py-0.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-(--accent)">
            <BookOpenText size={12} />
            {note.tag}
          </span>
          <AnimatePresence>
            {archived && !compact ? (
              <motion.span
                key="saved-badge"
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.85 }}
                transition={{ type: 'spring', stiffness: 380, damping: 26 }}
                className="inline-flex items-center gap-1 rounded-full border border-(--accent)/40 bg-(--accent-soft) px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.22em] text-(--accent)"
              >
                <BookmarkCheck size={10} />
                Saved
              </motion.span>
            ) : null}
          </AnimatePresence>
        </span>
        <span className="flex items-center gap-2 text-[10px] uppercase tracking-[0.28em] text-(--text-muted)">
          Source · {String(index + 1).padStart(2, '0')}
          <motion.span
            animate={{ rotate: expanded ? 180 : 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 24 }}
            className={cn(
              'grid h-6 w-6 place-items-center rounded-full border border-(--border-soft) bg-(--surface-strong) text-(--text-secondary) transition-colors group-hover:border-(--accent)/60 group-hover:text-(--accent)',
            )}
          >
            <ChevronDown size={12} />
          </motion.span>
        </span>
      </button>

      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        aria-controls={detailId}
        aria-expanded={expanded}
        className="font-display relative mt-3 block w-full text-left text-lg font-semibold leading-tight text-(--text-primary) transition-colors group-hover:text-(--accent)"
      >
        {note.title}
      </button>

      <AnimatePresence initial={false}>
        {expanded ? (
          <motion.div
            id={detailId}
            key="detail"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 0.61, 0.36, 1] }}
            className="overflow-hidden"
          >
            <p className="relative mt-2 text-sm leading-relaxed text-(--text-secondary)">
              {note.detail}
            </p>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="relative mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        {note.citationUrl ? (
          <a
            href={note.citationUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(buttonEvent) => buttonEvent.stopPropagation()}
            className="group/citation inline-flex min-w-0 max-w-full flex-1 cursor-pointer items-center gap-2 text-[11px] text-(--text-secondary) transition-colors hover:text-(--accent) focus-visible:text-(--accent) focus-visible:outline-none"
            title={`Open citation: ${note.citation}`}
            aria-label={`Open citation in a new tab: ${note.citation}`}
          >
            <ExternalLink
              size={12}
              className="shrink-0 text-(--accent) transition-transform group-hover/citation:-translate-y-0.5 group-hover/citation:translate-x-0.5"
            />
            <span className="font-mono truncate underline decoration-transparent underline-offset-4 transition-colors group-hover/citation:decoration-(--accent) group-focus-visible/citation:decoration-(--accent)">
              {note.citation}
            </span>
          </a>
        ) : (
          <div
            className="inline-flex min-w-0 max-w-full flex-1 items-center gap-2 text-[11px] text-(--text-muted)"
            title={note.citation}
          >
            <ExternalLink size={12} className="shrink-0 opacity-50" />
            <span className="font-mono truncate opacity-80">{note.citation}</span>
          </div>
        )}

        {onArchive ? (
          <motion.button
            type="button"
            onClick={(buttonEvent) => {
              buttonEvent.stopPropagation()
              onArchive()
            }}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.94 }}
            transition={{ type: 'spring', stiffness: 380, damping: 26 }}
            className={cn(
              'inline-flex w-fit shrink-0 items-center gap-1.5 self-start rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] transition sm:self-auto',
              archived
                ? 'border-(--accent)/60 bg-(--accent-soft) text-(--accent) shadow-sm'
                : 'border-(--border-soft) bg-(--surface-strong) text-(--text-secondary) hover:border-(--accent)/60 hover:text-(--accent)',
            )}
            aria-label={
              archived
                ? `Remove "${note.title}" from archive`
                : `Archive "${note.title}"`
            }
            aria-pressed={archived}
          >
            {archived ? <BookmarkCheck size={11} /> : <BookmarkPlus size={11} />}
            {archived ? 'Saved' : 'Archive'}
          </motion.button>
        ) : null}
      </div>
    </motion.article>
  )
}
