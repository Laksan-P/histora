import { AnimatePresence, motion } from 'framer-motion'
import {
  AlertTriangle,
  ChevronLeft,
  Mic,
  MicOff,
  Pencil,
  ScrollText,
  SendHorizonal,
  ShieldCheck,
  Sparkles,
  Square,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import HistoryPanel from './HistoryPanel'
import MessageBubble from './MessageBubble'
import QuizPanel from './QuizPanel'
import Shimmer from './Shimmer'
import SourceCard from './SourceCard'
import ThemeToggle from './ThemeToggle'
import type { ConversationSummary } from '../lib/conversations'
import {
  describeSpeechError,
  getSpeechRecognitionCtor,
  isSpeechRecognitionSupported,
  type SpeechRecognitionLike,
} from '../lib/speechRecognition'
import type {
  ChatMessage,
  HistoricalCharacter,
  HistoricalEvent,
  QuizQuestion,
  SourceNote,
  TtsVoiceGender,
} from '../lib/types'
import { cn } from '../lib/cn'

type ChatPanelProps = {
  event: HistoricalEvent
  character: HistoricalCharacter
  messages: ChatMessage[]
  sources: SourceNote[]
  quiz: QuizQuestion[]
  quizLoading: boolean
  quizError: string | null
  inputValue: string
  isThinking: boolean
  isSynthesizing: boolean
  playingMessageId: string | null
  /** Voice synthesis / playback failure surfaced after fetch or decode errors. */
  ttsError: string | null
  onDismissTtsError: () => void
  showQuiz: boolean
  conversations: ConversationSummary[]
  conversationsLoading: boolean
  conversationsError: string | null
  activeConversationId: string | null
  deletingConversationId: string | null
  editingMessageId: string | null
  archivedSourceIds: string[]
  ttsVoiceGender: TtsVoiceGender
  onTtsVoiceGenderChange: (gender: TtsVoiceGender) => void
  onInputChange: (value: string) => void
  onSend: () => void
  onPlayVoice: (messageId: string) => void
  onToggleQuiz: () => void
  onRegenerateQuiz: () => void
  onBack: () => void
  onEditMessage: (messageId: string) => void
  onCancelEdit: () => void
  onSelectConversation: (conversationId: string) => void
  onDeleteConversation: (conversationId: string) => void
  onNewChat: () => void
  onToggleArchive: (noteId: string) => void
}

const SUGGESTIONS = [
  'What pressures shaped the key decision here?',
  'Walk me through the timeline.',
  'How is this event remembered today?',
]

/**
 * Cycled phrases for the cinematic "thinking" indicator. Each line implies a
 * step in the source-grounded reasoning so the wait feels intentional rather
 * than empty.
 */
const THINKING_PHRASES = [
  'Consulting the archive…',
  'Reviewing source evidence…',
  'Cross-referencing historical records…',
  'Preparing a grounded response…',
] as const

export default function ChatPanel({
  event,
  character,
  messages,
  sources,
  quiz,
  quizLoading,
  quizError,
  inputValue,
  isThinking,
  isSynthesizing,
  playingMessageId,
  ttsError,
  onDismissTtsError,
  showQuiz,
  conversations,
  conversationsLoading,
  conversationsError,
  activeConversationId,
  deletingConversationId,
  editingMessageId,
  archivedSourceIds,
  ttsVoiceGender,
  onTtsVoiceGenderChange,
  onInputChange,
  onSend,
  onPlayVoice,
  onToggleQuiz,
  onRegenerateQuiz,
  onBack,
  onEditMessage,
  onCancelEdit,
  onSelectConversation,
  onDeleteConversation,
  onNewChat,
  onToggleArchive,
}: ChatPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [isListening, setIsListening] = useState(false)
  const [speechError, setSpeechError] = useState<string | null>(null)
  const [speechSupported] = useState<boolean>(() =>
    isSpeechRecognitionSupported(),
  )
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const speechBaseRef = useRef<string>('')
  const speechFinalRef = useRef<string>('')
  const [thinkingPhraseIndex, setThinkingPhraseIndex] = useState(0)
  const [thinkingSnapshot, setThinkingSnapshot] = useState(isThinking)

  const lastMessageId = messages.at(-1)?.id
  const isFirstScrollRef = useRef(true)

  // React's recommended pattern for "reset derived state when a prop
  // changes" — compare the live prop against a tracked snapshot, and when
  // the prop flips on, restart the cinematic phrase rotation at zero so
  // every fresh request opens with "Consulting the archive…". This keeps us
  // clear of both react-hooks/set-state-in-effect and react-hooks/refs.
  if (thinkingSnapshot !== isThinking) {
    setThinkingSnapshot(isThinking)
    if (isThinking) setThinkingPhraseIndex(0)
  }

  // Rotate the cinematic "thinking" caption every ~2 seconds while the
  // assistant is composing. The setState here lives inside the interval
  // callback (not the effect body), which is the recommended pattern.
  useEffect(() => {
    if (!isThinking) return
    const interval = window.setInterval(() => {
      setThinkingPhraseIndex(
        (current) => (current + 1) % THINKING_PHRASES.length,
      )
    }, 2200)
    return () => window.clearInterval(interval)
  }, [isThinking])

  // Scroll only the chat message container — never the whole page — and wait
  // for layout to settle so newly appended bubbles are fully measured. The
  // first scroll after mount (typical when restoring a conversation or
  // entering chat) is instant so the user lands at the bottom; subsequent
  // appends scroll smoothly.
  useEffect(() => {
    const node = scrollRef.current
    if (!node) return
    const behavior: ScrollBehavior = isFirstScrollRef.current
      ? 'auto'
      : 'smooth'
    const raf = window.requestAnimationFrame(() => {
      node.scrollTo({ top: node.scrollHeight, behavior })
      isFirstScrollRef.current = false
    })
    return () => window.cancelAnimationFrame(raf)
  }, [messages.length, lastMessageId, isThinking, isSynthesizing])

  // Restore / new persisted thread switches → snap to bottom on next layout pass.
  useEffect(() => {
    isFirstScrollRef.current = true
  }, [activeConversationId])

  // Focus the textarea (and place caret at end) whenever the parent puts us
  // into edit mode for a message.
  useEffect(() => {
    if (!editingMessageId) return
    const raf = window.requestAnimationFrame(() => {
      const el = textareaRef.current
      if (!el) return
      el.focus()
      const length = el.value.length
      try {
        el.setSelectionRange(length, length)
      } catch {
        /* setSelectionRange can throw on some types — ignore */
      }
    })
    return () => window.cancelAnimationFrame(raf)
  }, [editingMessageId])

  const lastUserMessageId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i]
      if (message.role === 'user') return message.id
    }
    return null
  }, [messages])

  const archivedSourceIdSet = useMemo(
    () => new Set(archivedSourceIds),
    [archivedSourceIds],
  )
  const archivedSources = useMemo(
    () => sources.filter((note) => archivedSourceIdSet.has(note.id)),
    [sources, archivedSourceIdSet],
  )

  // Drop any stale speech transcript buffers. Called immediately before we
  // send (or just stop) so the recognition `onend` callback — which fires
  // asynchronously after `recognition.stop()` — never reinflates the input
  // with text the user just submitted.
  const clearSpeechBuffers = useCallback(() => {
    speechBaseRef.current = ''
    speechFinalRef.current = ''
  }, [])

  const stopRecognition = useCallback(() => {
    const recognition = recognitionRef.current
    if (recognition) {
      try {
        recognition.stop()
      } catch {
        /* recognition may not be running */
      }
    }
  }, [])

  // Tear down recognition + dismiss the error pill when this panel unmounts.
  useEffect(() => {
    return () => {
      const recognition = recognitionRef.current
      if (recognition) {
        try {
          recognition.abort()
        } catch {
          /* ignore */
        }
        recognitionRef.current = null
      }
    }
  }, [])

  // Auto-dismiss transient speech errors so the form doesn't stay loud.
  useEffect(() => {
    if (!speechError) return
    const timer = window.setTimeout(() => setSpeechError(null), 5000)
    return () => window.clearTimeout(timer)
  }, [speechError])

  const handleToggleMic = useCallback(() => {
    if (isListening) {
      stopRecognition()
      return
    }

    const Ctor = getSpeechRecognitionCtor()
    if (!Ctor) {
      setSpeechError(
        'Voice input is not supported in this browser. Try the latest Chrome or Edge.',
      )
      return
    }

    const recognition = new Ctor()
    recognition.lang =
      typeof navigator !== 'undefined' && navigator.language
        ? navigator.language
        : 'en-US'
    recognition.continuous = true
    recognition.interimResults = true
    recognition.maxAlternatives = 1

    const trimmedInput = inputValue.trim()
    speechBaseRef.current = trimmedInput.length > 0 ? `${trimmedInput} ` : ''
    speechFinalRef.current = ''

    recognition.onstart = () => {
      setSpeechError(null)
      setIsListening(true)
    }
    recognition.onresult = (event) => {
      let interim = ''
      let accumulatedFinal = speechFinalRef.current
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        if (!result) continue
        const transcript = result[0]?.transcript ?? ''
        if (result.isFinal) {
          accumulatedFinal += transcript
        } else {
          interim += transcript
        }
      }
      speechFinalRef.current = accumulatedFinal
      const combined =
        speechBaseRef.current + accumulatedFinal + interim
      onInputChange(combined.replace(/\s+/g, ' ').trimStart())
    }
    recognition.onerror = (event) => {
      const message = describeSpeechError(event.error)
      if (message) setSpeechError(message)
      setIsListening(false)
    }
    recognition.onend = () => {
      setIsListening(false)
      recognitionRef.current = null
      // Trim any trailing interim noise once the engine stops.
      const combined = (
        speechBaseRef.current + speechFinalRef.current
      ).trim()
      if (combined.length > 0) {
        onInputChange(combined)
      }
      // Bring focus back to the textarea so the user can review/edit.
      requestAnimationFrame(() => {
        textareaRef.current?.focus()
      })
    }

    recognitionRef.current = recognition
    try {
      recognition.start()
    } catch (error) {
      console.error('[histora] speech start failed:', error)
      setSpeechError('Voice input could not start. Please try again.')
      setIsListening(false)
      recognitionRef.current = null
    }
  }, [inputValue, isListening, onInputChange, stopRecognition])

  return (
    <section className="relative box-border mx-auto w-full min-w-0 max-w-7xl overflow-x-clip px-4 pb-6 pt-1 sm:px-6 lg:px-8 lg:pb-7 lg:pt-2">
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55 }}
        className="grid w-full min-w-0 max-w-full grid-cols-1 gap-4 box-border lg:grid-cols-[320px_minmax(0,1fr)] lg:items-start lg:gap-6"
      >
        {/* Outer aside owns the sticky shape and clips overflow; the inner
            wrapper below is the only thing that scrolls, with a thin tinted
            scrollbar — so the sidebar never paints the giant default bar. */}
        <aside className="flex w-full min-w-0 max-w-full flex-col gap-4 box-border lg:sticky lg:top-6 lg:z-30 lg:max-h-[calc(100dvh-3rem)] lg:w-auto lg:self-start lg:overflow-hidden">
          <div className="scrollbar-thin flex w-full min-w-0 max-w-full flex-col gap-4 lg:max-h-[calc(100dvh-4rem)] lg:overflow-y-auto lg:overscroll-contain lg:pr-1">
          <div className="glass box-border max-w-full min-w-0 shrink-0 overflow-hidden rounded-3xl px-4 py-5 sm:p-6">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-3">
            <motion.button
              type="button"
              onClick={onBack}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.94 }}
              transition={{ type: 'spring', stiffness: 380, damping: 26 }}
              className="inline-flex items-center gap-2 rounded-full border border-(--border-soft) bg-(--surface-strong) px-3 py-1 text-xs font-medium text-(--text-secondary) transition-colors hover:border-(--accent) hover:text-(--text-primary)"
            >
              <ChevronLeft size={13} />
              Change perspective
            </motion.button>

            <div className="inline-flex shrink-0 items-center gap-2 rounded-full bg-(--accent-soft) px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.32em] text-(--accent)">
              <ShieldCheck size={12} />
              Source-grounded
            </div>
            </div>

            <span className="mt-5 block wrap-break-word font-mono text-[10px] uppercase tracking-[0.32em] text-(--text-muted)">
              {event.period} · {event.location}
            </span>
            <h2 className="font-display mt-1 wrap-break-word text-3xl font-semibold leading-tight text-(--text-primary)">
              {event.title}
            </h2>
            <p className="mt-2 text-sm text-(--text-secondary)">
              {event.tagline}
            </p>

            <div className="mt-6 flex min-w-0 max-w-full items-center gap-3 rounded-2xl border border-(--border-soft) bg-(--surface-strong) p-3 box-border">
              <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-2xl bg-linear-to-br from-(--accent) to-(--accent-strong) font-display text-lg font-bold text-(--background)">
                {character.initials}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-(--text-primary)">
                  {character.name}
                </div>
                <div className="line-clamp-2 wrap-break-word text-[11px] text-(--text-muted)">
                  {character.role}
                </div>
              </div>
            </div>

            <p className="mt-5 text-xs leading-relaxed text-(--text-secondary)">
              Histora responds only from curated source notes. The AI cites its
              archive on every answer — perfect for classroom and demo use.
            </p>

            <motion.button
              type="button"
              onClick={onToggleQuiz}
              whileHover={{ scale: 1.015 }}
              whileTap={{ scale: 0.965 }}
              transition={{ type: 'spring', stiffness: 380, damping: 26 }}
              className={cn(
                'mt-6 box-border flex w-full max-w-full min-w-0 flex-wrap items-center justify-center gap-3 rounded-2xl px-4 py-3 text-center text-sm font-semibold shadow-sm transition-shadow duration-300 sm:justify-between sm:px-5 sm:text-left',
                showQuiz
                  ? 'bg-(--accent-soft) text-(--accent)'
                  : 'bg-(--text-primary) text-(--background) hover:opacity-95 hover:shadow-(--shadow-cinema)',
              )}
            >
              {showQuiz ? 'Hide quiz panel' : 'Generate Quiz'}
              <span
                className={cn(
                  'grid h-7 w-7 place-items-center rounded-full',
                  showQuiz
                    ? 'bg-(--accent)/15 text-(--accent)'
                    : 'bg-(--background)/15 text-(--background)',
                )}
              >
                <Sparkles size={13} />
              </span>
            </motion.button>

            <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-(--border-soft) bg-(--surface-strong) px-3 py-3 text-xs text-(--text-secondary) sm:flex-row sm:items-center sm:justify-between sm:py-2">
              <span className="shrink-0 font-medium text-(--text-primary)">
                Theme
              </span>
              <div className="flex w-full min-w-0 justify-center sm:w-auto sm:justify-end">
                <ThemeToggle className="w-full max-w-[18rem] justify-between sm:w-auto sm:max-w-none sm:justify-start" />
              </div>
            </div>
          </div>

          <HistoryPanel
            conversations={conversations}
            loading={conversationsLoading}
            error={conversationsError}
            activeConversationId={activeConversationId}
            deletingConversationId={deletingConversationId}
            onSelect={onSelectConversation}
            onDelete={onDeleteConversation}
            onNewChat={onNewChat}
          />

          <div className="glass flex min-h-[200px] shrink-0 flex-col gap-4 overflow-hidden rounded-3xl p-4 box-border max-w-full min-w-0 sm:p-6 lg:min-h-[260px]">
            <div className="shrink-0">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <span className="font-mono text-[10px] uppercase tracking-[0.32em] text-(--text-muted)">
                    Source archive
                  </span>
                  <h3 className="font-display text-lg font-semibold text-(--text-primary)">
                    Loaded references
                  </h3>
                </div>
                <span
                  className={cn(
                    'inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.22em]',
                    archivedSources.length > 0
                      ? 'bg-(--accent-soft) text-(--accent)'
                      : 'bg-(--surface-strong) text-(--text-muted)',
                  )}
                >
                  {archivedSources.length}
                </span>
              </div>
            </div>

            <div className="min-h-0 flex-1">
              {archivedSources.length > 0 ? (
                <AnimatePresence initial={false}>
                  <motion.div
                    key="archived-list"
                    layout
                    className="flex flex-col gap-3 pb-1"
                  >
                    {archivedSources.map((note, index) => (
                      <motion.div
                        key={note.id}
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.96 }}
                        transition={{
                          type: 'spring',
                          stiffness: 360,
                          damping: 30,
                        }}
                      >
                        <SourceCard note={note} index={index} compact />
                      </motion.div>
                    ))}
                  </motion.div>
                </AnimatePresence>
              ) : (
                <div className="rounded-2xl border border-dashed border-(--border-soft) bg-(--surface-strong)/60 px-4 py-5 text-center">
                  <p className="text-xs leading-relaxed text-(--text-muted)">
                    Your archive is quiet for now.
                    <br />
                    Tap{' '}
                    <span className="font-semibold text-(--text-primary)">
                      Archive
                    </span>{' '}
                    on any source card below to keep it close while you read.
                  </p>
                </div>
              )}
            </div>
          </div>
          </div>
        </aside>

        <div className="flex min-h-0 w-full min-w-0 max-w-full flex-col gap-4 box-border">
          <div className="glass-strong relative flex min-h-[280px] w-full min-w-0 max-w-full flex-col overflow-hidden rounded-3xl box-border max-h-[min(52rem,calc(100dvh-11rem))] sm:min-h-[320px] lg:h-[clamp(280px,min(52rem,calc(100dvh-10.5rem)),52rem)] lg:max-h-none">
            <header className="flex flex-col gap-3 border-b border-(--border-soft) px-4 py-3 sm:px-6 sm:py-4 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between lg:gap-x-3 lg:gap-y-2">
              <div className="flex min-w-0 w-full items-center gap-3 lg:flex-[1_1_12rem] lg:w-auto">
                <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full bg-linear-to-br from-(--accent) to-(--accent-strong) font-display text-sm font-bold text-(--background)">
                  {character.initials}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-(--text-primary)">
                    {character.name}
                  </div>
                  <div className="truncate text-[11px] text-(--text-muted)">
                    Live perspective · ElevenLabs voice
                  </div>
                </div>
              </div>
              <div className="flex w-full min-w-0 flex-wrap items-center gap-2 lg:w-auto lg:flex-[1_1_auto] lg:flex-nowrap lg:justify-end">
                <div
                  role="radiogroup"
                  aria-label="Narrator voice"
                  className="inline-flex shrink-0 rounded-full border border-(--border-soft) bg-(--surface-strong) p-0.5"
                >
                  <button
                    type="button"
                    role="radio"
                    aria-checked={ttsVoiceGender === 'male'}
                    onClick={() => onTtsVoiceGenderChange('male')}
                    className={cn(
                      'rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] transition sm:px-3 sm:tracking-[0.14em]',
                      ttsVoiceGender === 'male'
                        ? 'bg-(--text-primary) text-(--background)'
                        : 'text-(--text-muted) hover:text-(--text-primary)',
                    )}
                  >
                    Male
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={ttsVoiceGender === 'female'}
                    onClick={() => onTtsVoiceGenderChange('female')}
                    className={cn(
                      'rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] transition sm:px-3 sm:tracking-[0.14em]',
                      ttsVoiceGender === 'female'
                        ? 'bg-(--text-primary) text-(--background)'
                        : 'text-(--text-muted) hover:text-(--text-primary)',
                    )}
                  >
                    Female
                  </button>
                </div>
                <span className="inline-flex min-w-0 max-w-full shrink items-center gap-2 rounded-full border border-(--border-soft) bg-(--surface) px-2 py-1 text-[11px] text-(--text-secondary) sm:px-3">
                  <span className="relative grid h-2 w-2 shrink-0 place-items-center">
                    <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/60" />
                    <span className="relative block h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  </span>
                  <span className="min-w-0 truncate">Source-grounded · Live</span>
                </span>
              </div>
            </header>

            <AnimatePresence>
              {ttsError ? (
                <motion.div
                  key="tts-error"
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                  className="flex flex-wrap items-start gap-2 border-b border-rose-400/25 bg-rose-400/[0.07] px-4 py-2.5 text-[11px] leading-relaxed text-rose-100 sm:px-6"
                  role="alert"
                >
                  <AlertTriangle
                    size={14}
                    className="mt-0.5 shrink-0 text-rose-400"
                    aria-hidden
                  />
                  <p className="min-w-0 flex-1 text-pretty">{ttsError}</p>
                  <button
                    type="button"
                    onClick={onDismissTtsError}
                    className="inline-flex shrink-0 items-center gap-1 rounded-full border border-rose-400/35 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-rose-100 transition hover:bg-rose-400/15"
                  >
                    <X size={11} aria-hidden />
                    Dismiss
                  </button>
                </motion.div>
              ) : null}
            </AnimatePresence>

            <AnimatePresence>
              {playingMessageId || isSynthesizing ? (
                <motion.div
                  key="voice-banner"
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.25, ease: 'easeOut' }}
                  className="flex flex-wrap items-center justify-between gap-3 border-b border-(--border-soft) bg-(--accent-soft)/60 px-4 py-2.5 text-[11px] text-(--text-secondary) sm:px-6"
                  role="status"
                  aria-live="polite"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      aria-hidden
                      className="flex h-5 items-end gap-0.5 leading-none"
                    >
                      {[0, 1, 2, 3, 4].map((bar) => (
                        <span
                          key={bar}
                          className="block w-0.5 origin-bottom rounded-full bg-(--accent)"
                          style={{
                            height: '14px',
                            animation: isSynthesizing
                              ? 'histora-thinking-wave 1.1s ease-in-out infinite'
                              : 'histora-voice-pulse 0.9s ease-in-out infinite',
                            animationDelay: `${bar * 90}ms`,
                          }}
                        />
                      ))}
                    </span>
                    <div className="min-w-0">
                      <div className="font-semibold uppercase tracking-[0.22em] text-(--accent)">
                        {isSynthesizing
                          ? 'Generating voice…'
                          : 'Currently speaking'}
                      </div>
                      <div className="truncate text-[11px] text-(--text-secondary)">
                        as{' '}
                        <span className="font-semibold text-(--text-primary)">
                          {character.name}
                        </span>
                      </div>
                    </div>
                  </div>
                  {playingMessageId && !isSynthesizing ? (
                    <motion.button
                      type="button"
                      onClick={() => onPlayVoice(playingMessageId)}
                      whileHover={{ scale: 1.04 }}
                      whileTap={{ scale: 0.94 }}
                      transition={{ type: 'spring', stiffness: 380, damping: 26 }}
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-(--accent)/50 bg-(--surface) px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-(--accent) transition hover:bg-(--accent) hover:text-(--background)"
                      aria-label="Stop voice playback"
                    >
                      <Square size={10} />
                      Stop
                    </motion.button>
                  ) : null}
                </motion.div>
              ) : null}
            </AnimatePresence>

            <div
              ref={scrollRef}
              className="scroll-fade-mask scrollbar-thin flex-1 min-h-0 space-y-5 overflow-y-auto overscroll-contain px-4 py-6 sm:px-6"
            >
              <AnimatePresence initial={false}>
                {messages.map((message) => {
                  const isBeingEdited =
                    !!editingMessageId && message.id === editingMessageId
                  const canEditThis =
                    message.role === 'user' &&
                    message.id === lastUserMessageId &&
                    !isThinking &&
                    !editingMessageId
                  return (
                    <MessageBubble
                      key={message.id}
                      message={message}
                      characterInitials={character.initials}
                      isPlaying={playingMessageId === message.id}
                      isBeingEdited={isBeingEdited}
                      onPlayVoice={
                        message.role === 'assistant'
                          ? () => onPlayVoice(message.id)
                          : undefined
                      }
                      canEdit={canEditThis}
                      onEdit={
                        canEditThis ? () => onEditMessage(message.id) : undefined
                      }
                    />
                  )
                })}
              </AnimatePresence>

              <AnimatePresence>
                {isThinking ? (
                  <motion.div
                    key="thinking"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="flex items-start gap-3"
                    role="status"
                    aria-live="polite"
                  >
                    <div className="grid h-9 w-9 place-items-center rounded-2xl bg-linear-to-br from-(--accent) to-(--accent-strong) text-xs font-semibold text-(--background)">
                      {character.initials}
                    </div>
                    <div className="glass w-full max-w-full min-w-0 flex-1 rounded-3xl px-5 py-4 sm:max-w-md">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-[10px] uppercase tracking-[0.28em] text-(--text-muted)">
                          {character.name}
                        </div>
                        <span
                          aria-hidden
                          className="flex items-end gap-0.5 leading-none"
                        >
                          {[0, 1, 2, 3, 4].map((bar) => (
                            <span
                              key={bar}
                              className="block w-0.5 origin-bottom rounded-full bg-(--accent) opacity-80"
                              style={{
                                height: '14px',
                                animation:
                                  'histora-thinking-wave 1.1s ease-in-out infinite',
                                animationDelay: `${bar * 110}ms`,
                              }}
                            />
                          ))}
                        </span>
                      </div>
                      <AnimatePresence mode="wait" initial={false}>
                        <motion.p
                          key={thinkingPhraseIndex}
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          transition={{ duration: 0.25, ease: 'easeOut' }}
                          className="mt-2 text-xs italic text-(--text-secondary)"
                        >
                          {THINKING_PHRASES[thinkingPhraseIndex]}
                        </motion.p>
                      </AnimatePresence>
                      <Shimmer className="mt-3" lines={3} width="md" />
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>

              <AnimatePresence>
                {isSynthesizing ? (
                  <motion.div
                    key="synth"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="rounded-2xl border border-(--border-soft) bg-(--surface) px-4 py-3 text-xs text-(--text-secondary)"
                  >
                    <div className="flex items-center gap-2">
                      <Mic size={13} className="text-(--accent)" />
                      <span>Generating voice…</span>
                    </div>
                    <div className="shimmer-bar mt-2 h-1.5 rounded-full" />
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>

            <div className="shrink-0 border-t border-(--border-soft) px-4 py-4 sm:px-6">
              {editingMessageId ? null : (
                <div className="mb-3 flex flex-wrap gap-2">
                  {SUGGESTIONS.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => onInputChange(suggestion)}
                      className="rounded-full border border-(--border-soft) bg-(--surface) px-3 py-1 text-[11px] text-(--text-secondary) transition hover:border-(--accent) hover:text-(--text-primary)"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}

              <AnimatePresence>
                {editingMessageId ? (
                  <motion.div
                    key="editing-indicator"
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.2 }}
                    className="mb-3 flex items-center justify-between gap-3 rounded-2xl border border-(--accent)/40 bg-(--accent-soft) px-3 py-2 text-[11px]"
                    role="status"
                  >
                    <span className="inline-flex items-center gap-2 text-(--accent)">
                      <Pencil size={12} />
                      <span className="font-semibold uppercase tracking-[0.18em]">
                        Editing last message
                      </span>
                    </span>
                    <motion.button
                      type="button"
                      onClick={onCancelEdit}
                      whileHover={{ scale: 1.04 }}
                      whileTap={{ scale: 0.94 }}
                      transition={{ type: 'spring', stiffness: 380, damping: 26 }}
                      className="inline-flex items-center gap-1 rounded-full border border-(--accent)/40 bg-(--background)/30 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-(--accent) transition hover:bg-(--accent) hover:text-(--background)"
                    >
                      <X size={10} />
                      Cancel
                    </motion.button>
                  </motion.div>
                ) : null}
              </AnimatePresence>

              <AnimatePresence>
                {speechError ? (
                  <motion.div
                    key="speech-error"
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.2 }}
                    className="mb-3 inline-flex w-full items-center gap-2 rounded-2xl border border-(--border-soft) bg-(--surface) px-3 py-2 text-[11px] text-(--text-secondary)"
                    role="status"
                  >
                    <MicOff size={12} className="text-rose-400" />
                    <span className="flex-1">{speechError}</span>
                  </motion.div>
                ) : null}
              </AnimatePresence>

              <form
                onSubmit={(formEvent) => {
                  formEvent.preventDefault()
                  clearSpeechBuffers()
                  if (isListening) stopRecognition()
                  onSend()
                }}
                className={cn(
                  'flex min-w-0 w-full flex-wrap items-end gap-2 rounded-3xl border bg-(--surface) p-2.5 transition-colors sm:flex-nowrap',
                  editingMessageId
                    ? 'border-(--accent)/50'
                    : 'border-(--border-soft)',
                )}
              >
                <button
                  type="button"
                  onClick={handleToggleMic}
                  className={cn(
                    'relative grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-(--text-secondary) transition',
                    isListening
                      ? 'bg-rose-500/15 text-rose-500'
                      : speechSupported
                        ? 'hover:bg-(--accent-soft) hover:text-(--accent)'
                        : 'opacity-70 hover:bg-(--surface-strong)',
                  )}
                  aria-label={
                    isListening
                      ? 'Stop listening'
                      : speechSupported
                        ? 'Use microphone'
                        : 'Voice input not supported in this browser'
                  }
                  title={
                    speechSupported
                      ? undefined
                      : 'Voice input not supported in this browser'
                  }
                >
                  {isListening ? (
                    <Square size={15} />
                  ) : speechSupported ? (
                    <Mic size={16} />
                  ) : (
                    <MicOff size={16} />
                  )}
                  {isListening ? (
                    <span
                      aria-hidden
                      className="absolute -inset-1 animate-ping rounded-3xl bg-rose-500/20"
                    />
                  ) : null}
                </button>
                <div className="min-w-0 flex-[1_1_12rem]">
                  <textarea
                    ref={textareaRef}
                    rows={1}
                    value={inputValue}
                    onChange={(eventValue) =>
                      onInputChange(eventValue.target.value)
                    }
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault()
                        clearSpeechBuffers()
                        if (isListening) stopRecognition()
                        onSend()
                      }
                    }}
                    placeholder={
                      editingMessageId
                        ? 'Refine your question, then send to regenerate the answer.'
                        : isListening
                          ? 'Listening… speak naturally, then send when you are ready.'
                          : `Ask ${character.name} about ${event.title}…`
                    }
                    className="max-h-28 min-h-[48px] w-full min-w-0 resize-none rounded-2xl bg-transparent px-3 py-2 text-sm text-(--text-primary) placeholder:text-(--text-muted) focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={!inputValue.trim() || isThinking}
                  className="inline-flex h-11 shrink-0 items-center gap-2 rounded-2xl bg-(--text-primary) px-4 text-sm font-semibold text-(--background) transition hover:opacity-90 disabled:opacity-50 sm:px-5"
                >
                  <SendHorizonal size={14} />
                  {editingMessageId ? 'Update' : 'Send'}
                </button>
              </form>
            </div>
          </div>

          <div className="min-w-0 max-w-full shrink-0">
            <div className="mb-3 flex min-w-0 max-w-full flex-wrap items-end justify-between gap-3 lg:items-center">
              <div>
                <span className="font-mono text-[10px] uppercase tracking-[0.32em] text-(--text-muted)">
                  Step 04
                </span>
                <h3 className="font-display text-2xl text-(--text-primary)">
                  Source evidence
                </h3>
              </div>
              <span className="inline-flex items-center gap-2 rounded-full bg-(--accent-soft) px-3 py-1 text-[11px] font-semibold text-(--accent)">
                <ScrollText size={12} />
                {sources.length} notes
              </span>
            </div>
            {sources.length > 0 ? (
              <div className="source-cards-scroll flex max-w-full gap-4 overflow-x-auto overscroll-x-contain scroll-smooth px-1 pb-6 pt-3 touch-pan-x [-webkit-overflow-scrolling:touch] sm:gap-5 sm:px-2">
                {sources.map((note, index) => (
                  <div
                    key={note.id}
                    className="w-[min(85vw,calc(100vw-2rem))] shrink-0 snap-start sm:w-[340px] sm:min-w-[340px] xl:w-[360px] xl:min-w-[360px]"
                  >
                    <SourceCard
                      note={note}
                      index={index}
                      archived={archivedSourceIdSet.has(note.id)}
                      onArchive={() => onToggleArchive(note.id)}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-3 rounded-3xl border border-dashed border-(--border-soft) bg-(--surface-strong)/60 px-6 py-10 text-center">
                <span className="font-mono text-[10px] uppercase tracking-[0.32em] text-(--accent)">
                  No source evidence yet
                </span>
                <p className="mt-3 text-sm leading-relaxed text-(--text-secondary)">
                  No source evidence has been added for this perspective yet.
                </p>
                <p className="mt-1 text-xs text-(--text-muted)">
                  Once an admin adds notes to{' '}
                  <span className="font-semibold text-(--text-primary)">
                    {event.title}
                  </span>
                  , they'll appear here — citations, links, and all.
                </p>
              </div>
            )}
          </div>

          <AnimatePresence>
            {showQuiz ? (
              <QuizPanel
                key="quiz-panel"
                questions={quiz}
                loading={quizLoading}
                error={quizError}
                eventTitle={event.title}
                characterName={character.name}
                onClose={onToggleQuiz}
                onRegenerate={onRegenerateQuiz}
              />
            ) : null}
          </AnimatePresence>
        </div>
      </motion.div>
    </section>
  )
}
