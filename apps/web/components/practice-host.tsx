'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'

import {
  practiceModeValues,
  type PracticeMode,
  type PracticeSessionSubmission,
  type PracticeSessionSubmissionResponse,
  type RangeRead,
} from '@poker-range-trainer/contracts'
import { explainHand } from '@poker-range-trainer/domain/domain/missExplanation'
import { recapMisses } from '@poker-range-trainer/domain/domain/missRecap'
import type { PokerHand } from '@poker-range-trainer/domain/domain/pokerHands'
import { compareBuiltRange } from '@poker-range-trainer/domain/domain/practice'
import {
  DEFAULT_DRILL_SECONDS,
  DRILL_DURATION_OPTIONS,
  getRemainingSeconds,
  isDrillOver,
} from '@poker-range-trainer/domain/domain/timedDrill'

import { HandGrid } from '@/components/hand-grid'
import { ApiClientError, getRange, getRangePractice, submitPracticeSession } from '@/lib/api-client'
import { readDrillPools } from '@/lib/drill-handoff'
import {
  DEFAULT_QUESTION_COUNT,
  buildDrillPlan,
  drawDrillHand,
  parseDrillRequest,
  promptCards,
  scoreDrillAnswer,
  toPracticeAttempts,
  toSubmissionAnswers,
  type CardSuit,
  type DrillAnswer,
  type DrillPlan,
} from '@/lib/drill'

/**
 * The practice screen: it reads the drill out of the URL, loads each queued
 * range, deals the questions its mode allows, and hands the finished run to the
 * API — which owns the scoring, the cumulative stats, and the review schedule.
 *
 * Two rules shape the state here. Nothing is ever fabricated: a range that will
 * not load says so and offers a retry, and a run that will not save keeps its
 * answers instead of quietly dropping them. And one attempt has exactly one
 * idempotency key, generated when the run starts and reused by every retry, so
 * a reply lost on the way back can never record the same drill twice.
 */

const MODE_LABELS: Record<PracticeMode, string> = {
  recognition: 'Recognition',
  timed: 'Timed',
  weakness: 'Weak spots',
  edges: 'Range edges',
  mistakes: 'Past mistakes',
  build: 'Build from memory',
}

const SUIT_GLYPHS: Record<CardSuit, string> = { s: '♠', h: '♥', d: '♦', c: '♣' }
const SUIT_NAMES: Record<CardSuit, string> = {
  s: 'spades',
  h: 'hearts',
  d: 'diamonds',
  c: 'clubs',
}

type SessionResult = PracticeSessionSubmissionResponse['data']
type AnsweredMode = Exclude<PracticeMode, 'build'>

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; mode: PracticeMode; range: RangeRead; plan: DrillPlan }

type Outcome =
  | { status: 'idle' }
  | { status: 'saving' }
  | { status: 'failed'; message: string }
  | { status: 'unanswered' }
  | { status: 'saved'; result: SessionResult }

interface RunState {
  answers: DrillAnswer[]
  prompt: PokerHand | undefined
  /** The last scored answer, kept on screen as feedback. */
  feedback: DrillAnswer | undefined
  /** True while an untimed miss or hit waits for the user to continue. */
  awaitingNext: boolean
  built: Set<string>
  startedAtMs: number
  idempotencyKey: string
}

function message(error: unknown, fallback: string): string {
  return error instanceof ApiClientError ? error.message : fallback
}

function startRun(plan: DrillPlan, mode: PracticeMode): RunState {
  const deals = mode !== 'build' && !plan.empty
  return {
    answers: [],
    prompt: deals ? drawDrillHand(plan.pool, []) : undefined,
    feedback: undefined,
    awaitingNext: false,
    built: new Set(),
    startedAtMs: Date.now(),
    idempotencyKey: crypto.randomUUID(),
  }
}

async function loadDrill(
  rangeId: string,
  mode: PracticeMode,
  handoffPool: readonly PokerHand[] | undefined,
): Promise<{ range: RangeRead; plan: DrillPlan }> {
  const needsAccuracy = mode === 'weakness' || mode === 'mistakes'
  const [rangeResponse, practiceResponse] = await Promise.all([
    getRange(rangeId),
    needsAccuracy ? getRangePractice(rangeId) : Promise.resolve(undefined),
  ])
  const range = rangeResponse.data
  return {
    range,
    plan: buildDrillPlan({
      mode,
      rangeHands: range.hands,
      handAccuracy: practiceResponse?.data.handAccuracy ?? [],
      handoffPool,
    }),
  }
}

