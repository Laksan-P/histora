import { supabase } from './supabaseClient'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AdminEvent = {
  id: string
  slug: string
  title: string
  period: string
  location: string
  tagline: string
  description: string
  accent: string
  hue: string
  motif: string
  imageUrl: string
}

export type AdminEventInput = {
  id?: string
  slug?: string
  title: string
  period?: string
  location?: string
  tagline?: string
  description?: string
  accent?: string
  hue?: string
  motif?: string
  imageUrl?: string
}

export type AdminCharacter = {
  id: string
  eventId: string
  slug: string
  name: string
  role: string
  years: string
  initials: string
  description: string
  tone: string
  signature: string
  voiceStyle: string
}

export type AdminCharacterInput = {
  id?: string
  slug?: string
  eventId: string
  name: string
  role?: string
  years?: string
  initials?: string
  description?: string
  tone?: string
  signature?: string
  voiceStyle?: string
}

export type AdminSourceNote = {
  id: string
  eventId: string
  characterId: string | null
  content: string
  citationLabel: string
  citationUrl: string
  tag: string
  createdAt: string
  updatedAt: string
}

export type AdminSourceNoteInput = {
  eventId: string
  characterId?: string | null
  content: string
  citationLabel?: string
  citationUrl?: string
  tag?: string
}

export type AdminProfile = {
  id: string
  email: string | null
  role: 'user' | 'admin'
  createdAt: string
}

export type AdminConversation = {
  id: string
  userId: string | null
  eventId: string | null
  characterId: string | null
  title: string
  createdAt: string
  updatedAt: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function isAdminApiAvailable(): boolean {
  return supabase !== null
}

function ensureSupabase() {
  if (!supabase) {
    throw new Error(
      'Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env.local file.',
    )
  }
  return supabase
}

function clean(value: string | null | undefined): string {
  return (value ?? '').toString().trim()
}

function nullable(value: string | null | undefined): string | null {
  const trimmed = clean(value)
  return trimmed.length === 0 ? null : trimmed
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
  image_url?: string | null
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
  content: string
  citation_label: string | null
  citation_url: string | null
  tag: string | null
  created_at: string
  updated_at: string
}

function mapEvent(row: RawEventRow): AdminEvent {
  return {
    id: String(row.id),
    slug: clean(row.slug),
    title: clean(row.title),
    period: clean(row.period),
    location: clean(row.location),
    tagline: clean(row.tagline),
    description: clean(row.description),
    accent: clean(row.accent),
    hue: clean(row.hue),
    motif: clean(row.motif),
    imageUrl: clean(row.image_url),
  }
}

function mapCharacter(row: RawCharacterRow): AdminCharacter {
  return {
    id: String(row.id),
    eventId: String(row.event_id),
    slug: clean(row.slug),
    name: clean(row.name),
    role: clean(row.role),
    years: clean(row.years),
    initials: clean(row.initials),
    description: clean(row.description),
    tone: clean(row.tone),
    signature: clean(row.signature),
    voiceStyle: clean(row.voice_style),
  }
}

function mapSourceNote(row: RawSourceNoteRow): AdminSourceNote {
  return {
    id: row.id,
    eventId: row.event_id,
    characterId: row.character_id,
    content: row.content,
    citationLabel: clean(row.citation_label),
    citationUrl: clean(row.citation_url),
    tag: clean(row.tag),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function describeError(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message
  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as { message?: unknown }).message === 'string'
  ) {
    return (error as { message: string }).message
  }
  return fallback
}

/**
 * Translate the most common Supabase / PostgREST error shapes into something
 * an admin can act on instead of a raw protocol message.
 */
function humanizeWriteError(message: string, fallback: string): string {
  const trimmed = message.trim()
  if (!trimmed) return fallback
  if (
    /row-level security|new row violates row-level security/i.test(trimmed)
  ) {
    return 'Row-level security blocked this write. Make sure your account has role=admin in the profiles table.'
  }
  if (/violates not-null constraint/i.test(trimmed)) {
    const match = trimmed.match(/column "([^"]+)"/)
    return match
      ? `The "${match[1]}" column is required by the database. Fill it in and try again.`
      : 'A required field is missing.'
  }
  if (/duplicate key value violates unique constraint/i.test(trimmed)) {
    return 'That value already exists. Pick a different id or slug.'
  }
  return trimmed || fallback
}

