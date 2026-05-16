import { motion } from 'framer-motion'
import { Sparkles } from 'lucide-react'
import { cn } from '../lib/cn'
import { HistoraLogoMark } from './HistoraLogoMark'

export default function Footer({ variant }: { variant?: 'default' | 'chat' }) {
  const isChat = variant === 'chat'

  return (
    <motion.footer
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.6 }}
      className={cn(
        'relative mx-auto w-full min-w-0 max-w-7xl overflow-x-clip box-border',
        isChat
          ? 'mt-6 px-4 pb-6 sm:mt-8 sm:px-6 sm:pb-8 lg:px-8'
          : 'mt-24 px-4 pb-12 sm:px-8',
      )}
    >
      <div className="glass box-border max-w-full min-w-0 overflow-hidden rounded-3xl px-5 py-8 sm:px-10">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-xl">
            <div className="flex min-w-0 items-center gap-3">
              <HistoraLogoMark variant="footer" />
              <span className="font-display text-3xl text-(--text-primary)">
                Histora
              </span>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-(--text-secondary)">
            Histora is an AI-powered platform that brings history to life through immersive conversations and cinematic storytelling. 
            Explore historical figures, events, and civilizations through intelligent voice-driven experiences. 
            Our mission is to make history more interactive, engaging, and unforgettable.
            </p>
          </div>

          <div className="flex flex-col gap-4 sm:items-end">
            <div className="flex items-center gap-3 rounded-full border border-(--border-soft) bg-(--surface) px-4 py-2 text-xs text-(--text-muted)">
              <Sparkles size={14} className="shrink-0 text-(--accent)" />
              <span className="text-pretty">
                Archive-born · Voice-led · Source-grounded
              </span>
            </div>
            <div className="flex items-center gap-3 text-sm text-(--text-secondary)">
              <span className="font-mono text-[11px] uppercase tracking-[0.32em] text-(--text-muted)">
                Chronicle
              </span>
              <span aria-hidden className="h-3 w-px bg-(--border-strong)" />
              <span>© {new Date().getFullYear()} Histora</span>
            </div>
          </div>
        </div>
      </div>
    </motion.footer>
  )
}
