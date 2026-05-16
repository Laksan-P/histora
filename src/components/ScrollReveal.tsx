import { motion, useReducedMotion, type Variants } from 'framer-motion'
import type { ReactNode } from 'react'
import { cn } from '../lib/cn'

type ScrollRevealProps = {
  children: ReactNode
  className?: string
  delay?: number
  duration?: number
  y?: number
  once?: boolean
  as?: 'div' | 'section' | 'article' | 'header' | 'aside' | 'span'
}

const baseVariants = (y: number, duration: number, delay: number): Variants => ({
  hidden: { opacity: 0, y },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration, delay, ease: 'easeOut' },
  },
})

export default function ScrollReveal({
  children,
  className,
  delay = 0,
  duration = 0.55,
  y = 18,
  once = true,
  as = 'div',
}: ScrollRevealProps) {
  const reduce = useReducedMotion()
  const MotionTag = motion[as]

  if (reduce) {
    const StaticTag = as
    return <StaticTag className={className}>{children}</StaticTag>
  }

  return (
    <MotionTag
      className={cn(className)}
      variants={baseVariants(y, duration, delay)}
      initial="hidden"
      whileInView="visible"
      viewport={{ once, margin: '-60px' }}
    >
      {children}
    </MotionTag>
  )
}
