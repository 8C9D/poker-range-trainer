import { StyleSheet, Text, View } from 'react-native';

import type { PokerHand } from '@core/domain/pokerHands';
import {
  TOTAL_HOLDEM_COMBOS,
  calculateRangePercentage,
  countSelectedCombos,
} from '@core/domain/rangeMath';

import { colors } from '../theme/colors';

export interface RangeStatsBarProps {
  /** The selected hands to summarize. */
  hands: PokerHand[];
}

/**
 * Live summary of a range: hand count, specific combos (of 1326), and the share of
 * all Hold'em combos it covers. All math reuses `@core/domain/rangeMath`.
 */
export function RangeStatsBar({ hands }: RangeStatsBarProps) {
  const combos = countSelectedCombos(hands);
  const percent = calculateRangePercentage(hands);
  return (
    <View style={styles.bar}>
      <Text testID="stat-hands" style={styles.stat}>
        {hands.length} {hands.length === 1 ? 'hand' : 'hands'}
      </Text>
      <Text testID="stat-combos" style={styles.stat}>
        {combos}/{TOTAL_HOLDEM_COMBOS} combos
      </Text>
      <Text testID="stat-percent" style={styles.stat}>
        {percent.toFixed(1)}%
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  stat: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
});
