import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { accuracyPercentage } from '@core/domain/accuracy';
import { assignedHands, correctActionFor, summarizeActionAccuracy } from '@core/domain/actionRange';
import { getRandomHandFrom } from '@core/domain/practice';
import type { PokerHand } from '@core/domain/pokerHands';
import { recordActionAccuracy } from '@core/storage/actionAccuracyStorage';
import { findSavedRangeById } from '@core/storage/rangeStorage';
import { RANGE_ACTIONS, RANGE_ACTION_LABELS, type RangeAction } from '@core/types/range';
import type { ActionAttempt } from '@core/types/practice';

import { actionColors } from '../../theme/actionColors';
import { useTheme } from '../../theme/colors';
import type { ThemeColors } from '../../theme/colors';
import { DRILL_QUESTION_COUNT } from '../../lib/drillPacing';

const EMPTY_ACTIONS: Record<PokerHand, RangeAction> = {};

/**
 * Action-quiz drill body: show an assigned hand and ask the user to name its action. Only
 * assigned hands are quizzed; per-action accuracy records per answer. Shared by the flat
 * action-quiz route and the practice overlay's action mode.
 *
 * `onAttempt` reports each answer as it is scored. The overlay's close button lives in
 * the frame around this component, so the host cannot ask for the run when it ends —
 * it accumulates the answers instead, and builds its summary from them.
 */
export function ActionQuizDrill({
  id,
  handPool,
  onAttempt,
  onComplete,
  questionCount = DRILL_QUESTION_COUNT,
}: {
  id?: string
  /**
   * Ask about only these hands instead of the whole chart — set when re-drilling
   * a session's misses. Grading is unchanged: the chart still says what is right.
   */
  handPool?: PokerHand[]
  onAttempt?: (attempt: ActionAttempt) => void
  /** The run reached `questionCount`; the host ends it on its summary. */
  onComplete?: () => void
  /** Questions before the run ends itself; the shared drill length by default. */
  questionCount?: number
}) {
  const theme = useTheme();
  const styles = makeStyles(theme);
  const ACTION_COLORS = actionColors(theme);
  const [range] = useState(() => (id ? findSavedRangeById(id) : undefined));
  const handActions = range?.handActions ?? EMPTY_ACTIONS;
  const pool = useMemo(() => handPool ?? assignedHands(handActions), [handPool, handActions]);

  const [hand, setHand] = useState<PokerHand | null>(() =>
    pool.length > 0 ? getRandomHandFrom(pool) : null,
  );
  const [attempts, setAttempts] = useState<ActionAttempt[]>([]);
  const [lastAttempt, setLastAttempt] = useState<ActionAttempt | null>(null);

  const answer = useCallback(
    (chosen: RangeAction) => {
      if (!range || hand === null) return;
      const expected = correctActionFor(handActions, hand);
      const attempt: ActionAttempt = { hand, chosen, expected, correct: chosen === expected };
      setAttempts((prev) => [...prev, attempt]);
      setLastAttempt(attempt);
      recordActionAccuracy(range.id, summarizeActionAccuracy([attempt]));
      onAttempt?.(attempt);
      // A quiz run counts toward the day and the review schedule like any other
      // drill, so it ends at the shared drill length instead of dealing forever.
      // The answer is reported first: the host builds its summary from them.
      if (attempts.length + 1 >= questionCount) {
        onComplete?.();
        return;
      }
      setHand(getRandomHandFrom(pool));
    },
    [range, hand, handActions, pool, onAttempt, onComplete, attempts.length, questionCount],
  );

  if (!range) {
    return <Text style={styles.notFound}>Range not found</Text>;
  }

  if (pool.length === 0) {
    return (
      <Text testID="no-actions" style={styles.notFound}>
        No actions assigned — add some in the Actions tab first.
      </Text>
    );
  }

  const total = attempts.length;
  const correct = attempts.filter((attempt) => attempt.correct).length;
  const accuracy = accuracyPercentage(correct, total);

  return (
    <View style={styles.body}>
      <View style={styles.handCard}>
        <Text testID="quiz-hand" style={styles.hand}>
          {hand}
        </Text>
      </View>

      {lastAttempt ? (
        <Text
          testID="quiz-feedback"
          style={[styles.feedback, lastAttempt.correct ? styles.feedbackCorrect : styles.feedbackWrong]}
        >
          {lastAttempt.correct
            ? 'Correct'
            : `Incorrect — ${lastAttempt.hand} is ${RANGE_ACTION_LABELS[lastAttempt.expected]}`}
        </Text>
      ) : (
        <Text style={styles.feedback}>What is the correct action?</Text>
      )}

      <View style={styles.actions}>
        {RANGE_ACTIONS.map((action) => (
          <Pressable
            key={action}
            testID={`quiz-action-${action}`}
            accessibilityRole="button"
            style={[styles.actionButton, { backgroundColor: ACTION_COLORS[action] }]}
            onPress={() => answer(action)}
          >
            <Text style={styles.actionButtonText}>{RANGE_ACTION_LABELS[action]}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.stats}>
        <Text testID="stat-total" style={styles.stat}>
          Answered: {total} of {questionCount}
        </Text>
        <Text testID="stat-correct" style={styles.stat}>
          Correct: {correct}
        </Text>
        <Text testID="stat-accuracy" style={styles.stat}>
          Accuracy: {accuracy.toFixed(0)}%
        </Text>
      </View>
    </View>
  );
}

function makeStyles(theme: ThemeColors) {
  return StyleSheet.create({
    body: { flex: 1, padding: 24, gap: 24, alignItems: 'center', justifyContent: 'center' },
    notFound: { color: theme.ink2, fontSize: 16, marginTop: 32, textAlign: 'center' },
    handCard: {
      backgroundColor: theme.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.line,
      borderRadius: 16,
      paddingVertical: 32,
      paddingHorizontal: 48,
    },
    hand: { color: theme.ink, fontSize: 56, fontWeight: '700' },
    feedback: { fontSize: 16, color: theme.ink2, textAlign: 'center' },
    feedbackCorrect: { color: theme.accentStrong },
    feedbackWrong: { color: theme.bad },
    actions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10 },
    actionButton: { paddingHorizontal: 18, paddingVertical: 12, borderRadius: 12 },
    actionButtonText: { color: theme.onAction, fontSize: 15, fontWeight: '600' },
    stats: { flexDirection: 'row', gap: 20, marginTop: 8 },
    stat: { color: theme.ink2, fontSize: 14 },
  });
}
