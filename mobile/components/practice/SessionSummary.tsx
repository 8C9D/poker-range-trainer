import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { fonts } from '../../theme/fonts';
import { useTheme } from '../../theme/colors';
import type { ThemeColors } from '../../theme/colors';

export interface SessionSummaryData {
  totalQuestions: number;
  correctAnswers: number;
  /** Session accuracy 0-100. */
  accuracy: number;
  /** Growth-framed comparison line, or null when there is nothing to compare. */
  deltaLine: string | null;
  /** Streak confirmation line, or null when no streak is active. */
  streakLine: string | null;
}

interface SessionSummaryProps {
  data: SessionSummaryData;
  /** Whether another range is waiting in the review queue. */
  hasNext: boolean;
  onNext: () => void;
  onDone: () => void;
}

/**
 * The peak-end session summary: an accuracy ring whose percentage counts up (and scales
 * in) on mount, the count line, the growth-framed delta, and the streak confirmation.
 * Honors the reduce-motion setting — it snaps to the final value instead of animating.
 */
export function SessionSummary({ data, hasNext, onNext, onDone }: SessionSummaryProps) {
  const theme = useTheme();
  const styles = makeStyles(theme);

  const [value] = useState(() => new Animated.Value(0));
  const [scale] = useState(() => new Animated.Value(0.85));
  const [shown, setShown] = useState(0);

  useEffect(() => {
    const listenerId = value.addListener(({ value: v }) => setShown(Math.round(v)));
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (cancelled) return;
      if (reduce) {
        value.setValue(data.accuracy);
        scale.setValue(1);
        setShown(Math.round(data.accuracy));
        return;
      }
      Animated.parallel([
        Animated.timing(value, { toValue: data.accuracy, duration: 800, useNativeDriver: false }),
        Animated.spring(scale, { toValue: 1, friction: 6, useNativeDriver: true }),
      ]).start();
    });
    return () => {
      cancelled = true;
      value.removeListener(listenerId);
    };
  }, [data.accuracy, value, scale]);

  return (
    <View style={styles.wrap}>
      <Animated.View style={[styles.ring, { transform: [{ scale }] }]}>
        <Text style={styles.ringLabel}>{shown}%</Text>
      </Animated.View>
      <Text style={styles.count}>
        {data.correctAnswers} of {data.totalQuestions} correct
      </Text>
      {data.deltaLine ? <Text style={styles.delta}>{data.deltaLine}</Text> : null}
      {data.streakLine ? <Text style={styles.streak}>{data.streakLine}</Text> : null}
      <View style={styles.actions}>
        {hasNext ? (
          <>
            <Pressable testID="summary-next" style={styles.primaryBtn} onPress={onNext}>
              <Text style={styles.primaryBtnText}>Next range</Text>
            </Pressable>
            <Pressable testID="summary-done" style={styles.quietBtn} onPress={onDone}>
              <Text style={styles.quietBtnText}>Done</Text>
            </Pressable>
          </>
        ) : (
          <Pressable testID="summary-done" style={styles.primaryBtn} onPress={onDone}>
            <Text style={styles.primaryBtnText}>Done</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

function makeStyles(theme: ThemeColors) {
  return StyleSheet.create({
    wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
    ring: {
      width: 168,
      height: 168,
      borderRadius: 84,
      borderWidth: 12,
      borderColor: theme.goldFill,
      backgroundColor: theme.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    ringLabel: {
      fontFamily: fonts.display,
      fontSize: 46,
      color: theme.ink,
      fontVariant: ['tabular-nums'],
    },
    count: {
      fontFamily: fonts.bodyMedium,
      fontSize: 16,
      color: theme.ink,
      fontVariant: ['tabular-nums'],
    },
    delta: { fontFamily: fonts.bodySemibold, fontSize: 15.5, color: theme.ink2, textAlign: 'center' },
    streak: { fontFamily: fonts.body, fontSize: 14, color: theme.accent, textAlign: 'center' },
    actions: { flexDirection: 'row', gap: 12, marginTop: 8 },
    primaryBtn: {
      backgroundColor: theme.goldFill,
      borderRadius: 14,
      paddingHorizontal: 26,
      paddingVertical: 14,
    },
    primaryBtnText: { fontFamily: fonts.bodySemibold, fontSize: 16, color: theme.onAccent },
    quietBtn: { borderRadius: 14, paddingHorizontal: 22, paddingVertical: 14 },
    quietBtnText: { fontFamily: fonts.bodySemibold, fontSize: 16, color: theme.ink2 },
  });
}
