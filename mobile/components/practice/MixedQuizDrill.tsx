import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { accuracyPercentage } from '@core/domain/accuracy';
import { handsWithMixedStrategy, primaryAction, type HandMixedStrategy } from '@core/domain/mixedStrategy';
import { getRandomHandFrom } from '@core/domain/practice';
import type { PokerHand } from '@core/domain/pokerHands';
import { findSavedRangeById } from '@core/storage/rangeStorage';
import { RANGE_ACTIONS, RANGE_ACTION_LABELS, type RangeAction } from '@core/types/range';

import { ACTION_COLORS } from '../../theme/actionColors';
import { colors } from '../../theme/colors';

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
 */
export function MixedQuizDrill({ id }: { id?: string }) {
  const [range] = useState(() => (id ? findSavedRangeById(id) : undefined));
  const mixedStrategies = range?.mixedStrategies ?? EMPTY_STRATEGIES;
  const pool = useMemo(() => handsWithMixedStrategy(mixedStrategies), [mixedStrategies]);

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
    },
    [answered, hand, mixedStrategies],
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

const styles = StyleSheet.create({
  body: { flex: 1, padding: 24, gap: 20, alignItems: 'center', justifyContent: 'center' },
  notFound: { color: colors.text, fontSize: 16, marginTop: 32, textAlign: 'center' },
  prompt: { color: colors.textStrong, fontSize: 16, fontWeight: '600' },
  handCard: {
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: 16,
    paddingVertical: 28,
    paddingHorizontal: 44,
  },
  hand: { color: colors.textStrong, fontSize: 52, fontWeight: '700' },
  feedback: { fontSize: 16, color: colors.text, textAlign: 'center' },
  feedbackCorrect: { color: colors.accent },
  feedbackWrong: { color: colors.danger },
  actions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10 },
  actionButton: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12 },
  actionButtonDisabled: { opacity: 0.4 },
  actionButtonText: { color: colors.onAccent, fontSize: 15, fontWeight: '600' },
  nextButton: {
    backgroundColor: colors.brand,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.accent,
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  nextButtonText: { color: colors.accent, fontSize: 15, fontWeight: '600' },
  stats: { flexDirection: 'row', gap: 20, marginTop: 8 },
  stat: { color: colors.text, fontSize: 14 },
});
