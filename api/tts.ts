/**
 * /api/tts — ElevenLabs text-to-speech proxy.
 *
 * The handler is hardened for the Vercel serverless runtime:
 *   - 15s hard timeout against ElevenLabs via AbortController, so the
 *     function never hits Vercel's 300s task-timed-out wall.
 *   - text length capped before the upstream call so we don't ship huge
 *     bodies that just stall the upstream connection.
 *   - try/catch wraps everything so we always return a JSON response
 *     (or the audio bytes) — the function can never hang open.
 *   - logs are Vercel-safe: API key existence is logged as a boolean,
 *     never the value, plus the resolved voice id presence, status code,
 *     and error category (timeout / network / invalid response).
 */

export const config = {
  // Pin to the Node serverless runtime so we get reliable timeouts and
  // Buffer/streaming semantics. Edge would also work but the upstream
  // ElevenLabs SDK behaviour and our error logs are tested under Node.
  runtime: 'nodejs',
}

type TtsBody = {
  text?: string
  voiceId?: string
  /** Client-selected preset; resolved server-side via env voice IDs. */
  selectedVoice?: unknown
}

const DEFAULT_MODEL = process.env.ELEVENLABS_MODEL_ID || 'eleven_turbo_v2_5'
/**
 * Cap the text we send to ElevenLabs. Hackathon priority: reliability
 * over perfect long-form speech. Anything longer than this is much more
 * likely to time out in a serverless cold-start than to actually
 * synthesize cleanly.
 */
const MAX_CHARS = 1400
/** Hard ceiling for the upstream ElevenLabs request. */
const UPSTREAM_TIMEOUT_MS = 15_000

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

function jsonError(error: string, status: number): Response {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}

export default async function handler(request: Request) {
  // Wrap the entire handler so any thrown/unexpected error still returns
  // JSON. The function must never hang and never bubble an uncaught
  // exception up to Vercel's runtime.
  try {
    if (request.method !== 'POST') {
      return jsonError('Method not allowed', 405)
    }

    const apiKey = process.env.ELEVENLABS_API_KEY
    // Vercel-safe diagnostic: presence only, never the value.
    console.log('[api/tts] apiKey present:', Boolean(apiKey))
    if (!apiKey) {
      return jsonError(
        'ELEVENLABS_API_KEY is not configured on the server.',
        500,
      )
    }

    let body: TtsBody
    try {
      body = (await request.json()) as TtsBody
    } catch {
      return jsonError('Invalid JSON body.', 400)
    }

    const text = typeof body.text === 'string' ? body.text.trim() : ''
    if (!text) {
      return jsonError('Missing text to synthesize.', 400)
    }

    const { voiceId, resolution } = resolveVoiceForTts(body)
    const selectedVoice = normalizeSelectedVoice(body.selectedVoice)
    console.log('[api/tts] selectedVoice:', selectedVoice ?? 'none')
    console.log('[api/tts] resolution:', resolution)
    console.log('[api/tts] voiceId present:', Boolean(voiceId))
    console.log('[api/tts] textLength:', text.length)

    if (!voiceId) {
      const hint =
        selectedVoice === 'female'
          ? 'Female voice uses ELEVENLABS_FEMALE_VOICE_ID (or ELEVENLABS_VOICE_ID_FEMALE), falling back to ELEVENLABS_VOICE_ID — at least one must be set.'
          : selectedVoice === 'male'
            ? 'Male voice uses ELEVENLABS_MALE_VOICE_ID (or ELEVENLABS_VOICE_ID_MALE), falling back to ELEVENLABS_VOICE_ID — at least one must be set.'
            : 'Set ELEVENLABS_VOICE_ID (required fallback), optionally with ELEVENLABS_MALE_VOICE_ID and ELEVENLABS_FEMALE_VOICE_ID.'

      return jsonError(`No ElevenLabs voice ID configured. ${hint}`, 500)
    }

    // Cap before sending. Reliability beats long-form fidelity in a
    // serverless context — long passages tend to either stall the
    // upstream stream or push us past the function timeout.
    const safeText = text.length > MAX_CHARS ? text.slice(0, MAX_CHARS) : text

    // 15s hard ceiling on the ElevenLabs round-trip. AbortController +
    // setTimeout is the canonical Vercel-friendly pattern; the timer is
    // cleared in `finally` so we don't leak handles.
    const upstreamController = new AbortController()
    const timeoutId = setTimeout(
      () => upstreamController.abort(),
      UPSTREAM_TIMEOUT_MS,
    )

    let upstream: Response
    try {
      upstream = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`,
        {
          method: 'POST',
          signal: upstreamController.signal,
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
    } catch (error) {
      // AbortError fires when our 15s timer trips. Anything else is a
      // network-level failure (DNS, TLS, refused connection, etc.). Log
      // the category but not the full error chain.
      const isAbort =
        error instanceof Error &&
        (error.name === 'AbortError' || /aborted/i.test(error.message))
      console.error(
        `[api/tts] upstream ${isAbort ? 'timeout' : 'network error'}:`,
        error instanceof Error ? error.message : 'unknown',
      )
      return jsonError(
        isAbort
          ? 'Voice request timed out'
          : 'Voice service is unreachable right now.',
        isAbort ? 504 : 502,
      )
    } finally {
      clearTimeout(timeoutId)
    }

    console.log('[api/tts] elevenlabs status:', upstream.status)

    if (!upstream.ok) {
      // Read the failure body once, defensively. If reading fails we
      // still return a structured error rather than leaking a hang.
      let detail = ''
      try {
        detail = await upstream.text()
      } catch {
        detail = ''
      }
      console.error(
        `[api/tts] ElevenLabs ${upstream.status} (${resolution}):`,
        detail.slice(0, 300),
      )
      return jsonError(
        detail.trim().slice(0, 500) ||
          `ElevenLabs request failed (${upstream.status}).`,
        502,
      )
    }

    // Read the body once as ArrayBuffer and immediately return — no
    // intermediate copies, no stream that could be left open.
    const audioBuffer = await upstream.arrayBuffer()
    return new Response(audioBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': String(audioBuffer.byteLength),
        'Cache-Control': 'no-store',
        'X-Histora-TTS-Resolution': resolution,
      },
    })
  } catch (error) {
    // Final safety net — even if something exotic explodes (e.g. JSON
    // serialization, a sync throw inside fetch options), the function
    // resolves with JSON instead of letting Vercel time out at 300s.
    console.error(
      '[api/tts] unexpected handler error:',
      error instanceof Error ? error.message : 'unknown',
    )
    return jsonError('Voice service failed unexpectedly.', 500)
  }
}
