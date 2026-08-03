import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';

import { formatMixedNotation, parseMixedNotation } from '@core/domain/mixedNotation';
import type { HandMixedStrategy } from '@core/domain/mixedStrategy';
import type { PokerHand } from '@core/domain/pokerHands';

import { useTheme } from '../theme/colors';
import type { ThemeColors } from '../theme/colors';

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
  const theme = useTheme();
  const styles = makeStyles(theme);
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
        placeholderTextColor={theme.ink3}
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
      fontSize: 14,
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
      color: theme.accentStrong,
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
