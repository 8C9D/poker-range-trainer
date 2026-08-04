import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Link, useFocusEffect } from 'expo-router';

import { HAND_CLASS_LABELS } from '@core/domain/handClass';
import { rankHandClassLeaks } from '@core/domain/leakReport';
import { summarizeLibraryAnalytics } from '@core/domain/libraryAnalytics';
import { currentStreak } from '@core/domain/spacedRepetition';
import { describeSpot, matchRangeToSpot, spotKey } from '@core/domain/spot';
import { rankSpotLeaks } from '@core/domain/spotLeaks';
import {
  accuracyByActionType,
  accuracyByPosition,
  rangesAtPosition,
  rangesWithActionType,
  type AccuracyGroup,
} from '@core/domain/seatAccuracy';
import { rankWeakHands, weakHandPools } from '@core/domain/weakHands';
import {
  dailyHandCounts,
  sessionsForLibrary,
  summarizeWeek,
  weeklyAccuracyTrend,
} from '@core/domain/weeklyStats';
import { loadHandAccuracy } from '@core/storage/handAccuracyStorage';
import { loadPracticeStats } from '@core/storage/practiceStatsStorage';
import { loadSavedRanges } from '@core/storage/rangeStorage';
import { loadSessionHistory } from '@core/storage/sessionHistoryStorage';
import { loadSpotAccuracy } from '@core/storage/spotAccuracyStorage';
import { ACTION_TYPE_LABELS, POSITION_LABELS, type SavedRange } from '@core/types/range';

import { Screen } from '../../components/Screen';
import { fonts } from '../../theme/fonts';
import { useTheme } from '../../theme/colors';
import type { ThemeColors } from '../../theme/colors';

const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const MONTHS_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

function loadProgressState() {
  const ranges = loadSavedRanges();
  // Every per-range cut below is already scoped to the live library; the volume
  // and accuracy figures have to be scoped the same way or they contradict it.
  const history = sessionsForLibrary(loadSessionHistory(), ranges);
  const practiceStats = loadPracticeStats();
  const handAccuracy = loadHandAccuracy();
  const nowIso = new Date().toISOString();
  const playedAt = Object.values(history)
    .flat()
    .map((session) => session.playedAt);
  const streak = currentStreak(playedAt, nowIso);
  const month = summarizeWeek(history, nowIso, 30);
  const liveRangeIds = new Set(ranges.map((range) => range.id));
  const analytics = summarizeLibraryAnalytics(
    Object.values(practiceStats).filter((stat) => liveRangeIds.has(stat.rangeId)),
  );
  const days = dailyHandCounts(history, nowIso);
  const trend = weeklyAccuracyTrend(history, nowIso);
  // Stats for deleted ranges would name leaks the user can no longer drill. Both
  // reports below rank a CAPPED list, so the scoping happens before the ranking:
  // filtering afterwards lets an orphaned record spend one of the slots and push
  // a real leak off the end.
  const liveAccuracy = Object.fromEntries(
    Object.entries(handAccuracy).filter(([rangeId]) => liveRangeIds.has(rangeId)),
  );
  const weakHands = rankWeakHands(liveAccuracy);
  const leaks = rankHandClassLeaks(liveAccuracy);
  const spotLeaks = rankSpotLeaks(loadSpotAccuracy()).filter(
    (leak) => matchRangeToSpot(ranges, leak.spot) !== null,
  );
  const seatGroups = accuracyByPosition(ranges, practiceStats);
  const actionGroups = accuracyByActionType(ranges, practiceStats);
  return {
    ranges,
    practiceStats,
    streak,
    month,
    analytics,
    days,
    trend,
    weakHands,
    leaks,
    seatGroups,
    actionGroups,
    spotLeaks,
  };
}

