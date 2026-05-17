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
 * synthesize cleanly. Tuned down for production stability — the
 * remaining audio is still ~30s of speech, plenty for a single reply.
 */
const MAX_CHARS = 700
/** Hard ceiling for the ElevenLabs HTTP fetch (request + headers). */
const FETCH_TIMEOUT_MS = 12_000
/** Hard ceiling for reading the audio body off the response stream. */
const READ_TIMEOUT_MS = 8_000

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

/**
 * Run a promise with a hard wall-clock ceiling. If the timer fires
 * first the race rejects with `Error(message)` so the caller can
 * distinguish a timeout from a real upstream failure.
 *
 * The timer is always cleared in the .then / .catch handlers so we
 * never leak a setTimeout handle, and the rejection happens in the
 * JavaScript runtime itself — no dependency on AbortController firing
 * (which we've seen Vercel + undici occasionally ignore on stalled
 * upstream streams).
 */
function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  message: string,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(message))
    }, ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        clearTimeout(timer)
        reject(error)
      },
    )
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

    // AbortController is forwarded to undici as a courtesy — but the
    // load-bearing safeguard is the `withTimeout` wrapper around BOTH
    // stages below, which guarantees the handler returns within budget
    // even if the abort signal is ignored on a stalled stream (the
    // exact failure mode we hit on Vercel production).
    const upstreamController = new AbortController()

    let upstream: Response
    try {
      console.log('[api/tts] entering elevenlabs fetch')
      upstream = await withTimeout(
        fetch(
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
        ),
        FETCH_TIMEOUT_MS,
        'Voice request timed out',
      )
      console.log('[api/tts] fetch completed status=', upstream.status)
    } catch (error) {
      // Tear down the upstream socket so undici stops queuing work
      // after we've decided to give up on this request.
      upstreamController.abort()
      const message =
        error instanceof Error ? error.message : 'unknown network error'
      const isTimeout = message === 'Voice request timed out'
      console.error(
        `[api/tts] upstream ${isTimeout ? 'timeout' : 'network error'}:`,
        message,
      )
      return jsonError(
        isTimeout ? 'Voice request timed out' : 'Voice service is unreachable right now.',
        isTimeout ? 504 : 502,
      )
    }

    console.log('[api/tts] elevenlabs status:', upstream.status)

    if (!upstream.ok) {
      // Read the failure body once, defensively. If reading fails we
      // still return a structured error rather than leaking a hang.
      let detail = ''
      try {
        detail = await withTimeout(
          upstream.text(),
          2_000,
          'error body read timed out',
        )
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

    // Read the audio body — this is the second hang point on Vercel.
    // Wrap it in withTimeout so a stalled response stream cannot keep
    // the function alive past our budget. On timeout, abort the
    // upstream controller so the socket is released..
    console.log('[api/tts] reading audio buffer')
    let audioBuffer: ArrayBuffer
    try {
      audioBuffer = await withTimeout(
        upstream.arrayBuffer(),
        READ_TIMEOUT_MS,
        'Voice audio stream timed out',
      )
    } catch (error) {
      upstreamController.abort()
      const message =
        error instanceof Error ? error.message : 'unknown read error'
      if (message === 'Voice audio stream timed out') {
        console.error('[api/tts] audio buffer timeout')
        return jsonError('Voice audio stream timed out', 504)
      }
      console.error('[api/tts] audio buffer read failed:', message)
      return jsonError(
        'Voice service stream failed while reading audio.',
        502,
      )
    }
    console.log(
      '[api/tts] audio buffer read complete bytes=',
      audioBuffer.byteLength,
    )

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
