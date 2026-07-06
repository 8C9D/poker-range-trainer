import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';

import { accuracyPercentage } from '@core/domain/accuracy';
import { handsWithMixedStrategy, primaryAction, type HandMixedStrategy } from '@core/domain/mixedStrategy';
import { getRandomHandFrom } from '@core/domain/practice';
import type { PokerHand } from '@core/domain/pokerHands';
import { findSavedRangeById } from '@core/storage/rangeStorage';
import { RANGE_ACTIONS, RANGE_ACTION_LABELS, type RangeAction } from '@core/types/range';

import { ACTION_COLORS } from '../theme/actionColors';
import { colors } from '../theme/colors';

// Stable empty overlay so a range without strategies keeps a referentially-stable
// mixedStrategies (and therefore a stable memoized pool) across renders.
const EMPTY_STRATEGIES: Record<PokerHand, HandMixedStrategy> = {};

interface AnsweredState {
  chosen: RangeAction;
  expected: RangeAction;
  correct: boolean;
}

/**
 * Mixed-frequency quiz for one saved range: quizzes the PRIMARY action of each hand that carries a
 * mixed strategy. The pool is `handsWithMixedStrategy(range.mixedStrategies)`; the correct answer is
 * `primaryAction(strategy)`. Pool + scoring reuse `@core/domain/mixedStrategy`, mirroring the web
 * `MixedActionQuiz`. Running stats only; no persistence (the strategies are the source of truth).
 */
export default function MixedQuizScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const idParam = typeof params.id === 'string' ? params.id : undefined;
  const [range] = useState(() => (idParam ? findSavedRangeById(idParam) : undefined));

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
    return (
      <View style={styles.screen}>
        <Stack.Screen options={{ title: 'Frequency quiz' }} />
        <Text style={styles.notFound}>Range not found</Text>
      </View>
    );
  }

  if (pool.length === 0 || hand === null) {
    return (
      <View style={styles.screen}>
        <Stack.Screen options={{ title: 'Frequency quiz' }} />
        <Text testID="no-frequencies" style={styles.notFound}>
          No mixed frequencies yet — assign frequencies first.
        </Text>
      </View>
    );
  }

  const accuracy = accuracyPercentage(correct, total);

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: 'Frequency quiz' }} />
      <Text style={styles.rangeName}>{range.name || 'Untitled'}</Text>
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
  screen: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 24,
    gap: 20,
    alignItems: 'center',
  },
  notFound: {
    color: colors.text,
    fontSize: 16,
    marginTop: 48,
    textAlign: 'center',
  },
  rangeName: {
    color: colors.text,
    fontSize: 16,
  },
  prompt: {
    color: colors.textStrong,
    fontSize: 16,
    fontWeight: '600',
  },
  handCard: {
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: 16,
    paddingVertical: 28,
    paddingHorizontal: 44,
  },
  hand: {
    color: colors.textStrong,
    fontSize: 52,
    fontWeight: '700',
  },
  feedback: {
    fontSize: 16,
    color: colors.text,
    textAlign: 'center',
  },
  feedbackCorrect: {
    color: colors.accent,
  },
  feedbackWrong: {
    color: colors.danger,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
  },
  actionButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
  },
  actionButtonDisabled: {
    opacity: 0.4,
  },
  actionButtonText: {
    color: colors.onAccent,
    fontSize: 15,
    fontWeight: '600',
  },
  nextButton: {
    backgroundColor: colors.brand,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.accent,
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  nextButtonText: {
    color: colors.accent,
    fontSize: 15,
    fontWeight: '600',
  },
  stats: {
    flexDirection: 'row',
    gap: 20,
    marginTop: 8,
  },
  stat: {
    color: colors.text,
    fontSize: 14,
  },
});
