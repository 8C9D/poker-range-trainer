import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Link } from 'expo-router';

import { ACTION_ACCURACY_STORAGE_KEY } from '@core/storage/actionAccuracyStorage';
import { HAND_ACCURACY_STORAGE_KEY } from '@core/storage/handAccuracyStorage';
import { PRACTICE_STATS_STORAGE_KEY } from '@core/storage/practiceStatsStorage';
import { STORAGE_KEY as RANGES_STORAGE_KEY } from '@core/storage/rangeStorage';
import { REVIEW_STATE_STORAGE_KEY } from '@core/storage/reviewStateStorage';
import { SESSION_HISTORY_STORAGE_KEY } from '@core/storage/sessionHistoryStorage';
import { SPOT_ACCURACY_STORAGE_KEY } from '@core/storage/spotAccuracyStorage';
import { TRAINING_GOAL_STORAGE_KEY } from '@core/storage/trainingGoalStorage';
import { WORKOUT_STORAGE_KEY } from '@core/storage/workoutStorage';

import { acknowledgeStorageLoss, pendingStorageLoss } from '../platform/storeIntegrity';
import { fonts } from '../theme/fonts';
import { useTheme } from '../theme/colors';
import type { ThemeColors } from '../theme/colors';

/**
 * What each storage key means to the person who lost it. Keyed by the constants
 * themselves, so a renamed or added key shows up as an unnamed slice rather than
 * as a wrong description — and the guard test holds every one of the nine to a
 * name here.
 */
const SLICE_NAMES: Record<string, string> = {
  [RANGES_STORAGE_KEY]: 'your saved ranges',
  [PRACTICE_STATS_STORAGE_KEY]: 'your practice stats',
  [SESSION_HISTORY_STORAGE_KEY]: 'your session history',
  [HAND_ACCURACY_STORAGE_KEY]: 'your per-hand accuracy',
  [ACTION_ACCURACY_STORAGE_KEY]: 'your action accuracy',
  [REVIEW_STATE_STORAGE_KEY]: 'your review schedule',
  [SPOT_ACCURACY_STORAGE_KEY]: 'your per-spot accuracy',
  [TRAINING_GOAL_STORAGE_KEY]: 'your daily goal',
  [WORKOUT_STORAGE_KEY]: "today's workout progress",
};

/** "your saved ranges and your practice stats", or a count when it is unnamed. */
export function describeLostSlices(keys: string[]): string {
  const names = keys.map((key) => SLICE_NAMES[key]).filter((name): name is string => Boolean(name));
  if (names.length === 0) return 'some of your saved data';
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/**
 * Tells the user that the device dropped data, on the one screen they always
 * see first.
 *
 * This is the other half of the recovery story: `storeIntegrity` notices the
 * loss, and without something here the app would carry on rendering whatever
 * survived as though it were the whole library. Restoring a backup file is the
 * only remedy that exists — there is no account and no server copy — so the
 * notice says so and puts the Account tab one tap away.
 *
 * It stays until dismissed, across relaunches, because the loss does too.
 */
export function StorageLossNotice() {
  const theme = useTheme();
  const styles = makeStyles(theme);
  const [lostKeys, setLostKeys] = useState(pendingStorageLoss);

  const dismiss = useCallback(() => {
    acknowledgeStorageLoss();
    setLostKeys([]);
  }, []);

  if (lostKeys.length === 0) return null;

  return (
    <View testID="storage-loss-notice" style={styles.notice}>
      <Text accessibilityRole="header" style={styles.title}>
        Some saved data is missing
      </Text>
      <Text style={styles.body}>
        This device could not read back {describeLostSlices(lostKeys)} after a storage error.
        Restoring a backup file is the only way to get it back.
      </Text>
      <View style={styles.actions}>
        <Link href="/account" asChild>
          <Pressable testID="storage-loss-restore" accessibilityRole="button" style={styles.primaryBtn}>
            <Text style={styles.primaryBtnText}>Restore a backup</Text>
          </Pressable>
        </Link>
        <Pressable
          testID="storage-loss-dismiss"
          accessibilityRole="button"
          onPress={dismiss}
          style={styles.ghostBtn}
        >
          <Text style={styles.ghostBtnText}>Dismiss</Text>
        </Pressable>
      </View>
    </View>
  );
}

function makeStyles(theme: ThemeColors) {
  return StyleSheet.create({
    notice: {
      backgroundColor: theme.card,
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.bad,
      padding: 16,
      gap: 10,
    },
    title: { fontFamily: fonts.displaySemibold, fontSize: 17, color: theme.bad },
    body: { fontFamily: fonts.body, fontSize: 14, lineHeight: 21, color: theme.ink2 },
    actions: { flexDirection: 'row', gap: 10 },
    primaryBtn: {
      backgroundColor: theme.goldFill,
      borderRadius: 10,
      paddingVertical: 11,
      paddingHorizontal: 16,
    },
    primaryBtnText: { fontFamily: fonts.bodySemibold, fontSize: 15, color: theme.onAccent },
    ghostBtn: {
      borderRadius: 10,
      paddingVertical: 11,
      paddingHorizontal: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.line2,
    },
    ghostBtnText: { fontFamily: fonts.bodySemibold, fontSize: 15, color: theme.ink },
  });
}
