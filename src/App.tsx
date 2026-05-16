import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  BookOpenText,
  Globe2,
  Loader2,
  MessageSquareQuote,
  Mic2,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import AdminDashboard from './components/admin/AdminDashboard'
import AuroraBackground from './components/AuroraBackground'
import AuthGate from './components/AuthGate'
import CharacterGrid from './components/CharacterGrid'
import ChatPanel from './components/ChatPanel'
import EventGrid from './components/EventGrid'
import Footer from './components/Footer'
import HeroSection from './components/HeroSection'
import OnboardingGuide from './components/OnboardingGuide'
import Marquee from './components/Marquee'
import Navbar, { type NavLandingSection } from './components/Navbar'
import ScrollReveal from './components/ScrollReveal'
import {
  buildChatHistory,
  requestChatCompletion,
  requestQuiz,
  requestSpeech,
} from './lib/api'
import {
  appendMessage,
  createConversation,
  deleteConversation,
  deleteMessagesByIds,
  fetchConversation,
  isHistoryAvailable,
  updateMessage,
} from './lib/conversations'
import { useAuth } from './lib/useAuth'
import { useCharacters } from './lib/useCharacters'
import { useConversations } from './lib/useConversations'
import { useEvents } from './lib/useEvents'
import { useLenis } from './lib/useLenis'
import {
  clearPersistedNavigation,
  readPersistedNavigation,
  writePersistedNavigation,
} from './lib/navigationPersistence'
import { useSourceNotes } from './lib/useSourceNotes'
import {
  seedMessages,
  sourceNotes as mockSourceNotes,
  type CharacterId,
  type ChatMessage,
  type EventId,
  type QuizQuestion,
  type SourceNote,
  type TtsVoiceGender,
} from './lib/types'

type View = 'landing' | 'events' | 'characters' | 'chat' | 'admin'

const VALID_HISTORA_VIEWS = new Set<View>([
  'landing',
  'events',
  'characters',
  'chat',
  'admin',
])

const HOW_IT_WORKS = [
  {
    icon: Globe2,
    title: 'Choose a historical event',
    body: 'Pick a curated era. Each event ships with verified source notes and primary archives ready for inspection.',
  },
  {
    icon: MessageSquareQuote,
    title: 'Select a perspective',
    body: 'Interview the leaders, witnesses, or scholars who lived the moment. Every reply stays inside the archive.',
  },
  {
    icon: Mic2,
    title: 'Ask a question and hear history respond',
    body: 'Type or speak — Histora answers in character, cites its sources, and reads the reply aloud with ElevenLabs voice.',
  },
]

const GROUNDING_PILLARS = [
  {
    icon: BookOpenText,
    label: 'Cited sources',
    body: 'Every answer references the archives, treaties, or transcripts it drew from.',
  },
  {
    icon: ShieldCheck,
    label: 'No hallucinations',
    body: 'The model can only respond from curated notes. If it doesn\u2019t know, it says so.',
  },
  {
    icon: Sparkles,
    label: 'Built for learning',
    body: 'Auto-generated quizzes turn every conversation into a study session.',
  },
]

const viewVariants = {
  initial: { opacity: 0, y: 28, scale: 0.985 },
  enter: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -18, scale: 0.99 },
}

const viewTransition = {
  duration: 0.55,
  ease: [0.22, 0.61, 0.36, 1] as const,
}

const SCROLL_OFFSET = -72
const SCROLL_DURATION = 1.1

const TTS_VOICE_STORAGE_KEY = 'histora.tts.voice'

function readStoredTtsVoice(): TtsVoiceGender {
  if (typeof window === 'undefined') return 'female'
  try {
    return window.localStorage.getItem(TTS_VOICE_STORAGE_KEY) === 'male'
      ? 'male'
      : 'female'
  } catch {
    return 'female'
  }
}

type PendingHistoryLoad = {
  conversationId: string
  characterId: string
  messages: ChatMessage[]
  title: string
}

export default function App() {
  const { state: authState } = useAuth()

  if (authState.status === 'signed-in') {
    return (
      <HistoraApp
        userId={authState.userId}
        userEmail={authState.email}
        isAdmin={authState.profile.role === 'admin'}
      />
    )
  }

  return <AuthGate />
}

type HistoraAppProps = {
  userId: string
  userEmail: string | null
  isAdmin: boolean
}

