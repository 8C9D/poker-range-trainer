import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';

import { formatMixedNotation, parseMixedNotation } from '@core/domain/mixedNotation';
import type { HandMixedStrategy } from '@core/domain/mixedStrategy';
import type { PokerHand } from '@core/domain/pokerHands';

import { colors } from '../theme/colors';

export interface MixedNotationProps {
  /** Current per-hand mixed strategies, mirrored back as one line per hand. */
  mixedStrategies: Record<PokerHand, HandMixedStrategy>;
  /** Replace the entire strategy map with the parsed notation result. */
  onReplaceStrategies: (mixedStrategies: Record<PokerHand, HandMixedStrategy>) => void;
}

/**
 * Import/export panel for mixed-frequency notation — the mixed-strategy parallel of
 * `ActionNotation`. The read-only "Current frequencies" reflects the live map via
 * `formatMixedNotation`; "Apply" parses the input with `parseMixedNotation` and REPLACES the map,
 * surfacing the parser's message on failure and leaving the map untouched. Copy/Paste use the
 * native clipboard. All formatting/parsing stays in the domain layer.
 */
export function MixedNotation({ mixedStrategies, onReplaceStrategies }: MixedNotationProps) {
  const [input, setInput] = useState('');
  const [error, setError] = useState('');

  const currentNotation = formatMixedNotation(mixedStrategies);

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
      onReplaceStrategies(parseMixedNotation(input));
      setError('');
    } catch (err) {
      // Leave the map untouched; show the parser's explanation.
      setError(err instanceof Error ? err.message : 'Could not parse that frequency notation.');
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Current frequencies</Text>
      <View style={styles.currentRow}>
        <Text testID="mixed-notation-current" style={styles.current} numberOfLines={6}>
          {currentNotation || 'No frequencies set'}
        </Text>
        <Pressable
          testID="mixed-notation-copy"
          accessibilityRole="button"
          style={styles.smallButton}
          onPress={handleCopy}
        >
          <Text style={styles.smallButtonText}>Copy</Text>
        </Pressable>
      </View>

      <Text style={styles.label}>Paste or type frequency notation</Text>
      <TextInput
        testID="mixed-notation-input"
        style={styles.input}
        value={input}
        onChangeText={setInput}
        placeholder={'e.g. AA: raise 60, call 40'}
        placeholderTextColor={colors.text}
        autoCapitalize="none"
        autoCorrect={false}
        multiline
      />
      <View style={styles.actions}>
        <Pressable
          testID="mixed-notation-paste"
          accessibilityRole="button"
          style={styles.smallButton}
          onPress={handlePaste}
        >
          <Text style={styles.smallButtonText}>Paste</Text>
        </Pressable>
        <Pressable
          testID="mixed-notation-apply"
          accessibilityRole="button"
          style={styles.applyButton}
          onPress={handleApply}
        >
          <Text style={styles.applyText}>Apply</Text>
        </Pressable>
      </View>
      {error ? (
        <Text testID="mixed-notation-error" style={styles.error}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  label: {
    color: colors.text,
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
    color: colors.textStrong,
    fontSize: 14,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 60,
    fontSize: 14,
    color: colors.textStrong,
    backgroundColor: colors.surface,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  smallButton: {
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  smallButtonText: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '600',
  },
  applyButton: {
    backgroundColor: colors.accent,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  applyText: {
    color: colors.onAccent,
    fontSize: 13,
    fontWeight: '600',
  },
  error: {
    color: colors.danger,
    fontSize: 13,
  },
});
