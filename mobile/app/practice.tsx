import { StyleSheet, Text, View } from 'react-native';
import { Link, Stack, useLocalSearchParams, useRouter } from 'expo-router';

import { isValidHand, type PokerHand } from '@core/domain/pokerHands';
import { findSavedRangeById } from '@core/storage/rangeStorage';
import type { SavedRange } from '@core/types/range';

import { PracticeHost, type PracticeRequest } from '../components/practice/PracticeHost';
import type { PracticeMode } from '../components/practice/ModePicker';
import { Screen } from '../components/Screen';
import { fonts } from '../theme/fonts';
import { useTheme } from '../theme/colors';

const MODES: PracticeMode[] = ['recognize', 'build', 'timed', 'weakness', 'edges'];

type RouteValue = string | string[] | undefined;

function single(value: RouteValue): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function asMode(value: RouteValue): PracticeMode | null {
  value = single(value);
  return value && (MODES as string[]).includes(value) ? (value as PracticeMode) : null;
}

function commaList(value: RouteValue): string[] {
  value = single(value);
  return value ? value.split(',').filter(Boolean) : [];
}

function handList(value: RouteValue): PokerHand[] {
  return commaList(value).filter(isValidHand);
}

/** Parse the per-range weak-hand pools (`pools` = JSON of Record<rangeId, hand[]>). */
function parsePools(value: RouteValue): Record<string, PokerHand[]> | undefined {
  value = single(value);
  if (!value) return undefined;
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return undefined;

    const pools: Record<string, PokerHand[]> = {};
    for (const [rangeId, hands] of Object.entries(parsed)) {
      if (!Array.isArray(hands)) continue;
      const validHands = hands.filter(
        (hand): hand is PokerHand => typeof hand === 'string' && isValidHand(hand),
      );
      if (validHands.length > 0) pools[rangeId] = validHands;
    }
    return Object.keys(pools).length > 0 ? pools : undefined;
  } catch {
    return undefined;
  }
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
  const params = useLocalSearchParams<{
    id?: RouteValue;
    queue?: RouteValue;
    mode?: RouteValue;
    pool?: RouteValue;
    pools?: RouteValue;
  }>();

  const mode = asMode(params.mode);
  const ids = params.queue ? commaList(params.queue) : single(params.id) ? [single(params.id)!] : [];
  const ranges = ids
    .map((id) => findSavedRangeById(id))
    .filter((range): range is SavedRange => range !== undefined);
  const handPool = handList(params.pool);

  const close = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  if (ranges.length === 0) {
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.notFound}>
          <Text style={[styles.notFoundText, { color: theme.ink2 }]}>
            Nothing to practice — this link points at a range that no longer exists. Create or
            open a range in the Library to start a drill.
          </Text>
          <Link href="/library" asChild>
            <Text style={[styles.link, { color: theme.accentStrong }]}>Back to Library</Text>
          </Link>
        </View>
      </Screen>
    );
  }

  const request: PracticeRequest = {
    ranges,
    mode,
    handPool: handPool.length > 0 ? handPool : undefined,
    handPools: parsePools(params.pools),
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
