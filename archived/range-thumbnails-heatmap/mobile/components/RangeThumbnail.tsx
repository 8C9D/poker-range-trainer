import { StyleSheet, View } from 'react-native';

import { generateHandMatrix } from '@core/domain/pokerHands';
import type { PokerHand } from '@core/domain/pokerHands';

import { useTheme } from '../theme/colors';

// Hand -> grid position, built once from the canonical 13x13 matrix (same source as the
// web RangeThumbnail).
const HAND_POSITIONS: Record<PokerHand, { row: number; col: number }> = (() => {
  const positions: Record<PokerHand, { row: number; col: number }> = {};
  generateHandMatrix().forEach((rowHands, row) => {
    rowHands.forEach((hand, col) => {
      positions[hand] = { row, col };
    });
  });
  return positions;
})();

interface RangeThumbnailProps {
  hands: PokerHand[];
  /** Rendered size in px (square). */
  size?: number;
  /**
   * Accessible name for the chart, e.g. from `describeRangeChart`. Pass it where
   * the chart is the content rather than a thumbnail beside a name.
   */
  label?: string;
}

/**
 * A miniature 13x13 grid of a range: gold cells on the well background. Decorative by
 * default — shown next to the range's name, never instead of it. Given a `label` it
 * becomes an image with that text instead, for the range's own screen where nothing
 * else says which hands are in. Only the in-range cells are drawn (absolutely
 * positioned) so a thumbnail costs ~|hands| views, not 169.
 */
export function RangeThumbnail({ hands, size = 44, label }: RangeThumbnailProps) {
  const theme = useTheme();
  const cell = size / 13;
  return (
    <View
      testID="range-thumbnail"
      accessible={label ? true : undefined}
      accessibilityRole={label ? 'image' : undefined}
      accessibilityLabel={label}
      style={[styles.grid, { width: size, height: size, backgroundColor: theme.well }]}
    >
      {hands.map((hand) => {
        const pos = HAND_POSITIONS[hand];
        if (!pos) return null;
        return (
          <View
            key={hand}
            style={{
              position: 'absolute',
              left: pos.col * cell + cell * 0.12,
              top: pos.row * cell + cell * 0.12,
              width: cell * 0.76,
              height: cell * 0.76,
              borderRadius: cell * 0.18,
              backgroundColor: theme.goldFill,
            }}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { borderRadius: 6, overflow: 'hidden' },
});
