import { Pressable, StyleSheet, Text, View } from 'react-native';

import { RANGE_ACTIONS, RANGE_ACTION_LABELS, type RangeAction } from '@core/types/range';

import { actionColors } from '../theme/actionColors';
import { useTheme } from '../theme/colors';
import type { ThemeColors } from '../theme/colors';

interface ActionPaletteProps {
  /** The currently active action — taps on the grid assign this. */
  active: RangeAction;
  /** Select a different active action. */
  onSelect: (action: RangeAction) => void;
}

/**
 * A required single-select row of action chips (`@core` `RANGE_ACTIONS`). The active chip is
 * filled with that action's color so the palette doubles as the grid's color legend. Unlike
 * `ChipRow`, there is always exactly one selection (no clearing).
 */
export function ActionPalette({ active, onSelect }: ActionPaletteProps) {
  const theme = useTheme();
  const styles = makeStyles(theme);
  const ACTION_COLORS = actionColors(theme);
  return (
    <View style={styles.row}>
      {RANGE_ACTIONS.map((action) => {
        const selected = active === action;
        return (
          <Pressable
            key={action}
            testID={`action-chip-${action}`}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            style={[
              styles.chip,
              selected ? { backgroundColor: ACTION_COLORS[action], borderColor: ACTION_COLORS[action] } : null,
            ]}
            onPress={() => onSelect(action)}
          >
            <Text style={[styles.chipText, selected && styles.chipTextActive]}>
              {RANGE_ACTION_LABELS[action]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function makeStyles(theme: ThemeColors) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    chip: {
      backgroundColor: theme.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.line,
      borderRadius: 14,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    chipText: {
      color: theme.ink2,
      fontSize: 13,
      fontWeight: '600',
    },
    chipTextActive: {
      color: theme.onAction,
    },
  });
}
