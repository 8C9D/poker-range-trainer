import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';

import { formatActionNotation, parseActionNotation } from '@core/domain/actionRange';
import type { PokerHand } from '@core/domain/pokerHands';
import type { RangeAction } from '@core/types/range';

import { colors } from '../theme/colors';

export interface ActionNotationProps {
  /** Current per-hand action overlay, mirrored back as action-grouped notation. */
  handActions: Record<PokerHand, RangeAction>;
  /** Replace the entire overlay with the parsed notation result. */
  onReplaceActions: (handActions: Record<PokerHand, RangeAction>) => void;
}

/**
 * Import/export panel for action-grouped notation — the multi-action parallel of
 * `RangeNotation`. The read-only "Current actions" reflects the live overlay via
 * `formatActionNotation`; "Apply" parses the input with `parseActionNotation` and REPLACES
 * the overlay, surfacing the parser's message on failure and leaving the overlay untouched.
 * Copy/Paste use the native clipboard. All formatting/parsing stays in the domain layer.
 */
export function ActionNotation({ handActions, onReplaceActions }: ActionNotationProps) {
  const [input, setInput] = useState('');
  const [error, setError] = useState('');

  const currentNotation = formatActionNotation(handActions);

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
      onReplaceActions(parseActionNotation(input));
      setError('');
    } catch (err) {
      // Leave the overlay untouched; show the parser's explanation.
      setError(err instanceof Error ? err.message : 'Could not parse that action notation.');
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Current actions</Text>
      <View style={styles.currentRow}>
        <Text testID="action-notation-current" style={styles.current} numberOfLines={4}>
          {currentNotation || 'No actions assigned'}
        </Text>
        <Pressable
          testID="action-notation-copy"
          accessibilityRole="button"
          style={styles.smallButton}
          onPress={handleCopy}
        >
          <Text style={styles.smallButtonText}>Copy</Text>
        </Pressable>
      </View>

      <Text style={styles.label}>Paste or type action notation</Text>
      <TextInput
        testID="action-notation-input"
        style={styles.input}
        value={input}
        onChangeText={setInput}
        placeholder={'e.g. Raise: AA, KK\nCall: 22-99'}
        placeholderTextColor={colors.text}
        autoCapitalize="none"
        autoCorrect={false}
        multiline
      />
      <View style={styles.actions}>
        <Pressable
          testID="action-notation-paste"
          accessibilityRole="button"
          style={styles.smallButton}
          onPress={handlePaste}
        >
          <Text style={styles.smallButtonText}>Paste</Text>
        </Pressable>
        <Pressable
          testID="action-notation-apply"
          accessibilityRole="button"
          style={styles.applyButton}
          onPress={handleApply}
        >
          <Text style={styles.applyText}>Apply</Text>
        </Pressable>
      </View>
      {error ? (
        <Text testID="action-notation-error" style={styles.error}>
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