/** Build the exact submission the mode's contract variant expects. */
function answeredSubmission(
  mode: AnsweredMode,
  rangeId: string,
  idempotencyKey: string,
  answers: readonly DrillAnswer[],
): PracticeSessionSubmission {
  const base = { rangeId, idempotencyKey, answers: toSubmissionAnswers(answers) }
  switch (mode) {
    case 'timed':
      return { mode, ...base }
    case 'weakness':
      return { mode, ...base }
    case 'edges':
      return { mode, ...base }
    case 'mistakes':
      return { mode, ...base }
    case 'recognition':
      return { mode, ...base }
  }
}

function formatDue(dueAt: string | null): string {
  if (dueAt === null) return 'not scheduled yet'
  const due = new Date(dueAt)
  return Number.isNaN(due.getTime()) ? 'not scheduled yet' : due.toLocaleDateString()
}

/**
 * A link to one drill. `count` and `seconds` are only written when they differ
 * from the default, so an ordinary mode link stays as short as the one a user
 * would type.
 */
function practiceHref(
  rangeId: string,
  mode: PracticeMode,
  options: { count?: number; seconds?: number } = {},
): string {
  const params = new URLSearchParams({ range: rangeId, mode })
  if (options.count !== undefined && options.count !== DEFAULT_QUESTION_COUNT) {
    params.set('count', String(options.count))
  }
  if (options.seconds !== undefined) params.set('seconds', String(options.seconds))
  return `/app/practice?${params.toString()}`
}

