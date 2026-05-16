import { AnimatePresence, motion } from 'framer-motion'
import { Pencil, Plus, Trash2, UsersRound, X } from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  createCharacter,
  deleteCharacter,
  listCharacters,
  listEvents,
  updateCharacter,
  type AdminCharacter,
  type AdminCharacterInput,
  type AdminEvent,
} from '../../lib/adminApi'
import {
  AdminButton,
  AdminEmpty,
  AdminInlineSelect,
  AdminListSkeleton,
  AdminSearchInput,
  AdminSection,
  AdminSelect,
  AdminTextArea,
  AdminTextField,
  AdminToastBanner,
  ConfirmDialog,
} from './AdminUI'
import { useAdminToast } from './useAdminToast'

type AdminCharactersTabProps = {
  refreshSignal: number
  onAfterMutate: () => void
}

type FormState = {
  id?: string
  slug: string
  eventId: string
  name: string
  role: string
  years: string
  initials: string
  description: string
  tone: string
  signature: string
  voiceStyle: string
}

const EMPTY_FORM: FormState = {
  slug: '',
  eventId: '',
  name: '',
  role: '',
  years: '',
  initials: '',
  description: '',
  tone: '',
  signature: '',
  voiceStyle: '',
}

function characterToForm(character: AdminCharacter): FormState {
  return {
    id: character.id,
    slug: character.slug,
    eventId: character.eventId,
    name: character.name,
    role: character.role,
    years: character.years,
    initials: character.initials,
    description: character.description,
    tone: character.tone,
    signature: character.signature,
    voiceStyle: character.voiceStyle,
  }
}

function formToInput(form: FormState): AdminCharacterInput {
  return {
    eventId: form.eventId,
    slug: form.slug,
    name: form.name,
    role: form.role,
    years: form.years,
    initials: form.initials,
    description: form.description,
    tone: form.tone,
    signature: form.signature,
    voiceStyle: form.voiceStyle,
  }
}

