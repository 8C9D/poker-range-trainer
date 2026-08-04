import { useEffect, useRef, useState } from 'react'
import { captureRecordingFailure, recordFinishedPracticeSession } from '../app/sessionRecording'
import { accuracyPercentage } from '../domain/accuracy'
import {
  segmentTitle,
  type DailyWorkout,
  type ReviewSegment,
  type WeakSpotsSegment,
  type FreshSpotsSegment,
} from '../domain/dailyWorkout'
import { recapMisses } from '../domain/missRecap'
import { currentStreak } from '../domain/spacedRepetition'
import type { SpotSessionResult } from '../domain/spotDrill'
import { evaluateDailyGoal, goalLine } from '../domain/trainingGoal'
import { sessionsForLibrary } from '../domain/weeklyStats'
import { loadSessionHistory } from '../storage/sessionHistoryStorage'
import { recordSpotAccuracy } from '../storage/spotAccuracyStorage'
import { loadTrainingGoal } from '../storage/trainingGoalStorage'
import { recordWorkoutCompletion } from '../storage/workoutStorage'
import type { PracticeAttempt } from '../types/practice'
import type { SavedRange } from '../types/range'
import { OverlayFrame } from './OverlayFrame'
import { RecognitionDrill } from './RecognitionDrill'
import { SessionSummary, type SessionSummaryData } from './SessionSummary'
import { SpotDrill } from './SpotDrill'

interface WorkoutHostProps {
  workout: DailyWorkout
  /** The whole library; the spot segments pick the range each spot needs. */
  ranges: SavedRange[]
  onClose: () => void
}

interface SegmentTally {
  total: number
  correct: number
}

/**
 * Runs the daily workout (v9.1): the plan's segments back-to-back in the
 * practice overlay, a hand-off screen before each one, and one combined
 * summary at the end. Each segment records through its drill's existing
 * recorder, so stats, schedules, and per-spot accuracy advance exactly as if
 * the drills were run by hand. Closing early keeps what was answered and
 * jumps to the summary; closing before answering anything abandons the run.
 */
