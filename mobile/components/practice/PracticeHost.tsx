import { useState } from 'react';
import { useRouter } from 'expo-router';

import { accuracyPercentage } from '@core/domain/accuracy';
import { rangeEdgeHands } from '@core/domain/edgeHands';
import { recapMisses } from '@core/domain/missRecap';
import type { PokerHand } from '@core/domain/pokerHands';
import { summarizePracticeAttempts } from '@core/domain/practice';
import type { SpotSessionResult } from '@core/domain/spotDrill';
import { currentStreak } from '@core/domain/spacedRepetition';
import { DEFAULT_DRILL_SECONDS } from '@core/domain/timedDrill';
import { sessionsForLibrary } from '@core/domain/weeklyStats';
import { loadSavedRanges } from '@core/storage/rangeStorage';
import { loadSessionHistory } from '@core/storage/sessionHistoryStorage';
import { recordSpotAccuracy } from '@core/storage/spotAccuracyStorage';
import type { PracticeAttempt } from '@core/types/practice';
import type { SavedRange, TableSize } from '@core/types/range';

import { ActionQuizDrill } from './ActionQuizDrill';
import { BuildDrill } from './BuildDrill';
import { ComboDrill } from './ComboDrill';
import { MixedQuizDrill } from './MixedQuizDrill';
import { ModePicker, type PracticeMode } from './ModePicker';
import { OverlayFrame } from './OverlayFrame';
import { RecognitionDrill } from './RecognitionDrill';
import { SpotDrill } from './SpotDrill';
import { SessionSummary, type SessionSummaryData } from './SessionSummary';
import { captureRecordingFailure, recordFinishedPracticeSession } from '../../lib/sessionRecording';

export interface PracticeRequest {
  /** The queue of ranges to drill (usually one; the review queue passes many). */
  ranges: SavedRange[];
  /** The preset mode, or null to open the mode picker. */
  mode: PracticeMode | null;
  /** Restrict recognition prompts to these hands (a single-range weak-hands pool). */
  handPool?: PokerHand[];
  /** Per-range pools for multi-range weak-hand drills, keyed by range id. */
  handPools?: Record<string, PokerHand[]>;
  /** The format the 'spots' drill deals from; ignored by every other mode. */
  spotFormat?: { tableSize: TableSize; stackDepthBb: number };
  /** Restrict the 'spots' drill to these spots (drilling one weak spot). */
  spotKeys?: string[];
}

// Modes rendered inline in the overlay; postflop/board route out to their own drill
// screens by design (overlay-inlining was considered and deferred at the Coach port).
type InlineMode =
  | 'recognize'
  | 'spots'
  | 'weakness'
  | 'edges'
  | 'timed'
  | 'build'
  | 'action'
  | 'mixed'
  | 'combo';
const INLINE_MODES = new Set<PracticeMode>([
  'recognize',
  'spots',
  'weakness',
  'edges',
  'timed',
  'build',
  'action',
  'mixed',
  'combo',
]);
const FLAT_ROUTE: Record<'postflop' | 'board', string> = {
  postflop: '/postflop',
  board: '/board',
};

type Phase =
  | { kind: 'picker' }
  | {
      kind: 'drill';
      mode: InlineMode;
      durationSeconds: number;
      /** Overrides the request's pool — set when re-drilling a session's misses. */
      handPool?: PokerHand[];
    }
  | {
      kind: 'summary';
      data: SessionSummaryData;
      /** The hands to re-drill, or null when the run cannot offer one. */
      missedHands: PokerHand[] | null;
    };

/**
 * The distinct hands a session got wrong, in first-missed order, or null when
 * there were none. This is the pool a re-drill deals from, so it stays at hand
 * granularity — the recap's play/fold split is for reading, not for dealing.
 */
function missedHandsOf(attempts: PracticeAttempt[]): PokerHand[] | null {
  const missed = [...new Set(attempts.filter((a) => !a.correct).map((a) => a.hand))];
  return missed.length > 0 ? missed : null;
}

/** Growth-framed comparison of this session against the range's previous one. */
function deltaLineFor(accuracy: number, prevAccuracy: number | null, misses: number): string {
  if (prevAccuracy === null) return 'First session logged — that’s your baseline.';
  const delta = Math.round(accuracy - prevAccuracy);
  if (delta > 0) return `Up ${delta} point${delta === 1 ? '' : 's'} from your last session.`;
  if (delta === 0) return `Held steady at ${accuracy.toFixed(0)}%.`;
  return misses > 0
    ? `${misses} miss${misses === 1 ? '' : 'es'} queued for review — they’ll show up more until they stick.`
    : 'A touch below your usual — it happens.';
}

