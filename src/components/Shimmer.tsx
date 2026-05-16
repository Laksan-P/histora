import { cn } from '../lib/cn'

type ShimmerProps = {
  className?: string
  lines?: number
  width?: 'full' | 'sm' | 'md' | 'lg'
}

const WIDTHS: Record<NonNullable<ShimmerProps['width']>, string> = {
  full: 'w-full',
  sm: 'w-1/3',
  md: 'w-2/3',
  lg: 'w-5/6',
}

export default function Shimmer({
  className,
  lines = 3,
  width = 'full',
}: ShimmerProps) {
  return (
    <div className={cn('flex flex-col gap-2', className)} aria-busy>
      {Array.from({ length: lines }).map((_, index) => (
        <div
          key={index}
          className={cn(
            'skeleton-shimmer h-3',
            index === lines - 1 ? WIDTHS[width] : 'w-full',
          )}
        />
      ))}
    </div>
  )
}
