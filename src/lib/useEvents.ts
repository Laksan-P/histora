import { useCallback, useEffect, useState } from 'react'
import { fetchEvents } from './data'
import type { HistoricalEvent } from './types'

type EventsState = {
  events: HistoricalEvent[]
  loading: boolean
  error: string | null
}

const INITIAL_STATE: EventsState = {
  events: [],
  loading: true,
  error: null,
}

export function useEvents() {
  const [state, setState] = useState<EventsState>(INITIAL_STATE)
  const [reloadKey, setReloadKey] = useState(0)

  const refetch = useCallback(() => {
    setState({ events: [], loading: true, error: null })
    setReloadKey((value) => value + 1)
  }, [])

  useEffect(() => {
    let cancelled = false

    void (async () => {
      try {
        const events = await fetchEvents()
        if (!cancelled) {
          setState({ events, loading: false, error: null })
        }
      } catch (error) {
        if (!cancelled) {
          setState({
            events: [],
            loading: false,
            error:
              error instanceof Error
                ? error.message
                : 'Failed to load events.',
          })
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [reloadKey])

  return {
    events: state.events,
    loading: state.loading,
    error: state.error,
    refetch,
  }
}