/**
 * Schema cache: tracks which columns we have seen Supabase reject for each
 * table so we can prune them from subsequent writes without retrying. The
 * cache lives for the lifetime of the page; once 0003 is applied, a hard
 * refresh re-enables every dropped field.
 */
const MISSING_COLUMNS: Record<string, Set<string>> = {}

function dropMissing<T extends Record<string, unknown>>(
  table: string,
  payload: T,
  column: string,
): T {
  const next = { ...payload }
  delete (next as Record<string, unknown>)[column]
  if (!MISSING_COLUMNS[table]) MISSING_COLUMNS[table] = new Set()
  MISSING_COLUMNS[table].add(column)
  return next
}

function pruneCachedMissing<T extends Record<string, unknown>>(
  table: string,
  payload: T,
): T {
  const missing = MISSING_COLUMNS[table]
  if (!missing || missing.size === 0) return payload
  const next = { ...payload } as Record<string, unknown>
  for (const key of missing) delete next[key]
  return next as T
}

function getErrorMessage(error: unknown): string {
  if (!error || typeof error !== 'object') return ''
  return 'message' in error && typeof (error as { message?: unknown }).message === 'string'
    ? (error as { message: string }).message
    : ''
}

function getErrorCode(error: unknown): string {
  if (!error || typeof error !== 'object') return ''
  return 'code' in error && typeof (error as { code?: unknown }).code === 'string'
    ? (error as { code: string }).code
    : ''
}

/**
 * Inspect a Supabase error payload and return the column name that the
 * server claims is missing. Supabase / PostgREST emits a few different
 * shapes here so we cover all the ones we have seen in the wild.
 */
function extractMissingColumn(
  error: unknown,
  payload: Record<string, unknown>,
): string | null {
  const message = getErrorMessage(error)
  const code = getErrorCode(error)
  const candidates: RegExp[] = [
    /Could not find the '([^']+)' column/i, // PGRST204 schema-cache miss
    /column "?([a-z_][a-z0-9_]*)"? of relation/i,
    /column "?([a-z_][a-z0-9_]*)"? does not exist/i,
  ]
  for (const re of candidates) {
    const match = message.match(re)
    if (match) return match[1]
  }
  // PGRST204 with the column name embedded only in the hint — fall back to
  // dropping the first payload key that the cache has not yet rejected.
  if (code === 'PGRST204') {
    for (const key of Object.keys(payload)) {
      if (!MISSING_COLUMNS[''] || !MISSING_COLUMNS[''].has(key)) return key
    }
  }
  return null
}

/** PostgREST: 'null value in column "id" of relation "events" violates not-null constraint' */
function extractNotNullColumn(error: unknown): string | null {
  const message = getErrorMessage(error)
  const match = message.match(/null value in column "([^"]+)"/i)
  return match ? match[1] : null
}

/** PostgREST: 'invalid input syntax for type uuid: "foo-bar"' (we sent a slug to a uuid column) */
function isInvalidUuidSyntax(error: unknown): boolean {
  return /invalid input syntax for type uuid/i.test(getErrorMessage(error))
}

type WriteOptions = {
  /**
   * If the database rejects a write because `id` is not-null but we omitted
   * it (text PK without a default), inject this id and retry. If the
   * database rejects an explicit id with `invalid input syntax for type
   * uuid` (uuid PK with default), drop id and retry.
   */
  fallbackId?: string
}

const MAX_SCHEMA_RETRIES = 24