interface PracticeHostProps {
  request: PracticeRequest;
  onClose: () => void;
}

/**
 * Orchestrates a practice run: mode picker -> full-screen drill -> peak-end summary,
 * advancing through the queued ranges one session at a time. Results persist through the
 * shared session recorder the moment a recognition drill ends. Only postflop/board route
 * out to their own drill screens; every other mode renders inline in the overlay.
 */
export function PracticeHost({ request, onClose }: PracticeHostProps) {
  const router = useRouter();
  /**
   * The library the streak counts: what is saved, plus whatever this run is
   * drilling. Sessions recorded against ranges that have since gone away would
   * otherwise inflate the streak past the one the Today screen shows, and the
   * queue is included so a run started from something not yet in the library
   * still counts the session it just recorded.
   */
  const livePlusDrilled = () => [...loadSavedRanges(), ...request.ranges];
  const [index, setIndex] = useState(0);
  // Bumped for every drill start so a re-drill of the same range remounts the
  // component instead of resuming the finished session behind the summary.
  const [run, setRun] = useState(0);
  const [phase, setPhase] = useState<Phase>(() =>
    request.mode && INLINE_MODES.has(request.mode)
      ? { kind: 'drill', mode: request.mode as InlineMode, durationSeconds: DEFAULT_DRILL_SECONDS }
      : { kind: 'picker' },
  );

  const range = request.ranges[index];
  if (!range) return null;
  const hasNext = index + 1 < request.ranges.length;
  const position = request.ranges.length > 1 ? `${index + 1}/${request.ranges.length}` : null;

  const runMode = (mode: PracticeMode, opts?: { durationSeconds?: number }) => {
    if (INLINE_MODES.has(mode)) {
      setPhase({
        kind: 'drill',
        mode: mode as InlineMode,
        durationSeconds: opts?.durationSeconds ?? DEFAULT_DRILL_SECONDS,
      });
      return;
    }
    router.replace({
      pathname: FLAT_ROUTE[mode as keyof typeof FLAT_ROUTE],
      params: { id: range.id },
    });
  };

  const finishRecognition = (attempts: PracticeAttempt[]) => {
    // Closing before answering anything abandons the run without recording.
    if (attempts.length === 0) {
      onClose();
      return;
    }
    const prevSessions = loadSessionHistory()[range.id] ?? [];
    const last = prevSessions[prevSessions.length - 1];
    const prevAccuracy = last ? accuracyPercentage(last.correctAnswers, last.totalQuestions) : null;
    const saveError = captureRecordingFailure(() =>
      recordFinishedPracticeSession(range.id, attempts),
    );
    const summary = summarizePracticeAttempts(attempts);
    const misses = attempts.filter((attempt) => !attempt.correct).length;
    const playedAt = Object.values(sessionsForLibrary(loadSessionHistory(), livePlusDrilled()))
      .flat()
      .map((session) => session.playedAt);
    const streak = currentStreak(playedAt, new Date().toISOString());
    setPhase({
      kind: 'summary',
      data: {
        totalQuestions: summary.totalQuestions,
        correctAnswers: summary.correctAnswers,
        accuracy: summary.accuracyPercentage,
        deltaLine: deltaLineFor(summary.accuracyPercentage, prevAccuracy, misses),
        streakLine: streak > 0 ? `${streak}-day streak — see you tomorrow to keep it going.` : null,
        misses: recapMisses(attempts),
        saveError,
      },
      missedHands: missedHandsOf(attempts),
    });
  };

  /**
   * The spot drill answers questions from several ranges in one session, so each
   * range's attempts are recorded as its own session and the summary sums them.
   */
  const finishSpots = ({ byRange, bySpot }: SpotSessionResult) => {
    const all = Object.values(byRange).flat();
    if (all.length === 0) {
      onClose();
      return;
    }
    const saveError = captureRecordingFailure(() => {
      for (const [rangeId, attempts] of Object.entries(byRange)) {
        recordFinishedPracticeSession(rangeId, attempts);
      }
      recordSpotAccuracy(bySpot);
    });
    const summary = summarizePracticeAttempts(all);
    const rangeCount = Object.keys(byRange).length;
    const playedAt = Object.values(sessionsForLibrary(loadSessionHistory(), livePlusDrilled()))
      .flat()
      .map((session) => session.playedAt);
    const streak = currentStreak(playedAt, new Date().toISOString());
    setPhase({
      kind: 'summary',
      data: {
        totalQuestions: summary.totalQuestions,
        correctAnswers: summary.correctAnswers,
        accuracy: summary.accuracyPercentage,
        deltaLine: `Across ${rangeCount} range${rangeCount === 1 ? '' : 's'} of your library.`,
        streakLine: streak > 0 ? `${streak}-day streak — see you tomorrow to keep it going.` : null,
        misses: recapMisses(all),
        saveError,
      },
      // A spot session's misses span the library, so re-drilling them means
      // re-queueing several ranges — more than this single-range host can do.
      missedHands: null,
    });
  };

  const nextRange = () => {
    setIndex(index + 1);
    setRun(run + 1);
    setPhase({
      kind: 'drill',
      mode: request.mode && INLINE_MODES.has(request.mode) ? (request.mode as InlineMode) : 'recognize',
      durationSeconds: DEFAULT_DRILL_SECONDS,
    });
  };

  /** Re-run the current range as a recognition drill over just its misses. */
  const drillMisses = (handPool: PokerHand[]) => {
    setRun(run + 1);
    setPhase({ kind: 'drill', mode: 'recognize', durationSeconds: DEFAULT_DRILL_SECONDS, handPool });
  };

  if (phase.kind === 'picker') {
    return (
      <OverlayFrame title={range.name || 'Untitled'} onClose={onClose}>
        <ModePicker range={range} onPick={runMode} />
      </OverlayFrame>
    );
  }

  if (phase.kind === 'summary') {
    // A spot session spans the library, so it is not titled after one range.
    const spots = request.mode === 'spots';
    return (
      <OverlayFrame
        title={spots ? 'Play the spot' : range.name || 'Untitled'}
        position={spots ? null : position}
        progress={1}
        onClose={onClose}
      >
        <SessionSummary
          data={phase.data}
          hasNext={!spots && hasNext}
          onNext={nextRange}
          onDone={onClose}
          onDrillMisses={
            phase.missedHands ? () => drillMisses(phase.missedHands as PokerHand[]) : undefined
          }
        />
      </OverlayFrame>
    );
  }

  if (phase.mode === 'spots') {
    return (
      <SpotDrill
        ranges={request.ranges}
        tableSize={request.spotFormat?.tableSize ?? 'sixMax'}
        stackDepthBb={request.spotFormat?.stackDepthBb ?? 100}
        spotKeys={request.spotKeys}
        onFinish={finishSpots}
      />
    );
  }

  if (phase.mode === 'build') {
    return (
      <OverlayFrame title={`${range.name || 'Untitled'} — build from memory`} onClose={onClose}>
        <BuildDrill id={range.id} />
      </OverlayFrame>
    );
  }
  if (phase.mode === 'action') {
    return (
      <OverlayFrame title={`${range.name || 'Untitled'} — action quiz`} onClose={onClose}>
        <ActionQuizDrill id={range.id} />
      </OverlayFrame>
    );
  }
  if (phase.mode === 'mixed') {
    return (
      <OverlayFrame title={`${range.name || 'Untitled'} — frequency quiz`} onClose={onClose}>
        <MixedQuizDrill id={range.id} />
      </OverlayFrame>
    );
  }
  if (phase.mode === 'combo') {
    return (
      <OverlayFrame title={`${range.name || 'Untitled'} — combo drill`} onClose={onClose}>
        <ComboDrill id={range.id} />
      </OverlayFrame>
    );
  }

  const variant = phase.mode === 'timed' ? 'timed' : phase.mode === 'weakness' ? 'weakness' : 'standard';
  return (
    <RecognitionDrill
      key={`${range.id}-${index}-${run}`}
      range={range}
      variant={variant}
      handPool={
        phase.mode === 'edges'
          ? rangeEdgeHands(range.hands)
          : phase.mode === 'recognize'
            ? (phase.handPool ?? request.handPool ?? request.handPools?.[range.id])
            : undefined
      }
      durationSeconds={phase.durationSeconds}
      position={position}
      onFinish={finishRecognition}
    />
  );
}
