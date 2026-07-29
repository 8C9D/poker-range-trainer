import { useEffect, useRef, useState } from 'react'
import { useSwipe } from '../components/useSwipe'
import { drawPracticeCombo } from '../domain/blockerPractice'
import type { Card } from '../domain/cards'
import {
  createPracticeAttempt,
  getRandomHandFrom,
  getRandomPracticeHand,
} from '../domain/practice'
import { explainHand } from '../domain/missExplanation'
import type { PokerHand } from '../domain/pokerHands'
import { DEFAULT_DRILL_SECONDS, getRemainingSeconds, isDrillOver } from '../domain/timedDrill'
import { getWeaknessFocusedHand } from '../domain/weaknessDrill'
import type { PracticeAttempt } from '../types/practice'
import type { SavedRange } from '../types/range'
import { OverlayFrame } from './OverlayFrame'
import { PlayingCards } from './PlayingCards'
import { answerVerbs, feedbackLine, scenarioLine } from './scenario'

/** Questions per (non-timed) drill: short sessions with a visible end. */
export const DRILL_QUESTION_COUNT = 20
/** Correct answers advance quickly; misses hold so the explanation is read. */
export const HIT_DWELL_MS = 900
export const MISS_DWELL_MS = 1600
/** Under the clock, feedback flashes faster. */
export const TIMED_HIT_DWELL_MS = 500
export const TIMED_MISS_DWELL_MS = 1000

interface Prompt {
  hand: PokerHand
  cards: Card[]
}

interface RecognitionDrillProps {
  range: SavedRange
  /** standard = random hands (or handPool); weakness = mistakes weighted; timed = against the clock. */
  variant: 'standard' | 'weakness' | 'timed'
  /** When non-empty, standard prompts are drawn only from these hands. */
  handPool?: PokerHand[]
  durationSeconds?: number
  questionCount?: number
  /** Queue position, e.g. "2/5"; shown in the top bar. */
  position?: string | null
  /**
   * Called with the scored attempts when the session ends: all questions
   * answered, the timer expired, or the user closed the overlay early.
   */
  onFinish: (attempts: PracticeAttempt[]) => void
  random?: () => number
}

/**
 * The full-screen recognition drill: concrete playing cards, a scenario line,
 * and two fixed-position answer buttons using the range's action verb. Every
 * answer scores instantly with explanatory feedback; misses dwell longer than
 * hits before auto-advancing.
 */
