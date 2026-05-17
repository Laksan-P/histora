/**
 * /api/tts — ElevenLabs text-to-speech proxy.
 *
 * Hardened for Vercel's Node serverless runtime. The previous version
 * relied solely on `AbortController` against the upstream fetch, but on
 * Vercel some upstream stalls slip past the abort signal entirely, so
 * the function would happily camp the runtime until Vercel itself
 * killed it at the 300s task-timed-out wall.
 *
 * The fix is a defence-in-depth pattern:
 *
 *   1. `raceWithTimeout` wraps BOTH the upstream `fetch` and the
 *      subsequent `response.arrayBuffer()` read. Whichever resolves
 *      first — the underlying promise or our timer-driven rejection —
 *      ends that stage. This guarantees the handler returns within
 *      budget regardless of whether AbortController fires.
 *   2. When the timer wins, we still call `controller.abort()` so the
 *      socket is torn down and undici stops queuing work in the
 *      background. No orphaned promises, no event-loop drag.
 *   3. The incoming `request.signal` (provided by the Vercel Node Web
 *      handler shape) is forwarded onto our controller, so a client
 *      disconnect cancels the upstream request immediately.
 *   4. If the gendered voice fails (timeout or non-2xx) and we have a
 *      different default voice configured, we retry exactly once with
 *      that default — never a loop.
 *
 * Logs are explicit and Vercel-safe — booleans for secrets, status
 * codes for upstream calls, stage names for timeouts.
 */

