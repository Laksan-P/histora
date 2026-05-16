type TtsBody = {
  text?: string
  voiceId?: string
  /** Client-selected preset; resolved server-side via env voice IDs. */
  selectedVoice?: unknown
}

const DEFAULT_MODEL = process.env.ELEVENLABS_MODEL_ID || 'eleven_turbo_v2_5'
const MAX_CHARS = 3500

/** Tutorial placeholders — treat as unset so we fall back to ELEVENLABS_VOICE_ID. */
const PLACEHOLDER_VOICE_IDS = new Set(
  [
    'your_female_voice_id',
    'your_male_voice_id',
    'your_voice_id',
    'female_voice_id',
    'male_voice_id',
    'voice_id_here',
  ].map((s) => s.toLowerCase()),
)

function sanitizeVoiceId(raw: string | undefined): string {
  if (typeof raw !== 'string') return ''
  let id = raw.trim().replace(/^\uFEFF/, '')
  // Strip wrapping quotes sometimes pasted into env UIs
  if (
    (id.startsWith('"') && id.endsWith('"')) ||
    (id.startsWith("'") && id.endsWith("'"))
  ) {
    id = id.slice(1, -1).trim()
  }
  if (!id) return ''
  if (PLACEHOLDER_VOICE_IDS.has(id.toLowerCase())) return ''
  return id
}

/** First non-empty sanitized voice ID from env keys (supports alternate namings). */
function envVoice(...keys: string[]): string {
  for (const key of keys) {
    const v = sanitizeVoiceId(process.env[key])
    if (v) return v
  }
  return ''
}

function normalizeSelectedVoice(raw: unknown): 'male' | 'female' | null {
  if (typeof raw === 'string') {
    const v = raw.trim().toLowerCase()
    if (v === 'male' || v === 'female') return v
    return null
  }
  if (Array.isArray(raw) && raw.length > 0) {
    return normalizeSelectedVoice(raw[0])
  }
  return null
}

type TtsVoiceResolution =
  | 'male-env'
  | 'male-fallback'
  | 'female-env'
  | 'female-fallback'
  | 'body-voice'
  | 'default'

/**
 * Female → ELEVENLABS_FEMALE_VOICE_ID (or ELEVENLABS_VOICE_ID_FEMALE),
 * male → ELEVENLABS_MALE_VOICE_ID (or ELEVENLABS_VOICE_ID_MALE),
 * then ELEVENLABS_VOICE_ID / legacy body.voiceId.
 */
function resolveVoiceForTts(body: TtsBody): {
  voiceId: string
  resolution: TtsVoiceResolution
} {
  const fallback =
    envVoice('ELEVENLABS_VOICE_ID') ||
    sanitizeVoiceId(typeof body.voiceId === 'string' ? body.voiceId : undefined)

  const gender = normalizeSelectedVoice(body.selectedVoice)

  if (gender === 'male') {
    const id = envVoice('ELEVENLABS_MALE_VOICE_ID', 'ELEVENLABS_VOICE_ID_MALE')
    if (id) return { voiceId: id, resolution: 'male-env' }
    if (fallback) return { voiceId: fallback, resolution: 'male-fallback' }
    return { voiceId: '', resolution: 'male-fallback' }
  }

  if (gender === 'female') {
    const id = envVoice(
      'ELEVENLABS_FEMALE_VOICE_ID',
      'ELEVENLABS_VOICE_ID_FEMALE',
    )
    if (id) return { voiceId: id, resolution: 'female-env' }
    if (fallback) {
      console.warn(
        '[api/tts] Female narrator selected but ELEVENLABS_FEMALE_VOICE_ID is missing or invalid — using ELEVENLABS_VOICE_ID fallback (often the same as the male voice). Set ELEVENLABS_FEMALE_VOICE_ID in the server environment.',
      )
      return { voiceId: fallback, resolution: 'female-fallback' }
    }
    return { voiceId: '', resolution: 'female-fallback' }
  }

  const bodyVoice = sanitizeVoiceId(
    typeof body.voiceId === 'string' ? body.voiceId : undefined,
  )
  if (bodyVoice.length > 0) {
    return { voiceId: bodyVoice, resolution: 'body-voice' }
  }

  if (fallback) return { voiceId: fallback, resolution: 'default' }

  return { voiceId: '', resolution: 'default' }
}

export default async function handler(request: Request) {
  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 })
  }

  const apiKey = process.env.ELEVENLABS_API_KEY
  if (!apiKey) {
    return Response.json(
      { error: 'ELEVENLABS_API_KEY is not configured on the server.' },
      { status: 500 },
    )
  }

  let body: TtsBody
  try {
    body = (await request.json()) as TtsBody
  } catch {
    return Response.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const text = typeof body.text === 'string' ? body.text.trim() : ''
  if (!text) {
    return Response.json(
      { error: 'Missing text to synthesize.' },
      { status: 400 },
    )
  }

  const { voiceId, resolution } = resolveVoiceForTts(body)

  if (!voiceId) {
    const gender = normalizeSelectedVoice(body.selectedVoice)
    const hint =
      gender === 'female'
        ? 'Female voice uses ELEVENLABS_FEMALE_VOICE_ID (or ELEVENLABS_VOICE_ID_FEMALE), falling back to ELEVENLABS_VOICE_ID — at least one must be set.'
        : gender === 'male'
          ? 'Male voice uses ELEVENLABS_MALE_VOICE_ID (or ELEVENLABS_VOICE_ID_MALE), falling back to ELEVENLABS_VOICE_ID — at least one must be set.'
          : 'Set ELEVENLABS_VOICE_ID (required fallback), optionally with ELEVENLABS_MALE_VOICE_ID and ELEVENLABS_FEMALE_VOICE_ID.'

    return Response.json(
      {
        error: `No ElevenLabs voice ID configured. ${hint}`,
      },
      { status: 500 },
    )
  }

  const safeText = text.length > MAX_CHARS ? text.slice(0, MAX_CHARS) : text

  try {
    const upstream = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'content-type': 'application/json',
          accept: 'audio/mpeg',
        },
        body: JSON.stringify({
          text: safeText,
          model_id: DEFAULT_MODEL,
          voice_settings: {
            stability: 0.45,
            similarity_boost: 0.85,
            style: 0.25,
            use_speaker_boost: true,
          },
        }),
      },
    )

    if (!upstream.ok) {
      const detail = await upstream.text().catch(() => '')
      console.error(
        `[api/tts] ElevenLabs ${upstream.status} (${resolution}):`,
        detail.slice(0, 500),
      )
      return Response.json(
        {
          error:
            detail.trim().slice(0, 500) ||
            `ElevenLabs request failed (${upstream.status}).`,
        },
        { status: 502 },
      )
    }

    const audioBuffer = await upstream.arrayBuffer()
    return new Response(audioBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': String(audioBuffer.byteLength),
        'Cache-Control': 'no-store',
        // Lets you verify in DevTools → Network → /api/tts which branch ran.
        'X-Histora-TTS-Resolution': resolution,
      },
    })
  } catch (error) {
    console.error('[api/tts] request failed:', error)
    const detail =
      error instanceof Error ? error.message : 'ElevenLabs request failed.'
    return Response.json({ error: detail }, { status: 502 })
  }
}
