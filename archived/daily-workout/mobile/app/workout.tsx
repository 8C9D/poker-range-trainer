import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Link, Stack, useRouter } from 'expo-router';

import { buildDailyWorkout } from '@core/domain/dailyWorkout';
import type { PokerHand } from '@core/domain/pokerHands';
import { loadReviewStates } from '@core/storage/reviewStateStorage';
import { loadSavedRanges } from '@core/storage/rangeStorage';
import { loadSpotAccuracy } from '@core/storage/spotAccuracyStorage';
import { loadTrainingGoal } from '@core/storage/trainingGoalStorage';

import { WorkoutHost } from '../components/practice/WorkoutHost';
import { Screen } from '../components/Screen';
import { fonts } from '../theme/fonts';
import { useTheme } from '../theme/colors';

/**
 * The daily-workout route. The plan is composed fresh from storage on entry (the
 * Today card links here without parameters — a workout is derived state, not
 * something to serialize through the URL) and handed to `WorkoutHost`, which runs
 * the segments full-screen above the tabs.
 */
export default function WorkoutScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [plan] = useState(() => {
    const ranges = loadSavedRanges();
    return {
      ranges,
      workout: buildDailyWorkout({
        ranges,
        reviewStates: loadReviewStates(),
        spotAccuracy: loadSpotAccuracy(),
        now: new Date().toISOString(),
        goalHands: loadTrainingGoal(),
      }),
    };
  });

  const close = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  /**
   * Re-drill a finished workout's misses. The run spans several ranges, so it
   * replays as one recognition queue over the ranges that actually missed
   * something — the same route the Progress screen's weak-hands drill takes.
   */
  const drillMisses = (pools: Record<string, PokerHand[]>) => {
    const queue = plan.ranges.filter((range) => pools[range.id]?.length);
    if (queue.length === 0) {
      close();
      return;
    }
    router.replace({
      pathname: '/practice',
      params: {
        queue: queue.map((range) => range.id).join(','),
        mode: 'recognize',
        pools: JSON.stringify(
          Object.fromEntries(queue.map((range) => [range.id, pools[range.id]])),
        ),
      },
    });
  };

  if (!plan.workout) {
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.empty}>
          <Text testID="workout-empty" style={[styles.emptyText, { color: theme.ink2 }]}>
            Nothing to train right now.
          </Text>
          <Link href="/" asChild>
            <Text style={[styles.link, { color: theme.accentStrong }]}>Back to Today</Text>
          </Link>
        </View>
      </Screen>
    );
  }

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <WorkoutHost
        workout={plan.workout}
        ranges={plan.ranges}
        onClose={close}
        onDrillMisses={drillMisses}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  emptyText: { fontFamily: fonts.body, fontSize: 16 },
  link: { fontFamily: fonts.bodySemibold, fontSize: 15 },
});
