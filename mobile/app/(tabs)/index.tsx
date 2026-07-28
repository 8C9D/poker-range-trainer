import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Link, useFocusEffect } from 'expo-router';

import { buildDailyWorkout, summarizeWorkout } from '@core/domain/dailyWorkout';
import { practiceAccuracyPercentage } from '@core/domain/practiceStats';
import { currentStreak, selectDueRanges } from '@core/domain/spacedRepetition';
import { buildSpotCoverage, inferLibraryContext } from '@core/domain/spotCoverage';
import {
  GOAL_OPTIONS,
  evaluateDailyGoal,
  goalLine,
} from '@core/domain/trainingGoal';
import { summarizeWeek } from '@core/domain/weeklyStats';
import { loadPracticeStats } from '@core/storage/practiceStatsStorage';
import { loadReviewStates } from '@core/storage/reviewStateStorage';
import { loadSavedRanges } from '@core/storage/rangeStorage';
import { loadSessionHistory } from '@core/storage/sessionHistoryStorage';
import { loadSpotAccuracy } from '@core/storage/spotAccuracyStorage';
import { loadTrainingGoal, saveTrainingGoal } from '@core/storage/trainingGoalStorage';

import { RangeThumbnail } from '../../components/RangeThumbnail';
import { Screen } from '../../components/Screen';
import { formatDateLine, formatDayDistance, greetingFor } from '../../lib/format';
import { fonts } from '../../theme/fonts';
import { useTheme } from '../../theme/colors';
import type { ThemeColors } from '../../theme/colors';

/** Rough drill length used for the "~X min" estimate on the review CTA. */
const MINUTES_PER_RANGE = 1.5;

function loadTodayState() {
  const now = new Date();
  const nowIso = now.toISOString();
  const ranges = loadSavedRanges();
  const reviewStates = loadReviewStates();
  const history = loadSessionHistory();
  const practiceStats = loadPracticeStats();
  const due = selectDueRanges(
    ranges.filter((range) => !range.archived),
    reviewStates,
    nowIso,
  );
  const playedAt = Object.values(history)
    .flat()
    .map((session) => session.playedAt);
  const streak = currentStreak(playedAt, nowIso);
  const week = summarizeWeek(history, nowIso);
  const sharpestName = week.sharpestRangeId
    ? (ranges.find((range) => range.id === week.sharpestRangeId)?.name ?? null)
    : null;
  const goal = loadTrainingGoal();
  // The spot drill only has something to deal once a range describes a situation.
  const spotFormat = inferLibraryContext(ranges);
  const spotCoverage = buildSpotCoverage(ranges, spotFormat.tableSize, spotFormat.stackDepthBb);
  const workout = buildDailyWorkout({
    ranges,
    reviewStates,
    spotAccuracy: loadSpotAccuracy(),
    now: nowIso,
    goalHands: goal,
  });
  return {
    now,
    nowIso,
    ranges,
    practiceStats,
    due,
    streak,
    week,
    sharpestName,
    history,
    goal,
    spotFormat,
    spotCoverage,
    workout,
  };
}

/**
 * The Today tab: what's due today, one primary action. Data is reloaded whenever the
 * tab regains focus (returning from a drill), so stats and the due queue stay fresh.
 * The due queue is the real spaced-repetition schedule from `selectDueRanges`.
 */
