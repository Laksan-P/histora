export type EventId = string

export type CharacterId = string

/** ElevenLabs TTS preset sent to `/api/tts` as `selectedVoice`. */
export type TtsVoiceGender = 'male' | 'female'

export type ChatRole = 'user' | 'assistant'

export type HistoricalEvent = {
  id: EventId
  slug: string
  title: string
  period: string
  location: string
  tagline: string
  description: string
  accent: string
  hue: string
  motif: string
}

export type HistoricalCharacter = {
  id: CharacterId
  eventId: EventId
  name: string
  role: string
  years: string
  initials: string
  description: string
  tone: string
  signature: string
  /**
   * Optional voice colour from the admin catalog. When set, the chat
   * server uses it to flavour word choice and rhythm in the persona
   * prompt. Mock characters and rows that pre-date the field default to
   * an empty string.
   */
  voiceStyle?: string
}

export type ChatMessage = {
  id: string
  role: ChatRole
  author: string
  content: string
  sources?: string[]
}

export type SourceNote = {
  id: string
  title: string
  detail: string
  citation: string
  tag: string
  /**
   * Optional character scope for notes loaded from Supabase. When null the
   * note belongs to the whole event; when set the note is specific to a
   * single perspective. Mock notes leave this undefined.
   */
  characterId?: string | null
  /**
   * Optional outbound link for the citation. When present, the citation
   * label in `SourceCard` is rendered as a clickable `<a target="_blank">`.
   * Mock notes leave this undefined → the citation renders as static text.
   */
  citationUrl?: string | null
}

export type QuizQuestion = {
  id: string
  prompt: string
  choices: string[]
  answerIndex: number
  rationale: string
}

export const sourceNotes: Record<string, SourceNote[]> = {
  'world-war-ii': [
    {
      id: 'wwii-1',
      title: 'Cabinet War Rooms diaries',
      detail:
        'Daily wartime journals describing strategy meetings between Churchill, military chiefs, and Allied liaisons.',
      citation: 'Imperial War Museum · CAB 65/1',
      tag: 'Primary archive',
    },
    {
      id: 'wwii-2',
      title: 'Atlantic Charter, 1941',
      detail:
        'Joint declaration outlining post-war aims for self-determination, free trade, and disarmament.',
      citation: 'US National Archives · 6878416',
      tag: 'Treaty',
    },
    {
      id: 'wwii-3',
      title: 'Operation Overlord briefings',
      detail:
        'Tactical overviews of the D-Day invasion timeline, including weather windows and beach assignments.',
      citation: 'SHAEF G-3 · June 1944',
      tag: 'Military plan',
    },
  ],
  'sri-lankan-independence': [
    {
      id: 'sl-1',
      title: 'Soulbury Commission report',
      detail:
        'Foundational constitutional reform document establishing the framework for self-government.',
      citation: 'Cmd. 6677, 1945',
      tag: 'Constitutional',
    },
    {
      id: 'sl-2',
      title: 'Independence Day address',
      detail:
        'D. S. Senanayake\u2019s 4 February 1948 speech on unity, governance, and the path ahead.',
      citation: 'Hansard · House of Representatives',
      tag: 'Oratory',
    },
    {
      id: 'sl-3',
      title: 'Agrarian policy briefs',
      detail:
        'Memoranda on irrigation, peasant resettlement, and the Gal Oya scheme that shaped early Ceylon.',
      citation: 'Department of Agriculture · 1947',
      tag: 'Policy',
    },
  ],
  'apollo-11': [
    {
      id: 'apollo-1',
      title: 'Apollo 11 flight plan',
      detail:
        'Minute-by-minute sequence from Saturn V launch through lunar descent, EVA, and Earth return.',
      citation: 'NASA · MSC-00171',
      tag: 'Flight ops',
    },
    {
      id: 'apollo-2',
      title: 'Mission Control transcripts',
      detail:
        'Voice loops between Houston, Columbia, and Eagle, including the 1202 alarm and descent calls.',
      citation: 'NASA · TEC-69 · 20 July',
      tag: 'Transcript',
    },
    {
      id: 'apollo-3',
      title: 'Post-flight crew debrief',
      detail:
        'Armstrong, Aldrin, and Collins reflecting on EVA performance, contingencies, and lessons.',
      citation: 'NASA · MSC-04112',
      tag: 'Debrief',
    },
  ],
}

