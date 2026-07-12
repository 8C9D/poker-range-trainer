import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';

import type { PokerHand } from '@core/domain/pokerHands';
import { formatRangeCsv, parseRangeCsv } from '@core/domain/rangeTransfer';
import type { SavedRange } from '@core/types/range';

import { useTheme } from '../theme/colors';
import type { ThemeColors } from '../theme/colors';

export interface RangeCsvProps {
  /** Current range name, written into the exported CSV's summary row. */
  name: string;
  /** Current selected hands, exported as the CSV `hand` column. */
  hands: PokerHand[];
  /** Apply a parsed CSV: replace the hands (and the name when the CSV carries one). */
  onImport: (result: { name?: string; hands: PokerHand[] }) => void;
}

/**
 * Clipboard CSV import/export for a range's hands — the CSV parallel of `RangeNotation`. The
 * read-only "Current CSV" reflects the live name + selection via `formatRangeCsv`; "Apply" parses
 * the input with `parseRangeCsv` and hands the result to `onImport` (the editor replaces the hands
 * and name), surfacing the parser's message on failure. CSV is a hands-only interchange; all
 * formatting/parsing stays in the domain layer.
 */
export function RangeCsv({ name, hands, onImport }: RangeCsvProps) {
  const theme = useTheme();
  const styles = makeStyles(theme);
  const [input, setInput] = useState('');
  const [error, setError] = useState('');

  // formatRangeCsv only reads name + hands; the other SavedRange fields are placeholders.
  const csvRange: SavedRange = { id: '', name, hands, createdAt: '', updatedAt: '' };
  const currentCsv = formatRangeCsv(csvRange);

  function handleCopy(): void {
    Clipboard.setStringAsync(currentCsv).catch(() => {});
  }

  function handlePaste(): void {
    Clipboard.getStringAsync()
      .then(setInput)
      .catch(() => {});
  }

  function handleApply(): void {
    try {
      onImport(parseRangeCsv(input));
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not parse that CSV.');
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Current CSV</Text>
      <View style={styles.currentRow}>
        <Text testID="range-csv-current" style={styles.current} numberOfLines={6}>
          {currentCsv}
        </Text>
        <Pressable
          testID="range-csv-copy"
          accessibilityRole="button"
          style={styles.smallButton}
          onPress={handleCopy}
        >
          <Text style={styles.smallButtonText}>Copy</Text>
        </Pressable>
      </View>

      <Text style={styles.label}>Paste or type CSV</Text>
      <TextInput
        testID="range-csv-input"
        style={styles.input}
        value={input}
        onChangeText={setInput}
        placeholder={'hand\nAA\nKK'}
        placeholderTextColor={theme.ink3}
        autoCapitalize="none"
        autoCorrect={false}
        multiline
      />
      <View style={styles.actions}>
        <Pressable
          testID="range-csv-paste"
          accessibilityRole="button"
          style={styles.smallButton}
          onPress={handlePaste}
        >
          <Text style={styles.smallButtonText}>Paste</Text>
        </Pressable>
        <Pressable
          testID="range-csv-apply"
          accessibilityRole="button"
          style={styles.applyButton}
          onPress={handleApply}
        >
          <Text style={styles.applyText}>Apply</Text>
        </Pressable>
      </View>
      {error ? (
        <Text testID="range-csv-error" style={styles.error}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

function makeStyles(theme: ThemeColors) {
  return StyleSheet.create({
    container: {
      gap: 8,
    },
    label: {
      color: theme.ink2,
      fontSize: 13,
      fontWeight: '600',
    },
    currentRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
    },
    current: {
      flex: 1,
      color: theme.ink,
      fontSize: 13,
    },
    input: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.line2,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      minHeight: 60,
      fontSize: 14,
      color: theme.ink,
      backgroundColor: theme.card,
      textAlignVertical: 'top',
    },
    actions: {
      flexDirection: 'row',
      gap: 8,
    },
    smallButton: {
      backgroundColor: theme.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.line,
      borderRadius: 8,
      paddingHorizontal: 14,
      paddingVertical: 8,
    },
    smallButtonText: {
      color: theme.accent,
      fontSize: 13,
      fontWeight: '600',
    },
    applyButton: {
      backgroundColor: theme.goldFill,
      borderRadius: 8,
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
    applyText: {
      color: theme.onAccent,
      fontSize: 13,
      fontWeight: '600',
    },
    error: {
      color: theme.bad,
      fontSize: 13,
    },
  });
}
