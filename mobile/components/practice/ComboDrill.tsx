import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { drawPracticeCombo } from '@core/domain/blockerPractice';
import { formatCard, type Card, type Suit } from '@core/domain/cards';
import { selectionForRange } from '@core/domain/comboSelection';
import { findSavedRangeById } from '@core/storage/rangeStorage';

import { availabilityForBoard, isBlockerAvailabilityError } from '../blockerDrill';
import { colors } from '../../theme/colors';

const SUIT_SYMBOLS: Record<Suit, string> = { s: '♠', h: '♥', d: '♦', c: '♣' };

/**
 * Blocker-aware combo drill body: type a board (dead cards), see how many of the range's
 * combos survive, and deal a random unblocked one (honoring per-hand combo refinements).
 * Exploratory — no persisted stats. Shared by the flat blocker-drill route and the practice
 * overlay's combo mode.
 */
export function ComboDrill({ id }: { id?: string }) {
  const [range] = useState(() => (id ? findSavedRangeById(id) : undefined));
  const [board, setBoard] = useState('');
  const [combo, setCombo] = useState<Card[] | null>(null);

  const selection = useMemo(
    () => (range ? selectionForRange(range.hands, range.comboSelections) : undefined),
    [range],
  );
  const availability = useMemo(
    () => (range ? availabilityForBoard(range.hands, board, selection) : undefined),
    [range, board, selection],
  );

  if (!range) {
    return <Text style={styles.notFound}>Range not found</Text>;
  }

  function deal() {
    if (!availability || isBlockerAvailabilityError(availability) || availability.remaining === 0) return;
    try {
      setCombo(drawPracticeCombo(range!.hands, availability.dead, selection));
    } catch {
      setCombo(null);
    }
  }

  const error = availability && isBlockerAvailabilityError(availability) ? availability.error : null;
  const remaining = availability && !isBlockerAvailabilityError(availability) ? availability.remaining : 0;

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.hint}>Type a board to remove blocked combos, then deal one.</Text>
      <View style={styles.field}>
        <Text style={styles.label}>Board (dead cards)</Text>
        <TextInput
          testID="blocker-board-input"
          value={board}
          onChangeText={(text) => {
            setBoard(text);
            setCombo(null);
          }}
          placeholder="e.g. AsKd7h"
          placeholderTextColor={colors.text}
          autoCapitalize="characters"
          autoCorrect={false}
          style={styles.input}
        />
      </View>

      {error ? (
        <Text testID="blocker-error" style={styles.error}>
          {error}
        </Text>
      ) : remaining === 0 ? (
        <Text testID="blocker-empty" style={styles.empty}>
          No combos available — every combo is blocked.
        </Text>
      ) : (
        <>
          <Text testID="blocker-remaining" style={styles.remaining}>
            {remaining} combos available
          </Text>
          <Pressable testID="blocker-deal" accessibilityRole="button" style={styles.dealButton} onPress={deal}>
            <Text style={styles.dealButtonText}>Deal a combo</Text>
          </Pressable>
          {combo ? (
            <View testID="blocker-combo" style={styles.combo}>
              {combo.map((card) => (
                <Text
                  key={formatCard(card)}
                  style={[styles.cardText, (card.suit === 'h' || card.suit === 'd') && styles.redSuit]}
                >
                  {card.rank}
                  {SUIT_SYMBOLS[card.suit]}
                </Text>
              ))}
            </View>
          ) : null}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 24, gap: 16 },
  notFound: { color: colors.text, fontSize: 16, marginTop: 32, textAlign: 'center' },
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
  empty: { color: colors.text, fontSize: 15 },
  remaining: { color: colors.accent, fontSize: 16, fontWeight: '700' },
  dealButton: {
    alignSelf: 'flex-start',
    backgroundColor: colors.accent,
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  dealButtonText: { color: colors.onAccent, fontSize: 15, fontWeight: '600' },
  combo: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    alignSelf: 'flex-start',
  },
  cardText: { color: colors.textStrong, fontSize: 32, fontWeight: '700' },
  redSuit: { color: '#f87171' },
});
