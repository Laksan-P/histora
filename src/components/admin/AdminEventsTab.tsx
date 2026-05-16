import { AnimatePresence, motion } from 'framer-motion'
import { BookOpenText, Pencil, Plus, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  createEvent,
  deleteEvent,
  listEvents,
  updateEvent,
  type AdminEvent,
  type AdminEventInput,
} from '../../lib/adminApi'
import {
  AdminButton,
  AdminEmpty,
  AdminListSkeleton,
  AdminSearchInput,
  AdminSection,
  AdminTextArea,
  AdminTextField,
  AdminToastBanner,
  ConfirmDialog,
} from './AdminUI'
import { useAdminToast } from './useAdminToast'

type AdminEventsTabProps = {
  refreshSignal: number
  onAfterMutate: () => void
}

type FormState = {
  id?: string
  title: string
  slug: string
  period: string
  location: string
  tagline: string
  description: string
  accent: string
  hue: string
  motif: string
  imageUrl: string
}

const EMPTY_FORM: FormState = {
  title: '',
  slug: '',
  period: '',
  location: '',
  tagline: '',
  description: '',
  accent: '',
  hue: '',
  motif: '',
  imageUrl: '',
}

function eventToForm(event: AdminEvent): FormState {
  return {
    id: event.id,
    title: event.title,
    slug: event.slug,
    period: event.period,
    location: event.location,
    tagline: event.tagline,
    description: event.description,
    accent: event.accent,
    hue: event.hue,
    motif: event.motif,
    imageUrl: event.imageUrl,
  }
}

function formToInput(form: FormState): AdminEventInput {
  return {
    title: form.title,
    slug: form.slug,
    period: form.period,
    location: form.location,
    tagline: form.tagline,
    description: form.description,
    accent: form.accent,
    hue: form.hue,
    motif: form.motif,
    imageUrl: form.imageUrl,
  }
}

