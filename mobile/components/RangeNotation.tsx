import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';

import type { PokerHand } from '@core/domain/pokerHands';
import { formatRangeNotation, parseRangeNotation } from '@core/domain/rangeNotation';

import { useTheme } from '../theme/colors';
import type { ThemeColors } from '../theme/colors';

export interface RangeNotationProps {
  /** Current selection, mirrored back as deterministic notation. */
  selectedHands: PokerHand[];
  /** Replace the entire selection with the parsed notation result. */
  onReplaceHands: (hands: PokerHand[]) => void;
}

/**
 * Import/export panel for poker range notation (mirrors the web RangeNotation).
 * The read-only "Current range" always reflects the live selection via
 * `formatRangeNotation`; "Apply" parses the input with `parseRangeNotation` and
 * REPLACES the selection, surfacing the parser's message on failure and leaving
 * the selection untouched. Copy/Paste use the native clipboard. All parsing and
 * formatting stays in the domain layer.
 */
export function RangeNotation({ selectedHands, onReplaceHands }: RangeNotationProps) {
  const theme = useTheme();
  const styles = makeStyles(theme);
  const [input, setInput] = useState('');
  const [error, setError] = useState('');

  const currentNotation = formatRangeNotation(selectedHands);

  function handleCopy(): void {
    Clipboard.setStringAsync(currentNotation).catch(() => {});
  }

  function handlePaste(): void {
    Clipboard.getStringAsync()
      .then(setInput)
      .catch(() => {});
  }

  function handleApply(): void {
    try {
      onReplaceHands(parseRangeNotation(input));
      setError('');
    } catch (err) {
      // Leave the selection untouched; show the parser's explanation.
      setError(err instanceof Error ? err.message : 'Could not parse that range notation.');
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Current range</Text>
      <View style={styles.currentRow}>
        <Text testID="notation-current" style={styles.current} numberOfLines={2}>
          {currentNotation || 'No hands selected'}
        </Text>
        <Pressable
          testID="notation-copy"
          accessibilityRole="button"
          style={styles.smallButton}
          onPress={handleCopy}
        >
          <Text style={styles.smallButtonText}>Copy</Text>
        </Pressable>
      </View>

      <Text style={styles.label}>Paste or type notation</Text>
      <TextInput
        testID="notation-input"
        style={styles.input}
        value={input}
        onChangeText={setInput}
        placeholder="e.g. 77+, AJs+, KQo"
        placeholderTextColor={theme.ink3}
        autoCapitalize="characters"
        autoCorrect={false}
        multiline
      />
      <View style={styles.actions}>
        <Pressable
          testID="notation-paste"
          accessibilityRole="button"
          style={styles.smallButton}
          onPress={handlePaste}
        >
          <Text style={styles.smallButtonText}>Paste</Text>
        </Pressable>
        <Pressable
          testID="notation-apply"
          accessibilityRole="button"
          style={styles.applyButton}
          onPress={handleApply}
        >
          <Text style={styles.applyText}>Apply</Text>
        </Pressable>
      </View>
      {error ? (
        <Text testID="notation-error" style={styles.error}>
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
      alignItems: 'center',
      gap: 8,
    },
    current: {
      flex: 1,
      color: theme.ink,
      fontSize: 14,
    },
    input: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.line2,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      minHeight: 44,
      fontSize: 14,
      color: theme.ink,
      backgroundColor: theme.card,
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
