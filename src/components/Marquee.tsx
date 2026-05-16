import { useReducedMotion } from 'framer-motion'
import { cn } from '../lib/cn'

type MarqueeProps = {
  items: string[]
  className?: string
}

export default function Marquee({ items, className }: MarqueeProps) {
  const reduce = useReducedMotion()
  const doubled = [...items, ...items]

  return (
    <div
      aria-hidden
      className={cn(
        'group relative w-full overflow-hidden',
        'mask-[linear-gradient(to_right,transparent,black_12%,black_88%,transparent)]',
        className,
      )}
    >
      <div
        className={cn(
          'flex w-max items-center gap-12 whitespace-nowrap py-3',
          reduce ? '' : 'marquee-track group-hover:[animation-play-state:paused]',
        )}
      >
        {doubled.map((item, index) => (
          <span
            key={`${item}-${index}`}
            className="font-display flex items-center gap-3 text-2xl text-(--text-secondary) sm:text-3xl"
          >
            {item}
            <span
              aria-hidden
              className="block h-1.5 w-1.5 rounded-full bg-(--accent)/70"
            />
          </span>
        ))}
      </div>
    </div>
  )
}
