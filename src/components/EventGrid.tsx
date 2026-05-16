import { motion } from 'framer-motion'
import { AlertTriangle, Loader2, RefreshCw } from 'lucide-react'
import EventCard from './EventCard'
import type { EventId, HistoricalEvent } from '../lib/types'

type EventGridProps = {
  events: HistoricalEvent[]
  selectedEventId?: EventId | null
  onSelectEvent: (eventId: EventId) => void
  headingEyebrow?: string
  heading?: string
  description?: string
  loading?: boolean
  error?: string | null
  onRetry?: () => void
}

export default function EventGrid({
  events,
  selectedEventId,
  onSelectEvent,
  headingEyebrow = 'Step 01',
  heading = 'Choose a historical event',
  description = 'Start with a curated era. Each event unlocks perspectives, source notes, and a generated quiz.',
  loading = false,
  error = null,
  onRetry,
}: EventGridProps) {
  return (
    <section
      id="event-selection"
      className="relative mx-auto mt-12 w-full max-w-7xl px-5 sm:px-8"
    >
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.6 }}
        className="mx-auto max-w-3xl text-center"
      >
        <span className="inline-flex rounded-full border border-(--border-soft) bg-(--surface) px-4 py-1 text-[10px] font-semibold uppercase tracking-[0.32em] text-(--text-muted)">
          {headingEyebrow}
        </span>
        <h2 className="font-display mt-5 text-balance text-4xl font-semibold text-(--text-primary) sm:text-5xl">
          {heading}
        </h2>
        <p className="mt-4 text-pretty text-sm leading-relaxed text-(--text-secondary) sm:text-base">
          {description}
        </p>
      </motion.div>

      {loading ? (
        <div
          aria-busy
          aria-live="polite"
          className="mt-12 grid gap-6 lg:grid-cols-3"
        >
          <div className="sr-only">Loading events from Supabase…</div>
          {[0, 1, 2].map((index) => (
            <div
              key={index}
              className="relative flex h-112 flex-col gap-4 overflow-hidden rounded-3xl border border-(--border-soft) bg-(--surface) p-7 backdrop-blur-xl"
            >
              <div className="skeleton-shimmer h-3 w-1/3" />
              <div className="skeleton-shimmer mt-4 h-8 w-3/4" />
              <div className="skeleton-shimmer mt-2 h-3 w-1/2" />
              <div className="mt-4 flex flex-col gap-2">
                <div className="skeleton-shimmer h-3 w-full" />
                <div className="skeleton-shimmer h-3 w-5/6" />
                <div className="skeleton-shimmer h-3 w-4/6" />
              </div>
              <div className="mt-auto flex items-center gap-2 text-xs text-(--text-muted)">
                <Loader2
                  size={14}
                  className="animate-spin text-(--accent)"
                  aria-hidden
                />
                <span>Fetching from archive…</span>
              </div>
              <div className="skeleton-shimmer h-11 w-full rounded-2xl" />
            </div>
          ))}
        </div>
      ) : error ? (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          role="alert"
          className="mx-auto mt-12 flex max-w-2xl flex-col items-center gap-4 rounded-3xl border border-rose-300/40 bg-rose-500/5 p-8 text-center backdrop-blur-xl"
        >
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-rose-500/10 text-rose-500">
            <AlertTriangle size={20} />
          </span>
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.32em] text-rose-400">
              Couldn't reach the archive
            </div>
            <p className="mt-2 text-sm text-(--text-primary)">{error}</p>
          </div>
          {onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center gap-2 rounded-full bg-(--text-primary) px-4 py-2 text-xs font-semibold text-(--background) transition hover:opacity-90"
            >
              <RefreshCw size={13} />
              Try again
            </button>
          ) : null}
        </motion.div>
      ) : events.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mx-auto mt-12 max-w-2xl rounded-3xl border border-(--border-soft) bg-(--surface) p-8 text-center backdrop-blur-xl"
        >
          <div className="font-mono text-[10px] uppercase tracking-[0.32em] text-(--text-muted)">
            Archive in progress
          </div>
          <p className="mt-3 text-sm text-(--text-secondary)">
            No events have been published yet. The first one will appear here as
            soon as an admin adds it from the dashboard.
          </p>
        </motion.div>
      ) : (
        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          {events.map((event, index) => (
            <EventCard
              key={event.id}
              event={event}
              index={index}
              isSelected={selectedEventId === event.id}
              onExplore={() => onSelectEvent(event.id)}
            />
          ))}
        </div>
      )}
    </section>
  )
}
