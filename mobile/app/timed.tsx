import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';

import {
  createPracticeAttempt,
  getRandomPracticeHand,
  summarizeHandAccuracy,
  summarizePracticeAttempts,
} from '@core/domain/practice';
import {
  DEFAULT_DRILL_SECONDS,
  DRILL_DURATION_OPTIONS,
  getRemainingSeconds,
  isDrillOver,
} from '@core/domain/timedDrill';
import { recordHandAccuracy } from '@core/storage/handAccuracyStorage';
import { recordPracticeSession } from '@core/storage/practiceStatsStorage';
import { findSavedRangeById } from '@core/storage/rangeStorage';
import type { PracticeAttempt } from '@core/types/practice';

import { colors } from '../theme/colors';

/**
 * Timed drill: answer as many hands as you can before a fixed countdown expires. The
 * answer loop and scoring reuse `@core/domain/practice` exactly like recognition
 * practice (and record per answer into the range's cumulative stats), while the
 * countdown math is the pure, tested `@core/domain/timedDrill` driven by an injected
 * `now` — so the screen owns only a one-second tick.
 */
export default function TimedScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const idParam = typeof params.id === 'string' ? params.id : undefined;
  const [range] = useState(() => (idParam ? findSavedRangeById(idParam) : undefined));

  const [durationSeconds, setDurationSeconds] = useState(DEFAULT_DRILL_SECONDS);
  const [startEpochMs, setStartEpochMs] = useState<number | null>(null);
  const [nowEpochMs, setNowEpochMs] = useState(0);
  const [hand, setHand] = useState(() => getRandomPracticeHand());
  const [attempts, setAttempts] = useState<PracticeAttempt[]>([]);
  const [lastAttempt, setLastAttempt] = useState<PracticeAttempt | null>(null);

  const over = startEpochMs !== null && isDrillOver(startEpochMs, durationSeconds, nowEpochMs);

  // Tick the displayed clock while the drill runs, and stop once it has expired. The
  // current time is read from Date.now() (the same source isDrillOver is evaluated on).
  useEffect(() => {
    if (startEpochMs === null) return;
    const id = setInterval(() => {
      const now = Date.now();
      setNowEpochMs(now);
      if (isDrillOver(startEpochMs, durationSeconds, now)) clearInterval(id);
    }, 250);
    return () => clearInterval(id);
  }, [startEpochMs, durationSeconds]);

  const start = useCallback(() => {
    const now = Date.now();
    setAttempts([]);
    setLastAttempt(null);
    setHand(getRandomPracticeHand());
    setNowEpochMs(now);
    setStartEpochMs(now);
  }, []);

  const restart = useCallback(() => {
    setStartEpochMs(null);
    setAttempts([]);
    setLastAttempt(null);
  }, []);

  const answer = useCallback(
    (answeredInRange: boolean) => {
      if (!range || startEpochMs === null) return;
      // Ignore answers landing after the buzzer (e.g. a tap mid-tick).
      if (isDrillOver(startEpochMs, durationSeconds, Date.now())) return;
      const attempt = createPracticeAttempt(hand, range.hands, answeredInRange);
      setAttempts((prev) => [...prev, attempt]);
      setLastAttempt(attempt);
      setHand(getRandomPracticeHand());
      // Record per answer, exactly like recognition practice, so timed sessions also
      // feed the library's per-range stats and the accuracy heatmap.
      recordPracticeSession(range.id, {
        totalQuestions: 1,
        correctAnswers: attempt.correct ? 1 : 0,
      });
      recordHandAccuracy(range.id, summarizeHandAccuracy([attempt]));
    },
    [hand, range, startEpochMs, durationSeconds],
  );

  if (!range) {
    return (
      <View style={styles.screen}>
        <Stack.Screen options={{ title: 'Timed drill' }} />
        <Text style={styles.notFound}>Range not found</Text>
      </View>
    );
  }

  const summary = summarizePracticeAttempts(attempts);
  const remaining =
    startEpochMs === null
      ? durationSeconds
      : getRemainingSeconds(startEpochMs, durationSeconds, nowEpochMs);

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: 'Timed drill' }} />
      <Text style={styles.rangeName}>{range.name || 'Untitled'}</Text>

      {startEpochMs === null ? (
        <>
          <Text style={styles.hint}>Answer as many hands as you can before time runs out.</Text>
          <View style={styles.durations}>
            {DRILL_DURATION_OPTIONS.map((seconds) => {
              const selected = durationSeconds === seconds;
              return (
                <Pressable
                  key={seconds}
                  testID={`duration-${seconds}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  style={[styles.durationChip, selected && styles.durationChipActive]}
                  onPress={() => setDurationSeconds(seconds)}
                >
                  <Text style={[styles.durationText, selected && styles.durationTextActive]}>
                    {seconds}s
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Pressable
            testID="timed-start"
            accessibilityRole="button"
            style={[styles.button, styles.startButton]}
            onPress={start}
          >
            <Text style={styles.startText}>Start</Text>
          </Pressable>
        </>
      ) : over ? (
        <View style={styles.overBox}>
          <Text testID="timed-over" style={styles.overText}>
            {"Time's up!"}
          </Text>
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
          <Pressable
            testID="timed-restart"
            accessibilityRole="button"
            style={[styles.button, styles.startButton]}
            onPress={restart}
          >
            <Text style={styles.startText}>Practice again</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <Text testID="timed-remaining" style={styles.remaining}>
            {remaining}
          </Text>
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
              {lastAttempt.correct ? 'Correct' : 'Incorrect'}
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
        </>
      )}
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
  hint: {
    color: colors.text,
    fontSize: 14,
    textAlign: 'center',
  },
  durations: {
    flexDirection: 'row',
    gap: 12,
  },
  durationChip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  durationChipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  durationText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  durationTextActive: {
    color: colors.onAccent,
  },
  button: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
  },
  startButton: {
    backgroundColor: colors.accent,
  },
  startText: {
    color: colors.onAccent,
    fontSize: 16,
    fontWeight: '600',
  },
  remaining: {
    color: colors.textStrong,
    fontSize: 40,
    fontWeight: '700',
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
  overBox: {
    alignItems: 'center',
    gap: 20,
  },
  overText: {
    color: colors.textStrong,
    fontSize: 24,
    fontWeight: '700',
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