function HistoraApp({ userId, userEmail, isAdmin }: HistoraAppProps) {
  const { signOut } = useAuth()
  const lenisRef = useLenis()
  const [view, setView] = useState<View>('landing')
  const [selectedEventId, setSelectedEventId] = useState<EventId | null>(null)
  const [selectedCharacterId, setSelectedCharacterId] =
    useState<CharacterId | null>(null)
  const [inputValue, setInputValue] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isThinking, setIsThinking] = useState(false)
  const [isSynthesizing, setIsSynthesizing] = useState(false)
  const [ttsError, setTtsError] = useState<string | null>(null)
  const [playingMessageId, setPlayingMessageId] = useState<string | null>(null)
  const [ttsVoiceGender, setTtsVoiceGender] =
    useState<TtsVoiceGender>(readStoredTtsVoice)
  const ttsVoiceGenderRef = useRef<TtsVoiceGender>(ttsVoiceGender)

  useLayoutEffect(() => {
    ttsVoiceGenderRef.current = ttsVoiceGender
  }, [ttsVoiceGender])
  const [showQuiz, setShowQuiz] = useState(false)
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([])
  const [quizLoading, setQuizLoading] = useState(false)
  const [quizError, setQuizError] = useState<string | null>(null)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [conversationTitle, setConversationTitle] = useState<string | null>(
    null,
  )
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0)
  const [pendingHistoryLoad, setPendingHistoryLoad] =
    useState<PendingHistoryLoad | null>(null)
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
  const [deletingConversationId, setDeletingConversationId] = useState<
    string | null
  >(null)
  const [archivedSourceIds, setArchivedSourceIds] = useState<string[]>([])
  const pendingLandingSection = useRef<NavLandingSection | null>(null)
  /** After first successful hydration from sessionStorage (or “nothing to restore”). */
  const navigationRestoreDoneRef = useRef(false)
  const audioElementRef = useRef<HTMLAudioElement | null>(null)
  const audioUrlRef = useRef<string | null>(null)
  const currentVoiceMessageRef = useRef<string | null>(null)
  const chatAbortRef = useRef<AbortController | null>(null)
  const quizAbortRef = useRef<AbortController | null>(null)
  const ttsAbortRef = useRef<AbortController | null>(null)
  const ttsGenerationRef = useRef(0)

  const {
    events,
    loading: eventsLoading,
    error: eventsError,
    refetch: refetchEvents,
  } = useEvents()
  const {
    characters: eventCharacters,
    loading: charactersLoading,
    error: charactersError,
    refetch: refetchCharacters,
  } = useCharacters(selectedEventId)
  const {
    notes: loadedSourceNotes,
    loading: sourceNotesLoading,
  } = useSourceNotes(selectedEventId)
  const {
    conversations,
    loading: conversationsLoading,
    error: conversationsError,
  } = useConversations({
    userId,
    eventId: selectedEventId,
    characterId: selectedCharacterId,
    refreshKey: historyRefreshKey,
  })

  const selectedEvent = useMemo(
    () => events.find((event) => event.id === selectedEventId) ?? null,
    [events, selectedEventId],
  )
  const selectedCharacter = useMemo(
    () =>
      eventCharacters.find(
        (character) => character.id === selectedCharacterId,
      ) ?? null,
    [eventCharacters, selectedCharacterId],
  )

  // Resolve the source notes shown to the user for the current event +
  // character pair. Priority:
  //   1. Supabase rows for this event (admin-curated).        ← preferred
  //      - Always include rows where character_id is null
  //        (general event notes apply to every perspective).
  //      - Include rows scoped to the selected character.
  //   2. If Supabase returns zero rows AND the slug matches a
  //      curated demo event, fall back to the static mock so the
  //      seeded experience still works without DB seeding.
  //   3. Otherwise leave the list empty (admin will see the
  //      empty-state message in the chat panel).
  const eventSourceNotes = useMemo<SourceNote[]>(() => {
    if (!selectedEvent) return []
    if (sourceNotesLoading) return []

    if (loadedSourceNotes.length > 0) {
      if (!selectedCharacter) return loadedSourceNotes
      return loadedSourceNotes.filter(
        (note) =>
          note.characterId === null ||
          note.characterId === undefined ||
          note.characterId === selectedCharacter.id,
      )
    }

    const fallback = mockSourceNotes[selectedEvent.slug]
    return fallback ?? []
  }, [selectedEvent, selectedCharacter, loadedSourceNotes, sourceNotesLoading])

  const stopCurrentAudio = useCallback(() => {
    const audio = audioElementRef.current
    if (audio) {
      try {
        audio.pause()
        audio.src = ''
      } catch {
        /* ignore */
      }
      audioElementRef.current = null
    }
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current)
      audioUrlRef.current = null
    }
    currentVoiceMessageRef.current = null
  }, [])

  useEffect(() => {
    return () => {
      stopCurrentAudio()
      chatAbortRef.current?.abort()
      quizAbortRef.current?.abort()
      ttsAbortRef.current?.abort()
    }
  }, [stopCurrentAudio])

  const scrollToId = useCallback(
    (id: string) => {
      const element = document.getElementById(id)
      if (!element) return
      const lenis = lenisRef?.current
      if (lenis) {
        lenis.scrollTo(element, {
          offset: SCROLL_OFFSET,
          duration: SCROLL_DURATION,
        })
      } else {
        const top =
          element.getBoundingClientRect().top + window.scrollY + SCROLL_OFFSET
        window.scrollTo({ top, behavior: 'smooth' })
      }
    },
    [lenisRef],
  )

  const snapToTop = useCallback(() => {
    const lenis = lenisRef?.current
    if (lenis) {
      lenis.scrollTo(0, { immediate: true })
    } else {
      window.scrollTo({ top: 0, behavior: 'auto' })
    }
  }, [lenisRef])

  useEffect(() => {
    const target = pendingLandingSection.current
    if (target && view === 'landing') {
      pendingLandingSection.current = null
      snapToTop()
      const frame = window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => scrollToId(target))
      })
      return () => window.cancelAnimationFrame(frame)
    }
    pendingLandingSection.current = null
    snapToTop()
  }, [view, scrollToId, snapToTop])

  // Tracks the {event, character} pair we have already auto-seeded the
  // sidebar archive for. Reset to null inside resetChatState so a fresh
  // chat (new chat / restored conversation / character swap) can seed once
  // notes load. Keeping this scoped per pair avoids re-seeding after the
  // user manually un-archives sources for the same perspective.
  const [archiveSeedKey, setArchiveSeedKey] = useState<string | null>(null)

  const resetChatState = useCallback(() => {
    chatAbortRef.current?.abort()
    chatAbortRef.current = null
    quizAbortRef.current?.abort()
    quizAbortRef.current = null
    ttsAbortRef.current?.abort()
    ttsAbortRef.current = null
    stopCurrentAudio()
    setMessages([])
    setInputValue('')
    setIsThinking(false)
    setIsSynthesizing(false)
    setTtsError(null)
    setPlayingMessageId(null)
    setShowQuiz(false)
    setQuizQuestions([])
    setQuizLoading(false)
    setQuizError(null)
    setConversationId(null)
    setConversationTitle(null)
    setEditingMessageId(null)
    setArchivedSourceIds([])
    setArchiveSeedKey(null)
  }, [stopCurrentAudio])

  /* Persisted navigation restore hydrates route state after events/characters load. */
  /* eslint-disable react-hooks/set-state-in-effect -- intentional one-shot snapshot sync */
  useEffect(() => {
    if (navigationRestoreDoneRef.current) return
    if (eventsLoading) return

    const snap = readPersistedNavigation()
    const finish = () => {
      navigationRestoreDoneRef.current = true
    }

    if (!snap) {
      finish()
      return
    }

    if (!VALID_HISTORA_VIEWS.has(snap.view)) {
      clearPersistedNavigation()
      finish()
      return
    }

    if (snap.view === 'admin') {
      if (isAdmin) setView('admin')
      finish()
      return
    }

    if (snap.view === 'landing') {
      setSelectedEventId(null)
      setSelectedCharacterId(null)
      resetChatState()
      setView('landing')
      finish()
      return
    }

    if (snap.view === 'events') {
      setSelectedEventId(null)
      setSelectedCharacterId(null)
      resetChatState()
      setView('events')
      finish()
      return
    }

    const eventExists =
      typeof snap.eventId === 'string' &&
      events.some((event) => event.id === snap.eventId)

    if (!eventExists) {
      clearPersistedNavigation()
      finish()
      return
    }

    if (selectedEventId !== snap.eventId) {
      setSelectedEventId(snap.eventId)
      return
    }

    if (charactersLoading) return

    if (snap.view === 'characters') {
      setSelectedCharacterId(null)
      resetChatState()
      setView('characters')
      finish()
      return
    }

    const characterExists =
      typeof snap.characterId === 'string' &&
      eventCharacters.some((character) => character.id === snap.characterId)

    if (!characterExists) {
      setSelectedCharacterId(null)
      resetChatState()
      setView('characters')
      finish()
      return
    }

    const character = eventCharacters.find(
      (entry) => entry.id === snap.characterId,
    )
    const event = events.find((entry) => entry.id === snap.eventId)

    if (!character || !event) {
      clearPersistedNavigation()
      finish()
      return
    }

    setSelectedCharacterId(snap.characterId)
    resetChatState()
    setMessages(seedMessages(character.name, event.title))
    setView('chat')
    finish()
  }, [
    charactersLoading,
    eventCharacters,
    events,
    eventsLoading,
    isAdmin,
    resetChatState,
    selectedEventId,
  ])
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!navigationRestoreDoneRef.current) return
    writePersistedNavigation({
      view,
      eventId: selectedEventId,
      characterId: selectedCharacterId,
      conversationId,
    })
  }, [view, selectedEventId, selectedCharacterId, conversationId])

  const goToEvents = () => {
    setView('events')
  }

  const handleLogo = () => {
    setSelectedEventId(null)
    setSelectedCharacterId(null)
    resetChatState()
    setView('landing')
  }

  const handleScrollToLandingSection = (section: NavLandingSection) => {
    if (view === 'landing') {
      scrollToId(section)
      return
    }
    pendingLandingSection.current = section
    setView('landing')
  }

  const handleSelectEvent = (eventId: EventId) => {
    setSelectedEventId(eventId)
    setSelectedCharacterId(null)
    resetChatState()
    setView('characters')
  }

  const handleSelectCharacter = (characterId: CharacterId) => {
    const character = eventCharacters.find((c) => c.id === characterId)
    const event = selectedEvent
    if (!character || !event) return

    setSelectedCharacterId(characterId)
    resetChatState()
    setMessages(seedMessages(character.name, event.title))
    // Archive defaults are seeded by the render-time seeder once
    // useSourceNotes finishes loading rows for this event.
    setView('chat')
  }

  const handleBackToEvents = () => {
    setSelectedEventId(null)
    setSelectedCharacterId(null)
    resetChatState()
    setView('events')
  }

  const handleBackToCharacters = () => {
    setSelectedCharacterId(null)
    resetChatState()
    setView('characters')
  }

  const handleSend = useCallback(async () => {
    if (!inputValue.trim() || !selectedEvent || !selectedCharacter) return
    if (isThinking) return

    const trimmed = inputValue.trim()
    const isEditing = editingMessageId !== null
    let activeConvId = conversationId
    let nextMessages: ChatMessage[]

    if (isEditing) {
      const idx = messages.findIndex(
        (message) => message.id === editingMessageId,
      )
      if (idx === -1) {
        setEditingMessageId(null)
        return
      }
      const target = messages[idx]
      if (target.role !== 'user') {
        setEditingMessageId(null)
        return
      }

      const followingIds = messages
        .slice(idx + 1)
        .map((message) => message.id)
      const updated: ChatMessage = { ...target, content: trimmed }
      nextMessages = [...messages.slice(0, idx), updated]

      setMessages(nextMessages)
      setInputValue('')
      setEditingMessageId(null)
      setIsThinking(true)

      // Stop voice playback because the regenerated response will replace any
      // audio tied to the deleted assistant message.
      stopCurrentAudio()
      setPlayingMessageId(null)
      setIsSynthesizing(false)
      ttsAbortRef.current?.abort()

      if (activeConvId && isHistoryAvailable()) {
        const tasks: Promise<unknown>[] = [
          updateMessage({
            conversationId: activeConvId,
            messageId: target.id,
            content: trimmed,
          }),
        ]
        if (followingIds.length > 0) {
          tasks.push(deleteMessagesByIds(activeConvId, followingIds))
        }
        void Promise.all(tasks)
          .then(() => setHistoryRefreshKey((key) => key + 1))
          .catch((error) =>
            console.error('[histora] could not persist edit:', error),
          )
      }
    } else {
      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        author: 'You',
        content: trimmed,
      }

      nextMessages = [...messages, userMessage]
      setMessages(nextMessages)
      setInputValue('')
      setIsThinking(true)

      // Ensure we have a conversation row before saving messages. If history is
      // not configured we silently skip persistence — chat still works locally.
      if (isHistoryAvailable()) {
        if (!activeConvId) {
          try {
            const newTitle =
              userMessage.content.slice(0, 80) || 'New conversation'
            const created = await createConversation({
              userId,
              eventId: selectedEvent.id,
              characterId: selectedCharacter.id,
              title: newTitle,
            })
            if (created) {
              activeConvId = created
              setConversationId(created)
              setConversationTitle(newTitle)
              setHistoryRefreshKey((key) => key + 1)
            }
          } catch (error) {
            console.error('[histora] could not create conversation:', error)
          }
        }
        if (activeConvId) {
          void appendMessage({
            conversationId: activeConvId,
            messageId: userMessage.id,
            role: 'user',
            content: userMessage.content,
            sourceNotes: [],
          })
            .then(() => setHistoryRefreshKey((key) => key + 1))
            .catch((error) =>
              console.error('[histora] could not save user message:', error),
            )
        }
      }
    }

    chatAbortRef.current?.abort()
    const controller = new AbortController()
    chatAbortRef.current = controller

    try {
      const { message, sources } = await requestChatCompletion({
        event: selectedEvent,
        character: selectedCharacter,
        sources: eventSourceNotes,
        history: buildChatHistory(nextMessages),
        signal: controller.signal,
      })

      if (controller.signal.aborted) return

      const fallbackSources = eventSourceNotes
        .slice(0, 2)
        .map((note) => note.title)

      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        author: selectedCharacter.name,
        content: message,
        sources: sources.length > 0 ? sources : fallbackSources,
      }

      setMessages((prev) => [...prev, assistantMessage])

      if (activeConvId && isHistoryAvailable()) {
        void appendMessage({
          conversationId: activeConvId,
          messageId: assistantMessage.id,
          role: 'assistant',
          content: assistantMessage.content,
          sourceNotes: assistantMessage.sources ?? [],
        })
          .then(() => setHistoryRefreshKey((key) => key + 1))
          .catch((error) =>
            console.error(
              '[histora] could not save assistant message:',
              error,
            ),
          )
      }
    } catch (error) {
      if (controller.signal.aborted) return
      const detail =
        error instanceof Error
          ? error.message
          : 'I could not reach the archive just now.'
      const fallback: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        author: 'Archive',
        content: `The archive is unreachable for a moment. Please try again shortly. (${detail})`,
      }
      setMessages((prev) => [...prev, fallback])
    } finally {
      if (!controller.signal.aborted) {
        setIsThinking(false)
      }
      if (chatAbortRef.current === controller) {
        chatAbortRef.current = null
      }
    }
  }, [
    inputValue,
    isThinking,
    messages,
    selectedCharacter,
    selectedEvent,
    eventSourceNotes,
    conversationId,
    userId,
    editingMessageId,
    stopCurrentAudio,
  ])

  const handleEditMessage = useCallback(
    (messageId: string) => {
      const idx = messages.findIndex((message) => message.id === messageId)
      if (idx === -1) return
      const target = messages[idx]
      if (target.role !== 'user') return
      // Only the latest user message is editable. If a newer one slipped in,
      // ignore the click instead of corrupting history.
      const hasLaterUser = messages
        .slice(idx + 1)
        .some((message) => message.role === 'user')
      if (hasLaterUser) return

      // Enter edit mode without mutating any messages. We only delete/replace
      // when the user actually sends the edited text.
      setEditingMessageId(target.id)
      setInputValue(target.content)
    },
    [messages],
  )

  const handleCancelEdit = useCallback(() => {
    setEditingMessageId(null)
    setInputValue('')
  }, [])

  const handleSelectConversation = useCallback(
    async (targetConversationId: string) => {
      if (!isHistoryAvailable()) return
      if (targetConversationId === conversationId) return
      try {
        // We don't know the character name yet — fall back to a neutral label.
        const detail = await fetchConversation(
          targetConversationId,
          'Perspective',
        )
        if (!detail) {
          console.warn('[histora] conversation not found:', targetConversationId)
          return
        }
        if (!detail.eventId || !detail.characterId) {
          console.warn(
            '[histora] conversation is missing event/character ids:',
            targetConversationId,
          )
          return
        }

        // Tear down anything that's currently in flight.
        chatAbortRef.current?.abort()
        chatAbortRef.current = null
        quizAbortRef.current?.abort()
        quizAbortRef.current = null
        ttsAbortRef.current?.abort()
        ttsAbortRef.current = null
        stopCurrentAudio()
        setIsThinking(false)
        setIsSynthesizing(false)
        setTtsError(null)
        setPlayingMessageId(null)
        setShowQuiz(false)
        setQuizQuestions([])
        setQuizError(null)
        setQuizLoading(false)
        setInputValue('')
        setEditingMessageId(null)

        setPendingHistoryLoad({
          conversationId: detail.id,
          characterId: detail.characterId,
          messages: detail.messages,
          title: detail.title,
        })
        setSelectedEventId(detail.eventId)
        setSelectedCharacterId(null)
        setView('chat')
      } catch (error) {
        console.error('[histora] failed to load conversation:', error)
      }
    },
    [conversationId, stopCurrentAudio],
  )

  const handleNewChat = useCallback(() => {
    resetChatState()
    if (selectedEvent && selectedCharacter) {
      setMessages(seedMessages(selectedCharacter.name, selectedEvent.title))
    }
    // Archive defaults are seeded by the render-time seeder.
  }, [resetChatState, selectedEvent, selectedCharacter])

  const handleToggleArchive = useCallback((noteId: string) => {
    setArchivedSourceIds((prev) =>
      prev.includes(noteId)
        ? prev.filter((id) => id !== noteId)
        : [...prev, noteId],
    )
  }, [])

  const handleDeleteConversation = useCallback(
    async (targetConversationId: string) => {
      if (!isHistoryAvailable()) return
      if (deletingConversationId) return

      const target = conversations.find(
        (entry) => entry.id === targetConversationId,
      )
      const label = target?.title ?? 'this conversation'
      const confirmed =
        typeof window !== 'undefined'
          ? window.confirm(
              `Delete "${label}"?\nThis removes the conversation and all of its messages. This cannot be undone.`,
            )
          : true
      if (!confirmed) return

      setDeletingConversationId(targetConversationId)
      try {
        await deleteConversation(targetConversationId)

        // If the deleted conversation is the one currently open, start a
        // fresh chat for the same event + character so the user lands in a
        // usable state instead of an empty void.
        if (conversationId === targetConversationId) {
          chatAbortRef.current?.abort()
          chatAbortRef.current = null
          quizAbortRef.current?.abort()
          quizAbortRef.current = null
          ttsAbortRef.current?.abort()
          ttsAbortRef.current = null
          stopCurrentAudio()
          setIsThinking(false)
          setIsSynthesizing(false)
          setTtsError(null)
          setPlayingMessageId(null)
          setShowQuiz(false)
          setQuizQuestions([])
          setQuizError(null)
          setQuizLoading(false)
          setInputValue('')
          setEditingMessageId(null)
          setConversationId(null)
          setConversationTitle(null)
          if (selectedEvent && selectedCharacter) {
            setMessages(
              seedMessages(selectedCharacter.name, selectedEvent.title),
            )
          } else {
            setMessages([])
          }
          setArchivedSourceIds([])
          setArchiveSeedKey(null)
        }

        setHistoryRefreshKey((key) => key + 1)
      } catch (error) {
        console.error('[histora] could not delete conversation:', error)
        if (typeof window !== 'undefined') {
          window.alert(
            'Could not delete this conversation. Please try again in a moment.',
          )
        }
      } finally {
        setDeletingConversationId(null)
      }
    },
    [
      conversationId,
      conversations,
      deletingConversationId,
      selectedEvent,
      selectedCharacter,
      stopCurrentAudio,
    ],
  )

  // Once the characters for the target event have loaded, resolve any pending
  // history load. Adjusting state during render is the React-recommended way
  // to react to async data without triggering the set-state-in-effect lint.
  if (
    pendingHistoryLoad &&
    selectedEventId &&
    !charactersLoading &&
    eventCharacters.some(
      (character) => character.id === pendingHistoryLoad.characterId,
    )
  ) {
    const pending = pendingHistoryLoad
    const character = eventCharacters.find(
      (entry) => entry.id === pending.characterId,
    )
    setPendingHistoryLoad(null)
    setSelectedCharacterId(pending.characterId)
    setConversationId(pending.conversationId)
    setConversationTitle(pending.title)
    setMessages(
      pending.messages.map((message) =>
        message.role === 'assistant' && character
          ? { ...message, author: character.name }
          : message,
      ),
    )
    // Archive defaults are seeded once useSourceNotes returns rows for the
    // restored conversation's event.
    setArchivedSourceIds([])
    setArchiveSeedKey(null)
  }

  // Render-time archive seeder. When a fresh chat is opened (resetChatState
  // cleared archiveSeedKey to null) and source notes finish loading for the
  // current event/character pair, populate "Loaded references" with the
  // first two notes. After that, archiveSeedKey pins the pair so manual
  // un-archive actions are not undone.
  const archiveSeedTarget =
    view === 'chat' &&
    selectedEvent &&
    selectedCharacter &&
    !sourceNotesLoading
      ? `${selectedEvent.id}::${selectedCharacter.id}`
      : null
  if (archiveSeedTarget !== null && archiveSeedTarget !== archiveSeedKey) {
    setArchiveSeedKey(archiveSeedTarget)
    if (archivedSourceIds.length === 0 && eventSourceNotes.length > 0) {
      setArchivedSourceIds(
        eventSourceNotes.slice(0, 2).map((note) => note.id),
      )
    }
  }

  const handlePlayVoice = useCallback(
    async (messageId: string) => {
      const target = messages.find((message) => message.id === messageId)
      if (!target || target.role !== 'assistant') return

      // Toggle off the currently playing message
      if (playingMessageId === messageId && audioElementRef.current) {
        ttsAbortRef.current?.abort()
        ttsAbortRef.current = null
        stopCurrentAudio()
        setPlayingMessageId(null)
        setIsSynthesizing(false)
        setTtsError(null)
        return
      }

      ttsAbortRef.current?.abort()
      const controller = new AbortController()
      ttsAbortRef.current = controller
      const generation = ++ttsGenerationRef.current

      stopCurrentAudio()
      setPlayingMessageId(null)
      setIsSynthesizing(true)
      setTtsError(null)
      currentVoiceMessageRef.current = messageId

      try {
        const blob = await requestSpeech(target.content, {
          signal: controller.signal,
          selectedVoice: ttsVoiceGenderRef.current,
        })

        if (controller.signal.aborted) return

        if (currentVoiceMessageRef.current !== messageId) return

        if (blob.size === 0) {
          throw new Error('Voice synthesis returned empty audio.')
        }

        const url = URL.createObjectURL(blob)
        audioUrlRef.current = url
        const audio = new Audio(url)
        audioElementRef.current = audio

        audio.addEventListener('ended', () => {
          if (audioUrlRef.current === url) {
            URL.revokeObjectURL(url)
            audioUrlRef.current = null
          }
          if (audioElementRef.current === audio) {
            audioElementRef.current = null
          }
          if (currentVoiceMessageRef.current === messageId) {
            currentVoiceMessageRef.current = null
          }
          setPlayingMessageId(null)
        })
        audio.addEventListener('error', () => {
          console.error('[histora] audio element playback error')
          stopCurrentAudio()
          setPlayingMessageId(null)
          currentVoiceMessageRef.current = null
          setTtsError('Voice playback failed. Tap Play Voice to try again.')
        })

        setIsSynthesizing(false)
        setPlayingMessageId(messageId)
        await audio.play()
      } catch (error) {
        if (controller.signal.aborted) return

        if (currentVoiceMessageRef.current === messageId) {
          const msg =
            error instanceof Error ? error.message : 'Voice synthesis failed.'
          console.error('[histora] tts failed:', error)
          setTtsError(msg)
          stopCurrentAudio()
          setPlayingMessageId(null)
          currentVoiceMessageRef.current = null
        }
      } finally {
        if (generation === ttsGenerationRef.current) {
          setIsSynthesizing(false)
        }
      }
    },
    [messages, playingMessageId, stopCurrentAudio],
  )

  const handleTtsVoiceGenderChange = useCallback((gender: TtsVoiceGender) => {
    ttsAbortRef.current?.abort()
    setTtsError(null)
    setTtsVoiceGender(gender)
    try {
      window.localStorage.setItem(TTS_VOICE_STORAGE_KEY, gender)
    } catch {
      /* ignore */
    }
  }, [])

  const handleGenerateQuiz = useCallback(async () => {
    if (!selectedEvent || !selectedCharacter) return
    if (quizLoading) return

    quizAbortRef.current?.abort()
    const controller = new AbortController()
    quizAbortRef.current = controller

    setQuizLoading(true)
    setQuizError(null)

    try {
      const questions = await requestQuiz({
        event: selectedEvent,
        character: selectedCharacter,
        sources: eventSourceNotes,
        signal: controller.signal,
      })
      if (controller.signal.aborted) return
      setQuizQuestions(questions)
    } catch (error) {
      if (controller.signal.aborted) return
      setQuizError(
        error instanceof Error
          ? error.message
          : 'Could not generate a quiz right now.',
      )
      setQuizQuestions([])
    } finally {
      if (!controller.signal.aborted) {
        setQuizLoading(false)
      }
      if (quizAbortRef.current === controller) {
        quizAbortRef.current = null
      }
    }
  }, [
    selectedEvent,
    selectedCharacter,
    eventSourceNotes,
    quizLoading,
  ])

  const handleToggleQuiz = useCallback(() => {
    setShowQuiz((prev) => {
      const next = !prev
      if (
        next &&
        quizQuestions.length === 0 &&
        !quizLoading &&
        selectedEvent &&
        selectedCharacter
      ) {
        void handleGenerateQuiz()
      }
      return next
    })
  }, [
    quizQuestions.length,
    quizLoading,
    selectedEvent,
    selectedCharacter,
    handleGenerateQuiz,
  ])

  const marqueeItems = events.flatMap((event) =>
    [event.title, event.period].filter((value): value is string =>
      Boolean(value),
    ),
  )

  const handleOpenAdmin = useCallback(() => {
    if (!isAdmin) return
    resetChatState()
    setSelectedEventId(null)
    setSelectedCharacterId(null)
    setView('admin')
  }, [isAdmin, resetChatState])

  const handleSignOut = useCallback(() => {
    clearPersistedNavigation()
    resetChatState()
    setSelectedEventId(null)
    setSelectedCharacterId(null)
    setView('landing')
    void signOut()
  }, [resetChatState, signOut])

  return (
    <div className="relative box-border min-h-screen w-full max-w-[100vw] min-w-0 overflow-x-clip">
      <AuroraBackground />
      <Navbar
        onLogoClick={handleLogo}
        onGoToEvents={goToEvents}
        onScrollToLandingSection={handleScrollToLandingSection}
        onStart={goToEvents}
        account={{ email: userEmail, isAdmin }}
        onOpenAdmin={isAdmin ? handleOpenAdmin : undefined}
        onSignOut={handleSignOut}
      />

      <AnimatePresence mode="wait" initial={false}>
        {view === 'landing' ? (
          <motion.main
            key="landing"
            variants={viewVariants}
            initial="initial"
            animate="enter"
            exit="exit"
            transition={viewTransition}
            style={{ willChange: 'transform, opacity' }}
          >
            <HeroSection onBegin={goToEvents} />

            {marqueeItems.length > 0 ? (
              <ScrollReveal
                as="section"
                className="relative mx-auto mt-2 w-full max-w-7xl px-5 sm:px-8"
              >
                <div className="glass relative overflow-hidden rounded-3xl px-4 py-3 sm:px-6">
                  <Marquee items={marqueeItems} />
                </div>
              </ScrollReveal>
            ) : null}

            <section
              id="how-it-works"
              className="relative mx-auto mt-20 w-full max-w-7xl scroll-mt-24 px-5 sm:mt-24 sm:px-8"
            >
              <ScrollReveal className="mx-auto max-w-3xl text-center">
                <span className="inline-flex rounded-full border border-(--border-soft) bg-(--surface) px-4 py-1 text-[10px] font-semibold uppercase tracking-[0.32em] text-(--text-muted)">
                  How Histora works
                </span>
                <h2 className="font-display mt-5 text-balance text-4xl font-semibold text-(--text-primary) sm:text-5xl">
                  Three steps to interview the past
                </h2>
                <p className="mt-4 text-pretty text-sm leading-relaxed text-(--text-secondary) sm:text-base">
                  Histora keeps every conversation cinematic, citable, and easy
                  to extend with your own archives.
                </p>
              </ScrollReveal>

              <div className="mt-12 grid gap-5 md:grid-cols-3">
                {HOW_IT_WORKS.map((step, index) => (
                  <motion.article
                    key={step.title}
                    initial={{ opacity: 0, y: 28 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-60px' }}
                    transition={{
                      duration: 0.55,
                      delay: index * 0.08,
                      ease: 'easeOut',
                    }}
                    whileHover={{ y: -6, scale: 1.01 }}
                    className="glass group relative flex flex-col gap-4 overflow-hidden rounded-3xl p-7 transition-shadow duration-500 hover:shadow-(--shadow-cinema)"
                  >
                    <span
                      aria-hidden
                      className="pointer-events-none absolute -top-16 right-0 h-32 w-32 rounded-full bg-(--accent)/15 opacity-0 blur-3xl transition group-hover:opacity-100"
                    />
                    <span className="font-mono text-[10px] uppercase tracking-[0.32em] text-(--text-muted)">
                      Step {String(index + 1).padStart(2, '0')}
                    </span>
                    <span className="grid h-12 w-12 place-items-center rounded-2xl bg-(--accent-soft) text-(--accent) transition group-hover:scale-110">
                      <step.icon size={20} />
                    </span>
                    <h3 className="font-display text-2xl text-(--text-primary)">
                      {step.title}
                    </h3>
                    <p className="text-sm leading-relaxed text-(--text-secondary)">
                      {step.body}
                    </p>
                  </motion.article>
                ))}
              </div>
            </section>

            <section
              id="source-grounded"
              className="relative mx-auto mt-24 w-full max-w-7xl scroll-mt-24 px-5 sm:mt-28 sm:px-8"
            >
              <div className="glass-strong relative grid gap-10 overflow-hidden rounded-4xl px-7 py-12 sm:px-12 lg:grid-cols-[1.05fr_1fr]">
                <div
                  aria-hidden
                  className="pointer-events-none absolute -right-32 -top-32 h-64 w-64 rounded-full bg-(--accent)/25 blur-3xl"
                />
                <div
                  aria-hidden
                  className="pointer-events-none absolute -bottom-32 -left-32 h-64 w-64 rounded-full bg-indigo-400/20 blur-3xl"
                />

                <ScrollReveal className="relative max-w-xl">
                  <span className="inline-flex rounded-full border border-(--border-soft) bg-(--surface) px-4 py-1 text-[10px] font-semibold uppercase tracking-[0.32em] text-(--text-muted)">
                    Why source-grounded AI matters
                  </span>
                  <h2 className="font-display mt-5 text-balance text-4xl font-semibold text-(--text-primary) sm:text-5xl">
                    History deserves citations, not hallucinations.
                  </h2>
                  <p className="mt-5 text-sm leading-relaxed text-(--text-secondary) sm:text-base">
                    Histora is built on a simple promise: the AI can only speak
                    from the archive you trust. Every reply links back to a
                    primary source so learners, teachers, and curious minds can
                    verify, learn, and dig deeper.
                  </p>
                  <div className="mt-7 inline-flex items-center gap-3 rounded-full bg-(--accent-soft) px-4 py-2 text-xs font-medium text-(--accent)">
                    <ShieldCheck size={14} />
                    Citations on every response
                  </div>
                </ScrollReveal>

                <div className="relative grid gap-4">
                  {GROUNDING_PILLARS.map((pillar, index) => (
                    <motion.div
                      key={pillar.label}
                      initial={{ opacity: 0, x: 32 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true, margin: '-60px' }}
                      transition={{
                        duration: 0.55,
                        delay: index * 0.08,
                        ease: 'easeOut',
                      }}
                      whileHover={{ y: -4, scale: 1.01 }}
                      className="group flex items-start gap-4 rounded-2xl border border-(--border-soft) bg-(--surface) p-5 transition-shadow hover:border-(--accent)/60 hover:shadow-(--shadow-cinema)"
                    >
                      <span className="grid h-11 w-11 place-items-center rounded-2xl bg-(--accent-soft) text-(--accent) transition group-hover:scale-110">
                        <pillar.icon size={18} />
                      </span>
                      <div>
                        <div className="text-sm font-semibold text-(--text-primary)">
                          {pillar.label}
                        </div>
                        <p className="mt-1 text-xs leading-relaxed text-(--text-secondary)">
                          {pillar.body}
                        </p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </section>
          </motion.main>
        ) : null}

        {view === 'events' ? (
          <motion.main
            key="events"
            variants={viewVariants}
            initial="initial"
            animate="enter"
            exit="exit"
            transition={viewTransition}
            style={{ willChange: 'transform, opacity' }}
            className="pt-6 sm:pt-10"
          >
            <OnboardingGuide />
            <EventGrid
              events={events}
              selectedEventId={selectedEventId}
              onSelectEvent={handleSelectEvent}
              headingEyebrow="Step 01 · Event selection"
              heading="Where would you like to listen?"
              description="Tap an event to reveal its perspectives, source notes, and quiz. You can return at any time."
              loading={eventsLoading}
              error={eventsError}
              onRetry={refetchEvents}
            />
          </motion.main>
        ) : null}

        {view === 'characters' && selectedEvent ? (
          <motion.main
            key="characters"
            variants={viewVariants}
            initial="initial"
            animate="enter"
            exit="exit"
            transition={viewTransition}
            style={{ willChange: 'transform, opacity' }}
            className="pt-6 sm:pt-10"
          >
            <CharacterGrid
              event={selectedEvent}
              characters={eventCharacters}
              selectedCharacterId={selectedCharacterId}
              onSelectCharacter={handleSelectCharacter}
              onBack={handleBackToEvents}
              loading={charactersLoading}
              error={charactersError}
              onRetry={refetchCharacters}
            />
          </motion.main>
        ) : null}

        {view === 'admin' && isAdmin ? (
          <motion.main
            key="admin"
            variants={viewVariants}
            initial="initial"
            animate="enter"
            exit="exit"
            transition={viewTransition}
            style={{ willChange: 'transform, opacity' }}
            className="pt-2 pb-6 sm:pt-3 sm:pb-7"
          >
            <AdminDashboard onBack={handleLogo} />
          </motion.main>
        ) : null}

        {view === 'chat' && (selectedEvent || pendingHistoryLoad) ? (
          <motion.main
            key="chat"
            variants={viewVariants}
            initial="initial"
            animate="enter"
            exit="exit"
            transition={viewTransition}
            style={{ willChange: 'transform, opacity' }}
            className="pt-2 pb-6 sm:pt-3 sm:pb-7"
          >
            {selectedEvent && selectedCharacter ? (
              <ChatPanel
                event={selectedEvent}
                character={selectedCharacter}
                messages={messages}
                sources={eventSourceNotes}
                quiz={quizQuestions}
                quizLoading={quizLoading}
                quizError={quizError}
                inputValue={inputValue}
                isThinking={isThinking}
                isSynthesizing={isSynthesizing}
                ttsError={ttsError}
                onDismissTtsError={() => setTtsError(null)}
                playingMessageId={playingMessageId}
                showQuiz={showQuiz}
                ttsVoiceGender={ttsVoiceGender}
                onTtsVoiceGenderChange={handleTtsVoiceGenderChange}
                conversations={conversations}
                conversationsLoading={conversationsLoading}
                conversationsError={conversationsError}
                activeConversationId={conversationId}
                deletingConversationId={deletingConversationId}
                editingMessageId={editingMessageId}
                archivedSourceIds={archivedSourceIds}
                onInputChange={setInputValue}
                onSend={() => {
                  void handleSend()
                }}
                onPlayVoice={(id) => {
                  void handlePlayVoice(id)
                }}
                onToggleQuiz={handleToggleQuiz}
                onRegenerateQuiz={() => {
                  void handleGenerateQuiz()
                }}
                onBack={handleBackToCharacters}
                onEditMessage={handleEditMessage}
                onCancelEdit={handleCancelEdit}
                onSelectConversation={(id) => {
                  void handleSelectConversation(id)
                }}
                onDeleteConversation={(id) => {
                  void handleDeleteConversation(id)
                }}
                onNewChat={handleNewChat}
                onToggleArchive={handleToggleArchive}
              />
            ) : (
              <section className="mx-auto w-full max-w-7xl px-4 pb-2 sm:px-6 lg:px-8">
                <div className="grid min-w-0 max-w-full gap-4 lg:grid-cols-[320px_minmax(0,1fr)] lg:items-start lg:gap-6">
                  <aside className="glass hidden h-[clamp(280px,min(52rem,calc(100dvh-10.5rem)),52rem)] min-h-[280px] flex-col gap-3 overflow-hidden rounded-3xl p-6 sm:min-h-[320px] lg:flex">
                    <div className="shimmer-bar h-6 w-32 rounded-full" />
                    <div className="shimmer-bar h-28 w-full rounded-2xl" />
                    <div className="shimmer-bar h-20 w-full rounded-2xl" />
                    <div className="shimmer-bar h-12 w-2/3 rounded-2xl" />
                  </aside>
                  <div className="glass-strong relative flex h-[clamp(280px,min(52rem,calc(100dvh-10.5rem)),52rem)] min-h-[280px] flex-col items-center justify-center gap-3 overflow-hidden rounded-3xl px-6 text-center sm:min-h-[320px]">
                    <span className="grid h-14 w-14 place-items-center rounded-2xl bg-(--accent-soft) text-(--accent)">
                      <Loader2 size={28} className="animate-spin" />
                    </span>
                    <p className="font-display text-lg font-semibold text-(--text-primary)">
                      Restoring conversation…
                    </p>
                    {pendingHistoryLoad?.title || conversationTitle ? (
                      <p className="max-w-sm text-xs leading-relaxed text-(--text-muted)">
                        {pendingHistoryLoad?.title ?? conversationTitle}
                      </p>
                    ) : (
                      <p className="text-xs text-(--text-muted)">
                        Loading messages and sources…
                      </p>
                    )}
                  </div>
                </div>
              </section>
            )}
          </motion.main>
        ) : null}
      </AnimatePresence>

      <Footer variant={view === 'chat' ? 'chat' : 'default'} />
    </div>
  )
}