async function insertWithRetry<TRow>(
  table: string,
  payload: Record<string, unknown>,
  options: WriteOptions = {},
): Promise<TRow> {
  const client = ensureSupabase()
  let attempt = pruneCachedMissing(table, payload)
  for (let tries = 0; tries < MAX_SCHEMA_RETRIES; tries += 1) {
    const { data, error } = await client
      .from(table)
      .insert(attempt)
      .select('*')
      .single()
    if (!error && data) return data as TRow
    if (!error) {
      throw new Error(humanizeWriteError('', `Could not insert into ${table}.`))
    }

    const missingCol = extractMissingColumn(error, attempt)
    if (missingCol && missingCol in attempt) {
      attempt = dropMissing(table, attempt, missingCol)
      continue
    }

    // Schema is text-required `id` but we sent nothing — inject a fallback.
    const notNullCol = extractNotNullColumn(error)
    if (
      notNullCol === 'id' &&
      options.fallbackId &&
      !('id' in attempt)
    ) {
      attempt = { ...attempt, id: options.fallbackId }
      continue
    }

    // Schema is uuid-with-default but we sent a slug — drop id, let default fire.
    if (isInvalidUuidSyntax(error) && 'id' in attempt) {
      attempt = dropMissing(table, attempt, 'id')
      continue
    }

    throw new Error(humanizeWriteError(error.message, `Could not insert into ${table}.`))
  }
  throw new Error(`Could not insert into ${table} after pruning unknown columns.`)
}

async function updateWithRetry<TRow>(
  table: string,
  id: string,
  payload: Record<string, unknown>,
): Promise<TRow> {
  const client = ensureSupabase()
  // Updates must NEVER touch the primary key — we filter against it. If a
  // caller accidentally included it, strip it here before pruning.
  const sanitized = { ...payload }
  delete sanitized.id
  let attempt = pruneCachedMissing(table, sanitized)
  for (let tries = 0; tries < MAX_SCHEMA_RETRIES; tries += 1) {
    const { data, error } = await client
      .from(table)
      .update(attempt)
      .eq('id', id)
      .select('*')
      .single()
    if (!error && data) return data as TRow
    if (!error) {
      throw new Error(humanizeWriteError('', `Could not update ${table}.`))
    }
    const missingCol = extractMissingColumn(error, attempt)
    if (missingCol && missingCol in attempt) {
      attempt = dropMissing(table, attempt, missingCol)
      continue
    }
    throw new Error(humanizeWriteError(error.message, `Could not update ${table}.`))
  }
  throw new Error(`Could not update ${table} after pruning unknown columns.`)
}

/**
 * Capture the actual column set returned for a list query so future writes
 * can pre-prune anything the schema doesn't expose. Only used to seed the
 * cache; explicit retries still cover any column the first row happened to
 * skip (e.g. nullable columns that all rows leave NULL).
 */
