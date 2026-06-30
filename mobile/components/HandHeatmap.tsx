import { StyleSheet, Text, View } from 'react-native';

import { generateHandMatrix } from '@core/domain/pokerHands';
import { accuracyHeatLevel, handAccuracyRate, type HeatLevel } from '@core/domain/practice';
import type { RangeHandAccuracy } from '@core/types/practice';

import { colors } from '../theme/colors';

// The 13×13 grid order comes straight from the reused core matrix; built once at
// module load (same source as HandGrid).
const HAND_MATRIX = generateHandMatrix();

interface HandHeatmapProps {
  /** Cumulative per-hand accuracy for the range; hands absent read as untested. */
  accuracy: RangeHandAccuracy;
}

/**
 * Read-only 13×13 heatmap of per-hand accuracy for one range: each cell is colored by
 * `accuracyHeatLevel` (untested / low / medium / high), mirroring the web's
 * `HandHeatmap`. Purely presentational — unlike `HandGrid`, cells are non-interactive.
 * The level is exposed via `accessibilityValue` (the RN parallel of the web's
 * `data-heat`) so assistive tech and tests can read it; the cumulative rate goes in the
 * accessibility label.
 */
export function HandHeatmap({ accuracy }: HandHeatmapProps) {
  return (
    <View style={styles.grid} accessibilityLabel="Accuracy heatmap">
      {HAND_MATRIX.map((row, rowIndex) => (
        <View key={rowIndex} style={styles.row}>
          {row.map((hand) => {
            const stat = accuracy[hand];
            const level = accuracyHeatLevel(stat);
            const label =
              stat && stat.attempts > 0
                ? `${hand} ${handAccuracyRate(stat).toFixed(0)}%`
                : `${hand} untested`;
            return (
              <View
                key={hand}
                testID={`heat-cell-${hand}`}
                accessibilityLabel={label}
                accessibilityValue={{ text: level }}
                style={[styles.cell, HEAT_CELL[level]]}
              >
                <Text numberOfLines={1} style={[styles.label, HEAT_LABEL[level]]}>
                  {hand}
                </Text>
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    width: '100%',
    aspectRatio: 1,
    gap: 2,
  },
  row: {
    flex: 1,
    flexDirection: 'row',
    gap: 2,
  },
  cell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 3,
  },
  label: {
    fontSize: 9,
    fontWeight: '600',
  },
  // Heat backgrounds + label colors mirror the web HandHeatmap dark palette.
  cellUntested: {
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  cellLow: { backgroundColor: '#da3633' },
  cellMedium: { backgroundColor: '#bb8009' },
  cellHigh: { backgroundColor: '#238636' },
  labelUntested: { color: colors.text },
  labelLow: { color: '#ffffff' },
  labelMedium: { color: '#1c1400' },
  labelHigh: { color: '#ffffff' },
});

// Exhaustive level → style maps (`satisfies` guarantees every HeatLevel is covered).
const HEAT_CELL = {
  untested: styles.cellUntested,
  low: styles.cellLow,
  medium: styles.cellMedium,
  high: styles.cellHigh,
} satisfies Record<HeatLevel, unknown>;

const HEAT_LABEL = {
  untested: styles.labelUntested,
  low: styles.labelLow,
  medium: styles.labelMedium,
  high: styles.labelHigh,
} satisfies Record<HeatLevel, unknown>;
