import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatCard, type Card, type Suit } from '@core/domain/cards';
import { comboKey, handClassCombos } from '@core/domain/combos';
import { isComboSelected, type ComboSelection } from '@core/domain/comboSelection';
import type { PokerHand } from '@core/domain/pokerHands';

import { colors } from '../theme/colors';

const SUIT_SYMBOLS: Record<Suit, string> = { s: '♠', h: '♥', d: '♦', c: '♣' };

interface ComboSelectorProps {
  /** The hand class whose concrete combos are shown (e.g. "AKs"). */
  hand: PokerHand;
  /** Current selection (a `Set` of `comboKey`s); the source of truth lives in the parent. */
  selection: ComboSelection;
  /** Fired with the toggled combo (two cards); the parent applies `toggleCombo`. */
  onToggle: (combo: Card[]) => void;
}

/**
 * Controlled, presentational grid of the concrete combos for a single hand class — the RN
 * parallel of the web `ComboSelector`. Each combo is a toggle reflecting its on/off state
 * (keyed by `comboKey`, so the order is irrelevant); the parent owns the `ComboSelection` and
 * applies the toggle. All combo logic is reused from `@core` (`handClassCombos`, `comboKey`,
 * `isComboSelected`) — this component holds no state.
 */
export function ComboSelector({ hand, selection, onToggle }: ComboSelectorProps) {
  const combos = handClassCombos(hand);
  const selectedHere = combos.filter((combo) => isComboSelected(selection, combo)).length;

  return (
    <View style={styles.container}>
      <Text testID="combo-selector-count" style={styles.count}>
        {selectedHere}/{combos.length} combos
      </Text>
      <View style={styles.grid}>
        {combos.map((combo) => {
          const key = comboKey(combo);
          const on = isComboSelected(selection, combo);
          return (
            <Pressable
              key={key}
              testID={`combo-cell-${key}`}
              accessibilityRole="button"
              accessibilityLabel={key}
              accessibilityState={{ selected: on }}
              onPress={() => onToggle(combo)}
              style={[styles.cell, on && styles.cellOn]}
            >
              {combo.map((card) => {
                const red = card.suit === 'h' || card.suit === 'd';
                return (
                  <Text
                    key={formatCard(card)}
                    style={[styles.cardText, on ? styles.cardOn : red ? styles.cardRed : styles.cardDefault]}
                  >
                    {card.rank}
                    {SUIT_SYMBOLS[card.suit]}
                  </Text>
                );
              })}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  count: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '700',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
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
  cellOn: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  cardText: {
    fontSize: 18,
    fontWeight: '700',
  },
  cardOn: {
    color: colors.onAccent,
  },
  cardRed: {
    color: '#f87171',
  },
  cardDefault: {
    color: colors.textStrong,
  },
});
