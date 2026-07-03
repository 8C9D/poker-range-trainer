import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';

import { accuracyPercentage } from '@core/domain/accuracy';
import {
  assignedHands,
  correctActionFor,
  summarizeActionAccuracy,
} from '@core/domain/actionRange';
import { getRandomHandFrom } from '@core/domain/practice';
import type { PokerHand } from '@core/domain/pokerHands';
import { recordActionAccuracy } from '@core/storage/actionAccuracyStorage';
import { findSavedRangeById } from '@core/storage/rangeStorage';
import { RANGE_ACTIONS, RANGE_ACTION_LABELS, type RangeAction } from '@core/types/range';
import type { ActionAttempt } from '@core/types/practice';

import { ACTION_COLORS } from '../theme/actionColors';
import { colors } from '../theme/colors';

// Stable empty overlay so an unassigned range keeps a referentially-stable handActions
// (and therefore a stable memoized pool) across renders.
const EMPTY_ACTIONS: Record<PokerHand, RangeAction> = {};

/**
 * Action-quiz practice for one saved range: show a hand the chart assigns and ask the user
 * to name its action. Only assigned hands are quizzed (`assignedHands`); the correct action
 * is `correctActionFor`. Scoring + per-action recording reuse `@core/domain/actionRange`
 * and `@core/storage/actionAccuracyStorage`, mirroring recognition practice's per-answer
 * recording.
 */
export default function ActionQuizScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const idParam = typeof params.id === 'string' ? params.id : undefined;
  const [range] = useState(() => (idParam ? findSavedRangeById(idParam) : undefined));

  const handActions = range?.handActions ?? EMPTY_ACTIONS;
  const pool = useMemo(() => assignedHands(handActions), [handActions]);

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
      setHand(getRandomHandFrom(pool));
      // Record per answer so action accuracy accumulates like recognition practice.
      recordActionAccuracy(range.id, summarizeActionAccuracy([attempt]));
    },
    [range, hand, handActions, pool],
  );

  if (!range) {
    return (
      <View style={styles.screen}>
        <Stack.Screen options={{ title: 'Action quiz' }} />
        <Text style={styles.notFound}>Range not found</Text>
      </View>
    );
  }

  if (pool.length === 0) {
    return (
      <View style={styles.screen}>
        <Stack.Screen options={{ title: 'Action quiz' }} />
        <Text testID="no-actions" style={styles.notFound}>
          No actions assigned — add some in Edit actions first.
        </Text>
      </View>
    );
  }

  const total = attempts.length;
  const correct = attempts.filter((attempt) => attempt.correct).length;
  const accuracy = accuracyPercentage(correct, total);

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: 'Action quiz' }} />
      <Text style={styles.rangeName}>{range.name || 'Untitled'}</Text>

      <View style={styles.handCard}>
        <Text testID="quiz-hand" style={styles.hand}>
          {hand}
        </Text>
      </View>

      {lastAttempt ? (
        <Text
          testID="quiz-feedback"
          style={[
            styles.feedback,
            lastAttempt.correct ? styles.feedbackCorrect : styles.feedbackWrong,
          ]}
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
    gap: 24,
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
  handCard: {
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: 16,
    paddingVertical: 32,
    paddingHorizontal: 48,
  },
  hand: {
    color: colors.textStrong,
    fontSize: 56,
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
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
  },
  actionButtonText: {
    color: colors.onAccent,
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