export function PracticeHost() {
  const searchParams = useSearchParams()
  const search = searchParams.toString()
  const request = useMemo(() => parseDrillRequest(new URLSearchParams(search)), [search])
  const { rangeIds, mode, questionCount, seconds, poolsKey } = request

  const [index, setIndex] = useState(0)
  const [load, setLoad] = useState<LoadState>({ status: 'loading' })
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [skipped, setSkipped] = useState<string[]>([])
  const [run, setRun] = useState<RunState>(() => ({
    answers: [],
    prompt: undefined,
    feedback: undefined,
    awaitingNext: false,
    built: new Set(),
    startedAtMs: Date.now(),
    idempotencyKey: crypto.randomUUID(),
  }))
  const [outcome, setOutcome] = useState<Outcome>({ status: 'idle' })
  const [nowMs, setNowMs] = useState(() => Date.now())
  const [notice, setNotice] = useState<string>()

  const rangeId = rangeIds[index]
  /**
   * The loaded drill, but only while it still matches the URL. Switching mode
   * (or advancing the queue) re-runs the load, and until it lands the previous
   * plan describes a drill nobody asked for — so it deals nothing and shows
   * nothing.
   */
  const drill =
    load.status === 'ready' && load.mode === mode && load.range.id === rangeId ? load : undefined

  useEffect(() => {
    if (rangeId === undefined) return
    let active = true
    // The handoff is read here rather than at render time: it is consumed once,
    // and a render can run twice before an effect ever does.
    const pools = poolsKey === undefined ? {} : readDrillPools(poolsKey)
    loadDrill(rangeId, mode, pools[rangeId])
      .then(({ range, plan }) => {
        if (!active) return
        setLoad({ status: 'ready', mode, range, plan })
        setRun(startRun(plan, mode))
        setOutcome({ status: 'idle' })
        setNowMs(Date.now())
      })
      .catch((caught: unknown) => {
        if (!active) return
        // A queue outlives the ranges in it; a deleted one is skipped, not fatal.
        if (caught instanceof ApiClientError && caught.status === 404) {
          setSkipped((current) => [...current, rangeId])
          setIndex((current) => current + 1)
          return
        }
        setLoad({ status: 'error', message: message(caught, 'We could not load this range.') })
      })
    return () => {
      active = false
    }
  }, [rangeId, mode, poolsKey, loadAttempt])

  const submit = useCallback(async (submission: PracticeSessionSubmission): Promise<void> => {
    setOutcome({ status: 'saving' })
    try {
      const response = await submitPracticeSession(submission)
      setOutcome({ status: 'saved', result: response.data })
    } catch (caught) {
      setOutcome({
        status: 'failed',
        message: message(caught, 'We could not save this practice session.'),
      })
    }
  }, [])

  const finish = useCallback(
    (endedRangeId: string, endedMode: AnsweredMode, key: string, answers: DrillAnswer[]): void => {
      if (answers.length === 0) {
        setOutcome({ status: 'unanswered' })
        return
      }
      void submit(answeredSubmission(endedMode, endedRangeId, key, answers))
    },
    [submit],
  )

  // Timed runs end themselves. The tick both drives the countdown and closes
  // the run, so the clock is the only thing that decides when time is up.
  useEffect(() => {
    if (mode !== 'timed' || drill === undefined || outcome.status !== 'idle') return
    const { startedAtMs, answers, idempotencyKey } = run
    const endedRangeId = drill.range.id
    const tick = setInterval(() => {
      const current = Date.now()
      setNowMs(current)
      if (!isDrillOver(startedAtMs, seconds, current)) return
      clearInterval(tick)
      finish(endedRangeId, 'timed', idempotencyKey, answers)
    }, 250)
    return () => clearInterval(tick)
  }, [mode, seconds, drill, outcome.status, run, finish])

  const unsaved = outcome.status !== 'saved' && (run.answers.length > 0 || run.built.size > 0)
  useEffect(() => {
    if (!unsaved) return
    const preventUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', preventUnload)
    return () => window.removeEventListener('beforeunload', preventUnload)
  }, [unsaved])

  const dealing =
    drill !== undefined && !drill.plan.empty && mode !== 'build' && outcome.status === 'idle'

  function answer(inRange: boolean): void {
    if (!drill || !dealing || run.awaitingNext || run.prompt === undefined) return
    const scored = scoreDrillAnswer(run.prompt, drill.range.hands, inRange, {
      questionId: crypto.randomUUID(),
      answeredAt: new Date().toISOString(),
    })
    const answers = [...run.answers, scored]
    // A notice about the previous run stops being true once this one starts.
    if (run.answers.length === 0) setNotice(undefined)
    if (mode === 'timed') {
      // Under the clock nothing pauses: the next hand is already on screen.
      setRun({
        ...run,
        answers,
        feedback: scored,
        prompt: drawDrillHand(drill.plan.pool, toPracticeAttempts(answers)),
      })
      return
    }
    setRun({ ...run, answers, feedback: scored, awaitingNext: true })
  }

  function next(): void {
    if (!drill || !run.awaitingNext) return
    if (run.answers.length >= questionCount) {
      finish(drill.range.id, mode as AnsweredMode, run.idempotencyKey, run.answers)
      return
    }
    setRun({
      ...run,
      awaitingNext: false,
      feedback: undefined,
      prompt: drawDrillHand(drill.plan.pool, toPracticeAttempts(run.answers)),
    })
  }

  function finishEarly(): void {
    if (!drill) return
    finish(drill.range.id, mode as AnsweredMode, run.idempotencyKey, run.answers)
  }

  function checkBuild(): void {
    if (!drill || run.built.size === 0) return
    setNotice(undefined)
    void submit({
      mode: 'build',
      rangeId: drill.range.id,
      idempotencyKey: run.idempotencyKey,
      selectedHands: [...run.built],
    })
  }

  function retrySubmit(): void {
    if (!drill) return
    if (mode === 'build') {
      checkBuild()
      return
    }
    // Same key: the server may already hold this attempt, and must not add it twice.
    finish(drill.range.id, mode as AnsweredMode, run.idempotencyKey, run.answers)
  }

  function restart(discarded: boolean): void {
    if (!drill) return
    setRun(startRun(drill.plan, mode))
    setOutcome({ status: 'idle' })
    setNowMs(Date.now())
    setNotice(discarded ? 'Those answers were discarded. Nothing was recorded.' : undefined)
  }

  function goToNextRange(): void {
    setLoad({ status: 'loading' })
    setNotice(undefined)
    setIndex((current) => current + 1)
  }

  function retryLoad(): void {
    setLoad({ status: 'loading' })
    setLoadAttempt((current) => current + 1)
  }

  // Registered every render so the handler always sees the current question;
  // a stale closure here would score an answer against the previous hand.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
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
      if (!dealing) return
      if (run.awaitingNext) {
        if (event.key !== 'Enter' && event.key !== ' ') return
        event.preventDefault()
        next()
        return
      }
      if (event.key === 'ArrowRight' || event.key === 'i' || event.key === 'I') {
        event.preventDefault()
        answer(true)
      } else if (event.key === 'ArrowLeft' || event.key === 'o' || event.key === 'O') {
        event.preventDefault()
        answer(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  if (rangeIds.length === 0) {
    return (
      <section className="library-state" aria-labelledby="practice-title">
        <p className="eyebrow">Practice</p>
        <h1 id="practice-title">Choose a range</h1>
        <p>Pick a range from your library and start a drill from its Practice link.</p>
        <Link className="button button-primary" href="/app/library">
          Go to library
        </Link>
      </section>
    )
  }

  if (rangeId === undefined) {
    return (
      <section className="library-state" role="alert">
        <h1>Nothing left to practice</h1>
        <p>
          {skipped.length > 0
            ? `${skipped.length} queued range${skipped.length === 1 ? '' : 's'} no longer exist, so there was nothing to drill.`
            : 'This queue has no ranges left.'}
        </p>
        <Link className="button button-primary" href="/app/library">
          Back to library
        </Link>
      </section>
    )
  }

  if (load.status === 'error') {
    return (
      <section className="library-state" role="alert">
        <h1>We could not load this drill</h1>
        <p>{load.message}</p>
        <button className="button button-primary" type="button" onClick={retryLoad}>
          Try again
        </button>
      </section>
    )
  }

  if (drill === undefined) {
    return (
      <p className="library-state" aria-busy="true">
        Loading this drill…
      </p>
    )
  }

  const range = drill.range
  const hasNext = index + 1 < rangeIds.length
  // Only a single range with a fresh, unstarted run can change mode: a queue is
  // one drill across several charts, a handoff pool belongs to the mode that
  // sent it, and switching mid-run would throw away answers the user gave.
  const switchable =
    rangeIds.length === 1 &&
    poolsKey === undefined &&
    outcome.status === 'idle' &&
    run.answers.length === 0 &&
    run.built.size === 0
  const remaining = getRemainingSeconds(run.startedAtMs, seconds, nowMs)

  return (
    <section className="practice" aria-labelledby="practice-title">
      <div className="practice-heading">
        <div>
          <p className="eyebrow">{MODE_LABELS[mode]} drill</p>
          <h1 id="practice-title">{range.name}</h1>
          {rangeIds.length > 1 ? (
            <p className="app-lede">
              Range {index + 1} of {rangeIds.length}
            </p>
          ) : null}
        </div>
        <Link className="text-link" href="/app/library">
          Back to library
        </Link>
      </div>

      {switchable ? (
        <ModePicker
          rangeId={range.id}
          mode={mode}
          questionCount={questionCount}
          seconds={seconds}
        />
      ) : null}

      {skipped.length > 0 ? (
        <p className="success-notice" role="status">
          {skipped.length} queued range{skipped.length === 1 ? ' was' : 's were'} skipped because
          {skipped.length === 1 ? ' it no longer exists' : ' they no longer exist'}.
        </p>
      ) : null}
      {drill.plan.notice !== undefined && !drill.plan.empty ? (
        <p className="success-notice" role="status">
          {drill.plan.notice}
        </p>
      ) : null}
      {notice !== undefined ? (
        <p className="success-notice" role="status">
          {notice}
        </p>
      ) : null}

      {drill.plan.empty ? (
        <section className="library-state">
          <h2>{drill.plan.notice}</h2>
          <p>Drill this range first, and the hands you miss will show up here.</p>
          <Link className="button button-primary" href={practiceHref(range.id, 'recognition')}>
            Practice recognition instead
          </Link>
        </section>
      ) : outcome.status === 'saved' ? (
        <SessionSummary
          result={outcome.result}
          answers={run.answers}
          built={run.built}
          mode={mode}
          rangeHands={range.hands}
          hasNext={hasNext}
          onAgain={() => restart(false)}
          onNext={goToNextRange}
        />
      ) : outcome.status === 'unanswered' ? (
        <section className="library-state" role="status">
          <h2>Time is up</h2>
          <p>You did not answer anything, so nothing was recorded.</p>
          <div className="practice-actions">
            <button className="button button-primary" type="button" onClick={() => restart(false)}>
              Practice again
            </button>
            <Link className="text-link" href="/app/library">
              Back to library
            </Link>
          </div>
        </section>
      ) : outcome.status === 'saving' ? (
        <p className="library-state" role="status" aria-busy="true">
          Saving your session…
        </p>
      ) : outcome.status === 'failed' ? (
        <section className="save-failure" role="alert">
          <h2>We could not save this session</h2>
          <p className="form-error">{outcome.message}</p>
          <p className="quiet">
            {mode === 'build'
              ? 'Your built range is still here.'
              : `Your ${run.answers.length} answer${run.answers.length === 1 ? '' : 's'} are still here.`}{' '}
            Retrying sends the same submission, so it cannot be recorded twice.
          </p>
          <div className="practice-actions">
            <button className="button button-primary" type="button" onClick={retrySubmit}>
              Retry
            </button>
            <button
              className="text-button danger-button"
              type="button"
              onClick={() => restart(true)}
            >
              Discard
            </button>
          </div>
        </section>
      ) : mode === 'build' ? (
        <BuildDrill
          built={run.built}
          onChange={(built) => setRun({ ...run, built })}
          onCheck={checkBuild}
        />
      ) : (
        <section className="drill" aria-label="Drill">
          <div className="drill-status">
            <p className="quiet">
              {mode === 'timed'
                ? `${remaining}s left · ${run.answers.length} answered`
                : `Question ${Math.min(run.answers.length + 1, questionCount)} of ${questionCount}`}
            </p>
            <button
              className="text-button"
              type="button"
              disabled={run.answers.length === 0}
              onClick={finishEarly}
            >
              Finish early
            </button>
          </div>
          {run.prompt !== undefined ? <PromptHand hand={run.prompt} /> : null}
          <div className="drill-feedback" role="status" aria-live="polite">
            {run.feedback ? (
              <>
                <p className={run.feedback.correct ? 'drill-hit' : 'drill-miss'}>
                  {run.feedback.correct ? 'Correct' : 'Missed'}
                </p>
                <p className="quiet">{explainHand(run.feedback.hand, range.hands).line}</p>
              </>
            ) : null}
          </div>
          <div className="drill-answers">
            {run.awaitingNext ? (
              <button
                className="button button-primary"
                type="button"
                aria-keyshortcuts="Enter"
                onClick={next}
              >
                {run.answers.length >= questionCount ? 'See results' : 'Next'}
              </button>
            ) : (
              <>
                <button
                  className="button button-primary"
                  type="button"
                  aria-keyshortcuts="I ArrowRight"
                  onClick={() => answer(true)}
                >
                  In range
                </button>
                <button
                  className="button"
                  type="button"
                  aria-keyshortcuts="O ArrowLeft"
                  onClick={() => answer(false)}
                >
                  Out of range
                </button>
              </>
            )}
          </div>
          <p className="quiet">
            Press I or the right arrow for in range, O or the left arrow for out of range.
          </p>
        </section>
      )}
    </section>
  )
}

/**
 * How a drill's mode is chosen. Every mode is a plain link, because the mode
 * lives in the URL: the picker is the same address bar the drill already reads,
 * so a chosen mode can be bookmarked, shared, and reloaded.
 */
function ModePicker({
  rangeId,
  mode,
  questionCount,
  seconds,
}: {
  rangeId: string
  mode: PracticeMode
  questionCount: number
  seconds: number
}) {
  return (
    <nav className="practice-modes" aria-label="Practice modes">
      <ul>
        {practiceModeValues.map((option) => (
          <li key={option}>
            <Link
              className={`mode-link${option === mode ? ' is-current' : ''}`}
              href={practiceHref(rangeId, option, {
                count: questionCount,
                ...(option === 'timed' && seconds !== DEFAULT_DRILL_SECONDS ? { seconds } : {}),
              })}
              {...(option === mode ? { 'aria-current': 'page' as const } : {})}
            >
              {MODE_LABELS[option]}
            </Link>
          </li>
        ))}
      </ul>
      {mode === 'timed' ? (
        <ul aria-label="Timed drill length">
          {DRILL_DURATION_OPTIONS.map((option) => (
            <li key={option}>
              <Link
                className={`mode-link${option === seconds ? ' is-current' : ''}`}
                href={practiceHref(rangeId, 'timed', { count: questionCount, seconds: option })}
                {...(option === seconds ? { 'aria-current': 'page' as const } : {})}
              >
                {option}s
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </nav>
  )
}

function PromptHand({ hand }: { hand: PokerHand }) {
  return (
    <div className="prompt-hand">
      <div className="playing-cards">
        {promptCards(hand).map((card, position) => (
          <span
            key={`${card.rank}${card.suit}${position}`}
            className={`playing-card playing-card-${card.suit}`}
            role="img"
            aria-label={`${card.rank} of ${SUIT_NAMES[card.suit]}`}
          >
            <span className="playing-card-rank">{card.rank}</span>
            <span aria-hidden="true">{SUIT_GLYPHS[card.suit]}</span>
          </span>
        ))}
      </div>
      {/* The deal is the question, so it has to be announced as one. */}
      <p className="visually-hidden" aria-live="polite">
        {hand}
      </p>
      <p className="prompt-hand-code" aria-hidden="true">
        {hand}
      </p>
    </div>
  )
}

function BuildDrill({
  built,
  onChange,
  onCheck,
}: {
  built: Set<string>
  onChange: (built: Set<string>) => void
  onCheck: () => void
}) {
  return (
    <section className="drill" aria-label="Build from memory">
      <p className="quiet">
        Select every hand you believe this range plays, then check it against the saved chart.
      </p>
      <HandGrid selectedHands={built} onChange={onChange} />
      <div className="practice-actions">
        <button
          className="button button-primary"
          type="button"
          disabled={built.size === 0}
          onClick={onCheck}
        >
          Check my range
        </button>
      </div>
    </section>
  )
}

function HandList({ label, hands }: { label: string; hands: readonly PokerHand[] }) {
  if (hands.length === 0) return null
  return (
    <div className="hand-list">
      <h3>
        {label} ({hands.length})
      </h3>
      <p>{hands.join(', ')}</p>
    </div>
  )
}

function SessionSummary({
  result,
  answers,
  built,
  mode,
  rangeHands,
  hasNext,
  onAgain,
  onNext,
}: {
  result: SessionResult
  answers: readonly DrillAnswer[]
  built: ReadonlySet<string>
  mode: PracticeMode
  rangeHands: readonly PokerHand[]
  hasNext: boolean
  onAgain: () => void
  onNext: () => void
}) {
  const { session, stats, review } = result
  const recap = mode === 'build' ? null : recapMisses(toPracticeAttempts(answers))
  const comparison = mode === 'build' ? compareBuiltRange([...rangeHands], [...built]) : undefined

  return (
    <section className="practice-summary" aria-label="Session summary">
      <h2>Session saved</h2>
      <p className="summary-headline">
        {session.correctAnswers} of {session.totalQuestions} correct ·{' '}
        {session.accuracyPercentage.toFixed(0)}%
      </p>
      <p className="quiet">
        This range is now {stats.accuracyPercentage.toFixed(0)}% across {stats.totalAttempts}{' '}
        answers. Next review: {formatDue(review.dueAt)}.
      </p>
      {comparison ? (
        <div className="summary-hands">
          <HandList label="Correct" hands={comparison.correct} />
          <HandList label="Missed" hands={comparison.missed} />
          <HandList label="Extra" hands={comparison.extra} />
        </div>
      ) : recap ? (
        <div className="summary-hands">
          <HandList label="Start playing" hands={recap.shouldPlay} />
          <HandList label="Start folding" hands={recap.shouldFold} />
          {recap.hiddenCount > 0 ? <p className="quiet">and {recap.hiddenCount} more.</p> : null}
        </div>
      ) : (
        <p className="quiet">No misses in this run.</p>
      )}
      <div className="practice-actions">
        <button className="button button-primary" type="button" onClick={onAgain}>
          Practice again
        </button>
        {hasNext ? (
          <button className="button" type="button" onClick={onNext}>
            Next range
          </button>
        ) : null}
        <Link className="text-link" href="/app/library">
          Back to library
        </Link>
      </div>
    </section>
  )
}
