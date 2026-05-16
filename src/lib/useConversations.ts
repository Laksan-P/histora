import { useEffect, useState } from 'react'
import {
  fetchRecentConversations,
  isHistoryAvailable,
  type ConversationSummary,
} from './conversations'

type State = {
  conversations: ConversationSummary[]
  loading: boolean
  error: string | null
}

const INITIAL_STATE: State = {
  conversations: [],
  loading: true,
  error: null,
}

const EMPTY_STATE: State = {
  conversations: [],
  loading: false,
  error: null,
}

type UseConversationsArgs = {
  userId: string | null
  eventId: string | null
  characterId: string | null
  refreshKey: number
}

export function useConversations({
  userId,
  eventId,
  characterId,
  refreshKey,
}: UseConversationsArgs) {
  const [state, setState] = useState<State>(INITIAL_STATE)
  const [trackedRefreshKey, setTrackedRefreshKey] = useState(refreshKey)
  const [trackedScope, setTrackedScope] = useState(`${eventId}::${characterId}`)

  const scope = `${eventId}::${characterId}`

  // When the caller bumps refreshKey, or the user switches event/character,
  // flip back to a loading state immediately. Adjusting state during render
  // is React's recommended pattern for prop-driven refresh signals and keeps
  // us clear of the set-state-in-effect lint rule.
  if (trackedRefreshKey !== refreshKey || trackedScope !== scope) {
    setTrackedRefreshKey(refreshKey)
    setTrackedScope(scope)
    setState((prev) => ({
      conversations: prev.conversations,
      loading: true,
      error: null,
    }))
  }

  useEffect(() => {
    if (!userId || !eventId || !characterId || !isHistoryAvailable()) return

    let cancelled = false
    void (async () => {
      try {
        const rows = await fetchRecentConversations(userId, {
          eventId,
          characterId,
        })
        if (!cancelled) {
          setState({ conversations: rows, loading: false, error: null })
        }
      } catch (error) {
        if (!cancelled) {
          setState({
            conversations: [],
            loading: false,
            error:
              error instanceof Error
                ? error.message
                : 'Could not load conversations.',
          })
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [userId, eventId, characterId, refreshKey])

  // Without a session, history support, or an active perspective there is
  // nothing to show — short-circuit so the sidebar doesn't render a stale
  // list while the user is between selections.
  if (!userId || !eventId || !characterId || !isHistoryAvailable()) {
    return EMPTY_STATE
  }
  return state
}
