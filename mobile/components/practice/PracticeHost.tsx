import { useRef, useState } from 'react';
import { useRouter } from 'expo-router';

import { accuracyPercentage } from '@core/domain/accuracy';
import { rangeEdgeHands } from '@core/domain/edgeHands';
import { recapActionMisses, recapMisses } from '@core/domain/missRecap';
import type { PokerHand } from '@core/domain/pokerHands';
import { summarizePracticeAttempts } from '@core/domain/practice';
import type { SpotSessionResult } from '@core/domain/spotDrill';
import { currentStreak } from '@core/domain/spacedRepetition';
import { DEFAULT_DRILL_SECONDS } from '@core/domain/timedDrill';
import { sessionsForLibrary } from '@core/domain/weeklyStats';
import { loadSavedRanges } from '@core/storage/rangeStorage';
import { loadSessionHistory } from '@core/storage/sessionHistoryStorage';
import { recordSpotAccuracy } from '@core/storage/spotAccuracyStorage';
import type { ActionAttempt, PracticeAttempt } from '@core/types/practice';
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
import {
  captureRecordingFailure,
  recordFinishedActionSession,
  recordFinishedPracticeSession,
} from '../../lib/sessionRecording';

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

/** How a finished run can be replayed over just what it got wrong. */
type Redrill =
  /** Re-run the current range as recognition over the hands it missed. */
  | { kind: 'hands'; hands: PokerHand[] }
  /** Re-run the action quiz over the hands whose action it got wrong. */
  | { kind: 'actionHands'; hands: PokerHand[] }
  /** Re-run the frequency quiz over the hands whose primary action it got wrong. */
  | { kind: 'mixedHands'; hands: PokerHand[] }
  /** Re-run a queue of ranges, each over its own misses (a spot run spans several). */
  | { kind: 'queue'; ranges: SavedRange[]; handPools: Record<string, PokerHand[]> };

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
      /** How to re-drill the run's misses, or null when it cannot offer one. */
      redrill: Redrill | null;
    };

/**
 * What the host is drilling right now: the request as it arrived, or the
 * recognition queue a finished run spawned by re-drilling its misses.
 */
interface Queue {
  ranges: SavedRange[];
  mode: PracticeMode | null;
  handPools?: Record<string, PokerHand[]>;
}

/**
 * The distinct hands a session got wrong, in first-missed order, or null when
 * there were none. This is the pool a re-drill deals from, so it stays at hand
 * granularity — the recap's play/fold split is for reading, not for dealing.
 */
function missedHandsOf(attempts: PracticeAttempt[]): PokerHand[] | null {
  const missed = [...new Set(attempts.filter((a) => !a.correct).map((a) => a.hand))];
  return missed.length > 0 ? missed : null;
}

/** The distinct hands an action quiz assigned the wrong action to, or null. */
function missedActionHandsOf(attempts: ActionAttempt[]): PokerHand[] | null {
  const missed = [...new Set(attempts.filter((a) => !a.correct).map((a) => a.hand))];
  return missed.length > 0 ? missed : null;
}

