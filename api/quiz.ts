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
}

type SourceInput = {
  title?: string
  detail?: string
  citation?: string
  tag?: string
}

type QuizBody = {
  event?: EventInput
  character?: CharacterInput
  sources?: SourceInput[]
  count?: number
}

type RawQuizQuestion = {
  id?: unknown
  prompt?: unknown
  choices?: unknown
  answerIndex?: unknown
  rationale?: unknown
}

const MODEL = process.env.OPENAI_QUIZ_MODEL || 'gpt-4o-mini'

function buildPrompt(body: QuizBody, count: number): string {
  const event = body.event ?? {}
  const character = body.character ?? {}
  const sources = Array.isArray(body.sources) ? body.sources : []

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
      : '(No primary sources attached. Lean on widely-known, textbook-grade facts about the event.)'

  const seed = Math.floor(Math.random() * 1_000_000)

  return `You are the quiz generator for Histora, a cinematic source-grounded history learning product.

Generate ${count} fresh multiple-choice questions about the event below, framed from an interview with ${character.name ?? 'the historical figure'} (${character.role ?? 'historical perspective'}).

EVENT
• Title: ${event.title ?? 'a historical event'}
• Period: ${event.period ?? 'unspecified'}
• Location: ${event.location ?? 'unspecified'}
• Brief: ${event.description ?? '(no description provided)'}${event.motif ? `\n• Touchstones: ${event.motif}` : ''}

PRIMARY SOURCE NOTES
${sourceBlock}

GENERATION RULES
1. Every question MUST have exactly 4 plausible choices, with exactly one correct.
2. Vary the angle across the set: timeline, decisions, key figures, geography, consequences, primary documents, cultural impact.
3. Educational, not trick questions. Concise, clearly worded prompts (one sentence each).
4. Provide a 1–2 sentence rationale that briefly explains why the correct answer is right.
5. Ground facts in the source notes when possible; otherwise use widely-known textbook facts.
6. Make this set feel DISTINCT from previous quizzes the user may have seen — explore different angles.
7. Avoid duplicating the wording of the source notes verbatim.

VARIETY SEED: ${seed} (use this as inspiration to pick a different angle than other quizzes).

OUTPUT FORMAT
Return ONLY a JSON object with this exact shape — no prose, no markdown:
{
  "questions": [
    {
      "id": "q1",
      "prompt": "question text",
      "choices": ["choice A", "choice B", "choice C", "choice D"],
      "answerIndex": 0,
      "rationale": "1-2 sentence explanation"
    }
  ]
}
Use ids "q1", "q2", ... in order. answerIndex is the 0-based index of the correct choice within "choices".`
}

function normalizeQuestion(
  raw: RawQuizQuestion,
  index: number,
): {
  id: string
  prompt: string
  choices: string[]
  answerIndex: number
  rationale: string
} | null {
  const prompt = typeof raw.prompt === 'string' ? raw.prompt.trim() : ''
  const rawChoices = Array.isArray(raw.choices) ? raw.choices : []
  const choices = rawChoices
    .filter((choice): choice is string => typeof choice === 'string')
    .map((choice) => choice.trim())
    .filter((choice) => choice.length > 0)

  const answerIndex =
    typeof raw.answerIndex === 'number' && Number.isInteger(raw.answerIndex)
      ? raw.answerIndex
      : -1

  const rationale =
    typeof raw.rationale === 'string' ? raw.rationale.trim() : ''

  const id =
    typeof raw.id === 'string' && raw.id.trim().length > 0
      ? raw.id.trim()
      : `q${index + 1}`

  if (
    !prompt ||
    choices.length !== 4 ||
    answerIndex < 0 ||
    answerIndex >= choices.length ||
    !rationale
  ) {
    return null
  }

  return { id, prompt, choices, answerIndex, rationale }
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

  let body: QuizBody
  try {
    body = (await request.json()) as QuizBody
  } catch {
    return Response.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  if (!body.event || !body.character) {
    return Response.json(
      { error: 'Missing event or character context.' },
      { status: 400 },
    )
  }

  const count = Math.min(
    Math.max(typeof body.count === 'number' ? Math.floor(body.count) : 5, 3),
    8,
  )

  const prompt = buildPrompt(body, count)

  try {
    const openai = new OpenAI({ apiKey })
    const completion = await openai.chat.completions.create({
      model: MODEL,
      response_format: { type: 'json_object' },
      temperature: 0.9,
      max_tokens: 1400,
      messages: [
        {
          role: 'system',
          content:
            'You generate educational, source-grounded quiz questions and return strict JSON. Never include prose outside JSON.',
        },
        { role: 'user', content: prompt },
      ],
    })

    const raw = completion.choices[0]?.message?.content ?? '{}'
    let parsed: { questions?: unknown } = {}
    try {
      parsed = JSON.parse(raw) as { questions?: unknown }
    } catch {
      return Response.json(
        { error: 'OpenAI returned invalid JSON for the quiz.' },
        { status: 502 },
      )
    }

    const rawQuestions = Array.isArray(parsed.questions)
      ? (parsed.questions as RawQuizQuestion[])
      : []

    const questions = rawQuestions
      .map((question, index) => normalizeQuestion(question, index))
      .filter((q): q is NonNullable<typeof q> => q !== null)

    if (questions.length === 0) {
      return Response.json(
        { error: 'No valid quiz questions were generated.' },
        { status: 502 },
      )
    }

    return Response.json({ questions })
  } catch (error) {
    console.error('[api/quiz] OpenAI request failed:', error)
    const detail =
      error instanceof Error ? error.message : 'OpenAI request failed.'
    return Response.json({ error: detail }, { status: 502 })
  }
}

/** Vercel Node functions expect `{ fetch }` for the Web Standards handler shape. */
export default { fetch: handler }
