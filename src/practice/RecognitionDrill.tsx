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
import {
  DRILL_QUESTION_COUNT,
  HIT_DWELL_MS,
  type DrillEnd,
  TIMED_HIT_DWELL_MS,
  TIMED_MISS_DWELL_MS,
  holdsForAcknowledgement,
} from './drillPacing'
import { OverlayFrame } from './OverlayFrame'
import { PlayingCards } from './PlayingCards'
import { answerVerbs, feedbackLine, scenarioLine } from './scenario'

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
  onFinish: (attempts: PracticeAttempt[], ended: DrillEnd) => void
  random?: () => number
}

/**
 * The full-screen recognition drill: concrete playing cards, a scenario line,
 * and two fixed-position answer buttons using the range's action verb. Every
 * answer scores instantly with explanatory feedback; a hit auto-advances, while
 * an untimed miss holds its explanation until the user presses Next.
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

  function finish(finalAttempts: PracticeAttempt[], ended: DrillEnd) {
    if (finishedRef.current) return
    finishedRef.current = true
    if (dwellTimeoutRef.current !== null) clearTimeout(dwellTimeoutRef.current)
    onFinish(finalAttempts, ended)
  }

  const timedOver = variant === 'timed' && isDrillOver(startMs, durationSeconds, nowMs)
  useEffect(() => {
    if (timedOver) finish(attemptsRef.current, 'completed')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timedOver])

  // Clear any pending dwell timer on unmount.
  useEffect(
    () => () => {
      if (dwellTimeoutRef.current !== null) clearTimeout(dwellTimeoutRef.current)
    },
    [],
  )

  /** Clear the feedback and deal the next hand, or end a finished session. */
  function advance() {
    // Only ever moves on from a scored answer, so a stray activation (a click
    // landing as the Next button unmounts) cannot skip a hand.
    if (!answeringRef.current || finishedRef.current) return
    if (dwellTimeoutRef.current !== null) {
      clearTimeout(dwellTimeoutRef.current)
      dwellTimeoutRef.current = null
    }
    const answered = attemptsRef.current
    if (variant !== 'timed' && answered.length >= questionCount) {
      finish(answered, 'completed')
      return
    }
    answeringRef.current = false
    setFeedback(null)
    setPrompt(drawPrompt(answered))
  }

  function answer(userAnsweredInRange: boolean) {
    if (answeringRef.current || feedback !== null || finishedRef.current) return
    answeringRef.current = true
    const attempt = createPracticeAttempt(prompt.hand, range.hands, userAnsweredInRange)
    const nextAttempts = [...attempts, attempt]
    setAttempts(nextAttempts)
    attemptsRef.current = nextAttempts
    setFeedback(attempt)
    // An untimed miss stays up until the user continues; everything else moves on.
    if (holdsForAcknowledgement(variant === 'timed', attempt.correct)) return
    const dwell =
      variant === 'timed'
        ? attempt.correct
          ? TIMED_HIT_DWELL_MS
          : TIMED_MISS_DWELL_MS
        : HIT_DWELL_MS
    dwellTimeoutRef.current = setTimeout(advance, dwell)
  }

  const holding =
    feedback !== null && holdsForAcknowledgement(variant === 'timed', feedback.correct)

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
      // While a miss is held, the arrow keys stay answers so a fast run of them
      // cannot skip past the explanation; only an explicit Enter continues.
      if (holding) {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          advance()
        }
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
      onClose={() => finish(attemptsRef.current, 'closed')}
    >
      {remainingSeconds !== null && (
        // No label: a paragraph cannot carry one, and "45s left" already says
        // more than the "Time remaining" that was on it would.
        <p className="drill-timer coach-tabular">{remainingSeconds}s left</p>
      )}
      <div className="drill-center" {...swipe}>
        {scenario && <p className="drill-scenario">{scenario}</p>}
        <PlayingCards cards={prompt.cards} />
        {/* The deal is the question, so it has to speak: without a live region a
            screen reader announces the feedback and then goes silent on the next
            hand, leaving the drill unplayable without sight. The scenario is the
            same for every question here, so only the hand needs announcing. */}
        <p className="sr-only" aria-live="polite" aria-atomic="true" data-testid="drill-hand">
          {prompt.hand}
        </p>
        <div className="drill-feedback" role="status">
          {feedback && (
            <>
              <p className={feedback.correct ? 'good' : 'bad'}>
                {feedbackLine(feedback.hand, feedback.expectedInRange, feedback.correct, verbs)}
              </p>
              {/* A miss is the teachable moment: say where the hand sits in the
                  chart. */}
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
        {holding ? (
          <button
            type="button"
            className="drill-answer next"
            aria-keyshortcuts="Enter"
            onClick={advance}
          >
            Next
          </button>
        ) : (
          <>
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
          </>
        )}
      </div>
    </OverlayFrame>
  )
}
