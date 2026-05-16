import { motion } from 'framer-motion'
import { ArrowRight, Quote } from 'lucide-react'
import type { HistoricalCharacter } from '../lib/types'
import { cn } from '../lib/cn'

type CharacterCardProps = {
  character: HistoricalCharacter
  isSelected?: boolean
  onSelect: () => void
  index?: number
}

export default function CharacterCard({
  character,
  isSelected,
  onSelect,
  index = 0,
}: CharacterCardProps) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.55, delay: index * 0.08 }}
      whileHover={{ y: -8, scale: 1.015 }}
      className={cn(
        'group relative flex h-full flex-col overflow-hidden rounded-3xl border bg-(--surface) p-7 backdrop-blur-xl transition-shadow duration-500',
        isSelected
          ? 'border-(--accent) shadow-(--shadow-glow)'
          : 'border-(--border-soft) hover:border-(--accent)/60 hover:shadow-(--shadow-cinema)',
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-(--accent)/15 blur-3xl transition group-hover:bg-(--accent)/25"
      />

      <div className="relative flex items-start gap-4">
        <div className="relative grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-2xl">
          <div className="absolute inset-0 bg-linear-to-br from-(--accent) to-(--accent-strong)" />
          <span className="relative font-display text-2xl font-bold text-(--background)">
            {character.initials}
          </span>
          <span
            aria-hidden
            className="absolute inset-0 ring-1 ring-inset ring-white/25"
          />
        </div>

        <div className="flex flex-col">
          <span className="font-mono text-[10px] uppercase tracking-[0.32em] text-(--text-muted)">
            {character.years}
          </span>
          <h3 className="font-display mt-1 text-2xl font-semibold leading-tight text-(--text-primary) sm:text-[1.65rem]">
            {character.name}
          </h3>
          <span className="mt-1 text-sm font-medium text-(--accent)">
            {character.role}
          </span>
        </div>
      </div>

      <p className="relative mt-5 text-sm leading-relaxed text-(--text-secondary)">
        {character.description}
      </p>

      <div className="relative mt-5 flex items-start gap-3 rounded-2xl border border-(--border-soft) bg-(--surface-strong) p-4">
        <Quote
          size={16}
          className="mt-0.5 shrink-0 text-(--accent)"
          aria-hidden
        />
        <p className="font-display text-base italic text-(--text-primary)">
          {character.signature}
        </p>
      </div>

      <div className="relative mt-4 inline-flex w-fit items-center gap-2 rounded-full bg-(--accent-soft) px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-(--accent)">
        {character.tone}
      </div>

      <div className="relative mt-auto pt-7">
        <motion.button
          type="button"
          onClick={onSelect}
          whileHover={{ scale: 1.015 }}
          whileTap={{ scale: 0.965 }}
          transition={{ type: 'spring', stiffness: 380, damping: 26 }}
          className="group/btn inline-flex w-full items-center justify-between gap-3 rounded-2xl bg-(--text-primary) px-5 py-3 text-sm font-semibold text-(--background) shadow-sm transition-shadow duration-300 hover:opacity-95 hover:shadow-(--shadow-cinema)"
        >
          Talk to this Perspective
          <span className="grid h-7 w-7 place-items-center rounded-full bg-(--background)/15 transition-transform duration-300 group-hover/btn:translate-x-1">
            <ArrowRight size={14} />
          </span>
        </motion.button>
      </div>
    </motion.article>
  )
}
