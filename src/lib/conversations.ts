import { supabase } from './supabaseClient'
import type { ChatMessage } from './types'

export type ConversationSummary = {
  id: string
  eventId: string | null
  characterId: string | null
  title: string
  updatedAt: string
  createdAt: string
}

export type ConversationDetail = ConversationSummary & {
  messages: ChatMessage[]
}

type ConversationRow = {
  id: string
  user_id: string | null
  event_id: string | null
  character_id: string | null
  title: string | null
  created_at: string
  updated_at: string
}

type MessageRow = {
  id: string
  conversation_id: string
  role: 'user' | 'assistant'
  content: string
  source_notes: unknown
  created_at: string
}

export function isHistoryAvailable(): boolean {
  return supabase !== null
}

function mapSummary(row: ConversationRow): ConversationSummary {
  return {
    id: row.id,
    eventId: row.event_id,
    characterId: row.character_id,
    title: row.title?.trim() || 'Untitled conversation',
    updatedAt: row.updated_at,
    createdAt: row.created_at,
  }
}

function normaliseSourceNotes(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => {
      if (typeof item === 'string') return item.trim()
      if (item && typeof item === 'object' && 'title' in item) {
        const title = (item as { title?: unknown }).title
        return typeof title === 'string' ? title.trim() : ''
      }
      return ''
    })
    .filter((item) => item.length > 0)
}

function mapMessage(row: MessageRow, characterName: string): ChatMessage {
  // Coerce defensively: a row coming back from the database might have any
  // string in `role` (until auth + tighter types land), so we normalise it to
  // the two values the UI knows how to render.
  const role: 'user' | 'assistant' =
    row.role === 'assistant' ? 'assistant' : 'user'
  const content = typeof row.content === 'string' ? row.content : ''
  return {
    id: row.id,
    role,
    author: role === 'user' ? 'You' : characterName,
    content,
    sources: normaliseSourceNotes(row.source_notes),
  }
}

export async function createConversation(opts: {
  userId: string
  eventId: string
  characterId: string
  title: string
}): Promise<string | null> {
  if (!supabase) return null
  const title = opts.title.slice(0, 120) || 'Untitled conversation'
  const { data, error } = await supabase
    .from('conversations')
    .insert({
      user_id: opts.userId,
      event_id: opts.eventId,
      character_id: opts.characterId,
      title,
    })
    .select('id')
    .single<{ id: string }>()
  if (error || !data) {
    throw new Error(error?.message ?? 'Could not create conversation.')
  }
  return data.id
}

export async function appendMessage(opts: {
  conversationId: string
  messageId?: string
  role: 'user' | 'assistant'
  content: string
  sourceNotes?: string[]
}): Promise<void> {
  if (!supabase) return
  const payload: Record<string, unknown> = {
    conversation_id: opts.conversationId,
    role: opts.role,
    content: opts.content,
    source_notes: opts.sourceNotes ?? [],
  }
  if (opts.messageId) payload.id = opts.messageId

  const { error } = await supabase.from('conversation_messages').insert(payload)
  if (error) {
    throw new Error(error.message)
  }

  // Touch the parent conversation so it floats to the top of the history list.
  const { error: touchError } = await supabase
    .from('conversations')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', opts.conversationId)
  if (touchError) {
    console.warn('[histora] could not touch conversation timestamp:', touchError.message)
  }
}

export async function updateConversationTitle(opts: {
  conversationId: string
  title: string
}): Promise<void> {
  if (!supabase) return
  const title = opts.title.slice(0, 120) || 'Untitled conversation'
  const { error } = await supabase
    .from('conversations')
    .update({ title, updated_at: new Date().toISOString() })
    .eq('id', opts.conversationId)
  if (error) {
    throw new Error(error.message)
  }
}

export async function updateMessage(opts: {
  conversationId: string
  messageId: string
  content: string
  sourceNotes?: string[]
}): Promise<void> {
  if (!supabase) return
  const patch: Record<string, unknown> = { content: opts.content }
  if (opts.sourceNotes !== undefined) {
    patch.source_notes = opts.sourceNotes
  }
  const { error } = await supabase
    .from('conversation_messages')
    .update(patch)
    .eq('conversation_id', opts.conversationId)
    .eq('id', opts.messageId)
  if (error) {
    throw new Error(error.message)
  }

  const { error: touchError } = await supabase
    .from('conversations')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', opts.conversationId)
  if (touchError) {
    console.warn(
      '[histora] could not touch conversation timestamp:',
      touchError.message,
    )
  }
}

export async function deleteMessagesByIds(
  conversationId: string,
  messageIds: string[],
): Promise<void> {
  if (!supabase) return
  if (messageIds.length === 0) return
  const { error } = await supabase
    .from('conversation_messages')
    .delete()
    .eq('conversation_id', conversationId)
    .in('id', messageIds)
  if (error) {
    throw new Error(error.message)
  }
}

export async function deleteConversation(
  conversationId: string,
): Promise<void> {
  if (!supabase) return
  // The `conversation_messages.conversation_id` FK has `on delete cascade`,
  // so removing the conversation row also wipes every saved message.
  const { error } = await supabase
    .from('conversations')
    .delete()
    .eq('id', conversationId)
  if (error) {
    throw new Error(error.message)
  }
}

export type FetchRecentConversationsOpts = {
  eventId?: string | null
  characterId?: string | null
  limit?: number
}

export async function fetchRecentConversations(
  userId: string,
  opts: FetchRecentConversationsOpts = {},
): Promise<ConversationSummary[]> {
  if (!supabase) return []
  const { eventId, characterId, limit = 20 } = opts

  let query = supabase
    .from('conversations')
    .select('id, user_id, event_id, character_id, title, created_at, updated_at')
    .eq('user_id', userId)

  // Narrow to the perspective the user is currently inhabiting so the sidebar
  // never mixes Winston Churchill chats with the WWII Historian's, etc.
  // Filters are applied only when provided so non-chat views (which don't
  // have a selection) still receive an empty/general list.
  if (eventId) query = query.eq('event_id', eventId)
  if (characterId) query = query.eq('character_id', characterId)

  const { data, error } = await query
    .order('updated_at', { ascending: false })
    .limit(limit)
    .returns<ConversationRow[]>()
  if (error) {
    throw new Error(error.message)
  }
  return (data ?? []).map(mapSummary)
}

export async function fetchConversation(
  conversationId: string,
  characterName: string,
): Promise<ConversationDetail | null> {
  if (!supabase) return null
  const { data: conv, error: convError } = await supabase
    .from('conversations')
    .select('id, user_id, event_id, character_id, title, created_at, updated_at')
    .eq('id', conversationId)
    .maybeSingle<ConversationRow>()
  if (convError) {
    throw new Error(convError.message)
  }
  if (!conv) return null

  const { data: messageRows, error: messagesError } = await supabase
    .from('conversation_messages')
    .select('id, conversation_id, role, content, source_notes, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .returns<MessageRow[]>()
  if (messagesError) {
    throw new Error(messagesError.message)
  }

  return {
    ...mapSummary(conv),
    messages: (messageRows ?? []).map((row) => mapMessage(row, characterName)),
  }
}
