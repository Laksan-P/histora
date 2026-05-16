import { useMemo, useState } from 'react'
import { cn } from '../lib/cn'

type SizePreset = 'sm' | 'md' | 'lg' | 'xl' | '2xl'

const SIZE_CLASS: Record<SizePreset, string> = {
  sm: 'h-8 w-8 text-[10px]',
  md: 'h-9 w-9 text-xs sm:h-10 sm:w-10 sm:text-sm',
  lg: 'h-12 w-12 text-sm sm:h-14 sm:w-14 sm:text-base',
  xl: 'h-20 w-20 text-xl sm:h-24 sm:w-24 sm:text-2xl',
  '2xl': 'h-28 w-28 text-2xl sm:h-32 sm:w-32 sm:text-3xl',
}

type UserAvatarProps = {
  /** Public URL for the user's uploaded avatar. */
  src?: string | null
  /** Falls back to initials when src is missing or fails to load. */
  fullName?: string | null
  username?: string | null
  email?: string | null
  /** Additional alt text override. */
  alt?: string
  size?: SizePreset
  className?: string
  /** When true, render a soft gold ring around the circle (admin/profile). */
  ringed?: boolean
  /** When true, mark image as eager. Use for above-the-fold avatars. */
  eager?: boolean
}

/**
 * Compute deterministic 1–2 character initials from the best available
 * piece of identity in priority order: full name → username → email.
 * Falls back to "H" so the placeholder is never empty.
 */
function deriveInitials(
  fullName?: string | null,
  username?: string | null,
  email?: string | null,
): string {
  const candidate = (fullName ?? username ?? email ?? '').trim()
  if (!candidate) return 'H'

  if (fullName) {
    const parts = fullName.trim().split(/\s+/).filter(Boolean)
    if (parts.length >= 2) {
      return (parts[0]!.charAt(0) + parts[parts.length - 1]!.charAt(0)).toUpperCase()
    }
    if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  }
  if (username) return username.trim().slice(0, 2).toUpperCase()
  return candidate.charAt(0).toUpperCase()
}

/**
 * WhatsApp-style circular avatar. The image is forced into a perfect
 * circle with `object-cover` so portraits, landscapes, and squares all
 * crop cleanly. When the URL is missing or fails, we render initials
 * over a soft gold-tinted background.
 */
function UserAvatar({
  src,
  fullName,
  username,
  email,
  alt,
  size = 'md',
  className,
  ringed = false,
  eager = false,
}: UserAvatarProps) {
  const [errored, setErrored] = useState(false)
  const initials = useMemo(
    () => deriveInitials(fullName, username, email),
    [fullName, username, email],
  )
  const showImage = Boolean(src) && !errored

  return (
    <span
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-(--accent-soft) font-semibold uppercase text-(--accent) ring-1 ring-(--border-soft)',
        SIZE_CLASS[size],
        ringed && 'ring-2 ring-(--accent)/60',
        className,
      )}
      aria-hidden={alt ? undefined : true}
    >
      {showImage ? (
        <img
          src={src!}
          alt={alt ?? `${fullName ?? username ?? 'Histora'} avatar`}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setErrored(true)}
          className="absolute inset-0 h-full w-full object-cover"
          draggable={false}
        />
      ) : (
        <span className="select-none tracking-wide">{initials}</span>
      )}
    </span>
  )
}

export default UserAvatar
