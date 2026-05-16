import { useCallback, useEffect, useState } from 'react'
import { fetchSourceNotesForEvent } from './data'
import { isSupabaseConfigured } from './supabaseClient'
import type { SourceNote } from './types'

type SourceNotesState = {
  notes: SourceNote[]
  fetchedFor: string | null
  error: string | null
}

const INITIAL_STATE: SourceNotesState = {
  notes: [],
  fetchedFor: null,
  error: null,
}

/**
 * Load every source note attached to an event. Results include both
 * character-scoped rows (character_id = some character) and general rows
 * (character_id IS NULL); callers filter at render time so changing the
 * selected character does not trigger a refetch.
 *
 * When Supabase isn't configured the hook resolves with an empty list and
 * `loading: false` so the UI can fall back to the static demo notes
 * without showing a spinner forever.
 */
export function useSourceNotes(eventId: string | null) {
  const [state, setState] = useState<SourceNotesState>(INITIAL_STATE)
  const [reloadKey, setReloadKey] = useState(0)

  const refetch = useCallback(() => {
    if (!eventId) return
    setState(INITIAL_STATE)
    setReloadKey((value) => value + 1)
  }, [eventId])

  // Render-time short-circuit when Supabase isn't configured: mark the
  // current eventId as fetched with an empty list so the UI can fall back
  // to the static demo notes immediately. Doing this in render (instead of
  // inside the effect) keeps us clear of react-hooks/set-state-in-effect.
  const configured = isSupabaseConfigured()
  if (eventId && !configured && state.fetchedFor !== eventId) {
    setState({ notes: [], fetchedFor: eventId, error: null })
  }

  useEffect(() => {
    if (!eventId) return
    if (!configured) return

    let cancelled = false

    void (async () => {
      try {
        const notes = await fetchSourceNotesForEvent(eventId)
        if (!cancelled) {
          setState({ notes, fetchedFor: eventId, error: null })
        }
      } catch (error) {
        if (!cancelled) {
          setState({
            notes: [],
            fetchedFor: eventId,
            error:
              error instanceof Error
                ? error.message
                : 'Failed to load source notes.',
          })
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [eventId, reloadKey, configured])

  const loading = eventId !== null && state.fetchedFor !== eventId
  const notes = state.fetchedFor === eventId ? state.notes : []
  const error = state.fetchedFor === eventId ? state.error : null

  return {
    notes,
    loading,
    error,
    refetch,
  }
}
