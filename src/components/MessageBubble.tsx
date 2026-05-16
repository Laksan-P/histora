import { motion } from 'framer-motion'
import { Pencil, Play, ScrollText, Square, Volume2 } from 'lucide-react'
import type { ChatMessage } from '../lib/types'
import { cn } from '../lib/cn'

type MessageBubbleProps = {
  message: ChatMessage
  characterInitials?: string
  isPlaying?: boolean
  isBeingEdited?: boolean
  onPlayVoice?: () => void
  canEdit?: boolean
  onEdit?: () => void
}

export default function MessageBubble({
  message,
  characterInitials,
  isPlaying,
  isBeingEdited,
  onPlayVoice,
  canEdit,
  onEdit,
}: MessageBubbleProps) {
  const isUser = message.role === 'user'

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 14, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className={cn(
        'flex w-full items-start gap-3',
        isUser ? 'flex-row-reverse text-right' : 'flex-row',
      )}
    >
      <div
        className={cn(
          'grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-2xl text-xs font-semibold',
          isUser
            ? 'bg-(--text-primary) text-(--background)'
            : 'bg-linear-to-br from-(--accent) to-(--accent-strong) text-(--background)',
        )}
      >
        {isUser ? 'You' : (characterInitials ?? 'AI')}
      </div>

      <div
        className={cn(
          'relative min-w-0 max-w-[calc(100%-2.75rem)] rounded-3xl px-5 py-4 text-sm leading-relaxed shadow-sm transition-shadow sm:max-w-[78%]',
          isUser
            ? 'bg-(--text-primary) text-(--background)'
            : 'glass text-(--text-primary)',
          isBeingEdited && 'ring-2 ring-(--accent)/60 ring-offset-2 ring-offset-(--background)',
        )}
      >
        {!isUser ? (
          <div className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.28em] text-(--text-muted)">
            <ScrollText size={11} className="text-(--accent)" />
            {message.author}
          </div>
        ) : null}

        <p className="wrap-break-word whitespace-pre-wrap text-pretty">{message.content}</p>

        {!isUser && message.sources && message.sources.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {message.sources.map((source) => (
              <span
                key={source}
                className="inline-flex items-center gap-1 rounded-full bg-(--accent-soft) px-2.5 py-0.5 text-[10px] font-medium text-(--accent)"
              >
                <ScrollText size={11} />
                {source}
              </span>
            ))}
          </div>
        ) : null}

        {!isUser && onPlayVoice ? (
          <motion.button
            type="button"
            onClick={onPlayVoice}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 380, damping: 26 }}
            className={cn(
              'mt-3 inline-flex max-w-full flex-wrap items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-semibold transition',
              isPlaying
                ? 'border-(--accent)/60 bg-(--accent-soft) text-(--accent)'
                : 'border-(--border-soft) bg-(--surface-strong) text-(--text-secondary) hover:border-(--accent) hover:text-(--text-primary)',
            )}
            aria-label={isPlaying ? 'Stop voice playback' : 'Play voice'}
            aria-pressed={isPlaying}
          >
            {isPlaying ? (
              <>
                <Volume2 size={12} className="text-(--accent)" />
                <span className="flex items-end gap-0.5 leading-none" aria-hidden>
                  {[0, 1, 2].map((bar) => (
                    <span
                      key={bar}
                      className="block w-0.5 origin-bottom rounded-full bg-(--accent)"
                      style={{
                        height: '11px',
                        animation:
                          'histora-voice-pulse 0.9s ease-in-out infinite',
                        animationDelay: `${bar * 110}ms`,
                      }}
                    />
                  ))}
                </span>
                Playing · tap to stop
                <Square size={11} className="text-(--accent)" />
              </>
            ) : (
              <>
                <Play size={12} className="text-(--accent)" />
                Play voice
              </>
            )}
          </motion.button>
        ) : null}

        {isUser && canEdit && onEdit ? (
          <motion.button
            type="button"
            onClick={onEdit}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.94 }}
            transition={{ type: 'spring', stiffness: 380, damping: 26 }}
            className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-(--background)/15 bg-(--background)/10 px-2.5 py-1 text-[10px] font-semibold text-(--background)/85 transition hover:bg-(--background)/20 hover:text-(--background)"
            aria-label="Edit this message"
          >
            <Pencil size={10} />
            Edit
          </motion.button>
        ) : null}
      </div>
    </motion.div>
  )
}
