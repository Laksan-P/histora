import { AnimatePresence, motion } from 'framer-motion'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  GraduationCap,
  Loader2,
  RotateCcw,
  Sparkles,
  Wand2,
  X,
  XCircle,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import type { QuizQuestion } from '../lib/types'
import { cn } from '../lib/cn'

type QuizPanelProps = {
  questions: QuizQuestion[]
  loading: boolean
  error: string | null
  eventTitle: string
  characterName: string
  onClose?: () => void
  onRegenerate: () => void
}

type AnswerState = {
  selected: number | null
  revealed: boolean
}

export default function QuizPanel({
  questions,
  loading,
  error,
  eventTitle,
  characterName,
  onClose,
  onRegenerate,
}: QuizPanelProps) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, AnswerState>>({})
  const [trackedQuestions, setTrackedQuestions] = useState(questions)

  // Reset progress whenever a new set of questions arrives. Adjusting state
  // during render is the React-recommended pattern for prop-driven resets and
  // avoids the cascading effect rerun warning.
  if (trackedQuestions !== questions) {
    setTrackedQuestions(questions)
    setActiveIndex(0)
    setAnswers({})
  }

  const current = questions[activeIndex]
  const currentAnswer = current ? answers[current.id] : undefined

  const score = useMemo(() => {
    let correct = 0
    for (const question of questions) {
      const answer = answers[question.id]
      if (answer?.revealed && answer.selected === question.answerIndex) {
        correct += 1
      }
    }
    return correct
  }, [answers, questions])

  const handleSelect = (index: number) => {
    if (!current) return
    setAnswers((prev) => ({
      ...prev,
      [current.id]: {
        selected: index,
        revealed: prev[current.id]?.revealed ?? false,
      },
    }))
  }

  const handleReveal = () => {
    if (!current) return
    setAnswers((prev) => ({
      ...prev,
      [current.id]: {
        selected: prev[current.id]?.selected ?? null,
        revealed: true,
      },
    }))
  }

  const handleReset = () => {
    setAnswers({})
    setActiveIndex(0)
  }

  const hasQuestions = questions.length > 0
  const showLoading = loading && !hasQuestions
  const showError = !loading && error && !hasQuestions

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }}
      transition={{ duration: 0.5 }}
      className="glass-strong relative overflow-hidden rounded-3xl"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-24 h-48 bg-linear-to-br from-(--accent)/25 via-transparent to-transparent blur-3xl"
      />

      <header className="relative flex flex-wrap items-center justify-between gap-4 border-b border-(--border-soft) px-6 py-5">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-(--accent-soft) text-(--accent)">
            <GraduationCap size={18} />
          </span>
          <div>
            <span className="font-mono text-[10px] uppercase tracking-[0.32em] text-(--text-muted)">
              Step 05 · Quiz panel
            </span>
            <h3 className="font-display text-2xl text-(--text-primary)">
              Quick review on {eventTitle}
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-full border border-(--border-soft) bg-(--surface) px-3 py-1 text-xs text-(--text-secondary)">
            <Sparkles size={12} className="text-(--accent)" />
            Generated from chat with {characterName}
          </span>
          <motion.button
            type="button"
            onClick={onRegenerate}
            disabled={loading}
            whileHover={loading ? undefined : { scale: 1.04 }}
            whileTap={loading ? undefined : { scale: 0.94 }}
            transition={{ type: 'spring', stiffness: 380, damping: 26 }}
            className="inline-flex items-center gap-2 rounded-full bg-(--accent) px-3 py-1 text-xs font-semibold text-(--background) shadow-sm transition hover:opacity-90 disabled:opacity-60"
            aria-label="Generate a new quiz"
          >
            {loading ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Wand2 size={12} />
            )}
            {loading ? 'Generating…' : 'New quiz'}
          </motion.button>
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="grid h-9 w-9 place-items-center rounded-full border border-(--border-soft) bg-(--surface) text-(--text-secondary) transition hover:border-(--accent) hover:text-(--accent)"
              aria-label="Close quiz panel"
            >
              <X size={14} />
            </button>
          ) : null}
        </div>
      </header>

      <div className="relative flex flex-col gap-5 px-6 py-6 sm:px-8">
        {showLoading ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="flex flex-col gap-5"
          >
            <div className="flex items-center gap-3 rounded-2xl border border-(--border-soft) bg-(--surface) px-4 py-3 text-sm text-(--text-secondary)">
              <span className="relative grid h-9 w-9 place-items-center rounded-full bg-(--accent-soft) text-(--accent)">
                <Loader2 size={16} className="animate-spin" />
              </span>
              <div>
                <div className="text-sm font-semibold text-(--text-primary)">
                  Drafting a fresh quiz…
                </div>
                <div className="text-xs text-(--text-muted)">
                  Crafting source-grounded questions for {characterName}.
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <div className="shimmer-bar h-6 w-3/4 rounded-full" />
              <div className="grid gap-2">
                {[0, 1, 2, 3].map((row) => (
                  <div
                    key={row}
                    className="shimmer-bar h-12 w-full rounded-2xl"
                  />
                ))}
              </div>
              <div className="shimmer-bar h-4 w-1/2 rounded-full" />
            </div>
          </motion.div>
        ) : showError ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="flex flex-col gap-4 rounded-2xl border border-rose-400/30 bg-rose-400/5 p-5 text-sm text-(--text-secondary)"
          >
            <div className="flex items-start gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-rose-400/15 text-rose-400">
                <AlertTriangle size={16} />
              </span>
              <div>
                <div className="text-sm font-semibold text-(--text-primary)">
                  Quiz generation failed
                </div>
                <p className="mt-1 text-xs text-(--text-muted)">{error}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onRegenerate}
              className="inline-flex w-fit items-center gap-2 rounded-full bg-(--text-primary) px-3 py-1.5 text-xs font-semibold text-(--background) transition hover:opacity-90"
            >
              <RotateCcw size={12} />
              Try again
            </button>
          </motion.div>
        ) : current ? (
          <>
            <div className="flex items-center justify-between text-xs text-(--text-muted)">
              <span>
                Question{' '}
                <span className="font-semibold text-(--text-primary)">
                  {String(activeIndex + 1).padStart(2, '0')}
                </span>{' '}
                of {String(questions.length).padStart(2, '0')}
              </span>
              <span>
                Score:{' '}
                <span className="font-semibold text-(--text-primary)">
                  {score}
                </span>{' '}
                / {questions.length}
              </span>
            </div>

            <div className="h-1.5 w-full overflow-hidden rounded-full bg-(--accent-soft)">
              <motion.div
                layout
                initial={false}
                animate={{
                  width: `${((activeIndex + 1) / questions.length) * 100}%`,
                }}
                transition={{ type: 'spring', stiffness: 140, damping: 22 }}
                className="h-full rounded-full bg-(--accent)"
              />
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={current.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.35 }}
                className="space-y-5"
              >
                <h4 className="font-display text-pretty text-2xl font-semibold text-(--text-primary) sm:text-3xl">
                  {current.prompt}
                </h4>

                <div className="grid gap-2">
                  {current.choices.map((choice, index) => {
                    const isSelected = currentAnswer?.selected === index
                    const isCorrect = current.answerIndex === index
                    const revealed = currentAnswer?.revealed

                    return (
                      <button
                        key={`${current.id}-${index}`}
                        type="button"
                        onClick={() => handleSelect(index)}
                        className={cn(
                          'group flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left text-sm transition',
                          revealed && isCorrect
                            ? 'border-emerald-400/60 bg-emerald-400/10 text-(--text-primary)'
                            : revealed && isSelected && !isCorrect
                              ? 'border-rose-400/60 bg-rose-400/10 text-(--text-primary)'
                              : isSelected
                                ? 'border-(--accent) bg-(--accent-soft) text-(--text-primary)'
                                : 'border-(--border-soft) bg-(--surface) text-(--text-secondary) hover:border-(--accent)/60 hover:text-(--text-primary)',
                        )}
                      >
                        <span className="flex items-center gap-3">
                          <span
                            className={cn(
                              'grid h-7 w-7 place-items-center rounded-full border text-[11px] font-semibold',
                              isSelected
                                ? 'border-(--accent) bg-(--accent) text-(--background)'
                                : 'border-(--border-strong) text-(--text-muted)',
                            )}
                          >
                            {String.fromCharCode(65 + index)}
                          </span>
                          <span>{choice}</span>
                        </span>
                        {revealed && isCorrect ? (
                          <CheckCircle2
                            size={16}
                            className="text-emerald-500"
                          />
                        ) : null}
                        {revealed && isSelected && !isCorrect ? (
                          <XCircle size={16} className="text-rose-500" />
                        ) : null}
                      </button>
                    )
                  })}
                </div>

                <AnimatePresence>
                  {currentAnswer?.revealed ? (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      className="rounded-2xl border border-(--border-soft) bg-(--surface) px-4 py-3 text-sm text-(--text-secondary)"
                    >
                      <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-(--accent)">
                        Why
                      </span>
                      <p className="mt-1 text-(--text-primary)">
                        {current.rationale}
                      </p>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </motion.div>
            </AnimatePresence>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setActiveIndex((prev) => Math.max(0, prev - 1))
                  }
                  disabled={activeIndex === 0}
                  className="inline-flex items-center gap-2 rounded-full border border-(--border-soft) bg-(--surface) px-3 py-1.5 text-xs text-(--text-secondary) transition hover:text-(--text-primary) disabled:opacity-50"
                >
                  <ArrowLeft size={13} />
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setActiveIndex((prev) =>
                      Math.min(questions.length - 1, prev + 1),
                    )
                  }
                  disabled={activeIndex === questions.length - 1}
                  className="inline-flex items-center gap-2 rounded-full border border-(--border-soft) bg-(--surface) px-3 py-1.5 text-xs text-(--text-secondary) transition hover:text-(--text-primary) disabled:opacity-50"
                >
                  Next
                  <ArrowRight size={13} />
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleReset}
                  className="inline-flex items-center gap-2 rounded-full border border-(--border-soft) bg-(--surface) px-3 py-1.5 text-xs text-(--text-secondary) transition hover:text-(--text-primary)"
                >
                  <RotateCcw size={13} />
                  Reset
                </button>
                <button
                  type="button"
                  onClick={handleReveal}
                  className="inline-flex items-center gap-2 rounded-full bg-(--text-primary) px-4 py-1.5 text-xs font-semibold text-(--background) transition hover:opacity-90"
                >
                  Reveal answer
                  <CheckCircle2 size={13} />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="rounded-2xl border border-dashed border-(--border-soft) bg-(--surface) p-8 text-center text-sm text-(--text-muted)">
            Tap <span className="font-semibold text-(--text-primary)">New quiz</span> to draft a fresh set of questions.
          </div>
        )}
      </div>
    </motion.section>
  )
}
