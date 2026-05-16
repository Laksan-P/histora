import { AnimatePresence, motion } from 'framer-motion'
import { ExternalLink, Library, Pencil, Plus, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  createSourceNote,
  deleteSourceNote,
  isValidUrl,
  listCharacters,
  listEvents,
  listSourceNotes,
  updateSourceNote,
  type AdminCharacter,
  type AdminEvent,
  type AdminSourceNote,
  type AdminSourceNoteInput,
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

type AdminSourceNotesTabProps = {
  refreshSignal: number
  onAfterMutate: () => void
}

type FormState = {
  id?: string
  eventId: string
  characterId: string
  content: string
  citationLabel: string
  citationUrl: string
  tag: string
}

const EMPTY_FORM: FormState = {
  eventId: '',
  characterId: '',
  content: '',
  citationLabel: '',
  citationUrl: '',
  tag: '',
}

function noteToForm(note: AdminSourceNote): FormState {
  return {
    id: note.id,
    eventId: note.eventId,
    characterId: note.characterId ?? '',
    content: note.content,
    citationLabel: note.citationLabel,
    citationUrl: note.citationUrl,
    tag: note.tag,
  }
}

function formToInput(form: FormState): AdminSourceNoteInput {
  return {
    eventId: form.eventId,
    characterId: form.characterId || null,
    content: form.content,
    citationLabel: form.citationLabel,
    citationUrl: form.citationUrl,
    tag: form.tag,
  }
}

export default function AdminSourceNotesTab({
  refreshSignal,
  onAfterMutate,
}: AdminSourceNotesTabProps) {
  const [events, setEvents] = useState<AdminEvent[]>([])
  const [characters, setCharacters] = useState<AdminCharacter[]>([])
  const [notes, setNotes] = useState<AdminSourceNote[]>([])
  const [eventFilter, setEventFilter] = useState('')
  const [characterFilter, setCharacterFilter] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [form, setForm] = useState<FormState | null>(null)
  const [formErrors, setFormErrors] = useState<{
    content?: string
    eventId?: string
    citationUrl?: string
  }>({})
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<AdminSourceNote | null>(null)
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
        const [nextEvents, nextCharacters, nextNotes] = await Promise.all([
          listEvents(),
          listCharacters(),
          listSourceNotes(),
        ])
        if (cancelled) return
        setEvents(nextEvents)
        setCharacters(nextCharacters)
        setNotes(nextNotes)
      } catch (caught) {
        if (cancelled) return
        setLoadError(
          caught instanceof Error
            ? caught.message
            : 'Failed to load source notes.',
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
    for (const event of events) {
      map.set(event.id, event.title || event.slug || event.id)
    }
    return map
  }, [events])

  const characterLabelById = useMemo(() => {
    const map = new Map<string, string>()
    for (const character of characters) {
      map.set(character.id, character.name || character.slug || character.id)
    }
    return map
  }, [characters])

  const charactersForFilter = useMemo(
    () =>
      eventFilter
        ? characters.filter((char) => char.eventId === eventFilter)
        : characters,
    [characters, eventFilter],
  )

  // Cache the eventId in a local so the React Compiler can match the
  // inferred dep set (it tracks the read, not the source object).
  const formEventId = form?.eventId ?? ''
  const charactersForForm = useMemo(
    () =>
      formEventId
        ? characters.filter((char) => char.eventId === formEventId)
        : [],
    [characters, formEventId],
  )

  // If the character filter is no longer valid for the active event filter
  // we drop it transparently instead of resetting state in an effect — that
  // keeps the filter list in sync without firing extra renders or tripping
  // the set-state-in-effect lint.
  const effectiveCharacterFilter = useMemo(() => {
    if (!characterFilter) return ''
    const match = characters.find((char) => char.id === characterFilter)
    if (!match) return ''
    if (eventFilter && match.eventId !== eventFilter) return ''
    return characterFilter
  }, [characters, characterFilter, eventFilter])

  const filteredNotes = useMemo(() => {
    const term = search.trim().toLowerCase()
    return notes.filter((note) => {
      if (eventFilter && note.eventId !== eventFilter) return false
      if (
        effectiveCharacterFilter &&
        note.characterId !== effectiveCharacterFilter
      ) {
        return false
      }
      if (!term) return true
      return [note.content, note.citationLabel, note.tag]
        .join(' ')
        .toLowerCase()
        .includes(term)
    })
  }, [notes, eventFilter, effectiveCharacterFilter, search])

  const isEditing = form !== null && Boolean(form.id)

  const startCreate = () => {
    setFormErrors({})
    setForm({
      ...EMPTY_FORM,
      eventId: eventFilter || events[0]?.id || '',
      characterId: effectiveCharacterFilter || '',
    })
  }

  const startEdit = (note: AdminSourceNote) => {
    setFormErrors({})
    setForm(noteToForm(note))
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
    if (!form.content.trim()) errors.content = 'Source content is required.'
    if (!form.eventId.trim()) errors.eventId = 'Pick an event.'
    if (form.citationUrl.trim() && !isValidUrl(form.citationUrl)) {
      errors.citationUrl = 'Use a full http(s) URL.'
    }
    setFormErrors(errors)
    if (Object.keys(errors).length > 0) return

    setSaving(true)
    try {
      if (form.id) {
        const updated = await updateSourceNote(form.id, formToInput(form))
        setNotes((prev) =>
          prev.map((row) => (row.id === updated.id ? updated : row)),
        )
        toast.success('Source note updated.')
      } else {
        const created = await createSourceNote(formToInput(form))
        setNotes((prev) => [created, ...prev])
        toast.success('Source note created.')
      }
      onAfterMutate()
      setForm(null)
    } catch (caught) {
      toast.error(
        caught instanceof Error
          ? caught.message
          : 'Could not save source note.',
      )
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteSourceNote(deleteTarget.id)
      setNotes((prev) => prev.filter((row) => row.id !== deleteTarget.id))
      toast.success('Source note deleted.')
      setDeleteTarget(null)
      onAfterMutate()
    } catch (caught) {
      toast.error(
        caught instanceof Error
          ? caught.message
          : 'Could not delete source note.',
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
        title="Source notes"
        description="Citations and primary-source snippets the AI grounds its answers in. Every note belongs to an event; characters are optional."
        actions={
          <>
            <AdminInlineSelect
              ariaLabel="Filter by event"
              value={eventFilter}
              onChange={(event) => {
                setEventFilter(event.target.value)
                setCharacterFilter('')
              }}
            >
              <option value="">All events</option>
              {events.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.title || event.slug || event.id}
                </option>
              ))}
            </AdminInlineSelect>
            <AdminInlineSelect
              ariaLabel="Filter by character"
              value={effectiveCharacterFilter}
              onChange={(event) => setCharacterFilter(event.target.value)}
            >
              <option value="">All characters</option>
              {charactersForFilter.map((character) => (
                <option key={character.id} value={character.id}>
                  {character.name || character.slug || character.id}
                </option>
              ))}
            </AdminInlineSelect>
            <AdminSearchInput
              ariaLabel="Search source notes"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search notes"
            />
            <AdminButton
              icon={Plus}
              onClick={startCreate}
              disabled={events.length === 0 || (form !== null && !form.id)}
            >
              New note
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
        ) : filteredNotes.length === 0 ? (
          <AdminEmpty
            icon={Library}
            title={
              search || eventFilter || characterFilter
                ? 'No notes match this filter.'
                : 'No source notes yet.'
            }
            message={
              events.length === 0
                ? 'Create an event first, then add the supporting sources.'
                : 'Add the first primary-source snippet so the AI can cite it.'
            }
          />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {filteredNotes.map((note) => (
              <motion.li
                key={note.id}
                whileHover={{ y: -2 }}
                transition={{ type: 'spring', stiffness: 320, damping: 26 }}
                className="flex h-full flex-col gap-3 rounded-2xl border border-(--border-soft) bg-(--surface-strong) p-4 transition hover:border-(--accent)/60 hover:shadow-(--shadow-cinema)"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="line-clamp-3 text-sm leading-relaxed text-(--text-primary)">
                      {note.content}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => startEdit(note)}
                      aria-label="Edit source note"
                      className="grid h-8 w-8 place-items-center rounded-full bg-(--surface) text-(--text-secondary) transition hover:bg-(--accent-soft) hover:text-(--accent)"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(note)}
                      aria-label="Delete source note"
                      className="grid h-8 w-8 place-items-center rounded-full bg-(--surface) text-(--text-secondary) transition hover:bg-rose-500/15 hover:text-rose-300"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px] uppercase tracking-[0.22em] text-(--text-muted)">
                  <span>{eventLabelById.get(note.eventId) ?? note.eventId}</span>
                  {note.characterId ? (
                    <span>
                      · {characterLabelById.get(note.characterId) ?? note.characterId}
                    </span>
                  ) : null}
                  {note.tag ? <span>· {note.tag}</span> : null}
                </div>
                {note.citationLabel || note.citationUrl ? (
                  <div className="flex items-center justify-between gap-2 rounded-xl bg-(--surface) px-3 py-2 text-[11px] text-(--text-secondary)">
                    <span className="truncate font-medium">
                      {note.citationLabel || note.citationUrl}
                    </span>
                    {note.citationUrl ? (
                      <a
                        href={note.citationUrl}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="inline-flex shrink-0 items-center gap-1 text-(--accent) hover:underline"
                      >
                        Open
                        <ExternalLink size={11} />
                      </a>
                    ) : null}
                  </div>
                ) : null}
              </motion.li>
            ))}
          </ul>
        )}
      </AdminSection>

      <AnimatePresence>
        {form ? (
          <motion.form
            key="source-form"
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
                  {isEditing ? 'Edit source note' : 'New source note'}
                </span>
                <h3 className="font-display mt-1 text-2xl font-semibold text-(--text-primary)">
                  {isEditing ? 'Edit source note' : 'Add a citation'}
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
                    prev
                      ? {
                          ...prev,
                          eventId: event.target.value,
                          // Reset the character when the event changes since
                          // their valid options just changed too.
                          characterId: '',
                        }
                      : prev,
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
              <AdminSelect
                label="Character"
                hint="Optional"
                value={form.characterId}
                onChange={(event) =>
                  setForm((prev) =>
                    prev ? { ...prev, characterId: event.target.value } : prev,
                  )
                }
                disabled={!form.eventId}
              >
                <option value="">— None —</option>
                {charactersForForm.map((character) => (
                  <option key={character.id} value={character.id}>
                    {character.name || character.slug || character.id}
                  </option>
                ))}
              </AdminSelect>
              <AdminTextField
                label="Citation label"
                hint="Recommended"
                value={form.citationLabel}
                onChange={(event) =>
                  setForm((prev) =>
                    prev
                      ? { ...prev, citationLabel: event.target.value }
                      : prev,
                  )
                }
                placeholder="Imperial War Museum · CAB 65/1"
              />
              <AdminTextField
                label="Citation URL"
                hint="Optional"
                value={form.citationUrl}
                onChange={(event) =>
                  setForm((prev) =>
                    prev ? { ...prev, citationUrl: event.target.value } : prev,
                  )
                }
                placeholder="https://archive.example.com/…"
                error={formErrors.citationUrl}
              />
              <AdminTextField
                label="Tag / category"
                value={form.tag}
                onChange={(event) =>
                  setForm((prev) =>
                    prev ? { ...prev, tag: event.target.value } : prev,
                  )
                }
                placeholder="Primary archive"
              />
            </div>

            <AdminTextArea
              label="Content"
              required
              rows={5}
              value={form.content}
              onChange={(event) =>
                setForm((prev) =>
                  prev ? { ...prev, content: event.target.value } : prev,
                )
              }
              error={formErrors.content}
              placeholder="Direct excerpt, paraphrase, or context the AI should cite from."
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
                {isEditing ? 'Save changes' : 'Create note'}
              </AdminButton>
            </footer>
          </motion.form>
        ) : null}
      </AnimatePresence>

      <ConfirmDialog
        open={deleteTarget !== null}
        tone="danger"
        title="Delete source note?"
        description={
          <span>
            This permanently removes the note. Existing conversation messages
            that already cited it stay intact.
          </span>
        }
        confirmLabel="Delete note"
        loading={deleting}
        onCancel={() => (deleting ? undefined : setDeleteTarget(null))}
        onConfirm={handleDelete}
      />
    </div>
  )
}
