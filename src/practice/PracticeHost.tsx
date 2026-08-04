import { useState } from 'react'
import { captureRecordingFailure, recordFinishedPracticeSession } from '../app/sessionRecording'
import { ActionQuiz } from '../components/ActionQuiz'
import { BuildFromMemoryPractice } from '../components/BuildFromMemoryPractice'
import { ComboBlockerDrill } from '../components/ComboBlockerDrill'
import { MixedActionQuiz } from '../components/MixedActionQuiz'
import { PostflopDrillSetup } from '../components/PostflopDrillSetup'
import { PostflopPractice } from '../components/PostflopPractice'
import { RangeVsBoard } from '../components/RangeVsBoard'
import { accuracyPercentage } from '../domain/accuracy'
import { summarizeActionAccuracy } from '../domain/actionRange'
import { selectionForRange } from '../domain/comboSelection'
import { recapMisses } from '../domain/missRecap'
import type { PokerHand } from '../domain/pokerHands'
import type { SpotSessionResult } from '../domain/spotDrill'
import type { PostflopScenario } from '../domain/postflopScenario'
import { summarizePracticeAttempts } from '../domain/practice'
import { currentStreak } from '../domain/spacedRepetition'
import { DEFAULT_DRILL_SECONDS } from '../domain/timedDrill'
import { recordActionAccuracy } from '../storage/actionAccuracyStorage'
import { sessionsForLibrary } from '../domain/weeklyStats'
import { loadSavedRanges } from '../storage/rangeStorage'
import { loadSessionHistory } from '../storage/sessionHistoryStorage'
import { recordSpotAccuracy } from '../storage/spotAccuracyStorage'
import type { ActionAttempt, PracticeAttempt } from '../types/practice'
import type { SavedRange, TableSize } from '../types/range'
import { rangeEdgeHands } from '../domain/edgeHands'
import { ModePicker, type PracticeMode } from './ModePicker'
import { OverlayFrame } from './OverlayFrame'
import { RecognitionDrill } from './RecognitionDrill'
import { SpotDrill } from './SpotDrill'
import { SessionSummary, type SessionSummaryData } from './SessionSummary'

export interface PracticeRequest {
  /** The queue of ranges to drill (usually one; the review queue passes many). */
  ranges: SavedRange[]
  /** The preset mode, or null to open the mode picker. */
  mode: PracticeMode | null
  /** Restrict recognition prompts to these hands (the weak-hands pool). */
  handPool?: PokerHand[]
  /** Per-range pools for multi-range weak-hand drills, keyed by range id. */
  handPools?: Record<string, PokerHand[]>
  /** The format the 'spots' drill deals from; ignored by every other mode. */
  spotFormat?: { tableSize: TableSize; stackDepthBb: number }
  /** Restrict the 'spots' drill to these spots (drilling one weak spot). */
  spotKeys?: string[]
}

interface PracticeHostProps {
  request: PracticeRequest
  onClose: () => void
}

type Phase =
  | { kind: 'picker' }
  | { kind: 'drill'; mode: PracticeMode; durationSeconds: number }
  | { kind: 'summary'; data: SessionSummaryData }

/** Growth-framed comparison of this session against the range's previous one. */
function deltaLineFor(accuracy: number, prevAccuracy: number | null, misses: number): string {
  if (prevAccuracy === null) return 'First session logged — that’s your baseline.'
  const delta = Math.round(accuracy - prevAccuracy)
  if (delta > 0) return `Up ${delta} point${delta === 1 ? '' : 's'} from your last session.`
  if (delta === 0) return `Held steady at ${accuracy.toFixed(0)}%.`
  return misses > 0
    ? `${misses} miss${misses === 1 ? '' : 'es'} queued for review — they’ll show up more until they stick.`
    : 'A touch below your usual — it happens.'
}

/**
 * Orchestrates a practice run: mode picker -> full-screen drill -> peak-end
 * summary, advancing through the queued ranges one session at a time. Results
 * are persisted through the shared session recorder the moment a drill ends.
 */