export function RecognitionDrill({
  range,
  variant,
  handPool,
  durationSeconds = DEFAULT_DRILL_SECONDS,
  questionCount = DRILL_QUESTION_COUNT,
  position = null,
  onFinish,
  random = Math.random,
}: RecognitionDrillProps) {
  const verbs = answerVerbs(range)
  const scenario = scenarioLine(range)

  function drawPrompt(prevAttempts: PracticeAttempt[]): Prompt {
    const hand =
      variant === 'weakness'
        ? getWeaknessFocusedHand(prevAttempts, random)
        : handPool && handPool.length > 0
          ? getRandomHandFrom(handPool, random)
          : getRandomPracticeHand(random)
    // Concrete suits: suited hands share a suit, offsuit/pairs differ, exactly
    // like dealing a real combo of that hand class.
    return { hand, cards: drawPracticeCombo([hand], [], undefined, random) }
  }

  const [prompt, setPrompt] = useState<Prompt>(() => drawPrompt([]))
  const [attempts, setAttempts] = useState<PracticeAttempt[]>([])
  const [feedback, setFeedback] = useState<PracticeAttempt | null>(null)
  const attemptsRef = useRef(attempts)
  const finishedRef = useRef(false)
  const answeringRef = useRef(false)
  const dwellTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Timed variant: tick every 250ms and end the session when time is up.
  const [startMs] = useState(() => Date.now())
  const [nowMs, setNowMs] = useState(startMs)
  useEffect(() => {
    if (variant !== 'timed') return
    const id = setInterval(() => setNowMs(Date.now()), 250)
    return () => clearInterval(id)
  }, [variant])

  function finish(finalAttempts: PracticeAttempt[]) {
    if (finishedRef.current) return
    finishedRef.current = true
    if (dwellTimeoutRef.current !== null) clearTimeout(dwellTimeoutRef.current)
    onFinish(finalAttempts)
  }

  const timedOver = variant === 'timed' && isDrillOver(startMs, durationSeconds, nowMs)
  useEffect(() => {
    if (timedOver) finish(attemptsRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timedOver])

  // Clear any pending dwell timer on unmount.
  useEffect(
    () => () => {
      if (dwellTimeoutRef.current !== null) clearTimeout(dwellTimeoutRef.current)
    },
    [],
  )

  function answer(userAnsweredInRange: boolean) {
    if (answeringRef.current || feedback !== null || finishedRef.current) return
    answeringRef.current = true
    const attempt = createPracticeAttempt(prompt.hand, range.hands, userAnsweredInRange)
    const nextAttempts = [...attempts, attempt]
    setAttempts(nextAttempts)
    attemptsRef.current = nextAttempts
    setFeedback(attempt)
    const dwell =
      variant === 'timed'
        ? attempt.correct
          ? TIMED_HIT_DWELL_MS
          : TIMED_MISS_DWELL_MS
        : attempt.correct
          ? HIT_DWELL_MS
          : MISS_DWELL_MS
    dwellTimeoutRef.current = setTimeout(() => {
      dwellTimeoutRef.current = null
      if (finishedRef.current) return
      if (variant !== 'timed' && nextAttempts.length >= questionCount) {
        finish(nextAttempts)
        return
      }
      answeringRef.current = false
      setFeedback(null)
      setPrompt(drawPrompt(nextAttempts))
    }, dwell)
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.repeat || event.altKey || event.ctrlKey || event.metaKey) return
      const target = event.target
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault()
        answer(true)
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault()
        answer(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  })

  const swipe = useSwipe({
    onSwipeRight: () => answer(true),
    onSwipeLeft: () => answer(false),
  })

  const remainingSeconds =
    variant === 'timed' ? getRemainingSeconds(startMs, durationSeconds, nowMs) : null
  const progress =
    variant === 'timed'
      ? 1 - (remainingSeconds ?? 0) / durationSeconds
      : attempts.length / questionCount

  return (
    <OverlayFrame
      title={range.name}
      position={position}
      progress={progress}
      onClose={() => finish(attemptsRef.current)}
    >
      {remainingSeconds !== null && (
        <p className="drill-timer coach-tabular" aria-label="Time remaining">
          {remainingSeconds}s left
        </p>
      )}
      <div className="drill-center" {...swipe}>
        {scenario && <p className="drill-scenario">{scenario}</p>}
        <PlayingCards cards={prompt.cards} />
        <p className="sr-only" data-testid="drill-hand">
          {prompt.hand}
        </p>
        <div className="drill-feedback" role="status">
          {feedback && (
            <>
              <p className={feedback.correct ? 'good' : 'bad'}>
                {feedbackLine(feedback.hand, feedback.expectedInRange, feedback.correct, verbs)}
              </p>
              {/* A miss is the teachable moment: say where the hand sits in the chart. */}
              {!feedback.correct && (
                <p className="drill-why">{explainHand(feedback.hand, range.hands).line}</p>
              )}
            </>
          )}
        </div>
        {!feedback && (
          <p className="drill-swipe-hint">
            Swipe or use arrow keys: right to {verbs.yes.toLowerCase()}, left to fold
          </p>
        )}
      </div>
      <div className="drill-answers">
        <button
          type="button"
          className="drill-answer yes"
          disabled={feedback !== null}
          aria-keyshortcuts="ArrowRight"
          onClick={() => answer(true)}
        >
          {verbs.yes}
        </button>
        <button
          type="button"
          className="drill-answer no"
          disabled={feedback !== null}
          aria-keyshortcuts="ArrowLeft"
          onClick={() => answer(false)}
        >
          {verbs.no}
        </button>
      </div>
    </OverlayFrame>
  )
}