/** Long-term training overview: streak, accuracy, volume, and weak spots. */
export default function ProgressScreen() {
  const theme = useTheme();
  const styles = makeStyles(theme);
  const [state, setState] = useState(loadProgressState);
  useFocusEffect(
    useCallback(() => {
      setState(loadProgressState());
    }, []),
  );

  const {
    ranges,
    practiceStats,
    streak,
    month,
    analytics,
    days,
    trend,
    weakHands,
    leaks,
    seatGroups,
    actionGroups,
    spotLeaks,
  } = state;
  const maxDay = Math.max(1, ...days.map((day) => day.handsAnswered));
  const trendHasData = trend.some((point) => point.handsAnswered > 0);
  const weekHasData = days.some((day) => day.handsAnswered > 0);
  const rangeName = (rangeId: string) =>
    ranges.find((range) => range.id === rangeId)?.name ?? 'Deleted range';

  const pools = weakHandPools(weakHands);
  const drillQueue = ranges.filter((range) => pools[range.id]?.length);
  const drillParams = {
    queue: drillQueue.map((range) => range.id).join(','),
    mode: 'recognize',
    pools: JSON.stringify(
      Object.fromEntries(drillQueue.map((range) => [range.id, pools[range.id]])),
    ),
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <Text accessibilityRole="header" style={styles.title}>Progress</Text>

        <View style={styles.tiles}>
          <View style={styles.tile}>
            <Text style={styles.tileValue}>
              {streak} day{streak === 1 ? '' : 's'}
            </Text>
            <Text style={styles.tileLabel}>Streak — one rest day is forgiven</Text>
          </View>
          <View style={styles.tile}>
            <Text style={styles.tileValue}>
              {month.handsAnswered > 0 ? `${month.accuracy.toFixed(0)}%` : '—'}
            </Text>
            <Text style={styles.tileLabel}>30-day accuracy</Text>
          </View>
          <View style={styles.tile}>
            <Text testID="hands-all-time" style={styles.tileValue}>
              {analytics.totalAttempts}
            </Text>
            <Text style={styles.tileLabel}>Hands all-time</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>Hands answered this week</Text>
          {weekHasData ? (
            <View style={styles.chart}>
              {days.map((day, index) => {
                const isToday = index === days.length - 1;
                const weekday = WEEKDAYS_SHORT[new Date(day.dayStart).getDay()];
                const heightPct = Math.round((day.handsAnswered / maxDay) * 100);
                return (
                  <View
                    key={day.dayStart}
                    style={styles.chartCol}
                    // `accessible` is what makes the column one element VoiceOver
                    // can name; without it the label is dropped and the bare
                    // number and weekday are read as two unrelated scraps.
                    accessible
                    accessibilityLabel={`${weekday}: ${day.handsAnswered} hand${day.handsAnswered === 1 ? '' : 's'}`}
                  >
                    {/* A bar with no number reads as decoration: 20 hands and 200
                        draw the same full-height column. */}
                    <Text testID={`chart-value-${index}`} style={styles.chartValue}>
                      {day.handsAnswered > 0 ? String(day.handsAnswered) : ''}
                    </Text>
                    <View style={styles.chartBarTrack}>
                      <View
                        style={[
                          styles.chartBar,
                          {
                            height: `${Math.max(2, heightPct)}%`,
                            backgroundColor: isToday ? theme.goldFill : theme.line2,
                          },
                        ]}
                      />
                    </View>
                    <Text style={[styles.chartLabel, isToday && { color: theme.ink }]}>
                      {weekday}
                    </Text>
                  </View>
                );
              })}
            </View>
          ) : (
            // An all-zero chart is seven bare ticks: decoration that says nothing.
            // Every sibling card explains itself when empty; this one should too.
            <Text testID="week-empty" style={styles.empty}>
              Answer some hands and this week’s practice will show up here.
            </Text>
          )}
        </View>

        <View style={styles.card}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>Accuracy by week</Text>
          {trendHasData ? (
            <View style={styles.chart}>
              {trend.map((point, index) => {
                const isThisWeek = index === trend.length - 1;
                const weekStart = new Date(point.weekStart);
                const weekLabel = `${MONTHS_SHORT[weekStart.getMonth()]} ${weekStart.getDate()}`;
                return (
                  <View
                    key={point.weekStart}
                    style={styles.chartCol}
                    accessible
                    accessibilityLabel={
                      point.handsAnswered > 0
                        ? `Week of ${weekLabel}: ${point.accuracy.toFixed(0)}% over ${point.handsAnswered} hand${point.handsAnswered === 1 ? '' : 's'}`
                        : `Week of ${weekLabel}: no practice`
                    }
                  >
                    <Text testID={`trend-value-${index}`} style={styles.chartValue}>
                      {point.handsAnswered > 0 ? `${point.accuracy.toFixed(0)}%` : ''}
                    </Text>
                    <View style={styles.chartBarTrack}>
                      <View
                        style={[
                          styles.chartBar,
                          {
                            height: `${Math.max(2, Math.round(point.accuracy))}%`,
                            backgroundColor: isThisWeek ? theme.goldFill : theme.line2,
                          },
                        ]}
                      />
                    </View>
                    <Text style={[styles.chartLabel, isThisWeek && { color: theme.ink }]}>
                      {weekLabel}
                    </Text>
                  </View>
                );
              })}
            </View>
          ) : (
            <Text style={styles.empty}>
              Practice over a couple of weeks and your accuracy trend will show up here.
            </Text>
          )}
        </View>

        <View style={styles.card}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>Across your library</Text>
          {analytics.totalAttempts > 0 ? (
            <Text style={styles.analytics}>
              {analytics.rangesPracticed} range{analytics.rangesPracticed === 1 ? '' : 's'} practiced ·{' '}
              {analytics.totalCorrect} of {analytics.totalAttempts} correct ·{' '}
              {analytics.overallAccuracy.toFixed(0)}% overall
            </Text>
          ) : (
            // "0 ranges practiced · 0 of 0 correct · — overall" is a row of zeros
            // dressed as a statistic. Same reason as the charts above: every
            // sibling card explains itself when empty, so this one should too.
            <Text testID="analytics-empty" style={styles.empty}>
              Practice any range and how your library is going will show up here.
            </Text>
          )}
        </View>

        {spotLeaks.length > 0 ? (
          <View testID="spot-leaks" style={styles.card}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>Weakest spots</Text>
            <View style={styles.spotList}>
              {spotLeaks.slice(0, 5).map((leak) => (
                <View key={spotKey(leak.spot)} style={styles.spotRow}>
                  <View style={styles.spotInfo}>
                    <Text style={styles.spotName}>{describeSpot(leak.spot)}</Text>
                    <Text style={styles.spotMeta}>
                      {leak.correct}/{leak.attempts} · {leak.accuracy.toFixed(0)}%
                    </Text>
                  </View>
                  <Link
                    href={{
                      pathname: '/practice',
                      params: {
                        mode: 'spots',
                        table: leak.spot.tableSize,
                        stack: String(leak.spot.stackDepthBb),
                        spot: spotKey(leak.spot),
                      },
                    }}
                    asChild
                  >
                    <Text testID={`drill-spot-${spotKey(leak.spot)}`} style={styles.drillBtn}>
                      Drill
                    </Text>
                  </Link>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        <View testID="seat-leaks" style={styles.card}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>Where you leak</Text>
          {seatGroups.length === 0 && actionGroups.length === 0 ? (
            <Text style={styles.empty}>
              Practice ranges that record a position or an action and this will show which seats
              and which actions you are weakest in.
            </Text>
          ) : (
            <>
              <LeakColumn
                heading="By seat"
                groups={seatGroups}
                labels={POSITION_LABELS}
                drillQueue={(key) => rangesAtPosition(ranges, practiceStats, key)}
                styles={styles}
                theme={theme}
              />
              <LeakColumn
                heading="By action"
                groups={actionGroups}
                labels={ACTION_TYPE_LABELS}
                drillQueue={(key) => rangesWithActionType(ranges, practiceStats, key)}
                styles={styles}
                theme={theme}
              />
            </>
          )}
        </View>

        <View style={styles.card}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>Leaks by hand type</Text>
          {leaks.length === 0 ? (
            <Text style={styles.empty}>
              Practice a little more and the hand types you miss most will show up here.
            </Text>
          ) : (
            <View style={styles.leakList}>
              {leaks.map((leak) => {
                const queue = ranges.filter((range) => leak.pools[range.id]?.length);
                const params = {
                  queue: queue.map((range) => range.id).join(','),
                  mode: 'recognize',
                  pools: JSON.stringify(
                    Object.fromEntries(queue.map((range) => [range.id, leak.pools[range.id]])),
                  ),
                };
                return (
                  <View key={leak.handClass} testID={`leak-${leak.handClass}`} style={styles.leakRow}>
                    <View style={styles.leakInfo}>
                      <Text style={styles.leakName}>{HAND_CLASS_LABELS[leak.handClass]}</Text>
                      <Text style={styles.leakMeta} numberOfLines={1}>
                        {leak.correct}/{leak.attempts} · {leak.accuracy.toFixed(0)}% ·{' '}
                        {leak.missedHands.slice(0, 4).join(', ')}
                        {leak.missedHands.length > 4 ? '…' : ''}
                      </Text>
                    </View>
                    {queue.length > 0 ? (
                      <Link href={{ pathname: '/practice', params }} asChild>
                        <Text testID={`drill-${leak.handClass}`} style={styles.drillBtn}>
                          Drill
                        </Text>
                      </Link>
                    ) : null}
                  </View>
                );
              })}
            </View>
          )}
        </View>

        <View style={styles.card}>
          <View style={styles.weakHeader}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>Weakest hands</Text>
            {weakHands.length > 0 && drillQueue.length > 0 ? (
              <Link href={{ pathname: '/practice', params: drillParams }} asChild>
                <Text testID="drill-weak-hands" style={styles.drillBtn}>
                  Drill these
                </Text>
              </Link>
            ) : null}
          </View>
          {weakHands.length === 0 ? (
            <Text style={styles.empty}>No recorded misses yet — they will show up here.</Text>
          ) : (
            <View style={styles.weakList}>
              <View style={styles.weakRowHead}>
                <Text style={[styles.weakCell, styles.weakHand, styles.weakHeadText]}>Hand</Text>
                <Text style={[styles.weakCell, styles.weakRange, styles.weakHeadText]}>Range</Text>
                <Text style={[styles.weakCell, styles.weakRec, styles.weakHeadText]}>Record</Text>
                <Text style={[styles.weakCell, styles.weakAcc, styles.weakHeadText]}>Acc</Text>
              </View>
              {weakHands.map((entry) => (
                <View key={`${entry.rangeId}-${entry.hand}`} style={styles.weakRow}>
                  <Text style={[styles.weakCell, styles.weakHand, styles.weakBody]}>{entry.hand}</Text>
                  <Text style={[styles.weakCell, styles.weakRange, styles.weakBodyMuted]} numberOfLines={1}>
                    {rangeName(entry.rangeId)}
                  </Text>
                  <Text style={[styles.weakCell, styles.weakRec, styles.weakBody]}>
                    {entry.correct}/{entry.attempts}
                  </Text>
                  <Text style={[styles.weakCell, styles.weakAcc, styles.weakBody]}>
                    {entry.accuracy.toFixed(0)}%
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}

/**
 * One ranked column of the v8.4 leak breakdown: weakest group first, each an
 * accuracy bar. Renders nothing when the cut has no group above the threshold.
 */
function LeakColumn<T extends string>({
  heading,
  groups,
  labels,
  drillQueue,
  styles,
  theme,
}: {
  heading: string;
  groups: AccuracyGroup<T>[];
  labels: Record<T, string>;
  /** The charts behind a group's number — the queue its Drill shortcut runs. */
  drillQueue: (key: T) => SavedRange[];
  styles: ReturnType<typeof makeStyles>;
  theme: ThemeColors;
}) {
  if (groups.length === 0) return null;
  return (
    <View style={styles.seatColumn}>
      <Text style={styles.seatHeading}>{heading}</Text>
      {groups.map((group) => {
        const queue = drillQueue(group.key);
        return (
          <View key={group.key} testID={`seat-row-${group.key}`} style={styles.seatRow}>
            <Text style={styles.seatName}>{labels[group.key]}</Text>
            <View style={styles.seatBar}>
              <View
                style={[
                  styles.seatFill,
                  { width: `${Math.max(2, group.accuracy)}%`, backgroundColor: theme.goldFill },
                ]}
              />
            </View>
            <Text style={styles.seatValue}>{group.accuracy.toFixed(0)}%</Text>
            {/* Naming a leak with no way to act on it is the one report that left
                the user to go and find the charts themselves. No pools: what is
                weak here is the situation, so each chart is drilled whole. */}
            {queue.length > 0 ? (
              <Link
                href={{
                  pathname: '/practice',
                  params: { queue: queue.map((range) => range.id).join(','), mode: 'recognize' },
                }}
                asChild
              >
                <Text testID={`drill-seat-${group.key}`} style={styles.drillBtn}>
                  Drill
                </Text>
              </Link>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

function makeStyles(theme: ThemeColors) {
  const tabular = { fontVariant: ['tabular-nums' as const] };
  return StyleSheet.create({
    content: { padding: 16, gap: 14, paddingBottom: 32 },
    title: { fontFamily: fonts.display, fontSize: 30, color: theme.ink, marginTop: 4 },
    tiles: { flexDirection: 'row', gap: 10 },
    tile: {
      flex: 1,
      backgroundColor: theme.surface,
      borderColor: theme.line,
      borderWidth: StyleSheet.hairlineWidth,
      borderRadius: 14,
      padding: 12,
      gap: 4,
      minHeight: 92,
    },
    tileValue: { fontFamily: fonts.display, fontSize: 22, color: theme.ink, ...tabular },
    tileLabel: { fontFamily: fonts.body, fontSize: 11.5, color: theme.ink3 },
    card: {
      backgroundColor: theme.surface,
      borderColor: theme.line,
      borderWidth: StyleSheet.hairlineWidth,
      borderRadius: 16,
      padding: 16,
      gap: 12,
    },
    sectionTitle: { fontFamily: fonts.bodySemibold, fontSize: 14, color: theme.ink },
    chart: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, height: 130 },
    chartCol: { flex: 1, alignItems: 'center', gap: 4 },
    // Height reserved even when empty, so bars across the week share one baseline.
    chartValue: {
      fontFamily: fonts.body,
      fontSize: 11,
      lineHeight: 14,
      minHeight: 14,
      color: theme.ink2,
      fontVariant: ['tabular-nums'],
    },
    chartBarTrack: { flex: 1, width: '100%', justifyContent: 'flex-end', alignItems: 'center' },
    chartBar: { width: '70%', borderRadius: 4, minHeight: 3 },
    chartLabel: { fontFamily: fonts.body, fontSize: 11, color: theme.ink3 },
    analytics: { fontFamily: fonts.body, fontSize: 14, color: theme.ink2, ...tabular },
    weakHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    leakList: { gap: 12, marginTop: 6 },
    leakRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
    leakInfo: { flex: 1, gap: 2 },
    leakName: { fontFamily: fonts.bodySemibold, fontSize: 14.5, color: theme.ink },
    leakMeta: { fontFamily: fonts.body, fontSize: 12.5, color: theme.ink2, ...tabular },
    drillBtn: {
      fontFamily: fonts.bodySemibold,
      fontSize: 13,
      color: theme.onAccent,
      backgroundColor: theme.goldFill,
      borderRadius: 10,
      overflow: 'hidden',
      paddingHorizontal: 14,
      paddingVertical: 8,
    },
    empty: { fontFamily: fonts.body, fontSize: 14, color: theme.ink2 },
    spotList: { gap: 12, marginTop: 6 },
    spotRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
    spotInfo: { flex: 1, gap: 2 },
    spotName: { fontFamily: fonts.bodyMedium, fontSize: 13.5, color: theme.ink },
    spotMeta: {
      fontFamily: fonts.body,
      fontSize: 12.5,
      color: theme.ink2,
      fontVariant: ['tabular-nums'],
    },
    seatColumn: { gap: 7 },
    seatHeading: { fontFamily: fonts.bodySemibold, fontSize: 12, color: theme.ink3 },
    seatRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    seatName: { width: 58, fontFamily: fonts.body, fontSize: 13, color: theme.ink2 },
    seatBar: { flex: 1, height: 7, borderRadius: 4, backgroundColor: theme.well, overflow: 'hidden' },
    seatFill: { height: '100%', borderRadius: 4 },
    seatValue: {
      width: 40,
      textAlign: 'right',
      fontFamily: fonts.body,
      fontSize: 13,
      color: theme.ink2,
      fontVariant: ['tabular-nums'],
    },
    weakList: { gap: 2 },
    weakRowHead: { flexDirection: 'row', paddingBottom: 4, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.line },
    weakRow: { flexDirection: 'row', paddingVertical: 5 },
    weakCell: { fontSize: 13, ...tabular },
    weakHeadText: { fontFamily: fonts.bodySemibold, color: theme.ink3, fontSize: 11.5 },
    weakBody: { fontFamily: fonts.bodyMedium, color: theme.ink },
    weakBodyMuted: { fontFamily: fonts.body, color: theme.ink2 },
    weakHand: { width: 52 },
    weakRange: { flex: 1, paddingRight: 8 },
    weakRec: { width: 52, textAlign: 'right' },
    weakAcc: { width: 44, textAlign: 'right' },
  });
}