export function PracticeHost({ request, onClose }: PracticeHostProps) {
  /**
   * The library the streak counts: what is saved, plus whatever this run is
   * drilling. Sessions recorded against ranges that have since gone away would
   * otherwise inflate the streak past the one the Today screen shows, and the
   * queue is included so a run started from something not yet in the library
   * still counts the session it just recorded.
   */
  const livePlusDrilled = () => [...loadSavedRanges(), ...request.ranges]

  const [index, setIndex] = useState(0)
  const [phase, setPhase] = useState<Phase>(() =>
    request.mode
      ? { kind: 'drill', mode: request.mode, durationSeconds: DEFAULT_DRILL_SECONDS }
      : { kind: 'picker' },
  )
  // Postflop drill sub-state: building the scenario, then practicing it.
  const [postflopScenario, setPostflopScenario] = useState<PostflopScenario | null>(null)

  const range = request.ranges[index]
  if (!range) return null
  const hasNext = index + 1 < request.ranges.length
  const position = request.ranges.length > 1 ? `${index + 1}/${request.ranges.length}` : null

  const finishRecognition = (attempts: PracticeAttempt[]) => {
    // Closing before answering anything abandons the run without recording.
    if (attempts.length === 0) {
      onClose()
      return
    }
    const prevSessions = loadSessionHistory()[range.id] ?? []
    const last = prevSessions[prevSessions.length - 1]
    const prevAccuracy = last
      ? accuracyPercentage(last.correctAnswers, last.totalQuestions)
      : null
    const saveError = captureRecordingFailure(() =>
      recordFinishedPracticeSession(range.id, attempts),
    )
    const summary = summarizePracticeAttempts(attempts)
    const misses = attempts.filter((attempt) => !attempt.correct).length
    const playedAt = Object.values(sessionsForLibrary(loadSessionHistory(), livePlusDrilled()))
      .flat()
      .map((session) => session.playedAt)
    const streak = currentStreak(playedAt, new Date().toISOString())
    setPhase({
      kind: 'summary',
      data: {
        totalQuestions: summary.totalQuestions,
        correctAnswers: summary.correctAnswers,
        accuracy: summary.accuracyPercentage,
        deltaLine: deltaLineFor(summary.accuracyPercentage, prevAccuracy, misses),
        streakLine:
          streak > 0 ? `${streak}-day streak — see you tomorrow to keep it going.` : null,
        misses: recapMisses(attempts),
        saveError,
      },
    })
  }

  const finishActionQuiz = (attempts: ActionAttempt[]) => {
    if (attempts.length === 0) {
      onClose()
      return
    }
    const saveError = captureRecordingFailure(() =>
      recordActionAccuracy(range.id, summarizeActionAccuracy(attempts)),
    )
    const correct = attempts.filter((attempt) => attempt.correct).length
    setPhase({
      kind: 'summary',
      data: {
        totalQuestions: attempts.length,
        correctAnswers: correct,
        accuracy: accuracyPercentage(correct, attempts.length),
        deltaLine: null,
        streakLine: null,
        saveError,
      },
    })
  }

  /**
   * The spot drill answers questions from several ranges in one session, so each
   * range's attempts are recorded as its own session and the summary sums them.
   */
  const finishSpots = ({ byRange, bySpot }: SpotSessionResult) => {
    const all = Object.values(byRange).flat()
    if (all.length === 0) {
      onClose()
      return
    }
    const saveError = captureRecordingFailure(() => {
      for (const [rangeId, attempts] of Object.entries(byRange)) {
        recordFinishedPracticeSession(rangeId, attempts)
      }
      recordSpotAccuracy(bySpot)
    })
    const summary = summarizePracticeAttempts(all)
    const rangeCount = Object.keys(byRange).length
    const playedAt = Object.values(sessionsForLibrary(loadSessionHistory(), livePlusDrilled()))
      .flat()
      .map((session) => session.playedAt)
    const streak = currentStreak(playedAt, new Date().toISOString())
    setPhase({
      kind: 'summary',
      data: {
        totalQuestions: summary.totalQuestions,
        correctAnswers: summary.correctAnswers,
        accuracy: summary.accuracyPercentage,
        deltaLine: `Across ${rangeCount} range${rangeCount === 1 ? '' : 's'} of your library.`,
        streakLine:
          streak > 0 ? `${streak}-day streak — see you tomorrow to keep it going.` : null,
        misses: recapMisses(all),
        saveError,
      },
    })
  }

  const nextRange = () => {
    setIndex(index + 1)
    setPostflopScenario(null)
    setPhase({
      kind: 'drill',
      mode: request.mode ?? 'recognize',
      durationSeconds: DEFAULT_DRILL_SECONDS,
    })
  }

  if (phase.kind === 'picker') {
    return (
      <OverlayFrame title={range.name} onClose={onClose}>
        <ModePicker
          range={range}
          onPick={(mode, opts) =>
            setPhase({
              kind: 'drill',
              mode,
              durationSeconds: opts?.durationSeconds ?? DEFAULT_DRILL_SECONDS,
            })
          }
        />
      </OverlayFrame>
    )
  }

  if (phase.kind === 'summary') {
    // A spot session spans the library, so it is not titled after one range.
    const spots = request.mode === 'spots'
    return (
      <OverlayFrame
        title={spots ? 'Play the spot' : range.name}
        position={spots ? null : position}
        progress={1}
        onClose={onClose}
      >
        <SessionSummary
          data={phase.data}
          hasNext={!spots && hasNext}
          onNext={nextRange}
          onDone={onClose}
        />
      </OverlayFrame>
    )
  }

  switch (phase.mode) {
    case 'spots':
      return (
        <SpotDrill
          ranges={request.ranges}
          tableSize={request.spotFormat?.tableSize ?? 'sixMax'}
          stackDepthBb={request.spotFormat?.stackDepthBb ?? 100}
          spotKeys={request.spotKeys}
          onFinish={finishSpots}
        />
      )
    case 'recognize':
      return (
        <RecognitionDrill
          key={`${range.id}-${index}`}
          range={range}
          variant="standard"
          handPool={request.handPool ?? request.handPools?.[range.id]}
          position={position}
          onFinish={finishRecognition}
        />
      )
    case 'edges':
      return (
        <RecognitionDrill
          key={`${range.id}-${index}`}
          range={range}
          variant="standard"
          handPool={rangeEdgeHands(range.hands)}
          position={position}
          onFinish={finishRecognition}
        />
      )
    case 'weakness':
      return (
        <RecognitionDrill
          key={`${range.id}-${index}`}
          range={range}
          variant="weakness"
          position={position}
          onFinish={finishRecognition}
        />
      )
    case 'timed':
      return (
        <RecognitionDrill
          key={`${range.id}-${index}`}
          range={range}
          variant="timed"
          durationSeconds={phase.durationSeconds}
          position={position}
          onFinish={finishRecognition}
        />
      )
    case 'build':
      return (
        <OverlayFrame title={`${range.name} — build from memory`} onClose={onClose}>
          <BuildFromMemoryPractice range={range} onExit={onClose} />
        </OverlayFrame>
      )
    case 'action':
      return (
        <OverlayFrame title={`${range.name} — action quiz`} onClose={onClose}>
          <ActionQuiz range={range} onExit={finishActionQuiz} />
        </OverlayFrame>
      )
    case 'mixed':
      return (
        <OverlayFrame title={`${range.name} — frequency quiz`} onClose={onClose}>
          <MixedActionQuiz range={range} onExit={onClose} />
        </OverlayFrame>
      )
    case 'combo':
      return (
        <OverlayFrame title={`${range.name} — combo drill`} onClose={onClose}>
          <ComboBlockerDrill
            hands={range.hands}
            selection={selectionForRange(range.hands, range.comboSelections)}
            onExit={onClose}
          />
        </OverlayFrame>
      )
    case 'postflop':
      return (
        <OverlayFrame title="Postflop drill" onClose={onClose}>
          {postflopScenario ? (
            <PostflopPractice scenario={postflopScenario} onExit={onClose} />
          ) : (
            <PostflopDrillSetup onStart={setPostflopScenario} onExit={onClose} />
          )}
        </OverlayFrame>
      )
    case 'board':
      return (
        <OverlayFrame title={`${range.name} — range vs board`} onClose={onClose}>
          <RangeVsBoard hands={range.hands} />
        </OverlayFrame>
      )
  }
}
