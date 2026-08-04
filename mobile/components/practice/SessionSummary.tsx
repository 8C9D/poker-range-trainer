import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import type { MissRecap } from '@core/domain/missRecap';

import { SaveErrorBanner } from '../liveSave';
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
  /** Daily-goal progress line (the workout reports it), or null to omit. */
  goalLine?: string | null;
  /** Streak confirmation line, or null when no streak is active. */
  streakLine: string | null;
  /** The session's missed hands, or null when nothing was missed. */
  misses?: MissRecap | null;
  /** Why the run could not be persisted, or null when it saved. */
  saveError?: string | null;
}

interface SessionSummaryProps {
  data: SessionSummaryData;
  /** Whether another range is waiting in the review queue. */
  hasNext: boolean;
  onNext: () => void;
  onDone: () => void;
}

/**
 * The peak-end session summary: an accuracy ring that scales in on mount, the count
 * line, the growth-framed delta, and the streak confirmation. The final score is
 * readable immediately; reduced motion skips the entrance animation entirely.
 */
export function SessionSummary({ data, hasNext, onNext, onDone }: SessionSummaryProps) {
  const theme = useTheme();
  const styles = makeStyles(theme);

  const [scale] = useState(() => new Animated.Value(1));

  useEffect(() => {
    let cancelled = false;
    let animation: Animated.CompositeAnimation | null = null;
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (cancelled || reduce) return;
      scale.setValue(0.85);
      animation = Animated.spring(scale, { toValue: 1, friction: 6, useNativeDriver: true });
      animation.start();
    });
    return () => {
      cancelled = true;
      animation?.stop();
    };
  }, [scale]);

  return (
    <View style={styles.wrap}>
      <Animated.View style={[styles.ring, { transform: [{ scale }] }]}>
        <Text style={styles.ringLabel}>{Math.round(data.accuracy)}%</Text>
      </Animated.View>
      <Text style={styles.count}>
        {data.correctAnswers} of {data.totalQuestions} correct
      </Text>
      {data.deltaLine ? <Text style={styles.delta}>{data.deltaLine}</Text> : null}
      {data.goalLine ? <Text style={styles.goal}>{data.goalLine}</Text> : null}
      {data.streakLine ? <Text style={styles.streak}>{data.streakLine}</Text> : null}
      {data.misses ? <MissRecapList misses={data.misses} styles={styles} /> : null}
      <SaveErrorBanner error={data.saveError ?? null} testID="summary-save-error" />
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

/**
 * The hands the session got wrong, as the two lists that are actually
 * actionable. Directions the run never missed are omitted rather than shown
 * empty, so a one-sided session reads as one line.
 */
function MissRecapList({
  misses,
  styles,
}: {
  misses: MissRecap;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={styles.misses} testID="summary-misses">
      <Text style={styles.sectionTitle} accessibilityRole="header">
        What you missed
      </Text>
      {misses.shouldPlay.length > 0 ? (
        <Text style={styles.missLine}>
          <Text style={styles.missLabel}>Play these: </Text>
          {misses.shouldPlay.join(', ')}
        </Text>
      ) : null}
      {misses.shouldFold.length > 0 ? (
        <Text style={styles.missLine}>
          <Text style={styles.missLabel}>Fold these: </Text>
          {misses.shouldFold.join(', ')}
        </Text>
      ) : null}
      {misses.hiddenCount > 0 ? (
        <Text style={styles.missMore}>
          and {misses.hiddenCount} more — the drill will bring them back.
        </Text>
      ) : null}
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
    goal: { fontFamily: fonts.body, fontSize: 14, color: theme.ink2, textAlign: 'center' },
    streak: { fontFamily: fonts.body, fontSize: 14, color: theme.accentStrong, textAlign: 'center' },
    misses: {
      alignSelf: 'stretch',
      gap: 4,
      padding: 14,
      borderRadius: 14,
      backgroundColor: theme.well,
    },
    sectionTitle: { fontFamily: fonts.display, fontSize: 14, color: theme.ink, marginBottom: 2 },
    missLine: { fontFamily: fonts.body, fontSize: 14, lineHeight: 21, color: theme.ink },
    missLabel: { fontFamily: fonts.bodySemibold, color: theme.ink2 },
    missMore: { fontFamily: fonts.body, fontSize: 14, color: theme.ink2 },
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
