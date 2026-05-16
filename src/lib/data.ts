import { supabase } from './supabaseClient'
import type {
  HistoricalCharacter,
  HistoricalEvent,
  SourceNote,
} from './types'

type RawEventRow = {
  id: string | number
  slug?: string | null
  title?: string | null
  period?: string | null
  location?: string | null
  tagline?: string | null
  description?: string | null
  accent?: string | null
  hue?: string | null
  motif?: string | null
}

type RawCharacterRow = {
  id: string | number
  event_id: string | number
  slug?: string | null
  name?: string | null
  role?: string | null
  years?: string | null
  initials?: string | null
  description?: string | null
  tone?: string | null
  signature?: string | null
  voice_style?: string | null
}

type RawSourceNoteRow = {
  id: string
  event_id: string
  character_id: string | null
  content?: string | null
  citation_label?: string | null
  citation_url?: string | null
  tag?: string | null
}

function ensureSupabase() {
  if (!supabase) {
    throw new Error(
      'Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env.local file.',
    )
  }
  return supabase
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function makeInitials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2)
  const letters = parts.map((part) => part[0]?.toUpperCase() ?? '').join('')
  return letters || 'H'
}

function clean(value: string | null | undefined): string {
  return (value ?? '').toString().trim()
}

export function mapEvent(row: RawEventRow): HistoricalEvent {
  const title = clean(row.title) || 'Untitled event'
  return {
    id: String(row.id),
    slug: clean(row.slug) || slugify(title),
    title,
    period: clean(row.period),
    location: clean(row.location),
    tagline: clean(row.tagline),
    description: clean(row.description),
    accent: clean(row.accent) || 'Historical archive',
    hue:
      clean(row.hue) ||
      'from-sky-400/25 via-indigo-500/20 to-amber-300/25',
    motif: clean(row.motif),
  }
}

export function mapCharacter(row: RawCharacterRow): HistoricalCharacter {
  const name = clean(row.name) || 'Unknown perspective'
  return {
    id: String(row.id),
    eventId: String(row.event_id),
    name,
    role: clean(row.role) || 'Historical perspective',
    years: clean(row.years) || '—',
    initials: clean(row.initials) || makeInitials(name),
    description: clean(row.description),
    tone: clean(row.tone) || 'Source-grounded',
    signature: clean(row.signature),
    voiceStyle: clean(row.voice_style),
  }
}

function describeError(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message
  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as { message: unknown }).message === 'string'
  ) {
    return (error as { message: string }).message
  }
  return fallback
}

export async function fetchEvents(): Promise<HistoricalEvent[]> {
  const client = ensureSupabase()
  const { data, error } = await client.from('events').select('*')
  if (error) {
    throw new Error(describeError(error, 'Failed to load events from Supabase.'))
  }
  return (data ?? []).map((row) => mapEvent(row as RawEventRow))
}

export async function fetchCharactersForEvent(
  eventId: string,
): Promise<HistoricalCharacter[]> {
  const client = ensureSupabase()
  const { data, error } = await client
    .from('characters')
    .select('*')
    .eq('event_id', eventId)
  if (error) {
    throw new Error(
      describeError(error, 'Failed to load characters from Supabase.'),
    )
  }
  return (data ?? []).map((row) => mapCharacter(row as RawCharacterRow))
}

/**
 * Pick a short, human-readable headline for a source card. Admin authors a
 * single `content` blob, so we derive the headline from the first sentence
 * (or the first ~70 characters) and fall back to the citation label when
 * the body is empty.
 */
function deriveSourceTitle(content: string, citationLabel: string): string {
  const trimmed = content.trim()
  if (trimmed) {
    const sentenceEnd = trimmed.search(/[.!?](\s|$)/)
    if (sentenceEnd > 0 && sentenceEnd <= 80) {
      return trimmed.slice(0, sentenceEnd + 1)
    }
    if (trimmed.length <= 70) return trimmed
    return `${trimmed.slice(0, 70).trimEnd()}…`
  }
  if (citationLabel) return citationLabel
  return 'Source note'
}

function deriveCitation(label: string, url: string): string {
  if (label) return label
  if (url) {
    try {
      return new URL(url).hostname.replace(/^www\./, '')
    } catch {
      return url
    }
  }
  return 'Archive'
}

export function mapSourceNote(row: RawSourceNoteRow): SourceNote {
  const content = clean(row.content)
  const citationLabel = clean(row.citation_label)
  const citationUrl = clean(row.citation_url)
  return {
    id: String(row.id),
    title: deriveSourceTitle(content, citationLabel),
    detail: content,
    citation: deriveCitation(citationLabel, citationUrl),
    tag: clean(row.tag) || 'Source',
    characterId: row.character_id,
    citationUrl: citationUrl || null,
  }
}

/**
 * Fetch every source note attached to an event. Caller is responsible for
 * filtering down to character-specific + general (null character_id) notes
 * at render time so we can swap selected characters without re-querying.
 */
export async function fetchSourceNotesForEvent(
  eventId: string,
): Promise<SourceNote[]> {
  const client = ensureSupabase()
  const { data, error } = await client
    .from('source_notes')
    .select('id, event_id, character_id, content, citation_label, citation_url, tag')
    .eq('event_id', eventId)
    .order('created_at', { ascending: true })
  if (error) {
    throw new Error(
      describeError(error, 'Failed to load source notes from Supabase.'),
    )
  }
  return (data ?? []).map((row) => mapSourceNote(row as RawSourceNoteRow))
}
