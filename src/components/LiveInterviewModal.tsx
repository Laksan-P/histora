import { AnimatePresence, motion } from 'framer-motion'
import {
  AudioWaveform,
  Loader2,
  MicOff,
  Pause,
  Play,
  Square,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { requestSpeech } from '../lib/api'
import { cn } from '../lib/cn'
import {
  describeSpeechError,
  getSpeechRecognitionCtor,
  isSpeechRecognitionSupported,
  type SpeechRecognitionLike,
} from '../lib/speechRecognition'
import type {
  HistoricalCharacter,
  HistoricalEvent,
  TtsVoiceGender,
} from '../lib/types'

export type LiveInterviewState =
  | 'idle'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'paused'

export type LiveInterviewSendResult = {
  assistantText: string
}

export type LiveInterviewSendFn = (
  question: string,
  options?: { source: 'live' },
) => Promise<LiveInterviewSendResult | null>

type LiveInterviewModalProps = {
  isOpen: boolean
  onClose: () => void
  event: HistoricalEvent
  character: HistoricalCharacter
  voiceGender: TtsVoiceGender
  conversationId: string | null
  onSendLiveMessage: LiveInterviewSendFn
}

const STATE_LABEL: Record<LiveInterviewState, string> = {
  idle: 'Ready',
  listening: 'Listening…',
  thinking: 'Thinking…',
  speaking: 'Speaking…',
  paused: 'Paused',
}

const STATE_DETAIL: Record<LiveInterviewState, string> = {
  idle: 'Tap Start to begin the interview.',
  listening: 'Speak naturally — pause when you finish a thought.',
  thinking: 'Consulting the source archive…',
  speaking: 'Listen to the response unfold.',
  paused: 'Interview paused — tap Start to resume listening.',
}

/**
 * Polished live voice conversation overlay. Reuses the project's existing
 * Web Speech API helpers and `/api/tts` endpoint so the chat history,
 * source-grounding and ElevenLabs voice continue to flow through their
 * canonical paths. The modal owns its own audio playback so it never
 * collides with the sidebar voice player driven by ChatPanel.
 */
export default function LiveInterviewModal({
  isOpen,
  onClose,
  event,
  character,
  voiceGender,
  onSendLiveMessage,
}: LiveInterviewModalProps) {
  const [state, setState] = useState<LiveInterviewState>('idle')
  const [liveTranscript, setLiveTranscript] = useState('')
  const [interimTranscript, setInterimTranscript] = useState('')
  const [assistantText, setAssistantText] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [voiceFallback, setVoiceFallback] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [speechSupported] = useState<boolean>(() =>
    isSpeechRecognitionSupported(),
  )

  // Latest-value refs so async handlers (recognition/audio events) can read
  // current state without stale closures.
  const stateRef = useRef<LiveInterviewState>(state)
  const isOpenRef = useRef<boolean>(isOpen)
  const isMutedRef = useRef<boolean>(isMuted)
  const voiceGenderRef = useRef<TtsVoiceGender>(voiceGender)
  const onSendLiveMessageRef = useRef<LiveInterviewSendFn>(onSendLiveMessage)

  useEffect(() => {
    stateRef.current = state
  }, [state])
  useEffect(() => {
    isOpenRef.current = isOpen
  }, [isOpen])
  useEffect(() => {
    isMutedRef.current = isMuted
  }, [isMuted])
  useEffect(() => {
    voiceGenderRef.current = voiceGender
  }, [voiceGender])
  useEffect(() => {
    onSendLiveMessageRef.current = onSendLiveMessage
  }, [onSendLiveMessage])

  // Resource refs.
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const audioUrlRef = useRef<string | null>(null)
  const finalTranscriptRef = useRef<string>('')
  const isProcessingRef = useRef<boolean>(false)
  const ttsAbortRef = useRef<AbortController | null>(null)
  // Mutually-recursive helper bag: startListening triggers processTranscript
  // on `onend`, and processTranscript restarts listening once audio finishes.
  // Wrapping in a ref means each call always finds the latest implementation
  // and we sidestep useCallback dependency cycles.
  const fnsRef = useRef<{
    startListening: () => void
    processTranscript: (text: string) => Promise<void>
  }>({
    startListening: () => {},
    processTranscript: async () => {},
  })

  const stopRecognition = useCallback(() => {
    const recognition = recognitionRef.current
    if (recognition) {
      try {
        recognition.abort()
      } catch {
        /* recognition may already be stopped */
      }
      recognitionRef.current = null
    }
  }, [])

  const stopAudio = useCallback(() => {
    const audio = audioRef.current
    if (audio) {
      try {
        audio.pause()
        audio.src = ''
      } catch {
        /* ignore */
      }
      audioRef.current = null
    }
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current)
      audioUrlRef.current = null
    }
  }, [])

  // Wire the implementation once. fnsRef.current holds stable closures that
  // always read the latest state through *Ref refs above.
  useEffect(() => {
    fnsRef.current.startListening = () => {
      if (!isOpenRef.current) return
      const Ctor = getSpeechRecognitionCtor()
      if (!Ctor) {
        setErrorMessage(
          'Voice input is not supported in this browser. Try the latest Chrome or Edge.',
        )
        setState('paused')
        return
      }

      // Tear down any previous recognition before starting a fresh session.
      stopRecognition()

      const recognition = new Ctor()
      recognition.lang = 'en-US'
      recognition.continuous = false
      recognition.interimResults = true
      recognition.maxAlternatives = 1

      finalTranscriptRef.current = ''
      setLiveTranscript('')
      setInterimTranscript('')
      setErrorMessage(null)

      recognition.onstart = () => {
        setState('listening')
      }

      recognition.onresult = (e) => {
        let interim = ''
        let final = finalTranscriptRef.current
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const result = e.results[i]
          if (!result) continue
          const transcript = result[0]?.transcript ?? ''
          if (result.isFinal) {
            final += transcript
          } else {
            interim += transcript
          }
        }
        finalTranscriptRef.current = final
        setLiveTranscript(final.trim())
        setInterimTranscript(interim.trim())
      }

      recognition.onerror = (e) => {
        const message = describeSpeechError(e.error)
        if (message) setErrorMessage(message)
        if (recognitionRef.current === recognition) {
          recognitionRef.current = null
        }
        if (stateRef.current === 'listening') {
          setState('paused')
        }
      }

      recognition.onend = () => {
        if (recognitionRef.current === recognition) {
          recognitionRef.current = null
        }
        // If we already moved past listening (manual pause / modal closed)
        // ignore the trailing onend so we don't reinflate the flow.
        if (stateRef.current !== 'listening') return

        const transcript = finalTranscriptRef.current.trim()
        setInterimTranscript('')
        if (!transcript) {
          // No speech captured — quietly retry so the user can keep talking.
          if (isOpenRef.current && stateRef.current === 'listening') {
            window.setTimeout(() => {
              if (isOpenRef.current && stateRef.current === 'listening') {
                fnsRef.current.startListening()
              }
            }, 250)
          }
          return
        }
        void fnsRef.current.processTranscript(transcript)
      }

      recognitionRef.current = recognition
      try {
        recognition.start()
      } catch (err) {
        console.error('[live-interview] start failed:', err)
        setErrorMessage('Voice input could not start. Please try again.')
        if (recognitionRef.current === recognition) {
          recognitionRef.current = null
        }
        setState('paused')
      }
    }

    fnsRef.current.processTranscript = async (text: string) => {
      // Hard guard against duplicate sends — even if the engine fires twice.
      if (isProcessingRef.current) return
      if (!isOpenRef.current) return
      const trimmed = text.trim()
      if (!trimmed) return

      isProcessingRef.current = true
      try {
        setState('thinking')
        setAssistantText('')
        setVoiceFallback(false)

        const result = await onSendLiveMessageRef.current(trimmed, {
          source: 'live',
        })
        if (!isOpenRef.current) return

        if (!result) {
          setErrorMessage(
            'The archive could not be reached. Tap Start to try again.',
          )
          setState('paused')
          return
        }

        setAssistantText(result.assistantText)
        finalTranscriptRef.current = ''

        // Mute path: skip TTS entirely and resume listening.
        if (isMutedRef.current) {
          if (isOpenRef.current && stateRef.current !== 'paused') {
            window.setTimeout(() => {
              if (
                isOpenRef.current &&
                stateRef.current !== 'paused' &&
                !isProcessingRef.current
              ) {
                setLiveTranscript('')
                setInterimTranscript('')
                fnsRef.current.startListening()
              }
            }, 350)
          }
          return
        }

        setState('speaking')

        ttsAbortRef.current?.abort()
        const ttsController = new AbortController()
        ttsAbortRef.current = ttsController

        let blob: Blob | null = null
        try {
          blob = await requestSpeech(result.assistantText, {
            selectedVoice: voiceGenderRef.current,
            signal: ttsController.signal,
          })
        } catch (err) {
          if (!ttsController.signal.aborted) {
            console.error('[live-interview] tts failed:', err)
            setVoiceFallback(true)
          }
        } finally {
          if (ttsAbortRef.current === ttsController) {
            ttsAbortRef.current = null
          }
        }

        if (!isOpenRef.current) return
        if (ttsController.signal.aborted) return

        if (!blob || blob.size === 0) {
          setVoiceFallback(true)
          window.setTimeout(() => {
            if (isOpenRef.current && stateRef.current === 'speaking') {
              setLiveTranscript('')
              setInterimTranscript('')
              fnsRef.current.startListening()
            }
          }, 1500)
          return
        }

        const url = URL.createObjectURL(blob)
        audioUrlRef.current = url
        const audio = new Audio(url)
        audioRef.current = audio

        await new Promise<void>((resolve) => {
          let resolved = false
          const finish = (failed: boolean) => {
            if (resolved) return
            resolved = true
            if (audioUrlRef.current === url) {
              URL.revokeObjectURL(url)
              audioUrlRef.current = null
            }
            if (audioRef.current === audio) {
              audioRef.current = null
            }
            if (failed) setVoiceFallback(true)
            resolve()
          }
          audio.addEventListener('ended', () => finish(false))
          audio.addEventListener('error', () => {
            console.error('[live-interview] audio element error')
            finish(true)
          })
          audio.play().catch((err) => {
            console.error('[live-interview] audio play failed:', err)
            finish(true)
          })
        })

        if (!isOpenRef.current) return

        if (stateRef.current === 'speaking') {
          setLiveTranscript('')
          setInterimTranscript('')
          fnsRef.current.startListening()
        }
      } finally {
        isProcessingRef.current = false
      }
    }
  }, [stopRecognition])

  // Side-effect cleanup whenever the modal toggles closed: tear down the
  // recognition + audio handles and abort any in-flight TTS request so the
  // user never hears a delayed reply once they've ended the interview.
  useEffect(() => {
    if (isOpen) return
    stopRecognition()
    stopAudio()
    ttsAbortRef.current?.abort()
    ttsAbortRef.current = null
    isProcessingRef.current = false
    finalTranscriptRef.current = ''
  }, [isOpen, stopAudio, stopRecognition])

  // Render-time reconciliation: when the modal flips from open → closed
  // we wipe every transcript / state pill so the next open is a clean
  // slate. This is the React-recommended replacement for setState-in-effect.
  const [openSnapshot, setOpenSnapshot] = useState(isOpen)
  if (openSnapshot !== isOpen) {
    setOpenSnapshot(isOpen)
    if (!isOpen) {
      setState('idle')
      setLiveTranscript('')
      setInterimTranscript('')
      setAssistantText('')
      setErrorMessage(null)
      setVoiceFallback(false)
      setIsMuted(false)
    }
  }

  // Final cleanup on unmount.
  useEffect(() => {
    return () => {
      stopRecognition()
      stopAudio()
      ttsAbortRef.current?.abort()
      ttsAbortRef.current = null
    }
  }, [stopAudio, stopRecognition])

  // Lock body scroll while the overlay is open so the page underneath stays
  // put on mobile.
  useEffect(() => {
    if (!isOpen || typeof document === 'undefined') return
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = original
    }
  }, [isOpen])

  // Auto-clear the "voice unavailable" pill after a few seconds so it stops
  // hanging around once the user has read it.
  useEffect(() => {
    if (!voiceFallback) return
    const timer = window.setTimeout(() => setVoiceFallback(false), 4500)
    return () => window.clearTimeout(timer)
  }, [voiceFallback])

  // Listen for Escape to end the interview.
  useEffect(() => {
    if (!isOpen) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  const handleStart = useCallback(() => {
    setErrorMessage(null)
    setVoiceFallback(false)
    fnsRef.current.startListening()
  }, [])

  const handlePause = useCallback(() => {
    stopRecognition()
    stopAudio()
    ttsAbortRef.current?.abort()
    ttsAbortRef.current = null
    setInterimTranscript('')
    setState('paused')
  }, [stopAudio, stopRecognition])

  const handleEnd = useCallback(() => {
    stopRecognition()
    stopAudio()
    ttsAbortRef.current?.abort()
    ttsAbortRef.current = null
    isProcessingRef.current = false
    setState('idle')
    onClose()
  }, [onClose, stopAudio, stopRecognition])

  const handleToggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev
      if (next) {
        // Cut current playback the moment we mute so the user isn't talked over.
        stopAudio()
        ttsAbortRef.current?.abort()
        ttsAbortRef.current = null
      }
      return next
    })
  }, [stopAudio])

  const showStartButton = state === 'idle' || state === 'paused'
  const startLabel = state === 'paused' ? 'Resume' : 'Start'

  return (
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          key="live-interview-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="fixed inset-0 z-60 flex items-center justify-center px-3 py-6 sm:px-6"
          role="dialog"
          aria-modal="true"
          aria-label={`Live Interview with ${character.name}`}
        >
          <div
            aria-hidden
            className="absolute inset-0 bg-black/70 backdrop-blur-md"
          />

          <motion.div
            key="live-interview-card"
            initial={{ y: 32, opacity: 0, scale: 0.96 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 16, opacity: 0, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 280, damping: 30 }}
            className="glass-strong scrollbar-thin relative z-10 flex w-full max-w-2xl flex-col overflow-hidden overflow-y-auto rounded-3xl px-5 py-6 sm:px-8 sm:py-8 max-h-[calc(100dvh-3rem)]"
          >
            <span
              aria-hidden
              className="pointer-events-none absolute -top-24 -right-12 h-56 w-56 rounded-full bg-(--accent)/30 blur-3xl"
            />
            <span
              aria-hidden
              className="pointer-events-none absolute -bottom-32 -left-16 h-64 w-64 rounded-full bg-indigo-400/20 blur-3xl"
            />

            <div className="relative flex items-start justify-between gap-3">
              <div className="min-w-0">
                <span className="font-mono text-[10px] uppercase tracking-[0.32em] text-(--text-muted)">
                  Live Interview
                </span>
                <h3 className="font-display mt-1 wrap-break-word text-2xl text-(--text-primary) sm:text-3xl">
                  with {character.name}
                </h3>
                <p className="mt-1 truncate text-xs text-(--text-secondary)">
                  {event.title} · Source-grounded · Real-time voice
                </p>
              </div>
              <motion.button
                type="button"
                onClick={handleEnd}
                whileHover={{ scale: 1.06 }}
                whileTap={{ scale: 0.94 }}
                transition={{ type: 'spring', stiffness: 380, damping: 26 }}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-(--border-soft) bg-(--surface) text-(--text-secondary) transition hover:border-(--accent) hover:text-(--text-primary)"
                aria-label="End interview"
              >
                <X size={15} />
              </motion.button>
            </div>

            {/* Voice orb */}
            <div className="relative mx-auto mt-7 flex h-44 w-44 items-center justify-center sm:h-52 sm:w-52">
              <AnimatePresence>
                {state === 'listening' ? (
                  <>
                    <motion.span
                      key="ring-1"
                      initial={{ opacity: 0.55, scale: 1 }}
                      animate={{ opacity: 0, scale: 1.45 }}
                      exit={{ opacity: 0 }}
                      transition={{
                        duration: 1.6,
                        repeat: Infinity,
                        ease: 'easeOut',
                      }}
                      className="absolute inset-0 rounded-full border border-(--accent)/60"
                    />
                    <motion.span
                      key="ring-2"
                      initial={{ opacity: 0.45, scale: 1 }}
                      animate={{ opacity: 0, scale: 1.7 }}
                      exit={{ opacity: 0 }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: 'easeOut',
                        delay: 0.4,
                      }}
                      className="absolute inset-0 rounded-full border border-(--accent)/40"
                    />
                  </>
                ) : null}
              </AnimatePresence>

              <AnimatePresence>
                {state === 'thinking' ? (
                  <motion.span
                    key="thinking-ring"
                    initial={{ opacity: 0, rotate: 0 }}
                    animate={{ opacity: 1, rotate: 360 }}
                    exit={{ opacity: 0 }}
                    transition={{
                      rotate: {
                        duration: 2.2,
                        repeat: Infinity,
                        ease: 'linear',
                      },
                      opacity: { duration: 0.3 },
                    }}
                    className="absolute inset-1.5 rounded-full border-2 border-transparent border-t-(--accent) border-r-(--accent)/40"
                  />
                ) : null}
              </AnimatePresence>

              <motion.div
                animate={{
                  scale:
                    state === 'listening'
                      ? [1, 1.05, 1]
                      : state === 'speaking'
                        ? [1, 1.025, 1]
                        : 1,
                  boxShadow:
                    state === 'idle' || state === 'paused'
                      ? '0 0 40px -10px rgba(214, 164, 69, 0.35)'
                      : '0 0 90px -10px rgba(214, 164, 69, 0.55)',
                }}
                transition={
                  state === 'listening'
                    ? { duration: 1.5, repeat: Infinity, ease: 'easeInOut' }
                    : state === 'speaking'
                      ? { duration: 0.65, repeat: Infinity, ease: 'easeInOut' }
                      : { duration: 0.4, ease: 'easeOut' }
                }
                className="relative grid h-32 w-32 place-items-center rounded-full bg-linear-to-br from-(--accent) to-(--accent-strong) text-(--background) sm:h-36 sm:w-36"
              >
                {state === 'speaking' ? (
                  <span
                    aria-hidden
                    className="flex h-12 items-end gap-1 leading-none"
                  >
                    {[0, 1, 2, 3, 4].map((bar) => (
                      <span
                        key={bar}
                        className="block w-1 origin-bottom rounded-full bg-(--background)"
                        style={{
                          height: '36px',
                          animation:
                            'histora-voice-pulse 0.9s ease-in-out infinite',
                          animationDelay: `${bar * 90}ms`,
                        }}
                      />
                    ))}
                  </span>
                ) : (
                  <span className="font-display text-3xl font-bold tracking-tight">
                    {character.initials}
                  </span>
                )}
              </motion.div>
            </div>

            <div className="relative mt-5 text-center">
              <AnimatePresence mode="wait">
                <motion.div
                  key={state}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.22, ease: 'easeOut' }}
                >
                  <div
                    className={cn(
                      'inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em]',
                      state === 'listening' &&
                        'bg-(--accent-soft) text-(--accent)',
                      state === 'thinking' &&
                        'bg-indigo-400/15 text-indigo-300',
                      state === 'speaking' &&
                        'bg-emerald-400/15 text-emerald-400',
                      state === 'paused' && 'bg-rose-400/15 text-rose-400',
                      state === 'idle' &&
                        'bg-(--surface-strong) text-(--text-muted)',
                    )}
                  >
                    {state === 'thinking' ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : state === 'listening' ? (
                      <AudioWaveform size={12} />
                    ) : state === 'speaking' ? (
                      <Volume2 size={12} />
                    ) : null}
                    {STATE_LABEL[state]}
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-(--text-secondary)">
                    {STATE_DETAIL[state]}
                  </p>
                </motion.div>
              </AnimatePresence>
            </div>

            <div className="relative mt-5 space-y-3">
              <AnimatePresence>
                {liveTranscript || interimTranscript ? (
                  <motion.div
                    key="user-transcript"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.2, ease: 'easeOut' }}
                    className="rounded-2xl border border-(--border-soft) bg-(--surface) px-4 py-3 text-sm text-(--text-primary)"
                  >
                    <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-(--text-muted)">
                      You
                    </div>
                    <p className="mt-1 wrap-break-word leading-relaxed">
                      {liveTranscript}
                      {interimTranscript ? (
                        <span className="ml-1 italic text-(--text-muted)">
                          {liveTranscript ? ' ' : null}
                          {interimTranscript}
                        </span>
                      ) : null}
                    </p>
                  </motion.div>
                ) : null}
              </AnimatePresence>

              <AnimatePresence>
                {assistantText ? (
                  <motion.div
                    key="assistant-transcript"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.25, ease: 'easeOut' }}
                    className="rounded-2xl border border-(--accent)/30 bg-(--accent-soft) px-4 py-3 text-sm text-(--text-primary)"
                  >
                    <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.28em] text-(--accent)">
                      <span>{character.name}</span>
                    </div>
                    <p className="mt-1 wrap-break-word whitespace-pre-wrap leading-relaxed">
                      {assistantText}
                    </p>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>

            <AnimatePresence>
              {voiceFallback ? (
                <motion.div
                  key="voice-fallback"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.2 }}
                  className="relative mt-3 inline-flex w-full items-center gap-2 rounded-2xl border border-(--border-soft) bg-(--surface) px-3 py-2 text-[11px] text-(--text-secondary)"
                  role="status"
                >
                  <VolumeX size={12} className="shrink-0 text-rose-400" />
                  <span className="flex-1">
                    Voice unavailable, showing text response.
                  </span>
                </motion.div>
              ) : null}
            </AnimatePresence>

            <AnimatePresence>
              {errorMessage ? (
                <motion.div
                  key="live-error"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.2 }}
                  className="relative mt-3 inline-flex w-full items-start gap-2 rounded-2xl border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-[11px] leading-relaxed text-rose-100"
                  role="status"
                >
                  <MicOff
                    size={12}
                    className="mt-0.5 shrink-0 text-rose-400"
                    aria-hidden
                  />
                  <span className="flex-1">{errorMessage}</span>
                </motion.div>
              ) : null}
            </AnimatePresence>

            {!speechSupported ? (
              <div
                className="relative mt-3 rounded-2xl border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-[11px] leading-relaxed text-rose-100"
                role="status"
              >
                Live Interview needs the Web Speech API. Try the latest Chrome
                or Edge to talk to the archive aloud.
              </div>
            ) : null}

            <div className="relative mt-6 flex flex-wrap items-center justify-center gap-2 sm:gap-3">
              {showStartButton ? (
                <motion.button
                  type="button"
                  onClick={handleStart}
                  disabled={!speechSupported}
                  whileHover={{ scale: speechSupported ? 1.04 : 1 }}
                  whileTap={{ scale: speechSupported ? 0.96 : 1 }}
                  transition={{ type: 'spring', stiffness: 380, damping: 26 }}
                  className="inline-flex items-center gap-2 rounded-full bg-(--text-primary) px-5 py-2 text-sm font-semibold text-(--background) shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Play size={14} />
                  {startLabel}
                </motion.button>
              ) : (
                <motion.button
                  type="button"
                  onClick={handlePause}
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.96 }}
                  transition={{ type: 'spring', stiffness: 380, damping: 26 }}
                  className="inline-flex items-center gap-2 rounded-full border border-(--border-soft) bg-(--surface) px-4 py-2 text-sm font-semibold text-(--text-primary) transition hover:border-(--accent) hover:text-(--accent)"
                >
                  <Pause size={14} />
                  Pause
                </motion.button>
              )}

              <motion.button
                type="button"
                onClick={handleToggleMute}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                transition={{ type: 'spring', stiffness: 380, damping: 26 }}
                aria-pressed={isMuted}
                className={cn(
                  'inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition',
                  isMuted
                    ? 'border-rose-400/50 bg-rose-400/10 text-rose-100 hover:bg-rose-400/20'
                    : 'border-(--border-soft) bg-(--surface) text-(--text-primary) hover:border-(--accent) hover:text-(--accent)',
                )}
              >
                {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
                {isMuted ? 'Unmute Voice' : 'Mute Voice'}
              </motion.button>

              <motion.button
                type="button"
                onClick={handleEnd}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                transition={{ type: 'spring', stiffness: 380, damping: 26 }}
                className="inline-flex items-center gap-2 rounded-full border border-rose-400/40 bg-rose-400/10 px-4 py-2 text-sm font-semibold text-rose-100 transition hover:bg-rose-400/20"
              >
                <Square size={14} />
                End Interview
              </motion.button>
            </div>

            <p className="relative mt-4 text-center text-[10px] uppercase tracking-[0.28em] text-(--text-muted)">
              Voice: {voiceGender} · Conversation saved to your chat history
            </p>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
