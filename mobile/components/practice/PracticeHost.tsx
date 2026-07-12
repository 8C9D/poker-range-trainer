import { useState } from 'react';
import { useRouter } from 'expo-router';

import { accuracyPercentage } from '@core/domain/accuracy';
import type { PokerHand } from '@core/domain/pokerHands';
import { summarizePracticeAttempts } from '@core/domain/practice';
import { currentStreak } from '@core/domain/spacedRepetition';
import { DEFAULT_DRILL_SECONDS } from '@core/domain/timedDrill';
import { loadSessionHistory } from '@core/storage/sessionHistoryStorage';
import type { PracticeAttempt } from '@core/types/practice';
import type { SavedRange } from '@core/types/range';

import { ActionQuizDrill } from './ActionQuizDrill';
import { BuildDrill } from './BuildDrill';
import { ComboDrill } from './ComboDrill';
import { MixedQuizDrill } from './MixedQuizDrill';
import { ModePicker, type PracticeMode } from './ModePicker';
import { OverlayFrame } from './OverlayFrame';
import { RecognitionDrill } from './RecognitionDrill';
import { SessionSummary, type SessionSummaryData } from './SessionSummary';
import { recordFinishedPracticeSession } from '../../lib/sessionRecording';

export interface PracticeRequest {
  /** The queue of ranges to drill (usually one; the review queue passes many). */
  ranges: SavedRange[];
  /** The preset mode, or null to open the mode picker. */
  mode: PracticeMode | null;
  /** Restrict recognition prompts to these hands (a single-range weak-hands pool). */
  handPool?: PokerHand[];
  /** Per-range pools for multi-range weak-hand drills, keyed by range id. */
  handPools?: Record<string, PokerHand[]>;
}

// Modes rendered inline in the overlay; postflop/board still route out to the flat drill
// screens until they are folded into the overlay (deferred to M8 with re-theming).
type InlineMode = 'recognize' | 'weakness' | 'timed' | 'build' | 'action' | 'mixed' | 'combo';
const INLINE_MODES = new Set<PracticeMode>([
  'recognize',
  'weakness',
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
  | { kind: 'drill'; mode: InlineMode; durationSeconds: number }
  | { kind: 'summary'; data: SessionSummaryData };

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
 * shared session recorder the moment a recognition drill ends. Non-recognition modes route
 * out to the flat drill screens for now (folded into the overlay at M6b).
 */
export function PracticeHost({ request, onClose }: PracticeHostProps) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
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
    recordFinishedPracticeSession(range.id, attempts);
    const summary = summarizePracticeAttempts(attempts);
    const misses = attempts.filter((attempt) => !attempt.correct).length;
    const playedAt = Object.values(loadSessionHistory())
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
      },
    });
  };

  const nextRange = () => {
    setIndex(index + 1);
    setPhase({
      kind: 'drill',
      mode: request.mode && INLINE_MODES.has(request.mode) ? (request.mode as InlineMode) : 'recognize',
      durationSeconds: DEFAULT_DRILL_SECONDS,
    });
  };

  if (phase.kind === 'picker') {
    return (
      <OverlayFrame title={range.name || 'Untitled'} onClose={onClose}>
        <ModePicker range={range} onPick={runMode} />
      </OverlayFrame>
    );
  }

  if (phase.kind === 'summary') {
    return (
      <OverlayFrame title={range.name || 'Untitled'} position={position} progress={1} onClose={onClose}>
        <SessionSummary data={phase.data} hasNext={hasNext} onNext={nextRange} onDone={onClose} />
      </OverlayFrame>
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
      key={`${range.id}-${index}`}
      range={range}
      variant={variant}
      handPool={phase.mode === 'recognize' ? (request.handPool ?? request.handPools?.[range.id]) : undefined}
      durationSeconds={phase.durationSeconds}
      position={position}
      onFinish={finishRecognition}
    />
  );
}
