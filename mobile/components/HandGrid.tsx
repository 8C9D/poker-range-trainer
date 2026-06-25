import { memo, useEffect, useMemo, useRef } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { generateHandMatrix, type PokerHand } from '@core/domain/pokerHands';

import { colors } from '../theme/colors';

// The 13×13 grid order comes straight from the reused core matrix (pairs on the
// diagonal, suited upper-right, offsuit lower-left). Built once at module load.
const HAND_MATRIX = generateHandMatrix();
const MATRIX_SIZE = HAND_MATRIX.length; // 13

/**
 * Map a touch point (relative to the square grid's top-left) to the hand under it,
 * or `null` when the point falls outside the grid. Pure and matrix-driven so the
 * drag-paint mapping can be unit-tested without React or gestures. `side` is the
 * grid's measured pixel side length.
 */
export function handAtPoint(x: number, y: number, side: number): PokerHand | null {
  if (side <= 0) return null;
  const cell = side / MATRIX_SIZE;
  const col = Math.floor(x / cell);
  const row = Math.floor(y / cell);
  if (row < 0 || row >= MATRIX_SIZE || col < 0 || col >= MATRIX_SIZE) return null;
  return HAND_MATRIX[row][col];
}

interface HandCellProps {
  hand: PokerHand;
  selected: boolean;
  disabled: boolean;
  onSetSelected: (hand: PokerHand, selected: boolean) => void;
}

// Memoized so toggling one hand re-renders only that cell, not all 169. Props are
// primitives plus a handler the parent should keep stable (e.g. via useCallback).
const HandCell = memo(function HandCell({
  hand,
  selected,
  disabled,
  onSetSelected,
}: HandCellProps) {
  return (
    <Pressable
      testID={`hand-cell-${hand}`}
      accessibilityRole="button"
      accessibilityLabel={hand}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={() => onSetSelected(hand, !selected)}
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
  /** Set a hand's membership (used by both tap and drag-paint). */
  onSetSelected: (hand: PokerHand, selected: boolean) => void;
  /** When true, cells are non-interactive and drag-paint is disabled. */
  disabled?: boolean;
}

/**
 * A controlled 13×13 starting-hand grid with tap-to-toggle and drag-to-paint.
 *
 * Paint model (matching the web grid): the first cell touched in a drag decides
 * the mode — touch an unselected hand to select, a selected hand to deselect — and
 * every hand crossed is *set* to that one target state (idempotent, not a toggle),
 * so re-entering a hand mid-drag never flips it.
 */
export function HandGrid({ selected, onSetSelected, disabled = false }: HandGridProps) {
  const sideRef = useRef(0);
  const paintModeRef = useRef(false);
  const paintedRef = useRef<Set<PokerHand>>(new Set());
  // Keep the latest selection + setter in refs (synced in an effect, never during
  // render) so the long-lived gesture callbacks read current values without the
  // gesture being rebuilt on every selection change.
  const selectedRef = useRef(selected);
  const onSetSelectedRef = useRef(onSetSelected);
  useEffect(() => {
    selectedRef.current = selected;
    onSetSelectedRef.current = onSetSelected;
  });

  /* eslint-disable react-hooks/refs -- gesture callbacks run at gesture time, never
     during render; they read refs for per-drag state and the latest props. */
  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(!disabled)
        // A stationary tap stays a Pressable press; only real movement activates
        // the pan, so taps are never applied twice.
        .activeOffsetX([-10, 10])
        .activeOffsetY([-10, 10])
        .onStart((e) => {
          const hand = handAtPoint(e.x, e.y, sideRef.current);
          if (hand === null) return;
          paintModeRef.current = !selectedRef.current.has(hand);
          paintedRef.current = new Set([hand]);
          onSetSelectedRef.current(hand, paintModeRef.current);
        })
        .onUpdate((e) => {
          const hand = handAtPoint(e.x, e.y, sideRef.current);
          if (hand === null || paintedRef.current.has(hand)) return;
          paintedRef.current.add(hand);
          onSetSelectedRef.current(hand, paintModeRef.current);
        })
        .onFinalize(() => {
          paintedRef.current = new Set();
        }),
    [disabled],
  );
  /* eslint-enable react-hooks/refs */

  function handleLayout(e: LayoutChangeEvent): void {
    sideRef.current = e.nativeEvent.layout.width;
  }

  return (
    <GestureDetector gesture={panGesture}>
      <View style={styles.grid} onLayout={handleLayout}>
        {HAND_MATRIX.map((row, rowIndex) => (
          <View key={rowIndex} style={styles.row}>
            {row.map((hand) => (
              <HandCell
                key={hand}
                hand={hand}
                selected={selected.has(hand)}
                disabled={disabled}
                onSetSelected={onSetSelected}
              />
            ))}
          </View>
        ))}
      </View>
    </GestureDetector>
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
