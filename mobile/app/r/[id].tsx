import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';

import { getSharedRange } from '@core/cloud/sharedRangesRepo';
import { calculateRangePercentage } from '@core/domain/rangeMath';
import { saveSavedRange } from '@core/storage/rangeStorage';
import type { SavedRange } from '@core/types/range';

import { createRangeId } from '../../platform/createRangeId';
import { getMobileSupabaseClient } from '../../platform/supabaseClient';
import { colors } from '../../theme/colors';

type ViewState = 'loading' | 'not-configured' | 'error' | 'done';

/**
 * Shared-range deep-link target (M7): the route `r/:id` (opened via the app's custom scheme,
 * `pokerrangetrainer://r/:id`, or in-app) fetches a shared range from the cloud and lets the
 * visitor add a copy to their library. Fetch reuses `@core/cloud/sharedRangesRepo` with the
 * native client; adding reuses `@core/storage`. Local-first: with no cloud configured it shows a
 * message instead of failing. An optional `token` query param carries the secret for private links.
 */
export default function SharedRangeScreen() {
  const params = useLocalSearchParams<{ id?: string; token?: string }>();
  const id = typeof params.id === 'string' ? params.id : undefined;
  const token = typeof params.token === 'string' ? params.token : undefined;

  const [state, setState] = useState<ViewState>('loading');
  const [range, setRange] = useState<SavedRange | null>(null);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

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
        setRange(fetched);
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
    saveSavedRange({ ...range, id: createRangeId(), createdAt: now, updatedAt: now });
    setStatus('Added to your library.');
  }, [range]);

  return (
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
          <Text testID="shared-range-name" style={styles.name}>
            {range.name || 'Untitled range'}
          </Text>
          <Text style={styles.meta}>
            {range.hands.length} hands · {calculateRangePercentage(range.hands).toFixed(1)}%
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
        </>
      ) : (
        <Text testID="shared-not-found" style={styles.muted}>
          That shared range was not found — the link may be wrong or no longer shared.
        </Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 24,
    gap: 14,
  },
  muted: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 16,
  },
  name: {
    color: colors.textStrong,
    fontSize: 22,
    fontWeight: '700',
  },
  meta: {
    color: colors.text,
    fontSize: 15,
  },
  button: {
    backgroundColor: colors.accent,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: {
    color: colors.onAccent,
    fontSize: 16,
    fontWeight: '700',
  },
  status: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '600',
  },
  error: {
    color: colors.danger,
    fontSize: 14,
  },
});
