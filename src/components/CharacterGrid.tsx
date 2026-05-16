import { motion } from 'framer-motion'
import { AlertTriangle, ChevronLeft, Loader2, RefreshCw } from 'lucide-react'
import CharacterCard from './CharacterCard'
import type {
  CharacterId,
  HistoricalCharacter,
  HistoricalEvent,
} from '../lib/types'

type CharacterGridProps = {
  event: HistoricalEvent
  characters: HistoricalCharacter[]
  selectedCharacterId?: CharacterId | null
  onSelectCharacter: (characterId: CharacterId) => void
  onBack: () => void
  loading?: boolean
  error?: string | null
  onRetry?: () => void
}

export default function CharacterGrid({
  event,
  characters,
  selectedCharacterId,
  onSelectCharacter,
  onBack,
  loading = false,
  error = null,
  onRetry,
}: CharacterGridProps) {
  return (
    <section className="relative mx-auto w-full max-w-7xl px-5 pt-4 pb-12 sm:px-8 sm:pt-6">
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col gap-8"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <motion.button
            type="button"
            onClick={onBack}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.94 }}
            transition={{ type: 'spring', stiffness: 380, damping: 26 }}
            className="inline-flex items-center gap-2 rounded-full border border-(--border-soft) bg-(--surface) px-3 py-1.5 text-xs font-medium text-(--text-secondary) transition-colors hover:border-(--accent) hover:text-(--text-primary)"
          >
            <ChevronLeft size={14} />
            Back to events
          </motion.button>
          <span className="inline-flex rounded-full border border-(--border-soft) bg-(--surface) px-4 py-1.5 text-[10px] font-semibold uppercase tracking-[0.32em] text-(--text-muted)">
            Step 02 · {event.title}
          </span>
        </div>

        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <h2 className="font-display text-balance text-4xl font-semibold text-(--text-primary) sm:text-5xl">
              Choose a perspective
            </h2>
            <p className="mt-4 text-pretty text-sm leading-relaxed text-(--text-secondary) sm:text-base">
              Each voice is grounded in curated source notes for {event.title}.
              Pick a leader or scholar to enter the chat workspace.
            </p>
          </div>

          <div className="rounded-3xl border border-(--border-soft) bg-(--surface) p-5 text-xs text-(--text-secondary) lg:max-w-sm">
            <span className="font-mono uppercase tracking-[0.32em] text-(--text-muted)">
              Curated context
            </span>
            <p className="mt-2 text-(--text-primary)">
              {event.motif || event.tagline || event.title}
            </p>
          </div>
        </div>
      </motion.div>

      {loading ? (
        <div
          aria-busy
          aria-live="polite"
          className="mt-12 grid gap-6 md:grid-cols-2 sm:mt-14"
        >
          <div className="sr-only">Loading perspectives from Supabase…</div>
          {[0, 1].map((index) => (
            <div
              key={index}
              className="relative flex h-96 flex-col gap-4 overflow-hidden rounded-3xl border border-(--border-soft) bg-(--surface) p-7 backdrop-blur-xl"
            >
              <div className="flex items-start gap-4">
                <div className="skeleton-shimmer h-16 w-16 rounded-2xl" />
                <div className="flex flex-1 flex-col gap-2">
                  <div className="skeleton-shimmer h-3 w-1/4" />
                  <div className="skeleton-shimmer h-6 w-3/4" />
                  <div className="skeleton-shimmer h-3 w-1/2" />
                </div>
              </div>
              <div className="mt-2 flex flex-col gap-2">
                <div className="skeleton-shimmer h-3 w-full" />
                <div className="skeleton-shimmer h-3 w-5/6" />
              </div>
              <div className="skeleton-shimmer h-14 w-full rounded-2xl" />
              <div className="mt-auto flex items-center gap-2 text-xs text-(--text-muted)">
                <Loader2
                  size={14}
                  className="animate-spin text-(--accent)"
                  aria-hidden
                />
                <span>Fetching perspectives…</span>
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
          className="mx-auto mt-12 flex max-w-2xl flex-col items-center gap-4 rounded-3xl border border-rose-300/40 bg-rose-500/5 p-8 text-center backdrop-blur-xl sm:mt-14"
        >
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-rose-500/10 text-rose-500">
            <AlertTriangle size={20} />
          </span>
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.32em] text-rose-400">
              Couldn't load perspectives
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
      ) : characters.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mx-auto mt-12 max-w-2xl rounded-3xl border border-(--border-soft) bg-(--surface) p-8 text-center backdrop-blur-xl sm:mt-14"
        >
          <div className="font-mono text-[10px] uppercase tracking-[0.32em] text-(--text-muted)">
            No perspectives yet
          </div>
          <p className="mt-3 text-sm text-(--text-secondary)">
            No one has been added to {event.title} yet. An admin can curate
            voices for this moment from the dashboard — once they do, you'll be
            able to interview them here.
          </p>
        </motion.div>
      ) : (
        <div className="mt-12 grid gap-6 md:grid-cols-2 sm:mt-14">
          {characters.map((character, index) => (
            <CharacterCard
              key={character.id}
              character={character}
              index={index}
              isSelected={selectedCharacterId === character.id}
              onSelect={() => onSelectCharacter(character.id)}
            />
          ))}
        </div>
      )}
    </section>
  )
}
