import { useCallback, useEffect, useState } from 'react'
import { fetchCharactersForEvent } from './data'
import type { HistoricalCharacter } from './types'

type CharactersState = {
  characters: HistoricalCharacter[]
  fetchedFor: string | null
  error: string | null
}

const INITIAL_STATE: CharactersState = {
  characters: [],
  fetchedFor: null,
  error: null,
}

export function useCharacters(eventId: string | null) {
  const [state, setState] = useState<CharactersState>(INITIAL_STATE)
  const [reloadKey, setReloadKey] = useState(0)

  const refetch = useCallback(() => {
    if (!eventId) return
    setState(INITIAL_STATE)
    setReloadKey((value) => value + 1)
  }, [eventId])

  useEffect(() => {
    if (!eventId) return

    let cancelled = false

    void (async () => {
      try {
        const characters = await fetchCharactersForEvent(eventId)
        if (!cancelled) {
          setState({ characters, fetchedFor: eventId, error: null })
        }
      } catch (error) {
        if (!cancelled) {
          setState({
            characters: [],
            fetchedFor: eventId,
            error:
              error instanceof Error
                ? error.message
                : 'Failed to load characters.',
          })
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [eventId, reloadKey])

  const loading = eventId !== null && state.fetchedFor !== eventId
  const characters = state.fetchedFor === eventId ? state.characters : []
  const error = state.fetchedFor === eventId ? state.error : null

  return {
    characters,
    loading,
    error,
    refetch,
  }
}