export default function AdminEventsTab({
  refreshSignal,
  onAfterMutate,
}: AdminEventsTabProps) {
  const [events, setEvents] = useState<AdminEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [form, setForm] = useState<FormState | null>(null)
  const [titleError, setTitleError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<AdminEvent | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [trackedSignal, setTrackedSignal] = useState(refreshSignal)
  const toast = useAdminToast()

  if (trackedSignal !== refreshSignal) {
    setTrackedSignal(refreshSignal)
    setLoading(true)
    setLoadError(null)
  }

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const next = await listEvents()
        if (!cancelled) setEvents(next)
      } catch (caught) {
        if (cancelled) return
        setLoadError(
          caught instanceof Error ? caught.message : 'Failed to load events.',
        )
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [refreshSignal])

  const filteredEvents = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return events
    return events.filter((event) =>
      [event.title, event.slug, event.period, event.location, event.tagline]
        .join(' ')
        .toLowerCase()
        .includes(term),
    )
  }, [events, search])

  const isEditing = form !== null && Boolean(form.id)

  const startCreate = () => {
    setTitleError(null)
    setForm({ ...EMPTY_FORM })
  }
  const startEdit = (event: AdminEvent) => {
    setTitleError(null)
    setForm(eventToForm(event))
  }
  const closeForm = () => {
    if (saving) return
    setForm(null)
    setTitleError(null)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!form || saving) return
    if (!form.title.trim()) {
      setTitleError('Event title is required.')
      return
    }
    setTitleError(null)
    setSaving(true)
    try {
      if (form.id) {
        const updated = await updateEvent(form.id, formToInput(form))
        setEvents((prev) =>
          prev.map((row) => (row.id === updated.id ? updated : row)),
        )
        toast.success(`Updated "${updated.title}".`)
      } else {
        const created = await createEvent(formToInput(form))
        setEvents((prev) => [...prev, created])
        toast.success(`Created "${created.title}".`)
      }
      onAfterMutate()
      setForm(null)
    } catch (caught) {
      toast.error(
        caught instanceof Error ? caught.message : 'Could not save event.',
      )
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteEvent(deleteTarget.id)
      setEvents((prev) => prev.filter((row) => row.id !== deleteTarget.id))
      toast.success(`Deleted "${deleteTarget.title}".`)
      setDeleteTarget(null)
      onAfterMutate()
    } catch (caught) {
      toast.error(
        caught instanceof Error ? caught.message : 'Could not delete event.',
      )
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <AdminToastBanner toast={toast.toast} onDismiss={toast.dismiss} />

      <AdminSection
        eyebrow="Catalog"
        title="Events"
        description="Each event groups the perspectives and source notes for a single moment in history."
        actions={
          <>
            <AdminSearchInput
              ariaLabel="Search events"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search events"
            />
            <AdminButton
              icon={Plus}
              onClick={startCreate}
              disabled={form !== null && !form.id}
            >
              New event
            </AdminButton>
          </>
        }
      >
        {loadError ? (
          <div className="rounded-2xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-xs leading-relaxed text-rose-200">
            {loadError}
          </div>
        ) : null}

        {loading ? (
          <AdminListSkeleton rows={4} />
        ) : filteredEvents.length === 0 ? (
          <AdminEmpty
            icon={BookOpenText}
            title={search ? 'No events match your search.' : 'No events yet.'}
            message={
              search
                ? 'Try a different keyword or clear the search.'
                : 'Create the first event to seed the archive.'
            }
          />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {filteredEvents.map((event) => (
              <motion.li
                key={event.id}
                whileHover={{ y: -2 }}
                transition={{ type: 'spring', stiffness: 320, damping: 26 }}
                className="flex h-full flex-col gap-3 rounded-2xl border border-(--border-soft) bg-(--surface-strong) p-4 transition hover:border-(--accent)/60 hover:shadow-(--shadow-cinema)"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-display truncate text-base font-semibold text-(--text-primary)">
                      {event.title || '(untitled)'}
                    </p>
                    <p className="mt-0.5 line-clamp-1 font-mono text-[10px] uppercase tracking-[0.22em] text-(--text-muted)">
                      {event.slug || event.id}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => startEdit(event)}
                      aria-label={`Edit ${event.title || 'event'}`}
                      className="grid h-8 w-8 place-items-center rounded-full bg-(--surface) text-(--text-secondary) transition hover:bg-(--accent-soft) hover:text-(--accent)"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(event)}
                      aria-label={`Delete ${event.title || 'event'}`}
                      className="grid h-8 w-8 place-items-center rounded-full bg-(--surface) text-(--text-secondary) transition hover:bg-rose-500/15 hover:text-rose-300"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
                {event.period || event.location ? (
                  <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-(--text-muted)">
                    {[event.period, event.location].filter(Boolean).join(' · ')}
                  </p>
                ) : null}
                {event.tagline ? (
                  <p className="line-clamp-2 text-xs leading-relaxed text-(--text-secondary)">
                    {event.tagline}
                  </p>
                ) : null}
              </motion.li>
            ))}
          </ul>
        )}
      </AdminSection>

      <AnimatePresence>
        {form ? (
          <motion.form
            key="event-form"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.25 }}
            onSubmit={handleSubmit}
            className="glass-strong flex flex-col gap-5 rounded-3xl p-6 sm:p-7"
          >
            <header className="flex items-start justify-between gap-3">
              <div>
                <span className="font-mono text-[10px] uppercase tracking-[0.32em] text-(--text-muted)">
                  {isEditing ? 'Edit event' : 'New event'}
                </span>
                <h3 className="font-display mt-1 text-2xl font-semibold text-(--text-primary)">
                  {isEditing ? form.title || 'Edit event' : 'Add a new event'}
                </h3>
              </div>
              <button
                type="button"
                onClick={closeForm}
                disabled={saving}
                className="grid h-9 w-9 place-items-center rounded-full bg-(--surface) text-(--text-secondary) transition hover:bg-(--surface-strong) hover:text-(--text-primary) disabled:opacity-50"
                aria-label="Close form"
              >
                <X size={14} />
              </button>
            </header>

            <div className="grid gap-4 sm:grid-cols-2">
              <AdminTextField
                label="Title"
                required
                value={form.title}
                onChange={(event) =>
                  setForm((prev) =>
                    prev ? { ...prev, title: event.target.value } : prev,
                  )
                }
                error={titleError}
                placeholder="e.g. Apollo 11"
              />
              <AdminTextField
                label="Slug"
                hint="Auto from title"
                value={form.slug}
                onChange={(event) =>
                  setForm((prev) =>
                    prev ? { ...prev, slug: event.target.value } : prev,
                  )
                }
                placeholder="apollo-11"
              />
              <AdminTextField
                label="Period"
                value={form.period}
                onChange={(event) =>
                  setForm((prev) =>
                    prev ? { ...prev, period: event.target.value } : prev,
                  )
                }
                placeholder="1969"
              />
              <AdminTextField
                label="Location"
                value={form.location}
                onChange={(event) =>
                  setForm((prev) =>
                    prev ? { ...prev, location: event.target.value } : prev,
                  )
                }
                placeholder="Moon · Sea of Tranquility"
              />
              <AdminTextField
                label="Tagline"
                value={form.tagline}
                onChange={(event) =>
                  setForm((prev) =>
                    prev ? { ...prev, tagline: event.target.value } : prev,
                  )
                }
                placeholder="One small step for man"
              />
              <AdminTextField
                label="Image URL"
                value={form.imageUrl}
                onChange={(event) =>
                  setForm((prev) =>
                    prev ? { ...prev, imageUrl: event.target.value } : prev,
                  )
                }
                placeholder="https://…"
              />
              <AdminTextField
                label="Accent label"
                value={form.accent}
                onChange={(event) =>
                  setForm((prev) =>
                    prev ? { ...prev, accent: event.target.value } : prev,
                  )
                }
                placeholder="Spaceflight archive"
              />
              <AdminTextField
                label="Hue gradient"
                hint="Tailwind classes"
                value={form.hue}
                onChange={(event) =>
                  setForm((prev) =>
                    prev ? { ...prev, hue: event.target.value } : prev,
                  )
                }
                placeholder="from-sky-400/25 via-indigo-500/20 to-amber-300/25"
              />
              <AdminTextField
                label="Motif"
                value={form.motif}
                onChange={(event) =>
                  setForm((prev) =>
                    prev ? { ...prev, motif: event.target.value } : prev,
                  )
                }
                placeholder="Lunar"
              />
            </div>

            <AdminTextArea
              label="Summary / description"
              rows={4}
              value={form.description}
              onChange={(event) =>
                setForm((prev) =>
                  prev ? { ...prev, description: event.target.value } : prev,
                )
              }
              placeholder="What happened, why it mattered, and what perspectives this archive includes."
            />

            <footer className="flex flex-wrap items-center justify-end gap-2">
              <AdminButton
                variant="secondary"
                type="button"
                onClick={closeForm}
                disabled={saving}
              >
                Cancel
              </AdminButton>
              <AdminButton type="submit" loading={saving}>
                {isEditing ? 'Save changes' : 'Create event'}
              </AdminButton>
            </footer>
          </motion.form>
        ) : null}
      </AnimatePresence>

      <ConfirmDialog
        open={deleteTarget !== null}
        tone="danger"
        title={`Delete "${deleteTarget?.title ?? ''}"?`}
        description={
          <span>
            This permanently removes the event from the catalog.
            <br />
            Characters and source notes tied to this event will <strong>stay
            in the database</strong> until you remove them too — they will
            simply lose their parent reference and disappear from the public
            app.
          </span>
        }
        confirmLabel="Delete event"
        loading={deleting}
        onCancel={() => (deleting ? undefined : setDeleteTarget(null))}
        onConfirm={handleDelete}
      />
    </div>
  )
}