export const config = {
  // Pin to the Node serverless runtime — fetch / AbortController /
  // setTimeout semantics are tested under Node, and this also makes the
  // runtime explicit so vercel.json's maxDuration applies cleanly.
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
 * Aggressive truncation. Reliability beats long-form fidelity on a
 * serverless platform — anything past this is far more likely to stall
 * the upstream stream than to actually finish synthesizing inside our
 * budget. Hackathon priority: speed + reliability over long playback.
 */
const MAX_CHARS = 800

/** Hard ceilings for each upstream stage. Sum < 30s function maxDuration. */
const FETCH_TIMEOUT_MS = 12_000
const READ_TIMEOUT_MS = 8_000
const ERROR_BODY_READ_TIMEOUT_MS = 2_000

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
    if (fallback) return { voiceId: fallback, resolution: 'female-fallback' }
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

class TimeoutError extends Error {
  readonly stage: string
  constructor(stage: string, ms: number) {
    super(`Timed out at ${stage} after ${ms}ms`)
    this.name = 'TimeoutError'
    this.stage = stage
  }
}

/**
 * Run a promise with a hard wall-clock ceiling. If the timer wins,
 * `onTimeout` fires (used to abort the in-flight controller so the
 * socket is torn down) and the race rejects with a TimeoutError.
 *
 * This is deliberately implemented without relying on AbortController
 * alone — on Vercel some upstream stalls have been observed to ignore
 * the abort signal, so the timer-rejection path is the load-bearing
 * one. Aborting the controller is just a courtesy to free the socket.
 */
function raceWithTimeout<T>(
  task: Promise<T>,
  ms: number,
  stage: string,
  onTimeout?: () => void,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      console.warn(`[api/tts] timeout reached at stage: ${stage} (${ms}ms)`)
      try {
        onTimeout?.()
      } catch {
        /* swallow — abort callbacks must never throw */
      }
      reject(new TimeoutError(stage, ms))
    }, ms)

    task.then(
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

type CallResult =
  | { ok: true; bytes: ArrayBuffer }
  | {
      ok: false
      reason: 'timeout' | 'network' | 'upstream'
      status: number
      body: string
      stage?: string
    }

/**
 * One-shot synthesis attempt against ElevenLabs. Both the fetch and the
 * arrayBuffer read are timer-bounded, and the local controller is
 * forwarded to undici so a timer-trip also tears down the socket.
 */
async function tryTtsForVoice(opts: {
  apiKey: string
  voiceId: string
  text: string
  clientSignal: AbortSignal | null
  attemptLabel: string
}): Promise<CallResult> {
  const { apiKey, voiceId, text, clientSignal, attemptLabel } = opts

  const controller = new AbortController()
  const onClientAbort = () => {
    console.warn('[api/tts] client disconnected — aborting upstream')
    controller.abort()
  }
  if (clientSignal) {
    if (clientSignal.aborted) {
      controller.abort()
    } else {
      clientSignal.addEventListener('abort', onClientAbort, { once: true })
    }
  }

  const stop = () => {
    if (!controller.signal.aborted) controller.abort()
  }

  try {
    console.log(`[api/tts] [${attemptLabel}] entering elevenlabs fetch`)
    let response: Response
    try {
      // Minimal payload — just text + model. ElevenLabs has sane voice
      // defaults, so omitting voice_settings keeps the body small and
      // sidesteps any weird interaction between custom settings and
      // Vercel's connection lifecycle that we've been chasing.
      response = await raceWithTimeout(
        fetch(
          `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`,
          {
            method: 'POST',
            signal: controller.signal,
            headers: {
              'xi-api-key': apiKey,
              'content-type': 'application/json',
              accept: 'audio/mpeg',
            },
            body: JSON.stringify({
              text,
              model_id: DEFAULT_MODEL,
            }),
          },
        ),
        FETCH_TIMEOUT_MS,
        'fetch',
        stop,
      )
    } catch (error) {
      stop()
      if (error instanceof TimeoutError) {
        return {
          ok: false,
          reason: 'timeout',
          status: 504,
          body: '',
          stage: error.stage,
        }
      }
      const message =
        error instanceof Error ? error.message : 'unknown network error'
      console.error(
        `[api/tts] [${attemptLabel}] network error during fetch:`,
        message,
      )
      return { ok: false, reason: 'network', status: 502, body: message }
    }

    console.log(
      `[api/tts] [${attemptLabel}] fetch completed status=${response.status}`,
    )

    if (!response.ok) {
      // Read the failure body once, with its own short ceiling. If
      // even reading the error body stalls, we fall back to an empty
      // string rather than letting the function hang.
      let body = ''
      try {
        body = await raceWithTimeout(
          response.text(),
          ERROR_BODY_READ_TIMEOUT_MS,
          'error-body-read',
          stop,
        )
      } catch (error) {
        if (error instanceof TimeoutError) {
          console.warn(
            `[api/tts] [${attemptLabel}] timed out reading error body`,
          )
        }
        body = ''
      }
      console.error(
        `[api/tts] [${attemptLabel}] elevenlabs ${response.status}:`,
        body.slice(0, 300),
      )
      return {
        ok: false,
        reason: 'upstream',
        status: response.status,
        body: body.slice(0, 500),
      }
    }

    console.log(`[api/tts] [${attemptLabel}] entering arrayBuffer read`)
    let bytes: ArrayBuffer
    try {
      bytes = await raceWithTimeout(
        response.arrayBuffer(),
        READ_TIMEOUT_MS,
        'arrayBuffer',
        stop,
      )
    } catch (error) {
      stop()
      if (error instanceof TimeoutError) {
        return {
          ok: false,
          reason: 'timeout',
          status: 504,
          body: '',
          stage: error.stage,
        }
      }
      const message =
        error instanceof Error ? error.message : 'unknown read error'
      console.error(
        `[api/tts] [${attemptLabel}] error during arrayBuffer:`,
        message,
      )
      return { ok: false, reason: 'network', status: 502, body: message }
    }

    console.log(
      `[api/tts] [${attemptLabel}] arrayBuffer completed bytes=${bytes.byteLength}`,
    )

    return { ok: true, bytes }
  } finally {
    if (clientSignal) {
      clientSignal.removeEventListener('abort', onClientAbort)
    }
  }
}

export default async function handler(request: Request) {
  console.log('[api/tts] request received')

  // Outer try/catch is a final safety net — even if something exotic
  // explodes, the function returns JSON instead of letting Vercel time
  // out at the 300s wall.
  try {
    if (request.method !== 'POST') {
      return jsonError('Method not allowed', 405)
    }

    const apiKey = process.env.ELEVENLABS_API_KEY
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
    const safeText = text.length > MAX_CHARS ? text.slice(0, MAX_CHARS) : text

    console.log('[api/tts] selectedVoice:', selectedVoice ?? 'none')
    console.log('[api/tts] resolution:', resolution)
    console.log('[api/tts] voiceId present:', Boolean(voiceId))
    console.log('[api/tts] textLength:', safeText.length)

    if (!voiceId) {
      const hint =
        selectedVoice === 'female'
          ? 'Female voice uses ELEVENLABS_FEMALE_VOICE_ID, falling back to ELEVENLABS_VOICE_ID — at least one must be set.'
          : selectedVoice === 'male'
            ? 'Male voice uses ELEVENLABS_MALE_VOICE_ID, falling back to ELEVENLABS_VOICE_ID — at least one must be set.'
            : 'Set ELEVENLABS_VOICE_ID (required fallback).'
      return jsonError(`No ElevenLabs voice ID configured. ${hint}`, 500)
    }

    // The incoming Request carries a signal that fires when the client
    // disconnects. We forward this all the way down so a user navigating
    // away or refreshing instantly cancels the upstream call.
    const clientSignal: AbortSignal | null = request.signal ?? null

    const primary = await tryTtsForVoice({
      apiKey,
      voiceId,
      text: safeText,
      clientSignal,
      attemptLabel: resolution,
    })

    if (primary.ok) {
      console.log('[api/tts] returning success')
      return new Response(primary.bytes, {
        status: 200,
        headers: {
          'Content-Type': 'audio/mpeg',
          'Content-Length': String(primary.bytes.byteLength),
          'Cache-Control': 'no-store',
          'X-Histora-TTS-Resolution': resolution,
        },
      })
    }

    // Decide whether a one-shot fallback to the default voice is worth
    // attempting. Only retry when:
    //   - we have a real ELEVENLABS_VOICE_ID configured,
    //   - it's actually different from the voice we just tried, and
    //   - the client is still listening.
    // Authentication / configuration errors (401/403/404) skip the
    // retry — the default voice would just hit the same wall.
    const defaultVoiceId = envVoice('ELEVENLABS_VOICE_ID')
    const clientStillThere = !clientSignal?.aborted
    const isAuthOrConfigError =
      primary.reason === 'upstream' &&
      (primary.status === 401 ||
        primary.status === 403 ||
        primary.status === 404)
    const shouldFallback =
      defaultVoiceId &&
      defaultVoiceId !== voiceId &&
      clientStillThere &&
      !isAuthOrConfigError

    if (shouldFallback) {
      console.warn(
        `[api/tts] primary attempt failed (${primary.reason}${primary.stage ? `:${primary.stage}` : ''} status=${primary.status}) — retrying once with default voice`,
      )
      const fallback = await tryTtsForVoice({
        apiKey,
        voiceId: defaultVoiceId,
        text: safeText,
        clientSignal,
        attemptLabel: `${resolution}->default`,
      })
      if (fallback.ok) {
        console.log('[api/tts] fallback succeeded — returning success')
        return new Response(fallback.bytes, {
          status: 200,
          headers: {
            'Content-Type': 'audio/mpeg',
            'Content-Length': String(fallback.bytes.byteLength),
            'Cache-Control': 'no-store',
            'X-Histora-TTS-Resolution': `${resolution}->default`,
          },
        })
      }
      console.error(
        `[api/tts] fallback also failed (${fallback.reason}${fallback.stage ? `:${fallback.stage}` : ''} status=${fallback.status})`,
      )
      // Surface the worse of the two — fallback's status if it's a real
      // upstream error, otherwise the original failure.
      if (fallback.reason === 'timeout') {
        return jsonError('Voice request timed out', 504)
      }
      return jsonError(
        fallback.body || `ElevenLabs request failed (${fallback.status}).`,
        502,
      )
    }

    if (primary.reason === 'timeout') {
      console.error('[api/tts] returning timeout error')
      return jsonError('Voice request timed out', 504)
    }
    console.error('[api/tts] returning upstream/network error')
    return jsonError(
      primary.body || `ElevenLabs request failed (${primary.status}).`,
      primary.reason === 'upstream' ? 502 : 502,
    )
  } catch (error) {
    console.error(
      '[api/tts] unexpected handler error:',
      error instanceof Error ? error.message : 'unknown',
    )
    return jsonError('Voice service failed unexpectedly.', 500)
  }
}
