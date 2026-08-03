import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';

import { getSharedPack } from '@core/cloud/sharedPacksRepo';
import { areValidHands } from '@core/domain/pokerHands';
import type { RangePack } from '@core/domain/rangeTransfer';
import { saveSavedRange } from '@core/storage/rangeStorage';

import { SaveErrorBanner, useLiveSave } from '../../components/liveSave';
import { Screen } from '../../components/Screen';
import { createRangeId } from '../../platform/createRangeId';
import { getMobileSupabaseClient } from '../../platform/supabaseClient';
import { fonts } from '../../theme/fonts';
import { useTheme } from '../../theme/colors';
import type { ThemeColors } from '../../theme/colors';

type ViewState = 'loading' | 'not-configured' | 'error' | 'done';

/**
 * Shared-pack deep-link target (M7): the route `p/:id` (opened via the app's custom scheme,
 * `pokerrangetrainer://p/:id`, or in-app) fetches a shared pack — a named set of ranges — from the
 * cloud and lets the visitor add all of them to their library. The pack analogue of `r/[id].tsx`.
 * Fetch reuses `@core/cloud/sharedPacksRepo`; adding reuses `@core/storage`. Local-first.
 */
export default function SharedPackScreen() {
  const theme = useTheme();
  const styles = makeStyles(theme);

  const params = useLocalSearchParams<{ id?: string; token?: string }>();
  const id = typeof params.id === 'string' ? params.id : undefined;
  const token = typeof params.token === 'string' ? params.token : undefined;

  const [state, setState] = useState<ViewState>('loading');
  const [pack, setPack] = useState<RangePack | null>(null);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [addError, runSave] = useLiveSave();

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const client = await getMobileSupabaseClient();
        if (!client) {
          if (active) setState('not-configured');
          return;
        }
        const fetched = id ? await getSharedPack(id, token, { client }) : null;
        if (!active) return;
        // A shared pack's data is publisher-controlled; reject it when any range
        // carries non-canonical hands so adding it to the library can't throw.
        const renderable =
          fetched != null &&
          Array.isArray(fetched.ranges) &&
          fetched.ranges.every((range) => areValidHands(range.hands));
        setPack(renderable ? fetched : null);
        setState('done');
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Could not load the shared pack.');
        setState('error');
      }
    })();
    return () => {
      active = false;
    };
  }, [id, token]);

  const handleAddAll = useCallback(() => {
    if (!pack) return;
    const now = new Date().toISOString();
    // Never confirm an add the device store refused: the button stays so the
    // viewer can free space and retry.
    const written = runSave(() => {
      for (const range of pack.ranges) {
        saveSavedRange({ ...range, id: createRangeId(), createdAt: now, updatedAt: now });
      }
    });
    if (!written) return;
    const count = pack.ranges.length;
    setStatus(`Added ${count} range${count === 1 ? '' : 's'} to your library.`);
  }, [pack, runSave]);

  return (
    <Screen>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <Stack.Screen options={{ title: 'Shared pack' }} />

        {state === 'loading' ? (
          <Text testID="shared-loading" style={styles.muted}>
            Loading…
          </Text>
        ) : state === 'not-configured' ? (
          <Text testID="shared-not-configured" style={styles.muted}>
            Shared links need cloud configured. Set EXPO_PUBLIC_SUPABASE_URL and
            EXPO_PUBLIC_SUPABASE_ANON_KEY to open them.
          </Text>
        ) : state === 'error' ? (
          <Text testID="shared-error" style={styles.error}>
            {error}
          </Text>
        ) : pack ? (
          <>
            <Text testID="shared-pack-name" style={styles.name}>
              {pack.name || 'Untitled pack'}
            </Text>
            <Text style={styles.meta}>
              {pack.ranges.length} range{pack.ranges.length === 1 ? '' : 's'}
            </Text>
            <Pressable
              testID="shared-add-all"
              accessibilityRole="button"
              style={styles.button}
              onPress={handleAddAll}
            >
              <Text style={styles.buttonText}>Add all to my library</Text>
            </Pressable>
            {status ? (
              <Text testID="shared-status" style={styles.status}>
                {status}
              </Text>
            ) : null}
            <SaveErrorBanner error={addError} testID="shared-add-error" />
          </>
        ) : (
          <Text testID="shared-not-found" style={styles.muted}>
            That shared pack was not found — the link may be wrong or no longer shared.
          </Text>
        )}
      </ScrollView>
    </Screen>
  );
}

function makeStyles(theme: ThemeColors) {
  return StyleSheet.create({
    screen: {
      flex: 1,
    },
    content: {
      padding: 24,
      gap: 14,
    },
    muted: {
      color: theme.ink2,
      fontFamily: fonts.body,
      fontSize: 15,
      lineHeight: 22,
      marginTop: 16,
    },
    name: {
      color: theme.ink,
      fontFamily: fonts.display,
      fontSize: 22,
    },
    meta: {
      color: theme.ink2,
      fontFamily: fonts.body,
      fontSize: 15,
    },
    button: {
      backgroundColor: theme.goldFill,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: 'center',
      marginTop: 8,
    },
    buttonText: {
      color: theme.onAccent,
      fontFamily: fonts.bodySemibold,
      fontSize: 16,
    },
    status: {
      color: theme.accent,
      fontFamily: fonts.bodySemibold,
      fontSize: 14,
    },
    error: {
      color: theme.bad,
      fontFamily: fonts.body,
      fontSize: 14,
    },
  });
}
