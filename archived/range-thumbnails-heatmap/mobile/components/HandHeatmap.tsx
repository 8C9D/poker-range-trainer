import { StyleSheet, Text, View } from 'react-native';

import { generateHandMatrix } from '@core/domain/pokerHands';
import { accuracyHeatLevel, handAccuracyRate, type HeatLevel } from '@core/domain/practice';
import type { RangeHandAccuracy } from '@core/types/practice';

import { useTheme } from '../theme/colors';
import type { ThemeColors } from '../theme/colors';

// The 13×13 grid order comes straight from the reused core matrix; built once at module load.
const HAND_MATRIX = generateHandMatrix();

interface HandHeatmapProps {
  /** Cumulative per-hand accuracy for the range; hands absent read as untested. */
  accuracy: RangeHandAccuracy;
}

/** Background + label color for one heat level, mirroring the web HandHeatmap heat ramp. */
function heatStyle(level: HeatLevel, theme: ThemeColors): { bg: string; fg: string } {
  switch (level) {
    case 'low':
      return { bg: theme.h1c, fg: theme.ink };
    case 'medium':
      return { bg: theme.h2c, fg: theme.h2cInk };
    case 'high':
      return { bg: theme.h3c, fg: theme.h3cInk };
    case 'untested':
    default:
      return { bg: theme.cellbg, fg: theme.ink3 };
  }
}

/**
 * Read-only 13×13 heatmap of per-hand accuracy for one range: each cell is colored by
 * `accuracyHeatLevel` on the Coach gold heat ramp (untested / low / medium / high), text
 * flipping with the theme. Purely presentational; the level rides `accessibilityValue` for
 * assistive tech + tests.
 */
export function HandHeatmap({ accuracy }: HandHeatmapProps) {
  const theme = useTheme();
  // No label on the grid itself: a View only carries one when it is
  // `accessible`, and making it so would collapse all 169 cells into a single
  // element and lose their per-hand labels. The "Accuracy heatmap" header above
  // it is what names this.
  return (
    <View style={styles.grid}>
      {HAND_MATRIX.map((row, rowIndex) => (
        <View key={rowIndex} style={styles.row}>
          {row.map((hand) => {
            const stat = accuracy[hand];
            const level = accuracyHeatLevel(stat);
            const { bg, fg } = heatStyle(level, theme);
            const label =
              stat && stat.attempts > 0
                ? `${hand} ${handAccuracyRate(stat).toFixed(0)}%`
                : `${hand} untested`;
            return (
              <View
                key={hand}
                testID={`heat-cell-${hand}`}
                // The cell has to be `accessible` to carry its own name; left
                // off, VoiceOver skips it and reads the bare "AA" inside, which
                // is the half of the label that says nothing about accuracy.
                accessible
                accessibilityRole="image"
                accessibilityLabel={label}
                accessibilityValue={{ text: level }}
                style={[styles.cell, { backgroundColor: bg }]}
              >
                <Text numberOfLines={1} style={[styles.label, { color: fg }]}>
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
  grid: { width: '100%', aspectRatio: 1, gap: 2 },
  row: { flex: 1, flexDirection: 'row', gap: 2 },
  cell: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 3 },
  label: { fontSize: 9, fontWeight: '600' },
});
