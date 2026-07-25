import { useEffect, useMemo, useRef, useState } from 'react'
import { useSwipe } from '../components/useSwipe'
import { drawPracticeCombo } from '../domain/blockerPractice'
import type { Card } from '../domain/cards'
import { explainHand } from '../domain/missExplanation'
import { createPracticeAttempt } from '../domain/practice'
import { describeSpot, spotKey } from '../domain/spot'
import {
  coveredSpots,
  drawSpotPrompt,
  nextChainedSpot,
  summarizeSpotSession,
  type AnsweredSpot,
  type SpotPrompt,
  type SpotSessionResult,
} from '../domain/spotDrill'
import type { PracticeAttempt } from '../types/practice'
import type { SavedRange, TableSize } from '../types/range'
import { DRILL_QUESTION_COUNT, HIT_DWELL_MS, MISS_DWELL_MS } from './RecognitionDrill'
import { OverlayFrame } from './OverlayFrame'
import { PlayingCards } from './PlayingCards'
import { answerVerbs, feedbackLine } from './scenario'

interface SpotDrillProps {
  /** The whole library; the drill picks the range each spot needs. */
  ranges: SavedRange[]
  tableSize: TableSize
  stackDepthBb: number
  questionCount?: number
  /** Called with the finished session, cut by range and by spot. */
  onFinish: (result: SpotSessionResult) => void
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

  type Question = SpotPrompt & { cards: Card[]; chained: boolean }

  function draw(): Question | null {
    const next = drawSpotPrompt(covered, random)
    if (!next) return null
    return {
      ...next,
      cards: drawPracticeCombo([next.hand], [], undefined, random),
      chained: false,
    }
  }

  /**
   * The same hand carried into the second decision, when the user played it
   * correctly and the library covers what comes next. Folding — or a wrong
   * answer — ends the hand, so the chain only ever rewards a right one.
   */
  function chain(current: Question, attempt: PracticeAttempt): Question | null {
    if (!attempt.correct || !attempt.expectedInRange) return null
    const next = nextChainedSpot(current.spot, covered, random)
    return next ? { ...next, hand: current.hand, cards: current.cards, chained: true } : null
  }

  const [prompt, setPrompt] = useState(draw)
  const [answered, setAnswered] = useState<AnsweredSpot[]>([])
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

  function finish(final: AnsweredSpot[]) {
    if (finishedRef.current) return
    finishedRef.current = true
    if (dwellTimeoutRef.current !== null) clearTimeout(dwellTimeoutRef.current)
    onFinish(summarizeSpotSession(final))
  }

  function answer(userAnsweredInRange: boolean) {
    if (!prompt || feedback !== null || finishedRef.current) return
    const attempt = createPracticeAttempt(prompt.hand, prompt.range.hands, userAnsweredInRange)
    const next = [
      ...answered,
      { rangeId: prompt.range.id, spotKey: spotKey(prompt.spot), attempt },
    ]
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
        setPrompt(chain(prompt, attempt) ?? draw())
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
        {prompt.chained && <p className="drill-chain">Same hand — the action continues.</p>}
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
