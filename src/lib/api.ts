import type {
  ChatMessage,
  HistoricalCharacter,
  HistoricalEvent,
  QuizQuestion,
  SourceNote,
  TtsVoiceGender,
} from './types'

const CHAT_ENDPOINT = '/api/chat'
const TTS_ENDPOINT = '/api/tts'
const QUIZ_ENDPOINT = '/api/quiz'

async function extractErrorMessage(
  response: Response,
  fallback: string,
): Promise<string> {
  const contentType = response.headers.get('content-type') ?? ''
  try {
    if (contentType.includes('application/json')) {
      const payload = (await response.json()) as { error?: unknown }
      if (typeof payload.error === 'string' && payload.error.trim()) {
        return payload.error.trim()
      }
    } else {
      const text = await response.text()
      if (text.trim()) return text.trim()
    }
  } catch {
    /* ignore */
  }
  return fallback
}

function trimEvent(event: HistoricalEvent) {
  return {
    title: event.title,
    period: event.period,
    location: event.location,
    description: event.description,
    tagline: event.tagline,
    motif: event.motif,
  }
}

function trimCharacter(character: HistoricalCharacter) {
  return {
    name: character.name,
    role: character.role,
    years: character.years,
    tone: character.tone,
    signature: character.signature,
    description: character.description,
    voiceStyle: character.voiceStyle,
  }
}

function trimSources(sources: SourceNote[]) {
  return sources.map((source) => ({
    title: source.title,
    detail: source.detail,
    citation: source.citation,
    tag: source.tag,
  }))
}

export type ChatRequest = {
  event: HistoricalEvent
  character: HistoricalCharacter
  sources: SourceNote[]
  history: { role: 'user' | 'assistant'; content: string }[]
  signal?: AbortSignal
}

export type ChatResponse = {
  message: string
  sources: string[]
}

export async function requestChatCompletion(
  params: ChatRequest,
): Promise<ChatResponse> {
  const response = await fetch(CHAT_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    signal: params.signal,
    body: JSON.stringify({
      event: trimEvent(params.event),
      character: trimCharacter(params.character),
      sources: trimSources(params.sources),
      messages: params.history,
    }),
  })

  if (!response.ok) {
    const detail = await extractErrorMessage(
      response,
      `Chat request failed (${response.status}).`,
    )
    throw new Error(detail)
  }

  const data = (await response.json()) as {
    message?: unknown
    sources?: unknown
  }
  const message = typeof data.message === 'string' ? data.message.trim() : ''
  if (!message) {
    throw new Error('The archive returned no reply.')
  }
  const sources = Array.isArray(data.sources)
    ? data.sources
        .filter((value): value is string => typeof value === 'string')
        .map((value) => value.trim())
        .filter((value) => value.length > 0)
    : []
  return { message, sources }
}

export function buildChatHistory(messages: ChatMessage[]) {
  return messages
    .filter((message) => message.id !== 'seed-1')
    .map((message) => ({ role: message.role, content: message.content }))
}

export async function requestSpeech(
  text: string,
  options: { signal?: AbortSignal; selectedVoice: TtsVoiceGender },
): Promise<Blob> {
  const response = await fetch(TTS_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    signal: options.signal,
    body: JSON.stringify({
      text,
      selectedVoice: options.selectedVoice,
    }),
  })

  const contentType = response.headers.get('content-type') ?? ''

  if (!response.ok) {
    const detail = await extractErrorMessage(
      response,
      `Voice synthesis failed (${response.status}).`,
    )
    throw new Error(detail)
  }

  // Proxies or misconfigured routes may return JSON errors with a 200 — fail fast
  // instead of handing a non-audio blob to the player (which hangs the UI).
  if (contentType.includes('application/json')) {
    let payload: { error?: unknown }
    try {
      payload = (await response.json()) as { error?: unknown }
    } catch {
      throw new Error('Voice synthesis returned unreadable JSON.')
    }
    const msg =
      typeof payload.error === 'string' && payload.error.trim()
        ? payload.error.trim()
        : 'Voice synthesis returned an error instead of audio.'
    throw new Error(msg)
  }

  return response.blob()
}

export type QuizRequest = {
  event: HistoricalEvent
  character: HistoricalCharacter
  sources: SourceNote[]
  count?: number
  signal?: AbortSignal
}

export async function requestQuiz(
  params: QuizRequest,
): Promise<QuizQuestion[]> {
  const response = await fetch(QUIZ_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    signal: params.signal,
    body: JSON.stringify({
      event: trimEvent(params.event),
      character: trimCharacter(params.character),
      sources: trimSources(params.sources),
      count: params.count ?? 5,
    }),
  })

  if (!response.ok) {
    const detail = await extractErrorMessage(
      response,
      `Quiz generation failed (${response.status}).`,
    )
    throw new Error(detail)
  }

  const data = (await response.json()) as { questions?: unknown }
  if (!Array.isArray(data.questions) || data.questions.length === 0) {
    throw new Error('The archive returned no quiz questions.')
  }
  return data.questions as QuizQuestion[]
}
