import { StyleSheet, Text, View } from 'react-native';
import { Link, Stack, useLocalSearchParams, useRouter } from 'expo-router';

import type { PokerHand } from '@core/domain/pokerHands';
import { findSavedRangeById } from '@core/storage/rangeStorage';
import type { SavedRange } from '@core/types/range';

import { PracticeHost, type PracticeRequest } from '../components/practice/PracticeHost';
import type { PracticeMode } from '../components/practice/ModePicker';
import { Screen } from '../components/Screen';
import { fonts } from '../theme/fonts';
import { useTheme } from '../theme/colors';

const MODES: PracticeMode[] = [
  'recognize',
  'build',
  'timed',
  'weakness',
  'action',
  'mixed',
  'combo',
  'postflop',
  'board',
];

function asMode(value: string | undefined): PracticeMode | null {
  return value && (MODES as string[]).includes(value) ? (value as PracticeMode) : null;
}

function commaList(value: string | undefined): string[] {
  return value ? value.split(',').filter(Boolean) : [];
}

/**
 * Practice overlay host route. Parses the request from the URL — `id` (one range) or
 * `queue` (comma-separated ids for the review queue), an optional preset `mode`, and an
 * optional `pool` of hands (weak-hand drills) — and hands it to `PracticeHost`, which runs
 * the mode picker / drill / summary flow full-screen above the tabs.
 */
export default function PracticeScreen() {
  const theme = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string; queue?: string; mode?: string; pool?: string }>();

  const ids = params.queue ? commaList(params.queue) : params.id ? [params.id] : [];
  const ranges = ids
    .map((id) => findSavedRangeById(id))
    .filter((range): range is SavedRange => range !== undefined);
  const handPool = commaList(params.pool) as PokerHand[];

  const close = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  if (ranges.length === 0) {
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.notFound}>
          <Text style={[styles.notFoundText, { color: theme.ink2 }]}>Range not found.</Text>
          <Link href="/library" asChild>
            <Text style={[styles.link, { color: theme.accent }]}>Back to Library</Text>
          </Link>
        </View>
      </Screen>
    );
  }

  const request: PracticeRequest = {
    ranges,
    mode: asMode(params.mode),
    handPool: handPool.length > 0 ? handPool : undefined,
  };

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <PracticeHost request={request} onClose={close} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  notFound: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  notFoundText: { fontFamily: fonts.body, fontSize: 16 },
  link: { fontFamily: fonts.bodySemibold, fontSize: 15 },
});
