import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Link, useFocusEffect } from 'expo-router';

import { practiceAccuracyPercentage } from '@core/domain/practiceStats';
import {
  describeFreePractice,
  freePracticeAction,
  suggestFreePractice,
} from '@core/domain/freePractice';
import { currentStreak, selectDueRanges } from '@core/domain/spacedRepetition';
import {
  GOAL_OPTIONS,
  evaluateDailyGoal,
  goalLine,
} from '@core/domain/trainingGoal';
import { sessionsForLibrary, summarizeWeek } from '@core/domain/weeklyStats';
import { loadHandAccuracy } from '@core/storage/handAccuracyStorage';
import { loadPracticeStats } from '@core/storage/practiceStatsStorage';
import { loadReviewStates } from '@core/storage/reviewStateStorage';
import { loadSavedRanges } from '@core/storage/rangeStorage';
import { loadSessionHistory } from '@core/storage/sessionHistoryStorage';
import { loadTrainingGoal, saveTrainingGoal } from '@core/storage/trainingGoalStorage';

import { SaveErrorBanner } from '../../components/liveSave';
import { Screen } from '../../components/Screen';
import { StorageLossNotice } from '../../components/StorageLossNotice';
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
  // Sessions recorded against ranges that have since gone away would still count
  // toward the streak, the week tiles, and the daily goal.
  const history = sessionsForLibrary(loadSessionHistory(), ranges);
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
  const week = summarizeWeek(history, nowIso, 7);
  const sharpestName = week.sharpestRangeId
    ? (ranges.find((range) => range.id === week.sharpestRangeId)?.name ?? null)
    : null;
  const goal = loadTrainingGoal();
  // Only worth computing when nothing is due, which is exactly when it is shown.
  const freePractice =
    due.length === 0
      ? suggestFreePractice({
          ranges,
          handAccuracy: loadHandAccuracy(),
          reviewStates,
          now: nowIso,
        })
      : null;
  return {
    now,
    nowIso,
    ranges,
    practiceStats,
    due,
    freePractice,
    streak,
    week,
    sharpestName,
    history,
    goal,
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
  const [goalError, setGoalError] = useState<string | null>(null);
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
    freePractice,
    streak,
    week,
    sharpestName,
    history,
    goal,
  } = state;
  const estimatedMinutes = Math.max(1, Math.ceil(due.length * MINUTES_PER_RANGE));
  const goalProgress = evaluateDailyGoal(history, nowIso, goal);
  // A weak-hand suggestion drills each range restricted to its own pool, exactly
  // like the Progress screen's; getting ahead is an ordinary recognition run.
  const freePracticeParams =
    freePractice?.kind === 'weakHands'
      ? {
          queue: freePractice.ranges.map((range) => range.id).join(','),
          mode: 'recognize',
          pools: JSON.stringify(freePractice.pools),
        }
      : freePractice
        ? { queue: freePractice.range.id, mode: 'recognize' }
        : undefined;

  const pickGoal = (target: number) => {
    // A throw here (full or unavailable store) would leave the picker showing a
    // target nothing saved, so report it and keep the old one.
    try {
      saveTrainingGoal(target);
    } catch (error) {
      setGoalError(error instanceof Error ? error.message : 'Could not save the daily goal.');
      return;
    }
    setGoalError(null);
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
        {/* Above everything: the library on screen below it may be a fraction of
            what the user actually had, and nothing else would ever say so. */}
        <StorageLossNotice />
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
              {/* The emoji is a sibling, not nested: a nested Text inherits the
                  chip's Instrument Sans, which carries no emoji glyph, and a
                  Release build draws the missing-glyph box instead of falling
                  back. Left family-less, it renders in the system font. */}
              <Text style={styles.streakEmoji}>🔥</Text>
              <Text style={styles.streakText}>
                {streak} day{streak === 1 ? '' : 's'}
              </Text>
            </Pressable>
          ) : null}
        </View>

        {ranges.length === 0 ? (
          <View testID="today-onboarding" style={styles.card}>
            <Text accessibilityRole="header" style={styles.cardTitle}>Welcome</Text>
            <Text style={styles.cardBody}>
              You have no ranges yet. Create your first one — pick the hands on the grid, save
              it, and it shows up here ready to train.
            </Text>
            <Link href="/range/new" asChild>
              <Pressable
                testID="create-first-range"
                accessibilityRole="button"
                style={styles.primaryBtn}
              >
                <Text style={styles.primaryBtnText}>Create a range</Text>
              </Pressable>
            </Link>
            <Link href="/library" asChild>
              <Pressable accessibilityRole="button" style={styles.ghostBtn}>
                <Text style={styles.ghostBtnText}>Open Library</Text>
              </Pressable>
            </Link>
          </View>
        ) : (
          <>
            {due.length > 0 ? (
              <View style={styles.card}>
                <Text accessibilityRole="header" style={styles.cardTitle}>Today&rsquo;s review</Text>
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
                  <Pressable testID="start-review" style={styles.primaryBtn}>
                    <Text style={styles.primaryBtnText}>Start review</Text>
                  </Pressable>
                </Link>
              </View>
            ) : (
              <View testID="today-caught-up" style={styles.card}>
                <Text accessibilityRole="header" style={styles.cardTitle}>All caught up</Text>
                <Text style={styles.cardBody}>
                  {freePractice
                    ? `Nothing is due right now. ${describeFreePractice(freePractice)}`
                    : 'Nothing is due right now. Fancy a free practice run anyway?'}
                </Text>
                {/* Caught up is where a steady user spends most days, so the card
                    runs the practice the records call for rather than handing the
                    "which range, which mode" decision back at the Library door. */}
                {freePractice ? (
                  <Link href={{ pathname: '/practice', params: freePracticeParams }} asChild>
                    <Pressable testID="free-practice" style={styles.ghostBtn}>
                      <Text style={styles.ghostBtnText}>{freePracticeAction(freePractice)}</Text>
                    </Pressable>
                  </Link>
                ) : (
                  <Link href="/library" asChild>
                    <Pressable style={styles.ghostBtn}>
                      <Text style={styles.ghostBtnText}>Free practice</Text>
                    </Pressable>
                  </Link>
                )}
              </View>
            )}

            {due.length > 0 ? (
              <View style={styles.card}>
                <Text accessibilityRole="header" style={styles.sectionTitle}>Due now</Text>
                <View style={styles.dueList}>
                  {due.map((range) => {
                    const stats = practiceStats[range.id];
                    return (
                      <View key={range.id} testID={`due-row-${range.id}`} style={styles.dueRow}>
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
                <Text accessibilityRole="header" style={styles.sectionTitle}>Daily goal</Text>
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
              <SaveErrorBanner error={goalError} testID="goal-error" />
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
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    streakEmoji: { fontSize: 13 },
    streakText: {
      fontFamily: fonts.bodySemibold,
      fontSize: 13,
      // The chip's own accentSoft fill lightens the ground, which left the
      // lighter `accent` gold at 2.8:1 on it.
      color: theme.accentStrong,
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
