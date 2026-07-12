import { Pressable, StyleSheet, Text, View } from 'react-native';

import { fonts } from '../theme/fonts';
import { useTheme } from '../theme/colors';

// Shared Coach UI primitives (the RN parallel of `.coach-chip` / `.coach-seg` in
// src/theme.css). Reused by Library, the Range page, and Progress so the chip and
// segmented-control look stays identical across screens.

interface ChipProps {
  label: string;
  /** 'due' tints the chip with the attention accent (never the gold primary fill). */
  tone?: 'default' | 'due';
  testID?: string;
}

/** A static pill for metadata (position, action, size %, Due, Archived). */
export function Chip({ label, tone = 'default', testID }: ChipProps) {
  const theme = useTheme();
  const due = tone === 'due';
  return (
    <View
      testID={testID}
      style={[
        styles.chip,
        {
          borderColor: due ? theme.accent : theme.line,
          backgroundColor: due ? theme.accentSoft : theme.card,
        },
      ]}
    >
      <Text style={[styles.chipText, { color: due ? theme.accentStrong : theme.ink2 }]}>{label}</Text>
    </View>
  );
}

export interface SegmentedOption<T extends string | number> {
  key: T;
  label: string;
}

interface SegmentedProps<T extends string | number> {
  options: readonly SegmentedOption<T>[];
  /** Active key, or undefined when nothing is selected. */
  value: T | undefined;
  /** Called with the tapped key, or undefined when the active key is tapped to clear. */
  onSelect: (value: T | undefined) => void;
  /** Prefix for each option's testID (`<prefix>-<key>`). */
  testIdPrefix: string;
}

/**
 * A single-select segmented control (well track, raised card for the active option).
 * Tapping the active option clears the selection — the mobile equivalent of the web
 * filters' "All …" default. Never gold: selection is a neutral raised state so gold
 * stays reserved for the screen's one primary action.
 */
export function Segmented<T extends string | number>({
  options,
  value,
  onSelect,
  testIdPrefix,
}: SegmentedProps<T>) {
  const theme = useTheme();
  return (
    <View style={[styles.seg, { backgroundColor: theme.well, borderColor: theme.line }]}>
      {options.map((option) => {
        const active = value === option.key;
        return (
          <Pressable
            key={String(option.key)}
            testID={`${testIdPrefix}-${option.key}`}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onSelect(active ? undefined : option.key)}
            style={[styles.segBtn, active && { backgroundColor: theme.card }]}
          >
            <Text
              style={[styles.segText, { color: active ? theme.ink : theme.ink2 }]}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  chipText: { fontFamily: fonts.bodyMedium, fontSize: 12.5, fontVariant: ['tabular-nums'] },
  seg: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    padding: 2,
    gap: 2,
  },
  segBtn: {
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  segText: { fontFamily: fonts.bodyMedium, fontSize: 13.5 },
});
