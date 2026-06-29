import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';

import {
  createPracticeAttempt,
  getRandomPracticeHand,
  reviewSessionMistakes,
  summarizeHandAccuracy,
  summarizePracticeAttempts,
} from '@core/domain/practice';
import { recordHandAccuracy } from '@core/storage/handAccuracyStorage';
import { recordPracticeSession } from '@core/storage/practiceStatsStorage';
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
      // Fold this answer into the range's cumulative practice stats immediately, so
      // the library's per-range stats and Practiced/Accuracy sorts reflect practice
      // even mid-session — and survive the app being backgrounded or killed, which a
      // mobile screen can't rely on an unmount/cleanup to handle. recordPracticeSession
      // *adds* the given totals, so one-question increments accumulate to the same
      // cumulative counts as recording the whole session once at the end.
      recordPracticeSession(range.id, {
        totalQuestions: 1,
        correctAnswers: attempt.correct ? 1 : 0,
      });
      // Likewise fold this answer into cumulative per-hand accuracy, which powers the
      // weakest-hands view, the editor-grid heatmap, and the mistakes-only drill in
      // later slices. summarizeHandAccuracy([attempt]) is the one-hand increment.
      recordHandAccuracy(range.id, summarizeHandAccuracy([attempt]));
    },
    [hand, range],
  );

  // Bucket the session's mistakes for the end-of-session review (recomputes when
  // a new attempt is recorded). Kept above the early return to satisfy hook rules.
  const review = useMemo(() => reviewSessionMistakes(attempts), [attempts]);

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

      {review.missed.length > 0 || review.wronglyIncluded.length > 0 ? (
        <View style={styles.review}>
          <Text style={styles.reviewTitle}>Session review</Text>
          {review.missed.length > 0 ? (
            <View style={styles.reviewRow}>
              <Text style={[styles.reviewLabel, styles.reviewLabelMissed]}>
                Missed (in range)
              </Text>
              <View testID="review-missed" style={styles.reviewChips}>
                {review.missed.map((reviewHand) => (
                  <Text key={reviewHand} style={styles.reviewChip}>
                    {reviewHand}
                  </Text>
                ))}
              </View>
            </View>
          ) : null}
          {review.wronglyIncluded.length > 0 ? (
            <View style={styles.reviewRow}>
              <Text style={[styles.reviewLabel, styles.reviewLabelWrong]}>
                Wrongly included (out of range)
              </Text>
              <View testID="review-wrong" style={styles.reviewChips}>
                {review.wronglyIncluded.map((reviewHand) => (
                  <Text key={reviewHand} style={styles.reviewChip}>
                    {reviewHand}
                  </Text>
                ))}
              </View>
            </View>
          ) : null}
        </View>
      ) : null}
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
  review: {
    alignSelf: 'stretch',
    gap: 12,
    marginTop: 8,
  },
  reviewTitle: {
    color: colors.textStrong,
    fontSize: 15,
    fontWeight: '700',
  },
  reviewRow: {
    gap: 6,
  },
  reviewLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  reviewLabelMissed: {
    color: colors.danger,
  },
  reviewLabelWrong: {
    color: colors.accent,
  },
  reviewChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  reviewChip: {
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
    overflow: 'hidden',
    color: colors.textStrong,
    fontSize: 13,
    fontWeight: '600',
  },
});
