import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowLeft,
  BookOpenText,
  LayoutDashboard,
  Library,
  RefreshCcw,
  Users,
  UsersRound,
} from 'lucide-react'
import { useCallback, useState } from 'react'
import AdminCharactersTab from './AdminCharactersTab'
import AdminEventsTab from './AdminEventsTab'
import AdminOverviewTab from './AdminOverviewTab'
import AdminSourceNotesTab from './AdminSourceNotesTab'
import AdminUsersTab from './AdminUsersTab'
import { HistoraLogoMark } from '../HistoraLogoMark'
import { AdminTabs, type AdminTab, type AdminTabKey } from './AdminUI'

type AdminDashboardProps = {
  onBack: () => void
}

const TABS: AdminTab[] = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard },
  { key: 'events', label: 'Events', icon: BookOpenText },
  { key: 'characters', label: 'Characters', icon: UsersRound },
  { key: 'sourceNotes', label: 'Source notes', icon: Library },
  { key: 'users', label: 'Users & logs', icon: Users },
]

export default function AdminDashboard({ onBack }: AdminDashboardProps) {
  const [activeKey, setActiveKey] = useState<AdminTabKey>('overview')
  const [refreshSignal, setRefreshSignal] = useState(0)

  const triggerRefresh = useCallback(() => {
    setRefreshSignal((value) => value + 1)
  }, [])

  return (
    <section className="relative mx-auto w-full min-w-0 max-w-7xl overflow-x-clip px-4 pb-10 pt-1 sm:px-6 lg:px-8 lg:pt-2">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="flex flex-col gap-6 lg:gap-7"
      >
        <header className="flex flex-col gap-5">
          <motion.button
            type="button"
            onClick={onBack}
            whileHover={{ x: -2 }}
            whileTap={{ scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 380, damping: 26 }}
            className="inline-flex w-fit items-center gap-2 rounded-full border border-(--border-soft) bg-(--surface-strong) px-3 py-1.5 text-xs font-medium text-(--text-secondary) transition hover:border-(--accent) hover:text-(--text-primary)"
          >
            <ArrowLeft size={14} />
            Back to Histora
          </motion.button>

          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:gap-5 lg:gap-6">
              <HistoraLogoMark variant="admin" />

              <div className="max-w-2xl min-w-0">
                <span className="font-mono text-[10px] uppercase tracking-[0.32em] text-(--text-muted)">
                  Admin · curated catalog
                </span>
                <h1 className="font-display mt-2 text-4xl font-semibold text-(--text-primary) sm:text-5xl">
                  Admin dashboard
                </h1>
                <p className="mt-2 text-sm leading-relaxed text-(--text-secondary)">
                  Manage every event, perspective, and source note that powers the
                  Histora archive. Role changes happen in the Supabase dashboard —
                  this view never elevates anyone to admin from the client.
                </p>
              </div>
            </div>
            <motion.button
              type="button"
              onClick={triggerRefresh}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 380, damping: 26 }}
              className="inline-flex w-fit items-center gap-2 self-start rounded-full bg-(--text-primary) px-4 py-2 text-xs font-semibold text-(--background) shadow-sm transition hover:opacity-95 lg:self-end"
            >
              <RefreshCcw size={13} />
              Refresh all
            </motion.button>
          </div>
        </header>

        <AdminTabs tabs={TABS} activeKey={activeKey} onChange={setActiveKey} />

        <AnimatePresence mode="wait">
          <motion.div
            key={activeKey}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.28, ease: [0.22, 0.61, 0.36, 1] }}
            className="flex flex-col gap-5"
          >
            {activeKey === 'overview' ? (
              <AdminOverviewTab
                refreshSignal={refreshSignal}
                onJumpTo={setActiveKey}
              />
            ) : null}
            {activeKey === 'events' ? (
              <AdminEventsTab
                refreshSignal={refreshSignal}
                onAfterMutate={triggerRefresh}
              />
            ) : null}
            {activeKey === 'characters' ? (
              <AdminCharactersTab
                refreshSignal={refreshSignal}
                onAfterMutate={triggerRefresh}
              />
            ) : null}
            {activeKey === 'sourceNotes' ? (
              <AdminSourceNotesTab
                refreshSignal={refreshSignal}
                onAfterMutate={triggerRefresh}
              />
            ) : null}
            {activeKey === 'users' ? (
              <AdminUsersTab
                refreshSignal={refreshSignal}
                onAfterMutate={triggerRefresh}
              />
            ) : null}
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </section>
  )
}
