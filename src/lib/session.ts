const STORAGE_KEY = 'histora:session-id'

function generateUuid(): string {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID()
  }
  // RFC 4122-ish fallback for environments without crypto.randomUUID
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = (Math.random() * 16) | 0
    const value = char === 'x' ? random : (random & 0x3) | 0x8
    return value.toString(16)
  })
}

let cachedSessionId: string | null = null

export function getSessionId(): string {
  if (cachedSessionId) return cachedSessionId

  if (typeof window === 'undefined') {
    cachedSessionId = generateUuid()
    return cachedSessionId
  }

  try {
    const existing = window.localStorage.getItem(STORAGE_KEY)
    if (existing && existing.trim().length > 0) {
      cachedSessionId = existing.trim()
      return cachedSessionId
    }
  } catch {
    /* localStorage might be disabled (private mode, etc.) */
  }

  const fresh = generateUuid()
  try {
    window.localStorage.setItem(STORAGE_KEY, fresh)
  } catch {
    /* ignore */
  }
  cachedSessionId = fresh
  return fresh
}
