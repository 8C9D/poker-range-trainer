import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';

import { areValidHands } from '@core/domain/pokerHands';
import { rangeComboPercentage } from '@core/domain/comboSelection';
import { decodeRangeFromHash } from '@core/domain/rangeTransfer';
import { saveSavedRange } from '@core/storage/rangeStorage';
import type { SavedRange } from '@core/types/range';

import { RangeThumbnail } from '../components/RangeThumbnail';
import { Screen } from '../components/Screen';
import { extractSharedRangeHash } from '../lib/shareLink';
import { createRangeId } from '../platform/createRangeId';
import { fonts } from '../theme/fonts';
import { useTheme } from '../theme/colors';
import type { ThemeColors } from '../theme/colors';

/** Decode a pasted link (or a deep link's `range` param) into a previewable range. */
function decodeLink(input: string): { range: SavedRange | null; error: string } {
  const hash = extractSharedRangeHash(input);
  if (!hash) return { range: null, error: 'That does not look like a share link.' };
  try {
    const range = decodeRangeFromHash(hash);
    // The payload is sender-controlled; a non-canonical hand would make the
    // percentage math throw during render, so reject it up front.
    if (!areValidHands(range.hands)) {
      return { range: null, error: 'That share link contains hands this app cannot read.' };
    }
    return { range, error: '' };
  } catch (err) {
    return { range: null, error: err instanceof Error ? err.message : 'Could not read that link.' };
  }
}

/**
 * Account-free range import: the target of an `import?range=<hash>` deep link, and a
 * paste box for links minted anywhere else (including the web app's `#range=` links).
 * The link carries the whole range, so this needs no cloud and no sign-in — the mobile
 * parallel of the web app's hash import.
 */
export default function ImportScreen() {
  const theme = useTheme();
  const styles = makeStyles(theme);

  const params = useLocalSearchParams<{ range?: string }>();
  const linked = typeof params.range === 'string' ? params.range : '';

  const [pasted, setPasted] = useState('');
  const [decoded, setDecoded] = useState(() => (linked ? decodeLink(linked) : null));
  const [status, setStatus] = useState('');

  const range = decoded?.range ?? null;

  const handleDecodePasted = () => {
    setStatus('');
    setDecoded(decodeLink(pasted));
  };

  const handleAdd = () => {
    if (!range) return;
    const now = new Date().toISOString();
    saveSavedRange({ ...range, id: createRangeId(), createdAt: now, updatedAt: now });
    setStatus(`Added "${range.name || 'Untitled'}" to your library.`);
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Stack.Screen options={{ title: 'Import range' }} />

        <Text accessibilityRole="header" style={styles.title}>Import a shared range</Text>
        <Text style={styles.body}>
          Paste a share link to add its range to your library. Share links carry the whole range,
          so no account is needed.
        </Text>

        <TextInput
          testID="import-input"
          style={styles.input}
          value={pasted}
          onChangeText={setPasted}
          placeholder="Paste share link"
          placeholderTextColor={theme.ink3}
          autoCapitalize="none"
          autoCorrect={false}
          multiline
        />
        <Pressable testID="import-decode" style={styles.button} onPress={handleDecodePasted}>
          <Text style={styles.buttonText}>Preview link</Text>
        </Pressable>

        {decoded?.error ? (
          <Text testID="import-error" style={styles.error}>
            {decoded.error}
          </Text>
        ) : null}

        {range ? (
          <View testID="import-preview" style={styles.preview}>
            <RangeThumbnail hands={range.hands} size={120} />
            <View style={styles.previewInfo}>
              <Text testID="import-range-name" style={styles.previewName}>
                {range.name || 'Untitled'}
              </Text>
              <Text style={styles.previewMeta}>
                {range.hands.length} hands · {rangeComboPercentage(range.hands, range.comboSelections).toFixed(1)}%
              </Text>
            </View>
          </View>
        ) : null}

        {range ? (
          <Pressable testID="import-add" style={styles.primaryBtn} onPress={handleAdd}>
            <Text style={styles.primaryBtnText}>Add to my library</Text>
          </Pressable>
        ) : null}

        {status ? (
          <Text testID="import-status" style={styles.status}>
            {status}
          </Text>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function makeStyles(theme: ThemeColors) {
  return StyleSheet.create({
    content: { padding: 20, gap: 14 },
    title: { fontFamily: fonts.display, fontSize: 24, color: theme.ink },
    body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: theme.ink2 },
    input: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.line2,
      borderRadius: 12,
      padding: 12,
      minHeight: 88,
      fontFamily: fonts.body,
      fontSize: 14,
      color: theme.ink,
      backgroundColor: theme.card,
      textAlignVertical: 'top',
    },
    button: {
      alignSelf: 'flex-start',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.line2,
      borderRadius: 12,
      paddingHorizontal: 18,
      paddingVertical: 10,
    },
    buttonText: { fontFamily: fonts.bodySemibold, fontSize: 15, color: theme.ink },
    preview: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.line,
      borderRadius: 16,
      padding: 14,
      backgroundColor: theme.surface,
    },
    previewInfo: { flex: 1, gap: 4 },
    previewName: { fontFamily: fonts.displaySemibold, fontSize: 18, color: theme.ink },
    previewMeta: {
      fontFamily: fonts.body,
      fontSize: 14,
      color: theme.ink2,
      fontVariant: ['tabular-nums'],
    },
    primaryBtn: {
      backgroundColor: theme.goldFill,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: 'center',
    },
    primaryBtnText: { fontFamily: fonts.bodySemibold, fontSize: 16, color: theme.onAccent },
    status: { fontFamily: fonts.bodySemibold, fontSize: 14, color: theme.accent },
    error: { fontFamily: fonts.body, fontSize: 14, color: theme.bad },
  });
}
