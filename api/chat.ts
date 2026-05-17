import OpenAI from 'openai'

type EventInput = {
  title?: string
  period?: string
  location?: string
  description?: string
  tagline?: string
  motif?: string
}

type CharacterInput = {
  name?: string
  role?: string
  years?: string
  tone?: string
  signature?: string
  description?: string
  voiceStyle?: string
}

type SourceInput = {
  title?: string
  detail?: string
  citation?: string
  tag?: string
}

type MessageInput = {
  role: 'user' | 'assistant'
  content: string
}

type ChatBody = {
  event?: EventInput
  character?: CharacterInput
  sources?: SourceInput[]
  messages?: MessageInput[]
}

const MODEL = process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini'

/**
 * Decide which "persona archetype" to nudge the model toward based on the
 * character's role string. Historians/scholars sound neutral and educational;
 * leaders/founders/generals sound reflective and authoritative; everyone
 * else gets a balanced witness tone.
 */
function inferPersonaArchetype(role: string): {
  archetype: string
  voiceGuidance: string
} {
  const r = role.toLowerCase()
  if (
    /historian|scholar|academic|professor|archivist|researcher|curator/.test(r)
  ) {
    return {
      archetype: 'historian',
      voiceGuidance:
        'Speak with the calm, measured cadence of an educator. Be neutral, contextual, and analytic. Frame events with cause and consequence. Quietly correct misconceptions when they appear in the question. Avoid first-person memory; you are commenting on the record, not living inside it.',
    }
  }
  if (
    /president|prime minister|king|queen|emperor|chancellor|leader|founder|statesman|stateswoman|general|commander|admiral|prophet|caliph|pope|monarch/.test(
      r,
    )
  ) {
    return {
      archetype: 'leader',
      voiceGuidance:
        'Speak as someone who carried the weight of the decision. Reflective. Authoritative without bombast. Mention burden, doubt, and trade-offs when they are honest. Use "we" when the action was collective; use "I" when the choice was yours alone.',
    }
  }
  if (
    /witness|survivor|soldier|reporter|journalist|correspondent|civilian|worker|nurse|farmer/.test(
      r,
    )
  ) {
    return {
      archetype: 'witness',
      voiceGuidance:
        'Speak as someone who stood close to the moment. Sensory, grounded, human. Small details matter — weather, sound, the look on a face. Resist sweeping claims about high politics; stay near what you saw and heard.',
    }
  }
  return {
    archetype: 'figure',
    voiceGuidance:
      'Speak as the person on the page — confident in what you knew, candid about what you did not. Specific, reflective, period-appropriate.',
  }
}

function buildSystemPrompt(body: ChatBody): string {
  const event = body.event ?? {}
  const character = body.character ?? {}
  const sources = Array.isArray(body.sources) ? body.sources : []
  const role = character.role ?? 'historical figure'
  const persona = inferPersonaArchetype(role)

  const sourceBlock =
    sources.length > 0
      ? sources
          .map((source, index) => {
            const title = source.title ?? `Source ${index + 1}`
            const detail = source.detail ?? ''
            const citation = source.citation ?? 'archive'
            const tag = source.tag ? ` [${source.tag}]` : ''
            return `${index + 1}. "${title}"${tag} — ${detail} (cited as ${citation})`
          })
          .join('\n')
      : '(No primary sources are attached for this event. Rely on widely-known, textbook-grade historical knowledge of the topic and openly flag uncertainty when a question goes beyond well-documented facts.)'

  const characterLines = [
    `• Role: ${role}`,
    character.years ? `• Era: ${character.years}` : null,
    character.description ? `• Background: ${character.description}` : null,
    character.tone ? `• Tone & demeanor: ${character.tone}` : null,
    character.signature ? `• Signature voice: ${character.signature}` : null,
    character.voiceStyle ? `• Voice style: ${character.voiceStyle}` : null,
  ]
    .filter(Boolean)
    .join('\n')

  const eventLines = [
    `• Title: ${event.title ?? 'a historical event'}`,
    event.period ? `• Period: ${event.period}` : null,
    event.location ? `• Location: ${event.location}` : null,
    event.description ? `• Brief: ${event.description}` : null,
    event.tagline ? `• Tagline: ${event.tagline}` : null,
    event.motif ? `• Touchstones: ${event.motif}` : null,
  ]
    .filter(Boolean)
    .join('\n')

  return `You speak in the first person AS ${character.name ?? 'the historical figure'}.

WHO YOU ARE
${characterLines}

INTERVIEW SUBJECT
${eventLines}

PERSONA ARCHETYPE: ${persona.archetype}
${persona.voiceGuidance}

PRIMARY SOURCES YOU MAY DRAW FROM
${sourceBlock}

RULES (ABSOLUTE)
1. Speak as yourself — first person, direct, natural. NEVER begin a reply with "Speaking as...", "As ${character.name ?? 'this figure'}...", "In my role as...", or any narrator framing. Just answer the way you would in real conversation.
2. Stay in character at all times. NEVER say "as an AI", "as a language model", "I cannot generate", or anything that breaks immersion. You are this person.
3. Match the PERSONA ARCHETYPE voice above. If you are a historian, sound educational and neutral. If you are a leader, sound reflective and authoritative. Witnesses stay near what they saw. Let your character.tone and character.voiceStyle (if provided) flavor word choice and rhythm.
4. Use period-appropriate language. No modern slang, no anachronisms, no internet-era phrasing. Phrasing, references, idioms, and metaphors must fit your era and station.
5. Ground every factual claim in the primary sources above. When the question wanders past the sources, you may rely on widely-known, well-documented historical facts about the event. If you are genuinely uncertain, say — in your own period-appropriate voice — exactly: "I cannot verify that from the available archive." You may briefly explain why before or after that line, but the line itself is your honesty marker.
6. Keep replies conversational — 2 to 4 short paragraphs. Specific. Reflective. Emotionally honest. Show the weight of decisions, the texture of the moment, the human cost.
7. Do NOT list source citations inline; the interface displays them separately.
8. Maintain continuity from earlier turns in this conversation — remember what you have already said and build on it without repeating yourself.

OUTPUT FORMAT
Respond with a single JSON object — and only a JSON object — in this exact shape:
{
  "reply": "your in-character response as plain prose, with paragraphs separated by \\n\\n",
  "sources_used": ["short title of source 1 you drew from", "short title of source 2", ...]
}
"reply" must be the spoken words only. "sources_used" may be an empty array if the question did not lean on a specific source.`
}

