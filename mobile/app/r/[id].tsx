import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';

import { getSharedRange } from '@core/cloud/sharedRangesRepo';
import { areValidHands } from '@core/domain/pokerHands';
import { rangeComboPercentage } from '@core/domain/comboSelection';
import { saveSavedRange } from '@core/storage/rangeStorage';
import type { SavedRange } from '@core/types/range';

import { SaveErrorBanner, useLiveSave } from '../../components/liveSave';
import { Screen } from '../../components/Screen';
import { createRangeId } from '../../platform/createRangeId';
import { getMobileSupabaseClient } from '../../platform/supabaseClient';
import { fonts } from '../../theme/fonts';
import { useTheme } from '../../theme/colors';
import type { ThemeColors } from '../../theme/colors';

type ViewState = 'loading' | 'not-configured' | 'error' | 'done';

/**
 * Shared-range deep-link target (M7): the route `r/:id` (opened via the app's custom scheme,
 * `pokerrangetrainer://r/:id`, or in-app) fetches a shared range from the cloud and lets the
 * visitor add a copy to their library. Fetch reuses `@core/cloud/sharedRangesRepo` with the
 * native client; adding reuses `@core/storage`. Local-first: with no cloud configured it shows a
 * message instead of failing. An optional `token` query param carries the secret for private links.
 */
export default function SharedRangeScreen() {
  const theme = useTheme();
  const styles = makeStyles(theme);

  const params = useLocalSearchParams<{ id?: string; token?: string }>();
  const id = typeof params.id === 'string' ? params.id : undefined;
  const token = typeof params.token === 'string' ? params.token : undefined;

  const [state, setState] = useState<ViewState>('loading');
  const [range, setRange] = useState<SavedRange | null>(null);
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
        const fetched = id ? await getSharedRange(id, token, { client }) : null;
        if (!active) return;
        // A shared range's data is publisher-controlled; reject a payload with
        // non-canonical hands so the percentage math can't throw during render.
        setRange(fetched && areValidHands(fetched.hands) ? fetched : null);
        setState('done');
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Could not load the shared range.');
        setState('error');
      }
    })();
    return () => {
      active = false;
    };
  }, [id, token]);

  const handleAdd = useCallback(() => {
    if (!range) return;
    const now = new Date().toISOString();
    // Never confirm an add the device store refused: the button stays so the
    // viewer can free space and retry.
    if (!runSave(() => saveSavedRange({ ...range, id: createRangeId(), createdAt: now, updatedAt: now })))
      return;
    setStatus('Added to your library.');
  }, [range, runSave]);

  return (
    <Screen>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <Stack.Screen options={{ title: 'Shared range' }} />

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
        ) : range ? (
          <>
            <Text testID="shared-range-name" accessibilityRole="header" style={styles.name}>
              {range.name || 'Untitled range'}
            </Text>
            <Text style={styles.meta}>
              {range.hands.length} hands · {rangeComboPercentage(range.hands, range.comboSelections).toFixed(1)}%
            </Text>
            <Pressable
              testID="shared-add"
              accessibilityRole="button"
              style={styles.button}
              onPress={handleAdd}
            >
              <Text style={styles.buttonText}>Add to my library</Text>
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
            That shared range was not found — the link may be wrong or no longer shared.
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