export default function TodayScreen() {
  const theme = useTheme();
  const styles = makeStyles(theme);
  const [state, setState] = useState(loadTodayState);
  useFocusEffect(
    useCallback(() => {
      setState(loadTodayState());
    }, []),
  );

  const {
    now,
    nowIso,
    ranges,
    practiceStats,
    due,
    streak,
    week,
    sharpestName,
    history,
    goal,
    spotFormat,
    spotCoverage,
    workout,
  } = state;
  const estimatedMinutes = Math.max(1, Math.ceil(due.length * MINUTES_PER_RANGE));
  const goalProgress = evaluateDailyGoal(history, nowIso, goal);

  const pickGoal = (target: number) => {
    saveTrainingGoal(target);
    // The workout is sized to the goal, so reload the whole card state.
    setState(loadTodayState());
  };

  const explainStreak = () =>
    Alert.alert(
      'Practice streak',
      'Counts consecutive days with at least one practice session. One rest day is forgiven before it resets.',
    );

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.date}>{formatDateLine(now)}</Text>
        <View style={styles.headingRow}>
          <Text testID="today-greeting" style={styles.greeting}>
            {greetingFor(now)}
          </Text>
          {streak > 0 ? (
            <Pressable
              testID="today-streak"
              onPress={explainStreak}
              accessibilityRole="button"
              accessibilityLabel={`${streak} day streak`}
              accessibilityHint="One rest day is forgiven before your streak resets."
              style={styles.streakChip}
            >
              <Text style={styles.streakText}>
                🔥 {streak} day{streak === 1 ? '' : 's'}
              </Text>
            </Pressable>
          ) : null}
        </View>

        {ranges.length === 0 ? (
          <View testID="today-onboarding" style={styles.card}>
            <Text style={styles.cardTitle}>Welcome</Text>
            <Text style={styles.cardBody}>
              You have no ranges yet. Build your first one in the Library, then come back here to
              train it on a schedule.
            </Text>
            <Link href="/library" asChild>
              <Pressable style={styles.primaryBtn}>
                <Text style={styles.primaryBtnText}>Open Library</Text>
              </Pressable>
            </Link>
          </View>
        ) : (
          <>
            {workout ? (
              <View testID="today-workout" style={styles.card}>
                <Text style={styles.cardTitle}>Daily workout</Text>
                <Text style={styles.cardBody}>{summarizeWorkout(workout)}</Text>
                <Link href="/workout" asChild>
                  <Pressable testID="start-workout" style={styles.primaryBtn}>
                    <Text style={styles.primaryBtnText}>Start workout</Text>
                  </Pressable>
                </Link>
              </View>
            ) : null}

            {due.length > 0 ? (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Today&rsquo;s review</Text>
                <Text style={styles.cardBody}>
                  {due.length} range{due.length === 1 ? '' : 's'} due · ~{estimatedMinutes} min
                </Text>
                <Link
                  href={{
                    pathname: '/practice',
                    params: { queue: due.map((range) => range.id).join(','), mode: 'recognize' },
                  }}
                  asChild
                >
                  <Pressable
                    testID="start-review"
                    style={workout ? styles.ghostBtn : styles.primaryBtn}
                  >
                    <Text style={workout ? styles.ghostBtnText : styles.primaryBtnText}>
                      Start review
                    </Text>
                  </Pressable>
                </Link>
              </View>
            ) : (
              <View testID="today-caught-up" style={styles.card}>
                <Text style={styles.cardTitle}>All caught up</Text>
                <Text style={styles.cardBody}>
                  Nothing is due right now. Fancy a free practice run anyway?
                </Text>
                <Link href="/library" asChild>
                  <Pressable style={styles.ghostBtn}>
                    <Text style={styles.ghostBtnText}>Free practice</Text>
                  </Pressable>
                </Link>
              </View>
            )}

            {spotCoverage.covered > 0 ? (
              <View testID="today-spots" style={styles.card}>
                <Text style={styles.cardTitle}>Play the spot</Text>
                <Text style={styles.cardBody}>
                  The table deals the situation · {spotCoverage.covered} of {spotCoverage.total}{' '}
                  spots covered
                </Text>
                <Link
                  href={{
                    pathname: '/practice',
                    params: {
                      mode: 'spots',
                      table: spotFormat.tableSize,
                      stack: String(spotFormat.stackDepthBb),
                    },
                  }}
                  asChild
                >
                  <Pressable testID="play-spots" style={styles.ghostBtn}>
                    <Text style={styles.ghostBtnText}>Play</Text>
                  </Pressable>
                </Link>
              </View>
            ) : null}

            {due.length > 0 ? (
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Due now</Text>
                <View style={styles.dueList}>
                  {due.map((range) => {
                    const stats = practiceStats[range.id];
                    return (
                      <View key={range.id} testID={`due-row-${range.id}`} style={styles.dueRow}>
                        <RangeThumbnail hands={range.hands} size={40} />
                        <View style={styles.dueInfo}>
                          <Text style={styles.dueName} numberOfLines={1}>
                            {range.name || 'Untitled'}
                          </Text>
                          <Text style={styles.dueMeta} numberOfLines={1}>
                            {stats
                              ? `${practiceAccuracyPercentage(stats).toFixed(0)}% last · practiced ${formatDayDistance(stats.lastPracticedAt, nowIso)}`
                              : 'New — never practiced'}
                          </Text>
                        </View>
                        <Link
                          href={{ pathname: '/practice', params: { id: range.id, mode: 'recognize' } }}
                          asChild
                        >
                          <Pressable testID={`review-${range.id}`} style={styles.rowBtn}>
                            <Text style={styles.rowBtnText}>Review</Text>
                          </Pressable>
                        </Link>
                      </View>
                    );
                  })}
                </View>
              </View>
            ) : null}

            <View testID="today-goal" style={styles.card}>
              <View style={styles.goalHead}>
                <Text style={styles.sectionTitle}>Daily goal</Text>
                <View style={styles.goalOptions}>
                  {[0, ...GOAL_OPTIONS].map((option) => {
                    const active = goal === option;
                    return (
                      <Pressable
                        key={option}
                        testID={`goal-${option}`}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                        onPress={() => pickGoal(option)}
                        style={[styles.goalChip, active && styles.goalChipActive]}
                      >
                        <Text style={[styles.goalChipText, active && styles.goalChipTextActive]}>
                          {option === 0 ? 'Off' : option}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
              <Text testID="goal-line" style={styles.goalLine}>
                {goalLine(goalProgress)}
              </Text>
              {goal > 0 ? (
                <View
                  testID="goal-bar"
                  accessibilityRole="progressbar"
                  accessibilityValue={{ min: 0, max: 100, now: Math.round(goalProgress.percent) }}
                  style={styles.goalTrack}
                >
                  <View style={[styles.goalFill, { width: `${goalProgress.percent}%` }]} />
                </View>
              ) : null}
            </View>

            <View style={styles.tiles}>
              <View style={styles.tile}>
                <Text testID="week-hands" style={styles.tileValue}>
                  {week.handsAnswered}
                </Text>
                <Text style={styles.tileLabel}>Hands this week</Text>
              </View>
              <View style={styles.tile}>
                <Text testID="week-accuracy" style={styles.tileValue}>
                  {week.handsAnswered > 0 ? `${week.accuracy.toFixed(0)}%` : '—'}
                </Text>
                <Text style={styles.tileLabel}>Accuracy</Text>
              </View>
              <View style={styles.tile}>
                <Text testID="week-sharpest" style={styles.tileName} numberOfLines={2}>
                  {sharpestName ?? '—'}
                </Text>
                <Text style={styles.tileLabel}>Sharpest range</Text>
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

function makeStyles(theme: ThemeColors) {
  return StyleSheet.create({
    content: { padding: 16, gap: 16 },
    date: { fontFamily: fonts.bodyMedium, fontSize: 13, color: theme.ink3, marginTop: 4 },
    headingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    greeting: { fontFamily: fonts.display, fontSize: 30, color: theme.ink, flexShrink: 1 },
    streakChip: {
      backgroundColor: theme.accentSoft,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    streakText: {
      fontFamily: fonts.bodySemibold,
      fontSize: 13,
      color: theme.accent,
      fontVariant: ['tabular-nums'],
    },
    card: {
      backgroundColor: theme.surface,
      borderColor: theme.line,
      borderWidth: StyleSheet.hairlineWidth,
      borderRadius: 16,
      padding: 18,
      gap: 10,
    },
    cardTitle: { fontFamily: fonts.displaySemibold, fontSize: 20, color: theme.ink },
    cardBody: {
      fontFamily: fonts.body,
      fontSize: 15,
      color: theme.ink2,
      fontVariant: ['tabular-nums'],
    },
    sectionTitle: { fontFamily: fonts.bodySemibold, fontSize: 13, color: theme.ink2, letterSpacing: 0.3 },
    primaryBtn: {
      alignSelf: 'flex-start',
      backgroundColor: theme.goldFill,
      borderRadius: 12,
      paddingHorizontal: 20,
      paddingVertical: 12,
      marginTop: 4,
    },
    primaryBtnText: { fontFamily: fonts.bodySemibold, fontSize: 15, color: theme.onAccent },
    ghostBtn: {
      alignSelf: 'flex-start',
      borderColor: theme.line2,
      borderWidth: StyleSheet.hairlineWidth,
      borderRadius: 12,
      paddingHorizontal: 20,
      paddingVertical: 12,
      marginTop: 4,
    },
    ghostBtnText: { fontFamily: fonts.bodySemibold, fontSize: 15, color: theme.ink },
    dueList: { gap: 12, marginTop: 4 },
    dueRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    dueInfo: { flex: 1, gap: 2 },
    dueName: { fontFamily: fonts.bodySemibold, fontSize: 15, color: theme.ink },
    dueMeta: {
      fontFamily: fonts.body,
      fontSize: 12,
      color: theme.ink2,
      fontVariant: ['tabular-nums'],
    },
    rowBtn: {
      borderColor: theme.line2,
      borderWidth: StyleSheet.hairlineWidth,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 8,
    },
    rowBtnText: { fontFamily: fonts.bodySemibold, fontSize: 13, color: theme.ink },
    goalHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    goalOptions: { flexDirection: 'row', gap: 6 },
    goalChip: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.line2,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 5,
    },
    goalChipActive: { backgroundColor: theme.line2 },
    goalChipText: { fontFamily: fonts.bodyMedium, fontSize: 12, color: theme.ink2 },
    goalChipTextActive: { color: theme.ink },
    goalLine: {
      fontFamily: fonts.body,
      fontSize: 14,
      color: theme.ink2,
      fontVariant: ['tabular-nums'],
    },
    goalTrack: { height: 8, borderRadius: 999, backgroundColor: theme.line, overflow: 'hidden' },
    goalFill: { height: '100%', borderRadius: 999, backgroundColor: theme.goldFill },
    tiles: { flexDirection: 'row', gap: 10 },
    tile: {
      flex: 1,
      backgroundColor: theme.surface,
      borderColor: theme.line,
      borderWidth: StyleSheet.hairlineWidth,
      borderRadius: 14,
      padding: 12,
      gap: 4,
      minHeight: 84,
      justifyContent: 'center',
    },
    tileValue: {
      fontFamily: fonts.display,
      fontSize: 24,
      color: theme.ink,
      fontVariant: ['tabular-nums'],
    },
    tileName: { fontFamily: fonts.displaySemibold, fontSize: 15, color: theme.ink },
    tileLabel: { fontFamily: fonts.body, fontSize: 12, color: theme.ink3 },
  });
}
