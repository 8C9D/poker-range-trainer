import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';

import {
  createPracticeAttempt,
  getRandomPracticeHand,
  summarizePracticeAttempts,
} from '@core/domain/practice';
import { findSavedRangeById } from '@core/storage/rangeStorage';
import type { PracticeAttempt } from '@core/types/practice';

import { colors } from '../theme/colors';

/**
 * Recognition practice for one saved range: a random starting hand is shown and
 * the user answers "in range" / "out of range" with immediate feedback. All
 * scoring and prompt selection reuse `@core/domain/practice`; session stats are
 * kept in component state.
 */
export default function PracticeScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const idParam = typeof params.id === 'string' ? params.id : undefined;
  const [range] = useState(() => (idParam ? findSavedRangeById(idParam) : undefined));

  const [hand, setHand] = useState(() => getRandomPracticeHand());
  const [attempts, setAttempts] = useState<PracticeAttempt[]>([]);
  const [lastAttempt, setLastAttempt] = useState<PracticeAttempt | null>(null);

  const answer = useCallback(
    (answeredInRange: boolean) => {
      if (!range) return;
      const attempt = createPracticeAttempt(hand, range.hands, answeredInRange);
      setAttempts((prev) => [...prev, attempt]);
      setLastAttempt(attempt);
      setHand(getRandomPracticeHand());
    },
    [hand, range],
  );

  if (!range) {
    return (
      <View style={styles.screen}>
        <Stack.Screen options={{ title: 'Practice' }} />
        <Text style={styles.notFound}>Range not found</Text>
      </View>
    );
  }

  const summary = summarizePracticeAttempts(attempts);

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: 'Practice' }} />
      <Text style={styles.rangeName}>{range.name || 'Untitled'}</Text>

      <View style={styles.handCard}>
        <Text testID="practice-hand" style={styles.hand}>
          {hand}
        </Text>
      </View>

      {lastAttempt ? (
        <Text
          testID="feedback"
          style={[
            styles.feedback,
            lastAttempt.correct ? styles.feedbackCorrect : styles.feedbackWrong,
          ]}
        >
          {lastAttempt.correct ? 'Correct' : 'Incorrect'} — {lastAttempt.hand} was{' '}
          {lastAttempt.expectedInRange ? 'in range' : 'out of range'}
        </Text>
      ) : (
        <Text style={styles.feedback}>Is this hand in the range?</Text>
      )}

      <View style={styles.answers}>
        <Pressable
          testID="answer-in"
          style={[styles.answerButton, styles.answerIn]}
          onPress={() => answer(true)}
        >
          <Text style={styles.answerText}>In range</Text>
        </Pressable>
        <Pressable
          testID="answer-out"
          style={[styles.answerButton, styles.answerOut]}
          onPress={() => answer(false)}
        >
          <Text style={styles.answerText}>Out of range</Text>
        </Pressable>
      </View>

      <View style={styles.stats}>
        <Text testID="stat-total" style={styles.stat}>
          Total: {summary.totalQuestions}
        </Text>
        <Text testID="stat-correct" style={styles.stat}>
          Correct: {summary.correctAnswers}
        </Text>
        <Text testID="stat-accuracy" style={styles.stat}>
          Accuracy: {summary.accuracyPercentage.toFixed(0)}%
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
  answers: {
    flexDirection: 'row',
    gap: 16,
  },
  answerButton: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 12,
  },
  answerIn: {
    backgroundColor: colors.accent,
  },
  answerOut: {
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  answerText: {
    color: colors.onAccent,
    fontSize: 16,
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