export function WorkoutHost({ workout, ranges, onClose }: WorkoutHostProps) {
  const { segments } = workout
  const [segmentIndex, setSegmentIndex] = useState(0)
  const [rangeIndex, setRangeIndex] = useState(0)
  const [phase, setPhase] = useState<
    { kind: 'handoff' } | { kind: 'drill' } | { kind: 'summary'; data: SessionSummaryData }
  >({ kind: 'handoff' })
  // A ref, not state: tallies are written and then read in the same handler
  // (record -> maybe show summary), and the summary snapshot is taken there
  // too, so render never touches the ref.
  const talliesRef = useRef<SegmentTally[]>(segments.map(() => ({ total: 0, correct: 0 })))
  // The first segment save that failed, held for the end-of-run summary. A
  // workout records segment by segment, so the failure has to survive the parts
  // that came after it rather than being reported where it happened.
  const saveErrorRef = useRef<string | null>(null)
  // Misses from every segment, so the one combined summary recaps the whole
  // workout rather than only whichever part happened to end it. Same reason as
  // the tallies above for being a ref.
  const missedRef = useRef<PracticeAttempt[]>([])

  const answeredSoFar = () => talliesRef.current.reduce((sum, tally) => sum + tally.total, 0)

  /** Record a segment, keeping the first failure instead of losing the run to it. */
  function record(persist: () => void) {
    const failure = captureRecordingFailure(persist)
    if (failure && saveErrorRef.current === null) saveErrorRef.current = failure
  }

  function addTally(attempts: PracticeAttempt[]) {
    const tally = talliesRef.current[segmentIndex]
    tally.total += attempts.length
    tally.correct += attempts.filter((attempt) => attempt.correct).length
    missedRef.current.push(...attempts.filter((attempt) => !attempt.correct))
  }

  function showSummary(completed: boolean) {
    const now = new Date().toISOString()
    // Only a run that made it through every segment counts as today's workout;
    // an early exit keeps its answers but leaves the card offering the plan.
    if (completed) record(() => recordWorkoutCompletion(now))
    const total = answeredSoFar()
    const correct = talliesRef.current.reduce((sum, tally) => sum + tally.correct, 0)
    const contributions = segments
      .map((segment, index) => ({ segment, tally: talliesRef.current[index] }))
      .filter(({ tally }) => tally.total > 0)
      .map(
        ({ segment, tally }) => `${segmentTitle(segment.kind)} ${tally.correct}/${tally.total}`,
      )
    const history = sessionsForLibrary(loadSessionHistory(), ranges)
    const playedAt = Object.values(history)
      .flat()
      .map((session) => session.playedAt)
    const streak = currentStreak(playedAt, now)
    const goalProgress = evaluateDailyGoal(history, now, loadTrainingGoal())
    const contributionLine = contributions.join(' · ')
    setPhase({
      kind: 'summary',
      data: {
        totalQuestions: total,
        correctAnswers: correct,
        accuracy: accuracyPercentage(correct, total),
        deltaLine: completed ? contributionLine : `Stopped early · ${contributionLine}`,
        goalLine: goalProgress.target > 0 ? goalLine(goalProgress) : null,
        streakLine:
          streak > 0 ? `${streak}-day streak — see you tomorrow to keep it going.` : null,
        misses: recapMisses(missedRef.current),
        saveError: saveErrorRef.current,
      },
    })
  }

  /** Leave the run: nothing answered = abandon, anything answered = summary. */
  function exit() {
    if (answeredSoFar() === 0) onClose()
    else showSummary(false)
  }

  // Enter starts the next part, so a keyboard-driven workout flows from
  // hand-off to drill without the mouse. Only the hand-off listens: the drills
  // and the summary own their own keys. A focused button keeps its native
  // Enter click.
  const onHandoff = phase.kind === 'handoff'
  useEffect(() => {
    if (!onHandoff) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.repeat || event.altKey || event.ctrlKey || event.metaKey) return
      if (event.key !== 'Enter') return
      const target = event.target
      if (
        target instanceof HTMLButtonElement ||
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return
      }
      event.preventDefault()
      setPhase({ kind: 'drill' })
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onHandoff])

  function advance() {
    if (segmentIndex + 1 < segments.length) {
      setSegmentIndex(segmentIndex + 1)
      setRangeIndex(0)
      setPhase({ kind: 'handoff' })
    } else {
      showSummary(true)
    }
  }

  function finishReviewRange(segment: ReviewSegment, attempts: PracticeAttempt[]) {
    if (attempts.length > 0) {
      record(() => recordFinishedPracticeSession(segment.ranges[rangeIndex].id, attempts))
      addTally(attempts)
    }
    if (attempts.length < segment.questionsPerRange) {
      exit()
      return
    }
    if (rangeIndex + 1 < segment.ranges.length) setRangeIndex(rangeIndex + 1)
    else advance()
  }

  function finishSpotSegment(
    segment: WeakSpotsSegment | FreshSpotsSegment,
    result: SpotSessionResult,
  ) {
    const all = Object.values(result.byRange).flat()
    if (all.length > 0) {
      record(() => {
        for (const [rangeId, attempts] of Object.entries(result.byRange)) {
          recordFinishedPracticeSession(rangeId, attempts)
        }
        recordSpotAccuracy(result.bySpot)
      })
      addTally(all)
    }
    if (all.length < segment.questionCount) exit()
    else advance()
  }

  if (phase.kind === 'summary') {
    return (
      <OverlayFrame title="Daily workout" progress={1} onClose={onClose}>
        <SessionSummary data={phase.data} hasNext={false} onNext={onClose} onDone={onClose} />
      </OverlayFrame>
    )
  }

  const segment = segments[segmentIndex]

  if (phase.kind === 'handoff') {
    return (
      <OverlayFrame
        title="Daily workout"
        position={`Part ${segmentIndex + 1} of ${segments.length}`}
        progress={segmentIndex / segments.length}
        onClose={exit}
      >
        <div className="drill-center workout-handoff">
          <h2>{segmentTitle(segment.kind)}</h2>
          <p className="workout-handoff-reason">{segment.reason}</p>
          <button
            type="button"
            className="coach-btn primary"
            aria-keyshortcuts="Enter"
            onClick={() => setPhase({ kind: 'drill' })}
          >
            {segmentIndex === 0 ? 'Start' : 'Continue'}
          </button>
        </div>
      </OverlayFrame>
    )
  }

  if (segment.kind === 'review') {
    return (
      <RecognitionDrill
        key={`${segmentIndex}-${rangeIndex}`}
        range={segment.ranges[rangeIndex]}
        variant="standard"
        questionCount={segment.questionsPerRange}
        position={
          segment.ranges.length > 1 ? `${rangeIndex + 1}/${segment.ranges.length}` : null
        }
        onFinish={(attempts) => finishReviewRange(segment, attempts)}
      />
    )
  }

  return (
    <SpotDrill
      key={segmentIndex}
      ranges={ranges}
      tableSize={segment.format.tableSize}
      stackDepthBb={segment.format.stackDepthBb}
      spotKeys={segment.spotKeys}
      questionCount={segment.questionCount}
      onFinish={(result) => finishSpotSegment(segment, result)}
    />
  )
}
