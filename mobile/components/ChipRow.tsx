import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';

export interface ChipRowProps<T extends string> {
  /** Row label shown above the chips. */
  label: string;
  /** Prefix for each chip's testID (`<prefix>-<value>`). */
  testIdPrefix: string;
  /** Selectable values. */
  options: readonly T[];
  /** Human label for each value. */
  labels: Record<T, string>;
  /** Currently selected value, or undefined. */
  selected: T | undefined;
  /** Called with the value, or undefined when the active chip is tapped to clear. */
  onSelect: (value: T | undefined) => void;
}

/**
 * A labelled row of single-select chips. Tapping a chip selects it; tapping the
 * already-selected chip clears the field. Shared by the metadata editor and the
 * library filters so the chip look/behavior stays consistent.
 */
export function ChipRow<T extends string>({
  label,
  testIdPrefix,
  options,
  labels,
  selected,
  onSelect,
}: ChipRowProps<T>) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.chips}>
        {options.map((option) => {
          const isSelected = selected === option;
          return (
            <Pressable
              key={option}
              testID={`${testIdPrefix}-${option}`}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              style={[styles.chip, isSelected && styles.chipSelected]}
              onPress={() => onSelect(isSelected ? undefined : option)}
            >
              <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                {labels[option]}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: 6,
  },
  label: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipSelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  chipText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  chipTextSelected: {
    color: colors.onAccent,
  },
});
