import { Pressable, StyleSheet, Text, View } from 'react-native';

import { generateHandMatrix, type PokerHand } from '@core/domain/pokerHands';
import { RANGE_ACTION_LABELS, type RangeAction } from '@core/types/range';

import { actionColors } from '../theme/actionColors';
import { useTheme } from '../theme/colors';
import type { ThemeColors } from '../theme/colors';

// The 13×13 grid order comes from the reused core matrix; built once at module load (same
// source as HandGrid / HandHeatmap).
const HAND_MATRIX = generateHandMatrix();

interface ActionGridProps {
  /** Current per-hand action assignments. */
  handActions: Record<PokerHand, RangeAction>;
  /**
   * The hands the range holds. Cells outside it are shown out of the range and
   * cannot be assigned: `hands` is the membership list, so an action there is
   * inert (the quiz skips it, the export does not colour it), and letting the
   * grid paint it made the tab promise something no drill honoured.
   */
  rangeHands: readonly PokerHand[];
  /** The action a tap assigns. */
  activeAction: RangeAction;
  /** Assign `action` to `hand`, or clear it with `null`. */
  onAssign: (hand: PokerHand, action: RangeAction | null) => void;
}

/**
 * A controlled 13×13 grid for assigning a single `RangeAction` per hand. Each cell is
 * colored by its assigned action (via {@link ACTION_COLORS}); tapping a cell assigns the
 * active action, and tapping a cell already set to the active action clears it. Tap-only —
 * drag-paint can be added later, as on `HandGrid`.
 */
export function ActionGrid({
  handActions,
  rangeHands,
  activeAction,
  onAssign,
}: ActionGridProps) {
  const inRange = new Set(rangeHands);
  const theme = useTheme();
  const styles = makeStyles(theme);
  const ACTION_COLORS = actionColors(theme);
  return (
    <View style={styles.grid}>
      {HAND_MATRIX.map((row, rowIndex) => (
        <View key={rowIndex} style={styles.row}>
          {row.map((hand) => {
            const outsideRange = !inRange.has(hand);
            const assigned = outsideRange ? undefined : handActions[hand];
            const isActive = assigned === activeAction;
            return (
              <Pressable
                key={hand}
                testID={`action-cell-${hand}`}
                accessibilityRole="button"
                disabled={outsideRange}
                accessibilityLabel={
                  outsideRange
                    ? `${hand}: not in this range`
                    : assigned
                      ? `${hand}: ${RANGE_ACTION_LABELS[assigned]}`
                      : `${hand}: unassigned`
                }
                accessibilityState={{ selected: assigned !== undefined, disabled: outsideRange }}
                onPress={() => onAssign(hand, isActive ? null : activeAction)}
                style={[
                  styles.cell,
                  { backgroundColor: assigned ? ACTION_COLORS[assigned] : theme.cellbg },
                  outsideRange && styles.cellOutside,
                ]}
              >
                <Text
                  numberOfLines={1}
                  style={[styles.label, assigned ? styles.labelAssigned : styles.labelUnassigned]}
                >
                  {hand}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

function makeStyles(theme: ThemeColors) {
  return StyleSheet.create({
    grid: {
      width: '100%',
      aspectRatio: 1,
    },
    row: {
      flex: 1,
      flexDirection: 'row',
    },
    // Outside the range: inert everywhere else. Marked by dropping the border
    // rather than by fading, so the hand label keeps full contrast — dimming a
    // labelled grid cell to mean "not in range" is what the web guard forbids.
    cellOutside: {
      borderColor: 'transparent',
      backgroundColor: theme.surface,
    },
    cell: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.line,
    },
    label: {
      fontSize: 11,
      fontWeight: '600',
    },
    labelAssigned: {
      color: theme.onAction,
    },
    labelUnassigned: {
      color: theme.ink2,
    },
  });
}