function rememberObservedColumns(table: string, rows: unknown[]) {
  if (rows.length === 0) return
  const sample = rows[0]
  if (!sample || typeof sample !== 'object') return
  const observed = new Set(Object.keys(sample as object))
  // Anything we previously *attempted* but isn't in observed stays cached;
  // anything we observe is definitely present, so remove it from misses.
  const misses = MISSING_COLUMNS[table]
  if (misses) {
    for (const col of Array.from(misses)) {
      if (observed.has(col)) misses.delete(col)
    }
  }
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

export async function listEvents(): Promise<AdminEvent[]> {
  const client = ensureSupabase()
  const { data, error } = await client
    .from('events')
    .select('*')
    .order('title', { ascending: true })
  if (error) throw new Error(describeError(error, 'Failed to load events.'))
  const rows = (data ?? []) as RawEventRow[]
  rememberObservedColumns('events', rows)
  return rows.map((row) => mapEvent(row))
}

/**
 * Compute the canonical text id for an event. The Histora schema uses a
 * required text primary key with no default, so every insert MUST include
 * a stable slug-shaped id. Resolution order:
 *   1. explicit input.id (admin overrode it)
 *   2. input.slug (the user typed one)
 *   3. slugify(title) (always present because title is required)
 */
function resolveEventId(input: AdminEventInput): string {
  const explicit = nullable(input.id)
  if (explicit) return slugify(explicit) || explicit
  const slug = nullable(input.slug)
  if (slug) return slugify(slug) || slug
  return slugify(clean(input.title))
}

function buildEventPayload(input: AdminEventInput): Record<string, unknown> {
  const title = clean(input.title)
  if (!title) throw new Error('Event title is required.')
  // Slug stays in lock-step with id on create so the public page URLs and
  // the primary key match the example flow:
  //   title: "Aragalaya 2022" → slug: "aragalaya-2022" → id: "aragalaya-2022"
  const slug = nullable(input.slug) ?? slugify(title)
  const payload: Record<string, unknown> = {
    title,
    slug,
    period: nullable(input.period),
    location: nullable(input.location),
    tagline: nullable(input.tagline),
    description: nullable(input.description),
    accent: nullable(input.accent),
    hue: nullable(input.hue),
    motif: nullable(input.motif),
    image_url: nullable(input.imageUrl),
  }
  // Strip undefined keys so they don't end up in JSON as nulls when we
  // didn't actually mean to clear the column.
  for (const key of Object.keys(payload)) {
    if (payload[key] === undefined) delete payload[key]
  }
  return payload
}

export async function createEvent(input: AdminEventInput): Promise<AdminEvent> {
  const payload = buildEventPayload(input)
  // Always provide id for events (text PK, no default). insertWithRetry will
  // automatically drop it if the running database actually uses uuid+default.
  payload.id = resolveEventId(input)
  const data = await insertWithRetry<RawEventRow>('events', payload, {
    fallbackId: typeof payload.id === 'string' ? payload.id : undefined,
  })
  return mapEvent(data)
}

export async function updateEvent(
  id: string,
  input: AdminEventInput,
): Promise<AdminEvent> {
  // Build the payload but strip id so the primary key stays stable across
  // edits. Slug, title, period, etc. all flow through normally.
  const payload = buildEventPayload(input)
  delete (payload as Record<string, unknown>).id
  const data = await updateWithRetry<RawEventRow>('events', id, payload)
  return mapEvent(data)
}

export async function deleteEvent(id: string): Promise<void> {
  const client = ensureSupabase()
  const { error } = await client.from('events').delete().eq('id', id)
  if (error) {
    throw new Error(humanizeWriteError(error.message, 'Could not delete event.'))
  }
}

// ---------------------------------------------------------------------------
// Characters
// ---------------------------------------------------------------------------

export async function listCharacters(eventId?: string): Promise<AdminCharacter[]> {
  const client = ensureSupabase()
  let query = client.from('characters').select('*').order('name', { ascending: true })
  if (eventId) query = query.eq('event_id', eventId)
  const { data, error } = await query
  if (error) throw new Error(describeError(error, 'Failed to load characters.'))
  const rows = (data ?? []) as RawCharacterRow[]
  rememberObservedColumns('characters', rows)
  return rows.map((row) => mapCharacter(row))
}

/**
 * Resolve a stable text id for a character. Pattern is `<eventId>-<slug>`
 * which keeps ids unique per event (e.g. `world-war-ii-churchill`).
 */
function resolveCharacterId(input: AdminCharacterInput): string {
  const explicit = nullable(input.id)
  if (explicit) return slugify(explicit) || explicit
  const eventSlug = slugify(clean(input.eventId))
  const charSlug =
    slugify(nullable(input.slug) ?? clean(input.name)) || 'character'
  return eventSlug ? `${eventSlug}-${charSlug}` : charSlug
}

function buildCharacterPayload(
  input: AdminCharacterInput,
): Record<string, unknown> {
  const name = clean(input.name)
  if (!name) throw new Error('Character name is required.')
  const eventId = clean(input.eventId)
  if (!eventId) throw new Error('Pick an event for the character.')
  const payload: Record<string, unknown> = {
    name,
    event_id: eventId,
    slug: nullable(input.slug) ?? slugify(name),
    role: nullable(input.role),
    years: nullable(input.years),
    initials: nullable(input.initials) ?? makeInitials(name),
    description: nullable(input.description),
    tone: nullable(input.tone),
    signature: nullable(input.signature),
    voice_style: nullable(input.voiceStyle),
  }
  for (const key of Object.keys(payload)) {
    if (payload[key] === undefined) delete payload[key]
  }
  return payload
}

export async function createCharacter(
  input: AdminCharacterInput,
): Promise<AdminCharacter> {
  const payload = buildCharacterPayload(input)
  payload.id = resolveCharacterId(input)
  const data = await insertWithRetry<RawCharacterRow>('characters', payload, {
    fallbackId: typeof payload.id === 'string' ? payload.id : undefined,
  })
  return mapCharacter(data)
}

export async function updateCharacter(
  id: string,
  input: AdminCharacterInput,
): Promise<AdminCharacter> {
  const payload = buildCharacterPayload(input)
  delete (payload as Record<string, unknown>).id
  const data = await updateWithRetry<RawCharacterRow>('characters', id, payload)
  return mapCharacter(data)
}

export async function deleteCharacter(id: string): Promise<void> {
  const client = ensureSupabase()
  const { error } = await client.from('characters').delete().eq('id', id)
  if (error) {
    throw new Error(
      humanizeWriteError(error.message, 'Could not delete character.'),
    )
  }
}

// ---------------------------------------------------------------------------
// Source notes
// ---------------------------------------------------------------------------

export async function listSourceNotes(opts?: {
  eventId?: string
  characterId?: string
}): Promise<AdminSourceNote[]> {
  const client = ensureSupabase()
  let query = client
    .from('source_notes')
    .select('*')
    .order('updated_at', { ascending: false })
  if (opts?.eventId) query = query.eq('event_id', opts.eventId)
  if (opts?.characterId) query = query.eq('character_id', opts.characterId)
  const { data, error } = await query
  if (error) {
    throw new Error(describeError(error, 'Failed to load source notes.'))
  }
  const rows = (data ?? []) as RawSourceNoteRow[]
  rememberObservedColumns('source_notes', rows)
  return rows.map((row) => mapSourceNote(row))
}

function buildSourceNotePayload(
  input: AdminSourceNoteInput,
): Record<string, unknown> {
  const content = clean(input.content)
  if (!content) throw new Error('Source note content is required.')
  const eventId = clean(input.eventId)
  if (!eventId) throw new Error('Pick an event for the source note.')
  const payload: Record<string, unknown> = {
    event_id: eventId,
    character_id: nullable(input.characterId ?? null),
    content,
    citation_label: nullable(input.citationLabel),
    citation_url: nullable(input.citationUrl),
    tag: nullable(input.tag),
  }
  for (const key of Object.keys(payload)) {
    if (payload[key] === undefined) delete payload[key]
  }
  return payload
}

/**
 * source_notes.id might be either a uuid with a default (the 0003 migration)
 * or a required text PK in older deployments. We omit id by default so the
 * uuid default fires; the retry helper will inject this fallback only if
 * the database complains that id is not-null.
 */
function buildSourceNoteFallbackId(input: AdminSourceNoteInput): string {
  const event = slugify(clean(input.eventId))
  const character = slugify(clean(input.characterId ?? ''))
  const citation = slugify(clean(input.citationLabel ?? ''))
  const snippet = slugify(clean(input.content).slice(0, 32))
  const parts = [event, character, citation || snippet].filter(
    (part) => part && part.length > 0,
  )
  const random = Math.random().toString(36).slice(2, 8)
  const base = parts.join('-') || 'source-note'
  return `${base}-${random}`.slice(0, 120)
}

export async function createSourceNote(
  input: AdminSourceNoteInput,
): Promise<AdminSourceNote> {
  const payload = buildSourceNotePayload(input)
  const data = await insertWithRetry<RawSourceNoteRow>('source_notes', payload, {
    fallbackId: buildSourceNoteFallbackId(input),
  })
  return mapSourceNote(data)
}

export async function updateSourceNote(
  id: string,
  input: AdminSourceNoteInput,
): Promise<AdminSourceNote> {
  const payload = buildSourceNotePayload(input)
  delete (payload as Record<string, unknown>).id
  const data = await updateWithRetry<RawSourceNoteRow>(
    'source_notes',
    id,
    payload,
  )
  return mapSourceNote(data)
}

export async function deleteSourceNote(id: string): Promise<void> {
  const client = ensureSupabase()
  const { error } = await client.from('source_notes').delete().eq('id', id)
  if (error) {
    throw new Error(
      humanizeWriteError(error.message, 'Could not delete source note.'),
    )
  }
}

// ---------------------------------------------------------------------------
// Profiles + conversations (read-only)
// ---------------------------------------------------------------------------

type RawProfileRow = {
  id: string
  email: string | null
  role: string | null
  created_at: string
}

type RawConversationRow = {
  id: string
  user_id: string | null
  event_id: string | null
  character_id: string | null
  title: string | null
  created_at: string
  updated_at: string
}

export async function listProfiles(limit = 200): Promise<AdminProfile[]> {
  const client = ensureSupabase()
  const { data, error } = await client
    .from('profiles')
    .select('id, email, role, created_at')
    .order('created_at', { ascending: false })
    .limit(limit)
    .returns<RawProfileRow[]>()
  if (error) throw new Error(describeError(error, 'Failed to load profiles.'))
  return (data ?? []).map((row) => ({
    id: row.id,
    email: row.email,
    role: row.role === 'admin' ? 'admin' : 'user',
    createdAt: row.created_at,
  }))
}

export async function listAllConversations(limit = 200): Promise<AdminConversation[]> {
  const client = ensureSupabase()
  const { data, error } = await client
    .from('conversations')
    .select('id, user_id, event_id, character_id, title, created_at, updated_at')
    .order('updated_at', { ascending: false })
    .limit(limit)
    .returns<RawConversationRow[]>()
  if (error) {
    throw new Error(describeError(error, 'Failed to load conversations.'))
  }
  return (data ?? []).map((row) => ({
    id: row.id,
    userId: row.user_id,
    eventId: row.event_id,
    characterId: row.character_id,
    title:
      typeof row.title === 'string' && row.title.trim().length > 0
        ? row.title
        : 'Untitled conversation',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }))
}

export async function deleteAdminConversation(id: string): Promise<void> {
  const client = ensureSupabase()
  const { error } = await client.from('conversations').delete().eq('id', id)
  if (error) {
    throw new Error(
      humanizeWriteError(error.message, 'Could not delete conversation.'),
    )
  }
}

// ---------------------------------------------------------------------------
// Overview counts (cheap, no row scan client-side)
// ---------------------------------------------------------------------------

export type AdminCounts = {
  events: number
  characters: number
  sourceNotes: number
  conversations: number
  profiles: number
  admins: number
}

async function countRows(
  table: string,
  filter?: { column: string; value: string },
): Promise<number> {
  const client = ensureSupabase()
  let query = client.from(table).select('id', { count: 'exact', head: true })
  if (filter) query = query.eq(filter.column, filter.value)
  const { count, error } = await query
  if (error) {
    throw new Error(describeError(error, `Failed to count ${table}.`))
  }
  return count ?? 0
}

export async function fetchAdminCounts(): Promise<AdminCounts> {
  const [events, characters, sourceNotes, conversations, profiles, admins] =
    await Promise.all([
      countRows('events'),
      countRows('characters'),
      countRows('source_notes'),
      countRows('conversations'),
      countRows('profiles'),
      countRows('profiles', { column: 'role', value: 'admin' }),
    ])
  return { events, characters, sourceNotes, conversations, profiles, admins }
}

// ---------------------------------------------------------------------------
// Misc utilities exported for UI validation
// ---------------------------------------------------------------------------

export function isValidUrl(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed) return true
  try {
    const url = new URL(trimmed)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}
