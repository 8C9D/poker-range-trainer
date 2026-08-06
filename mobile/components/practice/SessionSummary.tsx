import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import type { MissRecap } from '@core/domain/missRecap';
import type { PokerHand } from '@core/domain/pokerHands';

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
  /**
   * Re-run this range over just the hands it missed. Omitted when the run has
   * no misses, or when its misses are not a pool one drill could deal from.
   */
  onDrillMisses?: () => void;
}

/**
 * The peak-end session summary: an accuracy ring that scales in on mount, the count
 * line, the growth-framed delta, and the streak confirmation. The final score is
 * readable immediately; reduced motion skips the entrance animation entirely.
 */
export function SessionSummary({
  data,
  hasNext,
  onNext,
  onDone,
  onDrillMisses,
}: SessionSummaryProps) {
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
      {data.streakLine ? <Text style={styles.streak}>{data.streakLine}</Text> : null}
      {data.misses ? (
        <MissRecapList
          groups={[
            { label: 'Play these', hands: data.misses.shouldPlay },
            { label: 'Fold these', hands: data.misses.shouldFold },
          ]}
          hiddenCount={data.misses.hiddenCount}
          styles={styles}
          onDrill={onDrillMisses}
        />
      ) : null}
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
 * The hands the session got wrong, as the lists that are actually actionable —
 * one per lesson ("Play these", "3-bet these"). Groups the run never missed are
 * omitted rather than shown empty, so a one-sided session reads as one line.
 */
function MissRecapList({
  groups,
  hiddenCount,
  styles,
  onDrill,
}: {
  groups: { label: string; hands: PokerHand[] }[];
  hiddenCount: number;
  styles: ReturnType<typeof makeStyles>;
  onDrill?: () => void;
}) {
  return (
    <View style={styles.misses} testID="summary-misses">
      <Text style={styles.sectionTitle} accessibilityRole="header">
        What you missed
      </Text>
      {groups
        .filter((group) => group.hands.length > 0)
        .map((group) => (
          <Text key={group.label} style={styles.missLine}>
            <Text style={styles.missLabel}>{group.label}: </Text>
            {group.hands.join(', ')}
          </Text>
        ))}
      {hiddenCount > 0 ? (
        <Text style={styles.missMore}>
          and {hiddenCount} more — the drill will bring them back.
        </Text>
      ) : null}
      {/* Reading the list is the lesson; drilling it right away is the practice.
          Deals EVERY hand the run missed, not just the ones named above. */}
      {onDrill ? (
        <Pressable
          testID="summary-drill-misses"
          accessibilityRole="button"
          style={styles.missDrillBtn}
          onPress={onDrill}
        >
          <Text style={styles.missDrillBtnText}>Drill these now</Text>
        </Pressable>
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
    missDrillBtn: {
      alignSelf: 'center',
      marginTop: 8,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.line,
      backgroundColor: theme.surface,
      paddingHorizontal: 16,
      paddingVertical: 10,
    },
    missDrillBtnText: { fontFamily: fonts.bodySemibold, fontSize: 14, color: theme.ink },
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