function sanitizeMessages(messages: MessageInput[] | undefined): MessageInput[] {
  if (!Array.isArray(messages)) return []
  return messages
    .filter(
      (message): message is MessageInput =>
        Boolean(message) &&
        (message.role === 'user' || message.role === 'assistant') &&
        typeof message.content === 'string' &&
        message.content.trim().length > 0,
    )
    .map((message) => ({
      role: message.role,
      content: message.content.trim(),
    }))
    .slice(-16)
}

async function handler(request: Request) {
  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 })
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return Response.json(
      { error: 'OPENAI_API_KEY is not configured on the server.' },
      { status: 500 },
    )
  }

  let body: ChatBody
  try {
    body = (await request.json()) as ChatBody
  } catch {
    return Response.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  if (!body.event || !body.character) {
    return Response.json(
      { error: 'Missing event or character context.' },
      { status: 400 },
    )
  }

  const history = sanitizeMessages(body.messages)
  if (history.length === 0) {
    return Response.json(
      { error: 'No user messages to respond to.' },
      { status: 400 },
    )
  }

  const systemPrompt = buildSystemPrompt(body)

  try {
    const openai = new OpenAI({ apiKey })
    const completion = await openai.chat.completions.create({
      model: MODEL,
      response_format: { type: 'json_object' },
      temperature: 0.78,
      max_tokens: 700,
      messages: [
        { role: 'system', content: systemPrompt },
        ...history.map((message) => ({
          role: message.role,
          content: message.content,
        })),
      ],
    })

    const raw = completion.choices[0]?.message?.content ?? '{}'
    let parsed: { reply?: unknown; sources_used?: unknown } = {}
    try {
      parsed = JSON.parse(raw) as { reply?: unknown; sources_used?: unknown }
    } catch {
      // Fall back to treating the entire output as the reply
      const trimmed = raw.trim()
      if (trimmed) {
        return Response.json({ message: trimmed, sources: [] })
      }
      return Response.json(
        { error: 'Empty response from OpenAI.' },
        { status: 502 },
      )
    }

    const message =
      typeof parsed.reply === 'string' ? parsed.reply.trim() : ''
    const sources = Array.isArray(parsed.sources_used)
      ? parsed.sources_used
          .filter((value): value is string => typeof value === 'string')
          .map((value) => value.trim())
          .filter((value) => value.length > 0)
          .slice(0, 3)
      : []

    if (!message) {
      return Response.json(
        { error: 'OpenAI returned no usable reply.' },
        { status: 502 },
      )
    }

    return Response.json({ message, sources })
  } catch (error) {
    console.error('[api/chat] OpenAI request failed:', error)
    const detail =
      error instanceof Error ? error.message : 'OpenAI request failed.'
    return Response.json({ error: detail }, { status: 502 })
  }
}

/** Vercel Node functions expect `{ fetch }` for the Web Standards handler shape. */
export default { fetch: handler }
