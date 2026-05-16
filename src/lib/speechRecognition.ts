export type SpeechResultAlternative = {
  transcript: string
  confidence?: number
}

export type SpeechResult = {
  isFinal: boolean
  length: number
  [index: number]: SpeechResultAlternative
}

export type SpeechResultList = {
  length: number
  [index: number]: SpeechResult
}

export type SpeechRecognitionEventLike = {
  resultIndex: number
  results: SpeechResultList
}

export type SpeechRecognitionErrorEventLike = {
  error: string
  message?: string
}

export type SpeechRecognitionLike = {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives?: number
  start: () => void
  stop: () => void
  abort: () => void
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null
  onend: (() => void) | null
  onstart: (() => void) | null
}

export type SpeechRecognitionStatic = new () => SpeechRecognitionLike

type WindowWithSpeech = Window & {
  SpeechRecognition?: SpeechRecognitionStatic
  webkitSpeechRecognition?: SpeechRecognitionStatic
}

export function getSpeechRecognitionCtor(): SpeechRecognitionStatic | null {
  if (typeof window === 'undefined') return null
  const w = window as WindowWithSpeech
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export function isSpeechRecognitionSupported(): boolean {
  return getSpeechRecognitionCtor() !== null
}

export function describeSpeechError(code: string): string {
  switch (code) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'Microphone permission was denied. Enable it in your browser settings and try again.'
    case 'no-speech':
      return "We didn't catch anything. Tap the mic and try speaking a bit closer."
    case 'audio-capture':
      return 'No microphone was detected on this device.'
    case 'network':
      return 'Voice input needs an internet connection. Please try again.'
    case 'aborted':
      return ''
    default:
      return `Voice input error: ${code}`
  }
}