export default function AdminCharactersTab({
  refreshSignal,
  onAfterMutate,
}: AdminCharactersTabProps) {
  const [events, setEvents] = useState<AdminEvent[]>([])
  const [characters, setCharacters] = useState<AdminCharacter[]>([])
  const [eventFilter, setEventFilter] = useState<string>('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [form, setForm] = useState<FormState | null>(null)
  const [formErrors, setFormErrors] = useState<{
    name?: string
    eventId?: string
  }>({})
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<AdminCharacter | null>(null)
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
        const [nextEvents, nextCharacters] = await Promise.all([
          listEvents(),
          listCharacters(),
        ])
        if (cancelled) return
        setEvents(nextEvents)
        setCharacters(nextCharacters)
      } catch (caught) {
        if (cancelled) return
        setLoadError(
          caught instanceof Error
            ? caught.message
            : 'Failed to load characters.',
        )
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [refreshSignal])

  const eventLabelById = useMemo(() => {
    const map = new Map<string, string>()
    for (const event of events) map.set(event.id, event.title || event.slug || event.id)
    return map
  }, [events])

  const filteredCharacters = useMemo(() => {
    const term = search.trim().toLowerCase()
    return characters.filter((character) => {
      if (eventFilter && character.eventId !== eventFilter) return false
      if (!term) return true
      return [character.name, character.slug, character.role, character.tone]
        .join(' ')
        .toLowerCase()
        .includes(term)
    })
  }, [characters, eventFilter, search])

  const isEditing = form !== null && Boolean(form.id)

  const startCreate = () => {
    setFormErrors({})
    setForm({
      ...EMPTY_FORM,
      eventId: eventFilter || events[0]?.id || '',
    })
  }

  const startEdit = (character: AdminCharacter) => {
    setFormErrors({})
    setForm(characterToForm(character))
  }

  const closeForm = () => {
    if (saving) return
    setForm(null)
    setFormErrors({})
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!form || saving) return
    const errors: typeof formErrors = {}
    if (!form.name.trim()) errors.name = 'Name is required.'
    if (!form.eventId.trim()) errors.eventId = 'Pick an event.'
    setFormErrors(errors)
    if (Object.keys(errors).length > 0) return

    setSaving(true)
    try {
      if (form.id) {
        const updated = await updateCharacter(form.id, formToInput(form))
        setCharacters((prev) =>
          prev.map((row) => (row.id === updated.id ? updated : row)),
        )
        toast.success(`Updated "${updated.name}".`)
      } else {
        const created = await createCharacter(formToInput(form))
        setCharacters((prev) => [...prev, created])
        toast.success(`Created "${created.name}".`)
      }
      onAfterMutate()
      setForm(null)
    } catch (caught) {
      toast.error(
        caught instanceof Error
          ? caught.message
          : 'Could not save character.',
      )
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteCharacter(deleteTarget.id)
      setCharacters((prev) => prev.filter((row) => row.id !== deleteTarget.id))
      toast.success(`Deleted "${deleteTarget.name}".`)
      setDeleteTarget(null)
      onAfterMutate()
    } catch (caught) {
      toast.error(
        caught instanceof Error
          ? caught.message
          : 'Could not delete character.',
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
        title="Characters"
        description="Perspectives users can interview inside each event. Voice style is optional metadata for TTS hints."
        actions={
          <>
            <AdminInlineSelect
              ariaLabel="Filter by event"
              value={eventFilter}
              onChange={(event) => setEventFilter(event.target.value)}
            >
              <option value="">All events</option>
              {events.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.title || event.slug || event.id}
                </option>
              ))}
            </AdminInlineSelect>
            <AdminSearchInput
              ariaLabel="Search characters"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search characters"
            />
            <AdminButton
              icon={Plus}
              onClick={startCreate}
              disabled={events.length === 0 || (form !== null && !form.id)}
            >
              New character
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
        ) : filteredCharacters.length === 0 ? (
          <AdminEmpty
            icon={UsersRound}
            title={
              search || eventFilter
                ? 'No characters match this filter.'
                : 'No characters yet.'
            }
            message={
              events.length === 0
                ? 'Create at least one event before adding characters.'
                : 'Pick an event and add the first perspective.'
            }
          />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {filteredCharacters.map((character) => (
              <motion.li
                key={character.id}
                whileHover={{ y: -2 }}
                transition={{ type: 'spring', stiffness: 320, damping: 26 }}
                className="flex h-full flex-col gap-3 rounded-2xl border border-(--border-soft) bg-(--surface-strong) p-4 transition hover:border-(--accent)/60 hover:shadow-(--shadow-cinema)"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-(--accent-soft) font-mono text-xs font-semibold uppercase tracking-wide text-(--accent)">
                      {character.initials || character.name.charAt(0) || 'H'}
                    </span>
                    <div className="min-w-0">
                      <p className="font-display truncate text-base font-semibold text-(--text-primary)">
                        {character.name || '(unnamed)'}
                      </p>
                      <p className="mt-0.5 line-clamp-1 font-mono text-[10px] uppercase tracking-[0.22em] text-(--text-muted)">
                        {eventLabelById.get(character.eventId) ?? character.eventId}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => startEdit(character)}
                      aria-label={`Edit ${character.name}`}
                      className="grid h-8 w-8 place-items-center rounded-full bg-(--surface) text-(--text-secondary) transition hover:bg-(--accent-soft) hover:text-(--accent)"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(character)}
                      aria-label={`Delete ${character.name}`}
                      className="grid h-8 w-8 place-items-center rounded-full bg-(--surface) text-(--text-secondary) transition hover:bg-rose-500/15 hover:text-rose-300"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
                {character.role || character.years ? (
                  <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-(--text-muted)">
                    {[character.role, character.years]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                ) : null}
                {character.description ? (
                  <p className="line-clamp-2 text-xs leading-relaxed text-(--text-secondary)">
                    {character.description}
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
            key="character-form"
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
                  {isEditing ? 'Edit character' : 'New character'}
                </span>
                <h3 className="font-display mt-1 text-2xl font-semibold text-(--text-primary)">
                  {isEditing ? form.name || 'Edit character' : 'Add a perspective'}
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
              <AdminSelect
                label="Event"
                required
                value={form.eventId}
                onChange={(event) =>
                  setForm((prev) =>
                    prev ? { ...prev, eventId: event.target.value } : prev,
                  )
                }
                error={formErrors.eventId}
              >
                <option value="">Pick an event…</option>
                {events.map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.title || event.slug || event.id}
                  </option>
                ))}
              </AdminSelect>
              <AdminTextField
                label="Name"
                required
                value={form.name}
                onChange={(event) =>
                  setForm((prev) =>
                    prev ? { ...prev, name: event.target.value } : prev,
                  )
                }
                error={formErrors.name}
                placeholder="Winston Churchill"
              />
              <AdminTextField
                label="Slug"
                hint="Auto from name"
                value={form.slug}
                onChange={(event) =>
                  setForm((prev) =>
                    prev ? { ...prev, slug: event.target.value } : prev,
                  )
                }
                placeholder="winston-churchill"
              />
              <AdminTextField
                label="Role"
                value={form.role}
                onChange={(event) =>
                  setForm((prev) =>
                    prev ? { ...prev, role: event.target.value } : prev,
                  )
                }
                placeholder="Prime Minister"
              />
              <AdminTextField
                label="Years"
                value={form.years}
                onChange={(event) =>
                  setForm((prev) =>
                    prev ? { ...prev, years: event.target.value } : prev,
                  )
                }
                placeholder="1874–1965"
              />
              <AdminTextField
                label="Initials"
                hint="Auto from name"
                value={form.initials}
                onChange={(event) =>
                  setForm((prev) =>
                    prev ? { ...prev, initials: event.target.value } : prev,
                  )
                }
                placeholder="WC"
              />
              <AdminTextField
                label="Tone"
                value={form.tone}
                onChange={(event) =>
                  setForm((prev) =>
                    prev ? { ...prev, tone: event.target.value } : prev,
                  )
                }
                placeholder="Source-grounded · resolute"
              />
              <AdminTextField
                label="Signature"
                value={form.signature}
                onChange={(event) =>
                  setForm((prev) =>
                    prev ? { ...prev, signature: event.target.value } : prev,
                  )
                }
                placeholder="We shall fight on the beaches…"
              />
              <AdminTextField
                label="Voice style"
                hint="Optional TTS hint"
                value={form.voiceStyle}
                onChange={(event) =>
                  setForm((prev) =>
                    prev ? { ...prev, voiceStyle: event.target.value } : prev,
                  )
                }
                placeholder="warm, measured, mid-Atlantic"
              />
            </div>

            <AdminTextArea
              label="Description"
              rows={4}
              value={form.description}
              onChange={(event) =>
                setForm((prev) =>
                  prev ? { ...prev, description: event.target.value } : prev,
                )
              }
              placeholder="Who this perspective is, what they witnessed, and how they speak."
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
                {isEditing ? 'Save changes' : 'Create character'}
              </AdminButton>
            </footer>
          </motion.form>
        ) : null}
      </AnimatePresence>

      <ConfirmDialog
        open={deleteTarget !== null}
        tone="danger"
        title={`Delete "${deleteTarget?.name ?? ''}"?`}
        description={
          <span>
            This permanently removes the perspective from the catalog. Source
            notes attached to this character will <strong>stay in the
            database</strong> with a dangling character_id — clean them up in
            the Source notes tab afterwards.
          </span>
        }
        confirmLabel="Delete character"
        loading={deleting}
        onCancel={() => (deleting ? undefined : setDeleteTarget(null))}
        onConfirm={handleDelete}
      />
    </div>
  )
}
