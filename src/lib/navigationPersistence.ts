/** Persisted shell navigation so refresh stays on the same Histora screen. */
export const NAVIGATION_STORAGE_KEY = 'histora.navigation.v1'

export type PersistedNavigation = {
  view: 'landing' | 'events' | 'characters' | 'chat' | 'admin' | 'profile'
  eventId: string | null
  characterId: string | null
  conversationId: string | null
}

export function readPersistedNavigation(): PersistedNavigation | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(NAVIGATION_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<PersistedNavigation>
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      typeof parsed.view !== 'string'
    ) {
      return null
    }
    return {
      view: parsed.view as PersistedNavigation['view'],
      eventId:
        typeof parsed.eventId === 'string' ? parsed.eventId : null,
      characterId:
        typeof parsed.characterId === 'string'
          ? parsed.characterId
          : null,
      conversationId:
        typeof parsed.conversationId === 'string'
          ? parsed.conversationId
          : null,
    }
  } catch {
    return null
  }
}

export function writePersistedNavigation(snapshot: PersistedNavigation): void {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(NAVIGATION_STORAGE_KEY, JSON.stringify(snapshot))
  } catch {
    /* quota / private mode */
  }
}

export function clearPersistedNavigation(): void {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.removeItem(NAVIGATION_STORAGE_KEY)
  } catch {
    /* ignore */
  }
}
