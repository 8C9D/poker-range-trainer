import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { generateHandMatrix, type PokerHand } from '@core/domain/pokerHands';

import { colors } from '../theme/colors';

// The 13×13 grid order comes straight from the reused core matrix (pairs on the
// diagonal, suited upper-right, offsuit lower-left). Built once at module load.
const HAND_MATRIX = generateHandMatrix();

interface HandCellProps {
  hand: PokerHand;
  selected: boolean;
  disabled: boolean;
  onToggleHand: (hand: PokerHand) => void;
}

// Memoized so toggling one hand re-renders only that cell, not all 169. Props are
// primitives plus a handler the parent should keep stable (e.g. via useCallback).
const HandCell = memo(function HandCell({
  hand,
  selected,
  disabled,
  onToggleHand,
}: HandCellProps) {
  return (
    <Pressable
      testID={`hand-cell-${hand}`}
      accessibilityRole="button"
      accessibilityLabel={hand}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={() => onToggleHand(hand)}
      style={[styles.cell, selected ? styles.cellSelected : styles.cellUnselected]}
    >
      <Text
        numberOfLines={1}
        style={[styles.label, selected ? styles.labelSelected : styles.labelUnselected]}
      >
        {hand}
      </Text>
    </Pressable>
  );
});

export interface HandGridProps {
  /** Currently selected hands; the parent owns this state. */
  selected: ReadonlySet<PokerHand>;
  /** Called with a hand when its cell is pressed. */
  onToggleHand: (hand: PokerHand) => void;
  /** When true, cells are non-interactive. */
  disabled?: boolean;
}

/** A controlled 13×13 starting-hand grid with tap-to-toggle selection. */
export function HandGrid({ selected, onToggleHand, disabled = false }: HandGridProps) {
  return (
    <View style={styles.grid}>
      {HAND_MATRIX.map((row, rowIndex) => (
        <View key={rowIndex} style={styles.row}>
          {row.map((hand) => (
            <HandCell
              key={hand}
              hand={hand}
              selected={selected.has(hand)}
              disabled={disabled}
              onToggleHand={onToggleHand}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    width: '100%',
    aspectRatio: 1,
  },
  row: {
    flex: 1,
    flexDirection: 'row',
  },
  cell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  cellSelected: {
    backgroundColor: colors.accent,
  },
  cellUnselected: {
    backgroundColor: colors.surface,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
  },
  labelSelected: {
    color: colors.onAccent,
  },
  labelUnselected: {
    color: colors.text,
  },
});