export const quizzes: Record<string, QuizQuestion[]> = {
  'world-war-ii': [
    {
      id: 'q-wwii-1',
      prompt: 'Which 1941 declaration outlined Allied post-war aims for self-determination?',
      choices: ['Yalta Agreement', 'Atlantic Charter', 'Tehran Conference', 'Casablanca Directive'],
      answerIndex: 1,
      rationale:
        'Churchill and Roosevelt signed the Atlantic Charter in August 1941, setting common goals before the U.S. formally entered the war.',
    },
    {
      id: 'q-wwii-2',
      prompt: 'The D-Day landings in June 1944 were code-named ___.',
      choices: ['Operation Husky', 'Operation Torch', 'Operation Overlord', 'Operation Market Garden'],
      answerIndex: 2,
      rationale: 'Operation Overlord was the Allied invasion of Normandy that opened the Western Front in Europe.',
    },
    {
      id: 'q-wwii-3',
      prompt: 'Which body coordinated Britain\u2019s wartime cabinet decisions under Churchill?',
      choices: ['Privy Council', 'War Cabinet', 'Foreign Office', 'Ministry of Supply'],
      answerIndex: 1,
      rationale: 'Churchill chaired the War Cabinet, a small executive body steering daily wartime strategy.',
    },
  ],
  'sri-lankan-independence': [
    {
      id: 'q-sl-1',
      prompt: 'On which date did Ceylon gain independence from Britain?',
      choices: ['15 August 1947', '4 February 1948', '26 January 1950', '22 May 1972'],
      answerIndex: 1,
      rationale: 'Ceylon became an independent Dominion on 4 February 1948, with D. S. Senanayake as Prime Minister.',
    },
    {
      id: 'q-sl-2',
      prompt: 'Which commission shaped the constitutional path to Ceylon\u2019s independence?',
      choices: ['Donoughmore', 'Soulbury', 'Cripps', 'Simon'],
      answerIndex: 1,
      rationale: 'The Soulbury Commission report of 1945 set the constitutional framework leading to Dominion status.',
    },
    {
      id: 'q-sl-3',
      prompt: 'Which agrarian scheme is closely associated with D. S. Senanayake\u2019s early leadership?',
      choices: ['Mahaweli', 'Gal Oya', 'Walawe', 'Uda Walawe'],
      answerIndex: 1,
      rationale: 'The Gal Oya development scheme reflected Senanayake\u2019s focus on irrigation and rural settlement.',
    },
  ],
  'apollo-11': [
    {
      id: 'q-apollo-1',
      prompt: 'Apollo 11 landed on the lunar surface in which region?',
      choices: ['Oceanus Procellarum', 'Sea of Tranquility', 'Mare Imbrium', 'Taurus-Littrow'],
      answerIndex: 1,
      rationale: 'The Lunar Module Eagle touched down in the Sea of Tranquility on 20 July 1969.',
    },
    {
      id: 'q-apollo-2',
      prompt: 'What alarm interrupted the descent shortly before landing?',
      choices: ['1201 + 1202', '0900 abort', '7-second blackout', 'Master caution only'],
      answerIndex: 0,
      rationale: 'The guidance computer raised 1201 and 1202 program alarms; Mission Control cleared them to continue.',
    },
    {
      id: 'q-apollo-3',
      prompt: 'Who remained in lunar orbit aboard the command module Columbia?',
      choices: ['Buzz Aldrin', 'Michael Collins', 'Jim Lovell', 'Ken Mattingly'],
      answerIndex: 1,
      rationale: 'Michael Collins piloted Columbia while Armstrong and Aldrin descended to the surface.',
    },
  ],
}

export const seedMessages = (
  characterName: string,
  eventTitle: string,
): ChatMessage[] => [
  {
    id: 'seed-1',
    role: 'assistant',
    author: characterName,
    content: `Ask whatever you wish about ${eventTitle}. I will speak from memory, and from what the records still allow.`,
    sources: ['Curated archive briefing'],
  },
]