/** The same, per range, for a session graded against more than one of them. */
function missedPoolsOf(byRange: Record<string, PracticeAttempt[]>): Record<string, PokerHand[]> {
  const pools: Record<string, PokerHand[]> = {};
  for (const [rangeId, attempts] of Object.entries(byRange)) {
    const missed = missedHandsOf(attempts);
    if (missed) pools[rangeId] = missed;
  }
  return pools;
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
  const livePlusDrilled = () => [...loadSavedRanges(), ...queue.ranges];

  /**
   * The streak as it stands now — read AFTER the session is recorded, so the run that
   * just finished is counted. Null at zero, where there is nothing to claim.
   */
  const streakLine = (): string | null => {
    const playedAt = Object.values(sessionsForLibrary(loadSessionHistory(), livePlusDrilled()))
      .flat()
      .map((session) => session.playedAt);
    const streak = currentStreak(playedAt, new Date().toISOString());
    return streak > 0 ? `${streak}-day streak — see you tomorrow to keep it going.` : null;
  };
  const [queue, setQueue] = useState<Queue>(() => ({
    ranges: request.ranges,
    mode: request.mode,
    handPools: request.handPools,
  }));
  const [index, setIndex] = useState(0);
  // Refs, not state: the quizzes' answers are only ever read when the run ends,
  // so accumulating them must not re-render the drill mid-question.
  const actionAttemptsRef = useRef<ActionAttempt[]>([]);
  const mixedAttemptsRef = useRef<ActionAttempt[]>([]);
  // Bumped for every drill start so a re-drill of the same range remounts the
  // component instead of resuming the finished session behind the summary.
  const [run, setRun] = useState(0);
  const [phase, setPhase] = useState<Phase>(() =>
    request.mode && INLINE_MODES.has(request.mode)
      ? { kind: 'drill', mode: request.mode as InlineMode, durationSeconds: DEFAULT_DRILL_SECONDS }
      : { kind: 'picker' },
  );

  const range = queue.ranges[index];
  if (!range) return null;
  const hasNext = index + 1 < queue.ranges.length;
  const position = queue.ranges.length > 1 ? `${index + 1}/${queue.ranges.length}` : null;

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
    const missedHands = missedHandsOf(attempts);
    setPhase({
      kind: 'summary',
      data: {
        totalQuestions: summary.totalQuestions,
        correctAnswers: summary.correctAnswers,
        accuracy: summary.accuracyPercentage,
        deltaLine: deltaLineFor(summary.accuracyPercentage, prevAccuracy, misses),
        streakLine: streakLine(),
        misses: recapMisses(attempts),
        saveError,
      },
      redrill: missedHands ? { kind: 'hands', hands: missedHands } : null,
    });
  };

  /**
   * End the action quiz on the same peak-end summary every other mode gets.
   *
   * Per-action accuracy is already persisted by the drill, answer by answer (it is
   * also mounted by the flat action-quiz route, which has no host to record for it).
   * The session itself is recorded here, where the run is known to be over.
   */
  const finishActionQuiz = () => {
    const attempts = actionAttemptsRef.current;
    // Closing before answering anything abandons the run, as in every mode.
    if (attempts.length === 0) {
      onClose();
      return;
    }
    // Start the next quiz from empty. Nothing reads the run except this handler,
    // so clearing here covers every way out of it — a re-drill of these misses,
    // the next range in a queue, or a fresh pick from the mode picker. Without
    // it the second summary would report this run's answers all over again.
    actionAttemptsRef.current = [];
    const correct = attempts.filter((attempt) => attempt.correct).length;
    const summary = {
      totalQuestions: attempts.length,
      correctAnswers: correct,
      accuracyPercentage: accuracyPercentage(correct, attempts.length),
    };
    const saveError = captureRecordingFailure(() =>
      recordFinishedActionSession(range.id, summary),
    );
    const missedActionHands = missedActionHandsOf(attempts);
    setPhase({
      kind: 'summary',
      data: {
        totalQuestions: attempts.length,
        correctAnswers: correct,
        accuracy: summary.accuracyPercentage,
        deltaLine: null,
        streakLine: streakLine(),
        actionMisses: recapActionMisses(attempts),
        saveError,
      },
      // Re-drilled as another action quiz, not as recognition: these hands were
      // missed on which action they want, not on whether they are in the range.
      redrill: missedActionHands ? { kind: 'actionHands', hands: missedActionHands } : null,
    });
  };

  /**
   * End the frequency quiz on the same peak-end summary every other mode gets.
   *
   * Its misses group by the action each hand wanted, exactly like the action
   * quiz's — the question differs (the PRIMARY action of a mixed strategy rather
   * than the chart's assigned one), the lesson does not. No per-action accuracy is
   * recorded: that store is the action quiz's answer to a different question, and
   * folding frequency answers into it would misreport both. The session itself still
   * counts, like every other mode's.
   */
  const finishMixedQuiz = () => {
    const attempts = mixedAttemptsRef.current;
    // Closing before answering anything abandons the run, as in every mode.
    if (attempts.length === 0) {
      onClose();
      return;
    }
    // Start the next quiz from empty, so a re-drill of these misses or the next
    // range in a queue does not report this run's answers all over again.
    mixedAttemptsRef.current = [];
    const correct = attempts.filter((attempt) => attempt.correct).length;
    const summary = {
      totalQuestions: attempts.length,
      correctAnswers: correct,
      accuracyPercentage: accuracyPercentage(correct, attempts.length),
    };
    const saveError = captureRecordingFailure(() =>
      recordFinishedActionSession(range.id, summary),
    );
    const missedHands = missedActionHandsOf(attempts);
    setPhase({
      kind: 'summary',
      data: {
        totalQuestions: attempts.length,
        correctAnswers: correct,
        accuracy: summary.accuracyPercentage,
        deltaLine: null,
        streakLine: streakLine(),
        actionMisses: recapActionMisses(attempts),
        saveError,
      },
      redrill: missedHands ? { kind: 'mixedHands', hands: missedHands } : null,
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
    // A spot session's misses span the library, so the re-drill is a recognition
    // queue over the ranges that actually missed something, each dealt its own
    // pool — not a restart of one range.
    const handPools = missedPoolsOf(byRange);
    const missedRanges = queue.ranges.filter((entry) => handPools[entry.id]);
    setPhase({
      kind: 'summary',
      data: {
        totalQuestions: summary.totalQuestions,
        correctAnswers: summary.correctAnswers,
        accuracy: summary.accuracyPercentage,
        deltaLine: `Across ${rangeCount} range${rangeCount === 1 ? '' : 's'} of your library.`,
        streakLine: streakLine(),
        misses: recapMisses(all),
        saveError,
      },
      redrill: missedRanges.length > 0 ? { kind: 'queue', ranges: missedRanges, handPools } : null,
    });
  };

  const nextRange = () => {
    setIndex(index + 1);
    setRun(run + 1);
    setPhase({
      kind: 'drill',
      mode: queue.mode && INLINE_MODES.has(queue.mode) ? (queue.mode as InlineMode) : 'recognize',
      durationSeconds: DEFAULT_DRILL_SECONDS,
    });
  };

  /** Re-run the current range as a recognition drill over just its misses. */
  const drillMisses = (handPool: PokerHand[]) => {
    setRun(run + 1);
    setPhase({ kind: 'drill', mode: 'recognize', durationSeconds: DEFAULT_DRILL_SECONDS, handPool });
  };

  /** Re-run the action quiz over just the hands whose action went wrong. */
  const drillActionMisses = (handPool: PokerHand[]) => {
    setRun(run + 1);
    setPhase({ kind: 'drill', mode: 'action', durationSeconds: DEFAULT_DRILL_SECONDS, handPool });
  };

  /** Re-run the frequency quiz over just the hands whose primary action went wrong. */
  const drillMixedMisses = (handPool: PokerHand[]) => {
    setRun(run + 1);
    setPhase({ kind: 'drill', mode: 'mixed', durationSeconds: DEFAULT_DRILL_SECONDS, handPool });
  };

  /** Replace the queue with a recognition run over each range's own misses. */
  const drillQueue = (ranges: SavedRange[], handPools: Record<string, PokerHand[]>) => {
    setQueue({ ranges, mode: 'recognize', handPools });
    setIndex(0);
    setRun(run + 1);
    setPhase({ kind: 'drill', mode: 'recognize', durationSeconds: DEFAULT_DRILL_SECONDS });
  };

  const startRedrill = (redrill: Redrill) => {
    switch (redrill.kind) {
      case 'hands':
        return drillMisses(redrill.hands);
      case 'actionHands':
        return drillActionMisses(redrill.hands);
      case 'mixedHands':
        return drillMixedMisses(redrill.hands);
      case 'queue':
        return drillQueue(redrill.ranges, redrill.handPools);
    }
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
    const spots = queue.mode === 'spots';
    const redrill = phase.redrill;
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
          onDrillMisses={redrill ? () => startRedrill(redrill) : undefined}
        />
      </OverlayFrame>
    );
  }

  if (phase.mode === 'spots') {
    return (
      <SpotDrill
        ranges={queue.ranges}
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
      <OverlayFrame
        title={`${range.name || 'Untitled'} — action quiz`}
        onClose={finishActionQuiz}
      >
        <ActionQuizDrill
          key={`${range.id}-${run}`}
          id={range.id}
          handPool={phase.handPool}
          onAttempt={(attempt) => actionAttemptsRef.current.push(attempt)}
        />
      </OverlayFrame>
    );
  }
  if (phase.mode === 'mixed') {
    return (
      <OverlayFrame
        title={`${range.name || 'Untitled'} — frequency quiz`}
        onClose={finishMixedQuiz}
      >
        <MixedQuizDrill
          key={`${range.id}-${run}`}
          id={range.id}
          handPool={phase.handPool}
          onAttempt={(attempt) => mixedAttemptsRef.current.push(attempt)}
        />
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
            ? (phase.handPool ?? request.handPool ?? queue.handPools?.[range.id])
            : undefined
      }
      durationSeconds={phase.durationSeconds}
      position={position}
      onFinish={finishRecognition}
    />
  );
}
