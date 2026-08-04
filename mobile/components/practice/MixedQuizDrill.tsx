import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { accuracyPercentage } from '@core/domain/accuracy';
import { handsWithMixedStrategy, primaryAction, type HandMixedStrategy } from '@core/domain/mixedStrategy';
import { getRandomHandFrom } from '@core/domain/practice';
import type { PokerHand } from '@core/domain/pokerHands';
import { findSavedRangeById } from '@core/storage/rangeStorage';
import type { ActionAttempt } from '@core/types/practice';
import { RANGE_ACTIONS, RANGE_ACTION_LABELS, type RangeAction } from '@core/types/range';

import { actionColors } from '../../theme/actionColors';
import { useTheme } from '../../theme/colors';
import type { ThemeColors } from '../../theme/colors';

const EMPTY_STRATEGIES: Record<PokerHand, HandMixedStrategy> = {};

interface AnsweredState {
  chosen: RangeAction;
  expected: RangeAction;
  correct: boolean;
}

/**
 * Mixed-frequency quiz body: quizzes the primary action of each hand carrying a mixed
 * strategy. Running stats only (the strategies are the source of truth). Shared by the flat
 * frequency-quiz route and the practice overlay's frequency mode.
 *
 * `onAttempt` reports each answer as it is scored. The overlay's close button lives in the
 * frame around this component, so the host cannot ask for the run when it ends — it
 * accumulates the answers instead, and builds its summary from them.
 */
export function MixedQuizDrill({
  id,
  handPool,
  onAttempt,
}: {
  id?: string;
  /**
   * Ask about only these hands instead of every mixed-strategy hand — set when
   * re-quizzing a run's misses. Grading is unchanged: the strategies still say
   * what the primary action is.
   */
  handPool?: PokerHand[];
  onAttempt?: (attempt: ActionAttempt) => void;
}) {
  const theme = useTheme();
  const styles = makeStyles(theme);
  const ACTION_COLORS = actionColors(theme);
  const [range] = useState(() => (id ? findSavedRangeById(id) : undefined));
  const mixedStrategies = range?.mixedStrategies ?? EMPTY_STRATEGIES;
  const pool = useMemo(
    () => handPool ?? handsWithMixedStrategy(mixedStrategies),
    [handPool, mixedStrategies],
  );

  const [hand, setHand] = useState<PokerHand | null>(() =>
    pool.length > 0 ? getRandomHandFrom(pool) : null,
  );
  const [answered, setAnswered] = useState<AnsweredState | null>(null);
  const [total, setTotal] = useState(0);
  const [correct, setCorrect] = useState(0);

  const answer = useCallback(
    (chosen: RangeAction) => {
      if (answered || hand === null) return;
      const expected = primaryAction(mixedStrategies[hand] ?? []) ?? 'fold';
      const isCorrect = chosen === expected;
      setAnswered({ chosen, expected, correct: isCorrect });
      setTotal((value) => value + 1);
      if (isCorrect) setCorrect((value) => value + 1);
      onAttempt?.({ hand, chosen, expected, correct: isCorrect });
    },
    [answered, hand, mixedStrategies, onAttempt],
  );

  const nextHand = useCallback(() => {
    setHand(getRandomHandFrom(pool));
    setAnswered(null);
  }, [pool]);

  if (!range) {
    return <Text style={styles.notFound}>Range not found</Text>;
  }

  if (pool.length === 0 || hand === null) {
    return (
      <Text testID="no-frequencies" style={styles.notFound}>
        No mixed frequencies yet — assign frequencies first.
      </Text>
    );
  }

  const accuracy = accuracyPercentage(correct, total);

  return (
    <View style={styles.body}>
      <Text style={styles.prompt}>What is the primary action?</Text>
      <View style={styles.handCard}>
        <Text testID="quiz-hand" style={styles.hand}>
          {hand}
        </Text>
      </View>

      {answered ? (
        <Text
          testID="quiz-feedback"
          style={[styles.feedback, answered.correct ? styles.feedbackCorrect : styles.feedbackWrong]}
        >
          {answered.correct
            ? 'Correct'
            : `Incorrect — primary is ${RANGE_ACTION_LABELS[answered.expected]}`}
        </Text>
      ) : (
        <Text style={styles.feedback}>Pick the most frequent action.</Text>
      )}

      <View style={styles.actions}>
        {RANGE_ACTIONS.map((action) => (
          <Pressable
            key={action}
            testID={`mixed-action-${action}`}
            accessibilityRole="button"
            disabled={answered !== null}
            style={[
              styles.actionButton,
              { backgroundColor: ACTION_COLORS[action] },
              answered !== null && styles.actionButtonDisabled,
            ]}
            onPress={() => answer(action)}
          >
            <Text style={styles.actionButtonText}>{RANGE_ACTION_LABELS[action]}</Text>
          </Pressable>
        ))}
      </View>

      {answered ? (
        <Pressable testID="mixed-next" accessibilityRole="button" style={styles.nextButton} onPress={nextHand}>
          <Text style={styles.nextButtonText}>Next hand</Text>
        </Pressable>
      ) : null}

      <View style={styles.stats}>
        <Text testID="stat-total" style={styles.stat}>
          Total: {total}
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
    body: { flex: 1, padding: 24, gap: 20, alignItems: 'center', justifyContent: 'center' },
    notFound: { color: theme.ink2, fontSize: 16, marginTop: 32, textAlign: 'center' },
    prompt: { color: theme.ink, fontSize: 16, fontWeight: '600' },
    handCard: {
      backgroundColor: theme.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.line,
      borderRadius: 16,
      paddingVertical: 28,
      paddingHorizontal: 44,
    },
    hand: { color: theme.ink, fontSize: 52, fontWeight: '700' },
    feedback: { fontSize: 16, color: theme.ink2, textAlign: 'center' },
    feedbackCorrect: { color: theme.accentStrong },
    feedbackWrong: { color: theme.bad },
    actions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10 },
    actionButton: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12 },
    actionButtonDisabled: { opacity: 0.4 },
    actionButtonText: { color: theme.onAction, fontSize: 15, fontWeight: '600' },
    nextButton: {
      backgroundColor: theme.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.accent,
      borderRadius: 10,
      paddingHorizontal: 20,
      paddingVertical: 10,
    },
    nextButtonText: { color: theme.accentStrong, fontSize: 15, fontWeight: '600' },
    stats: { flexDirection: 'row', gap: 20, marginTop: 8 },
    stat: { color: theme.ink2, fontSize: 14 },
  });
}
