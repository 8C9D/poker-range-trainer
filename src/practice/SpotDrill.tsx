import { useEffect, useMemo, useRef, useState } from 'react'
import { useSwipe } from '../components/useSwipe'
import { drawPracticeCombo } from '../domain/blockerPractice'
import type { Card } from '../domain/cards'
import { explainHand } from '../domain/missExplanation'
import { createPracticeAttempt } from '../domain/practice'
import { describeSpot } from '../domain/spot'
import { coveredSpots, drawSpotPrompt, type SpotPrompt } from '../domain/spotDrill'
import type { PracticeAttempt } from '../types/practice'
import type { SavedRange, TableSize } from '../types/range'
import { DRILL_QUESTION_COUNT, HIT_DWELL_MS, MISS_DWELL_MS } from './RecognitionDrill'
import { OverlayFrame } from './OverlayFrame'
import { PlayingCards } from './PlayingCards'
import { answerVerbs, feedbackLine } from './scenario'

/** One answered question, tagged with the range that graded it. */
interface SpotAttempt {
  rangeId: string
  attempt: PracticeAttempt
}

interface SpotDrillProps {
  /** The whole library; the drill picks the range each spot needs. */
  ranges: SavedRange[]
  tableSize: TableSize
  stackDepthBb: number
  questionCount?: number
  /** Called with the attempts grouped by the range that graded them. */
  onFinish: (attemptsByRange: Record<string, PracticeAttempt[]>) => void
  random?: () => number
}

/**
 * The v8.2 spot drill: the table deals the situation, not the range.
 *
 * Each question states a spot in plain words, deals a hand, and grades the answer
 * against whichever saved range covers that spot — so the user has to recall
 * which chart applies before they can recall the hand. Attempts are grouped by
 * range so they fold into exactly the same per-range stats as every other drill.
 */
export function SpotDrill({
  ranges,
  tableSize,
  stackDepthBb,
  questionCount = DRILL_QUESTION_COUNT,
  onFinish,
  random = Math.random,
}: SpotDrillProps) {
  const covered = useMemo(
    () => coveredSpots(ranges, tableSize, stackDepthBb),
    [ranges, tableSize, stackDepthBb],
  )

  function draw(): (SpotPrompt & { cards: Card[] }) | null {
    const next = drawSpotPrompt(covered, random)
    if (!next) return null
    return { ...next, cards: drawPracticeCombo([next.hand], [], undefined, random) }
  }

  const [prompt, setPrompt] = useState(draw)
  const [answered, setAnswered] = useState<SpotAttempt[]>([])
  const [feedback, setFeedback] = useState<PracticeAttempt | null>(null)
  const answeredRef = useRef(answered)
  const finishedRef = useRef(false)
  const dwellTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      if (dwellTimeoutRef.current !== null) clearTimeout(dwellTimeoutRef.current)
    },
    [],
  )

  function finish(final: SpotAttempt[]) {
    if (finishedRef.current) return
    finishedRef.current = true
    if (dwellTimeoutRef.current !== null) clearTimeout(dwellTimeoutRef.current)
    const grouped: Record<string, PracticeAttempt[]> = {}
    for (const { rangeId, attempt } of final) (grouped[rangeId] ??= []).push(attempt)
    onFinish(grouped)
  }

  function answer(userAnsweredInRange: boolean) {
    if (!prompt || feedback !== null || finishedRef.current) return
    const attempt = createPracticeAttempt(prompt.hand, prompt.range.hands, userAnsweredInRange)
    const next = [...answered, { rangeId: prompt.range.id, attempt }]
    setAnswered(next)
    answeredRef.current = next
    setFeedback(attempt)
    dwellTimeoutRef.current = setTimeout(
      () => {
        dwellTimeoutRef.current = null
        if (finishedRef.current) return
        if (next.length >= questionCount) {
          finish(next)
          return
        }
        setFeedback(null)
        setPrompt(draw())
      },
      attempt.correct ? HIT_DWELL_MS : MISS_DWELL_MS,
    )
  }

  const swipe = useSwipe({
    onSwipeRight: () => answer(true),
    onSwipeLeft: () => answer(false),
  })

  if (!prompt) {
    return (
      <OverlayFrame title="Play the spot" onClose={() => finish([])}>
        <div className="drill-center">
          <p className="drill-scenario">
            None of your saved ranges covers a spot at this table size and stack depth. Fill a
            gap on the coverage map and the table will start dealing.
          </p>
        </div>
      </OverlayFrame>
    )
  }

  const verbs = answerVerbs(prompt.range)

  return (
    <OverlayFrame
      title="Play the spot"
      progress={answered.length / questionCount}
      onClose={() => finish(answeredRef.current)}
    >
      <div className="drill-center" {...swipe}>
        <p className="drill-scenario">{describeSpot(prompt.spot)}</p>
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
              {/* Naming the chart is half the lesson: the spot maps to THIS range. */}
              <p className="drill-why">
                {feedback.correct
                  ? `That spot is your “${prompt.range.name}”.`
                  : `${explainHand(feedback.hand, prompt.range.hands).line} (from “${prompt.range.name}”)`}
              </p>
            </>
          )}
        </div>
        {!feedback && (
          <p className="drill-swipe-hint">Swipe right to {verbs.yes.toLowerCase()}, left to fold</p>
        )}
      </div>
      <div className="drill-answers">
        <button
          type="button"
          className="drill-answer yes"
          disabled={feedback !== null}
          onClick={() => answer(true)}
        >
          {verbs.yes}
        </button>
        <button
          type="button"
          className="drill-answer no"
          disabled={feedback !== null}
          onClick={() => answer(false)}
        >
          {verbs.no}
        </button>
      </div>
    </OverlayFrame>
  )
}
