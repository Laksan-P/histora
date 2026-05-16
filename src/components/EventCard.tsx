import { motion } from 'framer-motion'
import { ArrowUpRight, MapPin } from 'lucide-react'
import type { HistoricalEvent } from '../lib/types'
import { cn } from '../lib/cn'

type EventCardProps = {
  event: HistoricalEvent
  isSelected?: boolean
  onExplore: () => void
  index?: number
}

const TOUCHSTONES_FALLBACK = 'Source-grounded archive'

export default function EventCard({
  event,
  isSelected,
  onExplore,
  index = 0,
}: EventCardProps) {
  const hasLocation = Boolean(event.location && event.location.trim())
  const motif = event.motif?.trim()
  const touchstoneText = motif || TOUCHSTONES_FALLBACK

  return (
    <motion.article
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.6, delay: index * 0.08 }}
      whileHover={{ y: -6, scale: 1.012 }}
      className={cn(
        'group relative flex h-full flex-col overflow-hidden rounded-3xl border bg-(--surface) p-6 backdrop-blur-xl transition-shadow duration-500 sm:p-7',
        isSelected
          ? 'border-(--accent) shadow-(--shadow-glow)'
          : 'border-(--border-soft) hover:border-(--accent)/60 hover:shadow-(--shadow-cinema)',
      )}
    >
      <div
        aria-hidden
        className={cn(
          'pointer-events-none absolute inset-x-0 -top-20 h-44 bg-linear-to-br opacity-70 blur-3xl transition-opacity duration-500 group-hover:opacity-90',
          event.hue,
        )}
      />

      <div className="relative flex items-center justify-between gap-2 text-xs uppercase tracking-[0.32em] text-(--text-muted)">
        <span className="truncate">{event.accent}</span>
        {event.period ? (
          <span className="shrink-0 font-mono text-(--text-secondary)">
            {event.period}
          </span>
        ) : null}
      </div>

      <h3 className="font-display relative mt-5 text-3xl font-semibold leading-tight text-(--text-primary) sm:text-[2rem]">
        {event.title}
      </h3>

      {event.tagline ? (
        <p className="relative mt-3 text-sm font-medium text-(--accent)">
          {event.tagline}
        </p>
      ) : null}

      {event.description ? (
        <p className="relative mt-3 text-sm leading-relaxed text-(--text-secondary)">
          {event.description}
        </p>
      ) : null}

      {hasLocation ? (
        <div className="relative mt-4 flex items-center gap-2 text-xs text-(--text-muted)">
          <MapPin size={13} className="text-(--accent)" />
          <span className="truncate">{event.location}</span>
        </div>
      ) : null}

      <div className="relative mt-5 rounded-2xl border border-(--border-soft) bg-(--surface-strong) px-4 py-3 text-xs text-(--text-secondary)">
        <span className="font-mono uppercase tracking-[0.2em] text-(--text-muted)">
          Touchstones
        </span>
        <p className="mt-1 text-(--text-primary)">{touchstoneText}</p>
      </div>

      <div className="relative mt-auto pt-6">
        <motion.button
          type="button"
          onClick={onExplore}
          whileHover={{ scale: 1.015 }}
          whileTap={{ scale: 0.965 }}
          transition={{ type: 'spring', stiffness: 380, damping: 26 }}
          className="group/btn inline-flex w-full items-center justify-between gap-3 rounded-2xl bg-(--text-primary) px-5 py-3 text-sm font-semibold text-(--background) shadow-sm transition-shadow duration-300 hover:opacity-95 hover:shadow-(--shadow-cinema)"
        >
          Explore Event
          <span className="grid h-7 w-7 place-items-center rounded-full bg-(--background)/15 transition-transform duration-300 group-hover/btn:-translate-y-0.5 group-hover/btn:translate-x-1">
            <ArrowUpRight size={14} />
          </span>
        </motion.button>
      </div>
    </motion.article>
  )
}
