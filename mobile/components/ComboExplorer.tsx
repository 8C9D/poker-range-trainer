import { useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { formatCard, type Card, type Suit } from '@core/domain/cards';
import { comboKey } from '@core/domain/combos';

import { enumerateCombos, isComboEnumerationError } from './comboEnumeration';
import { colors } from '../theme/colors';

const SUIT_SYMBOLS: Record<Suit, string> = { s: '♠', h: '♥', d: '♦', c: '♣' };

function cardLabel(card: Card): string {
  return `${card.rank}${SUIT_SYMBOLS[card.suit]}`;
}

/**
 * Combo explorer: type a hand class (e.g. "AKs") to see its concrete 2-card combos, and
 * optionally type dead/board cards to see how many survive the blockers. All combo math
 * reuses `@core/domain/combos` (via `enumerateCombos`). Shared by the flat combos route
 * and the Range page's Combos tab.
 */
export function ComboExplorer() {
  const [handInput, setHandInput] = useState('AKs');
  const [deadInput, setDeadInput] = useState('');

  const result = useMemo(() => enumerateCombos(handInput, deadInput), [handInput, deadInput]);
  const error = isComboEnumerationError(result) ? result.error : null;
  const hasDead = deadInput.trim().length > 0;

  return (
    <View style={styles.content}>
      <Text style={styles.hint}>Type a hand to list its concrete combos.</Text>

      <View style={styles.field}>
        <Text style={styles.label}>Hand</Text>
        <TextInput
          testID="combo-hand-input"
          value={handInput}
          onChangeText={setHandInput}
          placeholder="e.g. AKs"
          placeholderTextColor={colors.text}
          autoCapitalize="characters"
          autoCorrect={false}
          style={styles.input}
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Dead cards (optional)</Text>
        <TextInput
          testID="combo-dead-input"
          value={deadInput}
          onChangeText={setDeadInput}
          placeholder="e.g. As Kd 7h"
          placeholderTextColor={colors.text}
          autoCapitalize="characters"
          autoCorrect={false}
          style={styles.input}
        />
      </View>

      {error ? (
        <Text testID="combo-error" style={styles.error}>
          {error}
        </Text>
      ) : isComboEnumerationError(result) ? null : (
        <>
          <Text testID="combo-count" style={styles.count}>
            {hasDead ? `${result.survivingCount} of ${result.total} combos` : `${result.total} combos`}
          </Text>
          <View style={styles.grid}>
            {result.combos.map((combo) => {
              const key = comboKey(combo);
              const removed = result.deadKeys.has(key);
              return (
                <View key={key} testID={`combo-cell-${key}`} style={[styles.cell, removed && styles.cellRemoved]}>
                  {combo.map((card) => (
                    <Text
                      key={formatCard(card)}
                      style={[styles.cardText, (card.suit === 'h' || card.suit === 'd') && styles.redSuit]}
                    >
                      {cardLabel(card)}
                    </Text>
                  ))}
                </View>
              );
            })}
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: 16 },
  hint: { color: colors.text, fontSize: 14 },
  field: { gap: 6 },
  label: { color: colors.textStrong, fontSize: 14, fontWeight: '600' },
  input: {
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: colors.textStrong,
    fontSize: 18,
  },
  error: { color: colors.danger, fontSize: 14 },
  count: { color: colors.accent, fontSize: 16, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  cell: {
    flexDirection: 'row',
    gap: 4,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  cellRemoved: { opacity: 0.3 },
  cardText: { color: colors.textStrong, fontSize: 18, fontWeight: '700' },
  redSuit: { color: '#f87171' },
});
