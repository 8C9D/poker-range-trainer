import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Link } from 'expo-router';

import { accuracyPercentage } from '@core/domain/accuracy';
import { handAccuracyRate, handsWithMistakes, rankHandAccuracy } from '@core/domain/practice';
import { loadHandAccuracy } from '@core/storage/handAccuracyStorage';
import { loadSessionHistory } from '@core/storage/sessionHistoryStorage';

import { fonts } from '../theme/fonts';
import { useTheme } from '../theme/colors';
import type { ThemeColors } from '../theme/colors';


/**
 * The Range page's Stats tab: weakest hands with a "Practice weak hands" shortcut,
 * and session history. All stats come from the reused `@core` storage/domain; this
 * only lays them out. "Practice weak hands" links to the recognition drill restricted
 * to the mistake pool.
 */
export function RangeStats({ id }: { id: string }) {
  const theme = useTheme();
  const styles = makeStyles(theme);

  const [handAccuracy] = useState(() => loadHandAccuracy()[id] ?? {});
  const [history] = useState(() => loadSessionHistory()[id] ?? []);

  const weakest = rankHandAccuracy(handAccuracy).slice(0, 8);
  const mistakePool = handsWithMistakes(handAccuracy);
  const recentSessions = history.slice(-8).reverse();
  const hasAnyData = weakest.length > 0 || history.length > 0;

  if (!hasAnyData) {
    return (
      <View style={styles.card}>
        <Text style={styles.emptyText}>
          No practice data yet. Run a session to see your weak hands and history.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.stack}>
      {weakest.length > 0 ? (
        <View style={styles.card}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>Weakest hands</Text>
          <View style={styles.chips}>
            {weakest.map((stat) => (
              <View key={stat.hand} style={styles.statChip}>
                <Text style={styles.statChipText}>
                  {stat.hand} {handAccuracyRate(stat).toFixed(0)}%
                </Text>
              </View>
            ))}
          </View>
          {mistakePool.length > 0 ? (
            <Link
              href={{
                pathname: '/practice',
                params: { id, mode: 'recognize', pool: mistakePool.join(',') },
              }}
              asChild
            >
              <Pressable testID="practice-weak-hands" style={styles.primaryBtn}>
                <Text style={styles.primaryBtnText}>Practice weak hands</Text>
              </Pressable>
            </Link>
          ) : null}
        </View>
      ) : null}

      {recentSessions.length > 0 ? (
        <View style={styles.card}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>Session history</Text>
          {recentSessions.map((session) => (
            <View key={session.playedAt} style={styles.actionRow}>
              <Text style={styles.actionName}>{new Date(session.playedAt).toLocaleDateString()}</Text>
              <Text style={styles.actionRate}>
                {session.correctAnswers}/{session.totalQuestions} ·{' '}
                {accuracyPercentage(session.correctAnswers, session.totalQuestions).toFixed(0)}%
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function makeStyles(theme: ThemeColors) {
  return StyleSheet.create({
    stack: { gap: 14 },
    card: {
      backgroundColor: theme.surface,
      borderColor: theme.line,
      borderWidth: StyleSheet.hairlineWidth,
      borderRadius: 16,
      padding: 16,
      gap: 12,
    },
    emptyText: { fontFamily: fonts.body, fontSize: 15, color: theme.ink2 },
    sectionTitle: { fontFamily: fonts.bodySemibold, fontSize: 14, color: theme.ink },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    statChip: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.line,
      backgroundColor: theme.card,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    statChipText: {
      fontFamily: fonts.bodyMedium,
      fontSize: 12.5,
      color: theme.ink2,
      fontVariant: ['tabular-nums'],
    },
    primaryBtn: {
      alignSelf: 'flex-start',
      backgroundColor: theme.goldFill,
      borderRadius: 12,
      paddingHorizontal: 18,
      paddingVertical: 11,
    },
    primaryBtnText: { fontFamily: fonts.bodySemibold, fontSize: 14, color: theme.onAccent },
    actionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    actionName: { fontFamily: fonts.bodyMedium, fontSize: 14, color: theme.ink, textTransform: 'capitalize' },
    actionRate: {
      fontFamily: fonts.bodyMedium,
      fontSize: 13,
      color: theme.ink2,
      fontVariant: ['tabular-nums'],
    },
  });
}
